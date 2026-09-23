/**
 * Walk Nepal Walk - MapMiners & Community Trails Cloudflare Worker
 * Dedicated service for parsing GPX files, tracking community map submissions, and R2 trail downloads.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Admin-Email',
};

function jsonResponse(data, status = 200, customHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...customHeaders,
    },
  });
}

function errorResponse(errorMsg, status = 500) {
  return jsonResponse({ success: false, error: errorMsg }, status);
}

// Native Cloudflare Edge Cache API Helpers (Zero-Cost RAM Caching at the Edge)
async function matchEdgeCache(request) {
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      return await caches.default.match(request);
    }
  } catch (_) {}
  return null;
}

async function putEdgeCache(request, response, ctx, ttlSeconds = 300) {
  try {
    if (typeof caches !== 'undefined' && caches.default && response && response.ok) {
      const cloned = response.clone();
      const cachedResponse = new Response(cloned.body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers: new Headers(cloned.headers)
      });
      cachedResponse.headers.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      cachedResponse.headers.set('X-Edge-Cache', 'HIT');
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(caches.default.put(request, cachedResponse));
      } else {
        await caches.default.put(request, cachedResponse);
      }
    }
  } catch (_) {}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/+/g, '/');

    // Handle OPTIONS Preflight CORS Request
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // ===== MAPMINERS / COMMUNITY TRAILS ENDPOINTS =====

      // GET /mapminers/trails or GET /community_trails or GET /trails - List trails
      if (method === 'GET' && (path === '/mapminers/trails' || path === '/community_trails' || path === '/trails')) {
        if (!env.DB) {
          return jsonResponse({ success: false, error: "Cloudflare D1 Database binding 'DB' is missing in wrangler-mapminers.toml or Cloudflare dashboard settings" });
        }

        const isFresh = url.searchParams.has('fresh');
        if (!isFresh) {
          const cached = await matchEdgeCache(request);
          if (cached) return cached;
        }

        let results = [];
        try {
          const res = await env.DB.prepare('SELECT * FROM community_trails ORDER BY uploaded_at DESC').all();
          results = res.results || [];
        } catch (e) {
          return jsonResponse({ success: false, error: "D1 Query Error: " + (e instanceof Error ? e.message : String(e)) });
        }

        const data = results.map((r) => ({
          ...r,
          file_name: r.file_name || r.fileName,
          fileName: r.fileName || r.file_name,
          contributor_email: r.contributor_email || r.contributorEmail,
          contributorEmail: r.contributorEmail || r.contributor_email,
          file_size: r.file_size || r.fileSize || 0,
          fileSize: r.fileSize || r.file_size || 0,
          status: r.status || 'approved',
        }));

        const resp = jsonResponse({ success: true, data }, 200, {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Edge-Cache': 'MISS'
        });
        await putEdgeCache(request, resp, ctx, 300);
        return resp;
      }

      // PATCH /mapminers/trails/:id or PATCH /community_trails/:id - Update trail status (Approve / Reject)
      const patchTrailMatch = path.match(/^\/(mapminers|community_trails)(\/trails)?\/([^/]+)$/);
      if (method === 'PATCH' && patchTrailMatch) {
        const trailId = decodeURIComponent(patchTrailMatch[3]);
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        const body = await request.json();
        const status = body.status;
        if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
          return errorResponse('Invalid status. Must be approved, rejected, or pending.', 400);
        }

        await env.DB.prepare('UPDATE community_trails SET status = ? WHERE id = ? OR file_name = ?')
          .bind(status, trailId, trailId)
          .run();

        return jsonResponse({
          success: true,
          message: `Trail ${trailId} status updated to ${status}`,
          id: trailId,
          status
        });
      }

      // DELETE /mapminers/trails/:id or DELETE /community_trails/:id - Delete from D1 AND Cloudflare R2
      const deleteTrailMatch = path.match(/^\/(mapminers|community_trails)(\/trails)?\/([^/]+)$/);
      if (method === 'DELETE' && deleteTrailMatch) {
        const trailId = decodeURIComponent(deleteTrailMatch[3]);
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        // 1. Find the trail in D1 to get the exact file_name stored in R2
        let fileName = null;
        try {
          const row = await env.DB.prepare('SELECT file_name FROM community_trails WHERE id = ? OR file_name = ?')
            .bind(trailId, trailId)
            .first();
          if (row && row.file_name) {
            fileName = row.file_name;
          }
        } catch (err) {
          console.warn('Could not query trail for deletion:', err);
        }

        // 2. Permanently delete the file from Cloudflare R2 storage bucket
        const bucket = env.TRAILS_BUCKET || env.BUCKET;
        let r2Deleted = false;
        if (bucket && fileName) {
          try {
            await bucket.delete(fileName);
            r2Deleted = true;
            console.log(`✅ Permanently deleted ${fileName} from Cloudflare R2 bucket`);
          } catch (r2Err) {
            console.error(`❌ Failed to delete ${fileName} from R2 bucket:`, r2Err);
          }
        }

        // 3. Permanently delete the record from Cloudflare D1
        await env.DB.prepare('DELETE FROM community_trails WHERE id = ? OR file_name = ?')
          .bind(trailId, trailId)
          .run();

        return jsonResponse({
          success: true,
          message: `Trail ${trailId} deleted from D1 and R2`,
          id: trailId,
          fileName,
          r2Deleted
        });
      }

      // ===== TRAIL COMMENTS ENDPOINTS =====

      // GET /mapminers/comments or GET /community_trails/comments or GET /comments - Fetch comments for trail
      if (method === 'GET' && (path === '/mapminers/comments' || path === '/community_trails/comments' || path === '/comments')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        const trailId = url.searchParams.get('trailId') || url.searchParams.get('trail_id') || '';
        try {
          // Ensure table exists
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS trail_comments (
              id TEXT PRIMARY KEY,
              trail_id TEXT NOT NULL,
              text TEXT NOT NULL,
              author_name TEXT,
              author_email TEXT,
              guest_session_id TEXT,
              timestamp INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          let sql = 'SELECT * FROM trail_comments';
          const params = [];
          if (trailId) {
            sql += ' WHERE trail_id = ?';
            params.push(trailId);
          }
          sql += ' ORDER BY timestamp ASC LIMIT 200';

          const res = await env.DB.prepare(sql).bind(...params).all();
          const comments = (res.results || []).map(r => ({
            id: r.id,
            trailId: r.trail_id,
            text: r.text,
            authorName: r.author_name || 'Anonymous',
            authorEmail: r.author_email || '',
            guestSessionId: r.guest_session_id || null,
            timestamp: Number(r.timestamp) || Date.now()
          }));

          return jsonResponse({ success: true, comments, count: comments.length });
        } catch (err) {
          console.warn('Error querying trail_comments in D1:', err);
          return jsonResponse({ success: true, comments: [], error: err.message });
        }
      }

      // POST /mapminers/comments or POST /community_trails/comments or POST /comments - Create comment
      if (method === 'POST' && (path === '/mapminers/comments' || path === '/community_trails/comments' || path === '/comments')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        const body = await request.json().catch(() => ({}));
        const commentId = body.id || `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const trailId = body.trailId || body.trail_id || '';
        const text = body.text || '';
        const authorName = body.authorName || body.author_name || 'Hiker';
        const authorEmail = body.authorEmail || body.author_email || '';
        const guestSessionId = body.guestSessionId || body.guest_session_id || null;
        const timestamp = Number(body.timestamp) || Date.now();

        if (!trailId || !text) {
          return errorResponse('trailId and text are required', 400);
        }

        try {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS trail_comments (
              id TEXT PRIMARY KEY,
              trail_id TEXT NOT NULL,
              text TEXT NOT NULL,
              author_name TEXT,
              author_email TEXT,
              guest_session_id TEXT,
              timestamp INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          await env.DB.prepare(`
            INSERT INTO trail_comments (id, trail_id, text, author_name, author_email, guest_session_id, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(commentId, trailId, text, authorName, authorEmail, guestSessionId, timestamp).run();

          return jsonResponse({
            success: true,
            message: 'Comment posted successfully',
            comment: {
              id: commentId,
              trailId,
              text,
              authorName,
              authorEmail,
              guestSessionId,
              timestamp
            }
          });
        } catch (err) {
          console.error('Error saving trail comment to D1:', err);
          return errorResponse(`Failed to save comment: ${err.message}`, 500);
        }
      }

      // DELETE /mapminers/comments/:id or DELETE /comments/:id
      if (method === 'DELETE' && (path.startsWith('/mapminers/comments/') || path.startsWith('/community_trails/comments/') || path.startsWith('/comments/'))) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        const commentId = decodeURIComponent(path.replace(/^\/(mapminers|community_trails)?\/?comments\//, ''));
        try {
          await env.DB.prepare('DELETE FROM trail_comments WHERE id = ?').bind(commentId).run();
          return jsonResponse({ success: true, message: `Comment ${commentId} deleted` });
        } catch (err) {
          return errorResponse(`Failed to delete comment: ${err.message}`, 500);
        }
      }

      // GET /images/:fileName - Serve trail preview images from TRAILS_BUCKET only
      if (method === 'GET' && (path.startsWith('/images/') || path.startsWith('/mapminers/images/') || path.startsWith('/community_trails/images/'))) {
        const fileName = decodeURIComponent(path.replace(/^\/(mapminers|community_trails)?\/?images\//, ''));
        const bucket = env.TRAILS_BUCKET;
        if (!bucket) return errorResponse('R2 Storage binding TRAILS_BUCKET missing', 500);

        const object = await bucket.get(fileName);
        if (!object) {
          return errorResponse('Image not found in R2 storage', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        
        let contentType = 'image/jpeg';
        if (fileName.endsWith('.png')) contentType = 'image/png';
        else if (fileName.endsWith('.webp')) contentType = 'image/webp';
        else if (fileName.endsWith('.gif')) contentType = 'image/gif';
        
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // GET /mapminers/download/:fileName or GET /download/:fileName - Download file from R2
      if (method === 'GET' && (path.startsWith('/mapminers/download/') || path.startsWith('/community_trails/download/') || path.startsWith('/download/'))) {
        const fileName = decodeURIComponent(path.replace(/^\/(mapminers\/|community_trails\/)?download\//, ''));
        const bucket = env.TRAILS_BUCKET || env.BUCKET;
        if (!bucket) return errorResponse('R2 Storage binding BUCKET missing', 500);

        const object = await bucket.get(fileName);
        if (!object) {
          return errorResponse('Trail file not found in R2 storage', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Type', headers.get('Content-Type') || 'application/xml');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=2592000, immutable');

        return new Response(object.body, { headers });
      }

      // POST /mapminers/upload or POST /community_trails/upload or POST /upload (Fills all snake_case and camelCase metadata)
      if (method === 'POST' && (path === '/mapminers/upload' || path === '/community_trails/upload' || path === '/upload')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        // MapMiners MUST only use TRAILS_BUCKET for GPS/KML files, never Core's BUCKET
        const bucket = env.TRAILS_BUCKET;

        const contentType = request.headers.get('content-type') || '';
        let fileName = '';
        let fileContent = '';
        let trailName = '';
        let contributorEmail = '';
        let body = {};

        if (contentType.includes('application/json')) {
          body = await request.json();
          fileName = body.file_name || body.fileName || `trail_${Date.now()}.gpx`;
          fileContent = body.fileContent || body.file_content || '';
          trailName = body.name || fileName;
          contributorEmail = body.contributor_email || body.contributorEmail || '';
        } else {
          return errorResponse('Please upload JSON payload with fileName and fileContent', 400);
        }

        // Convert string fileContent to Uint8Array binary buffer for R2 storage
        let uploadedToR2 = false;
        if (bucket && fileContent) {
          try {
            const buffer = new TextEncoder().encode(fileContent);
            await bucket.put(fileName, buffer, {
              httpMetadata: { contentType: 'application/xml' },
            });
            uploadedToR2 = true;
            console.log(`✅ Uploaded ${fileName} to R2 bucket (${buffer.byteLength} bytes)`);
          } catch (r2Err) {
            console.error(`❌ R2 storage upload failed for ${fileName}:`, r2Err);
          }
        }

        // Extract metadata fields sent from frontend
        const description = body.description || '';
        const difficulty = body.difficulty || 'Moderate';
        const stats = body.stats || {};
        const distance = Number(stats.distance || 0);
        const elevation_gain = Number(stats.elevationGain || stats.elevation_gain || 0);
        const elevation_loss = Number(stats.elevationLoss || stats.elevation_loss || 0);
        const min_elevation = Number(stats.minElevation || stats.min_elevation || 0);
        const max_elevation = Number(stats.maxElevation || stats.max_elevation || 0);
        const estimated_hours = Number(stats.estimatedHours || stats.estimated_hours || 0);
        const bounds = typeof body.bounds === 'string' ? body.bounds : JSON.stringify(body.bounds || []);
        const start_pos = typeof body.startPos === 'string' ? body.startPos : (typeof body.start_pos === 'string' ? body.start_pos : JSON.stringify(body.startPos || body.start_pos || { lat: 27.7, lng: 85.3 }));
        const contributor_name = body.contributorName || body.contributor_name || 'Map Miner';
        const contributor_email = body.contributorEmail || body.contributor_email || contributorEmail || '';
        const province = body.province || '';
        const district = body.district || '';
        const nearby_city = body.nearbyCity || body.nearby_city || '';
        const highlights = body.highlights || '';
        const trailId = body.id || `trail_${Date.now()}`;
        const status = body.status || 'pending';

        // Try full column insert first, and fall back to minimal core columns if D1 table lacks extra columns
        try {
          await env.DB.prepare(`
            INSERT INTO community_trails (
              id, file_name, name, description, difficulty, distance,
              elevation_gain, elevation_loss, min_elevation, max_elevation,
              estimated_hours, bounds, start_pos, contributor_name, contributor_email,
              province, district, nearby_city, highlights, uploaded_at, file_size, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
          `).bind(
            trailId,
            fileName,
            trailName,
            description,
            difficulty,
            distance,
            elevation_gain,
            elevation_loss,
            min_elevation,
            max_elevation,
            estimated_hours,
            bounds,
            start_pos,
            contributor_name,
            contributor_email,
            province,
            district,
            nearby_city,
            highlights,
            fileContent.length,
            status
          ).run();
        } catch (d1Err) {
          console.warn('Full D1 insert failed, trying minimal core columns fallback:', d1Err);
          await env.DB.prepare(`
            INSERT INTO community_trails (
              id, file_name, name, description, difficulty, distance, bounds, start_pos, contributor_email, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            trailId,
            fileName,
            trailName,
            description,
            difficulty,
            distance,
            bounds,
            start_pos,
            contributor_email,
            status
          ).run();
        }

        return jsonResponse({ success: true, message: 'Trail uploaded successfully to D1', id: trailId, fileName });
      }

      return errorResponse(`Route ${method} ${path} not found in MapMiners Worker`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  }
};
