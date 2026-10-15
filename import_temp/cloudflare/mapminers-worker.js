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

        try {
          if (typeof caches !== 'undefined' && caches.default) {
            await caches.default.delete(new Request(new URL('/mapminers/trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/community_trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/trails', request.url).toString()));
          }
        } catch (_) {}

        return jsonResponse({
          success: true,
          message: `Trail ${trailId} status updated to ${status}`,
          id: trailId,
          status
        }, 200, {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
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

        try {
          if (typeof caches !== 'undefined' && caches.default) {
            await caches.default.delete(new Request(new URL('/mapminers/trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/community_trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/trails', request.url).toString()));
          }
        } catch (_) {}

        return jsonResponse({
          success: true,
          message: `Trail ${trailId} deleted from D1 and R2`,
          id: trailId,
          fileName,
          r2Deleted
        }, 200, {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
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
            const existingObj = await bucket.head(fileName).catch(() => null);
            if (existingObj) {
              fileName = `${Date.now()}_${fileName}`;
            }
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

        try {
          if (typeof caches !== 'undefined' && caches.default) {
            await caches.default.delete(new Request(new URL('/mapminers/trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/community_trails', request.url).toString()));
            await caches.default.delete(new Request(new URL('/trails', request.url).toString()));
          }
        } catch (_) {}

        return jsonResponse({ success: true, message: 'Trail uploaded successfully to D1', id: trailId, fileName });
      }

      // ===== USER ACTIVITIES (GPX R2 UPLOAD + D1 PERSISTENCE) =====

      // Helper to format coordinate track array into a standard GPX 1.1 XML string
      const formatCoordinatesToGpx = (coordinates = [], meta = {}) => {
        const escapeXml = (str) =>
          String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        const title = escapeXml(meta.trailName || meta.name || 'Hike Activity');
        const desc = escapeXml(meta.description || `Recorded by ${meta.userName || meta.userEmail || 'Hiker'}`);
        const timeIso = escapeXml(meta.startTime || new Date().toISOString());

        const trkpts = (Array.isArray(coordinates) ? coordinates : [])
          .map((pt) => {
            const lat = Array.isArray(pt) ? Number(pt[0]) : Number(pt.lat ?? pt.latitude);
            const lon = Array.isArray(pt) ? Number(pt[1]) : Number(pt.lng ?? pt.lon ?? pt.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';

            const ele = Array.isArray(pt) ? pt[2] : (pt.ele ?? pt.elevation ?? pt.altitude);
            const rawTime = Array.isArray(pt) ? pt[3] : (pt.time ?? pt.timestamp);

            let childTags = '';
            if (ele !== undefined && ele !== null && Number.isFinite(Number(ele))) {
              childTags += `<ele>${Number(ele).toFixed(1)}</ele>`;
            }
            if (rawTime) {
              const iso = typeof rawTime === 'number' ? new Date(rawTime).toISOString() : String(rawTime);
              childTags += `<time>${escapeXml(iso)}</time>`;
            }
            return `      <trkpt lat="${lat}" lon="${lon}">${childTags}</trkpt>`;
          })
          .filter(Boolean)
          .join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Walk Nepal Walk - MapMiners" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <desc>${desc}</desc>
    <time>${timeIso}</time>
  </metadata>
  <trk>
    <name>${title}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
      };

      const ensureUserActivitiesTable = async (db) => {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS user_activities (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_name TEXT,
            user_email TEXT,
            trail_id TEXT,
            trail_name TEXT,
            distance REAL DEFAULT 0,
            duration INTEGER DEFAULT 0,
            elevation_gain REAL DEFAULT 0,
            elevation_loss REAL DEFAULT 0,
            avg_speed REAL DEFAULT 0,
            pace TEXT,
            calories INTEGER DEFAULT 0,
            points_count INTEGER DEFAULT 0,
            start_time TEXT,
            end_time TEXT,
            gpx_file_name TEXT,
            gpx_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      };

      // POST /mapminers/activities or POST /user_activities or POST /activities
      // Step B: Formats coordinate track to GPX -> Uploads to R2 -> Inserts row into D1 user_activities table
      if (
        method === 'POST' &&
        (path === '/mapminers/activities' ||
          path === '/mapminers/user_activities' ||
          path === '/user_activities' ||
          path === '/activities')
      ) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);
        const bucket = env.TRAILS_BUCKET || env.BUCKET;
        if (!bucket) return errorResponse('R2 Storage binding (TRAILS_BUCKET) missing', 500);

        const body = await request.json().catch(() => ({}));
        const coordinates = body.coordinates || body.track || body.points || [];
        const rawGpx = body.gpxContent || body.gpx_content || body.fileContent || '';

        if ((!Array.isArray(coordinates) || coordinates.length === 0) && !rawGpx) {
          return errorResponse('Coordinate track (coordinates array) or gpxContent is required', 400);
        }

        const activityId = body.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const userId = body.userId || body.user_id || body.uid || '';
        const userName = body.userName || body.user_name || 'Hiker';
        const userEmail = body.userEmail || body.user_email || '';
        const trailId = body.trailId || body.trail_id || '';
        const trailName = body.trailName || body.trail_name || body.name || 'Recorded Hike';

        const metrics = body.metrics || body.stats || {};
        const distance = Number(body.distance ?? metrics.distance ?? 0);
        const duration = Number(body.duration ?? metrics.duration ?? 0);
        const elevationGain = Number(body.elevationGain ?? body.elevation_gain ?? metrics.elevationGain ?? metrics.elevation_gain ?? 0);
        const elevationLoss = Number(body.elevationLoss ?? body.elevation_loss ?? metrics.elevationLoss ?? metrics.elevation_loss ?? 0);
        const avgSpeed = Number(body.avgSpeed ?? body.avg_speed ?? metrics.avgSpeed ?? metrics.avg_speed ?? 0);
        const pace = String(body.pace ?? metrics.pace ?? '');
        const calories = Number(body.calories ?? metrics.calories ?? 0);
        const pointsCount = Array.isArray(coordinates) ? coordinates.length : Number(body.pointsCount ?? body.points_count ?? 0);
        const startTime = body.startTime || body.start_time || new Date().toISOString();
        const endTime = body.endTime || body.end_time || new Date().toISOString();

        // 1. Format coordinate track into GPX XML string
        const gpxXml = rawGpx || formatCoordinatesToGpx(coordinates, {
          trailName,
          userName,
          userEmail,
          startTime,
        });

        // 2. Upload GPX file to R2 Bucket and confirm upload before D1 insert
        const gpxFileName = body.fileName || body.file_name || `activity_${activityId}.gpx`;
        const gpxBuffer = new TextEncoder().encode(gpxXml);

        const r2Result = await bucket.put(gpxFileName, gpxBuffer, {
          httpMetadata: { contentType: 'application/gpx+xml' },
        });

        if (!r2Result) {
          return errorResponse('R2 upload failed: no confirmation returned from bucket', 500);
        }

        const gpxUrl = `${url.origin}/mapminers/download/${encodeURIComponent(gpxFileName)}`;

        // 3. Once R2 confirms upload, insert a new row into D1 user_activities table
        await ensureUserActivitiesTable(env.DB);

        await env.DB.prepare(`
          INSERT INTO user_activities (
            id, user_id, user_name, user_email, trail_id, trail_name,
            distance, duration, elevation_gain, elevation_loss, avg_speed,
            pace, calories, points_count, start_time, end_time,
            gpx_file_name, gpx_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          activityId,
          userId,
          userName,
          userEmail,
          trailId,
          trailName,
          distance,
          duration,
          elevationGain,
          elevationLoss,
          avgSpeed,
          pace,
          calories,
          pointsCount,
          startTime,
          endTime,
          gpxFileName,
          gpxUrl
        ).run();

        return jsonResponse({
          success: true,
          message: 'Activity GPX uploaded to R2 and saved to D1 user_activities',
          activity: {
            id: activityId,
            user_id: userId,
            user_name: userName,
            user_email: userEmail,
            trail_id: trailId,
            trail_name: trailName,
            distance,
            duration,
            elevation_gain: elevationGain,
            elevation_loss: elevationLoss,
            avg_speed: avgSpeed,
            pace,
            calories,
            points_count: pointsCount,
            start_time: startTime,
            end_time: endTime,
            gpx_file_name: gpxFileName,
            gpx_url: gpxUrl,
          },
        });
      }

      // GET /mapminers/activities or GET /user_activities or GET /activities - Fetch recorded user activities
      if (
        method === 'GET' &&
        (path === '/mapminers/activities' ||
          path === '/mapminers/user_activities' ||
          path === '/user_activities' ||
          path === '/activities')
      ) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        await ensureUserActivitiesTable(env.DB);

        const userEmail = url.searchParams.get('user_email') || url.searchParams.get('email') || '';
        const userId = url.searchParams.get('user_id') || url.searchParams.get('userId') || '';
        const trailId = url.searchParams.get('trail_id') || url.searchParams.get('trailId') || '';

        let sql = 'SELECT * FROM user_activities';
        const conditions = [];
        const params = [];

        if (userEmail) {
          conditions.push('LOWER(user_email) = LOWER(?)');
          params.push(userEmail);
        }
        if (userId) {
          conditions.push('user_id = ?');
          params.push(userId);
        }
        if (trailId) {
          conditions.push('trail_id = ?');
          params.push(trailId);
        }
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY created_at DESC LIMIT 200';

        const res = await env.DB.prepare(sql).bind(...params).all();
        return jsonResponse({
          success: true,
          activities: res.results || [],
        });
      }

      // ===== SAVED TRAILS (MY MAPS BOOKMARKS) ENDPOINTS =====
      const ensureSavedTrailsTable = async (db) => {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS saved_trails (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            trail_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      };

      // GET /mapminers/saved?email=...
      if (method === 'GET' && (path === '/mapminers/saved' || path === '/saved_trails' || path === '/saved')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);
        const email = (url.searchParams.get('email') || url.searchParams.get('user_email') || '').trim().toLowerCase();
        if (!email) return jsonResponse({ success: true, trailIds: [] });

        await ensureSavedTrailsTable(env.DB);
        const res = await env.DB.prepare(
          'SELECT trail_id FROM saved_trails WHERE LOWER(user_email) = LOWER(?) ORDER BY created_at DESC'
        ).bind(email).all();

        const trailIds = (res.results || []).map((r) => r.trail_id).filter(Boolean);
        return jsonResponse({ success: true, trailIds });
      }

      // POST /mapminers/saved - Save a trail to user's My Maps
      if (method === 'POST' && (path === '/mapminers/saved' || path === '/saved_trails' || path === '/saved')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || body.user_email || '').trim().toLowerCase();
        const trailId = String(body.trailId || body.trail_id || '').trim();
        if (!email || !trailId) {
          return errorResponse('email and trailId are required', 400);
        }

        await ensureSavedTrailsTable(env.DB);
        const rowId = `${email}__${trailId}`;
        await env.DB.prepare(
          'INSERT OR IGNORE INTO saved_trails (id, user_email, trail_id) VALUES (?, ?, ?)'
        ).bind(rowId, email, trailId).run();

        return jsonResponse({ success: true, trailId, saved: true });
      }

      // DELETE /mapminers/saved - Remove a trail from user's My Maps
      if (method === 'DELETE' && (path === '/mapminers/saved' || path === '/saved_trails' || path === '/saved')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);
        const body = await request.json().catch(() => ({}));
        const email = String(url.searchParams.get('email') || body.email || body.user_email || '').trim().toLowerCase();
        const trailId = String(url.searchParams.get('trailId') || body.trailId || body.trail_id || '').trim();
        if (!email || !trailId) {
          return errorResponse('email and trailId are required', 400);
        }

        await ensureSavedTrailsTable(env.DB);
        await env.DB.prepare(
          'DELETE FROM saved_trails WHERE LOWER(user_email) = LOWER(?) AND trail_id = ?'
        ).bind(email, trailId).run();

        return jsonResponse({ success: true, trailId, saved: false });
      }

      return errorResponse(`Route ${method} ${path} not found in MapMiners Worker`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  }
};
