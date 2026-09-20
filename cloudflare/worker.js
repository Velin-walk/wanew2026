/**
 * Walk Nepal Walk API - Cloudflare Worker
 * Direct D1 & R2 Backend for Walk Nepal Walk Application
 * 
 * Bindings required in Cloudflare Worker configuration:
 * - D1 Database Binding: DB (bound to your D1 database, e.g., walk-nepal-walk-db)
 * - R2 Bucket Binding: BUCKET (bound to your R2 bucket, e.g., walk-nepal-walk-storage)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

function cleanLightweightData(parsedObj) {
  if (!parsedObj || typeof parsedObj !== 'object') return parsedObj;
  
  for (const key in parsedObj) {
    if (Object.prototype.hasOwnProperty.call(parsedObj, key)) {
      if (typeof parsedObj[key] === 'string') {
        // Strip duplicate heavy base64 strings (such as cover images or day-by-day images)
        if (parsedObj[key].length > 1000 && parsedObj[key].startsWith('data:image')) {
          parsedObj[key] = '';
        }
        // Truncate extremely long texts/coordinates in list view to keep payload under 100KB
        else if (parsedObj[key].length > 10000) {
          parsedObj[key] = parsedObj[key].substring(0, 100) + '... (truncated for performance)';
        }
      } else if (typeof parsedObj[key] === 'object' && parsedObj[key] !== null) {
        cleanLightweightData(parsedObj[key]);
      }
    }
  }
  return parsedObj;
}

async function processBase64Images(obj, env, urlOrigin, prefix = 'img') {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('data:image/') && val.includes(';base64,')) {
        try {
          const parts = val.split(';base64,');
          const mimePart = parts[0]; // e.g. "data:image/jpeg"
          const base64Data = parts[1];
          const mimeType = mimePart.substring(5); // e.g. "image/jpeg"
          let ext = 'jpg';
          if (mimeType.includes('png')) ext = 'png';
          else if (mimeType.includes('gif')) ext = 'gif';
          else if (mimeType.includes('webp')) ext = 'webp';

          const rand = Math.random().toString(36).substring(2, 7);
          const fileName = `${prefix}_${Date.now()}_${rand}.${ext}`;
          
          // Decode Base64 in Cloudflare Worker environment using native Web API atob
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const bucket = env.TRAILS_BUCKET || env.BUCKET;
          if (bucket) {
            await bucket.put(fileName, bytes, {
              httpMetadata: { contentType: mimeType }
            });
            // Update the object key to use the clean, short public R2 URL
            obj[key] = `${urlOrigin}/images/${fileName}`;
            console.log(`Successfully moved Base64 image to R2: ${fileName}`);
          }
        } catch (err) {
          console.error('Error processing and uploading Base64 image to R2:', err);
        }
      } else if (typeof val === 'object' && val !== null) {
        await processBase64Images(val, env, urlOrigin, prefix);
      }
    }
  }
  return obj;
}

// Performance & Rate-Limit Optimization: In-memory cache for aggregate trek counts
let cachedTrekAggMap = null;
let lastTrekAggTime = 0;
const TREK_AGG_TTL = 5 * 60 * 1000; // 5 minutes in ms

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
      const cloned = new Response(response.body, response);
      cloned.headers.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      cloned.headers.set('X-Edge-Cache', 'HIT');
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(caches.default.put(request, cloned));
      } else {
        await caches.default.put(request, cloned);
      }
    }
  } catch (_) {}
}

async function purgeEdgeCache(urlList, ctx) {
  try {
    if (typeof caches !== 'undefined' && caches.default && Array.isArray(urlList)) {
      for (const u of urlList) {
        const req = new Request(u);
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(caches.default.delete(req));
        } else {
          await caches.default.delete(req);
        }
      }
    }
  } catch (_) {}
}

let indexesEnsured = false;
async function ensurePerformanceIndexes(env) {
  if (indexesEnsured || !env || !env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_regs_hike_number ON registrations (hike_number)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_regs_email ON registrations (email_address)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_regs_timestamp ON registrations (timestamp DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_roster_reg_id ON bookings_roster (registration_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_roster_hike_number ON bookings_roster (hike_number)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_treks_created_at ON treks (created_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_treks_hike_number ON treks (hike_number)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_executions_hike_number ON event_executions (hike_number)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_trek_photos_trek_id ON trek_photos (trek_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_community_trails_status ON community_trails (status)')
    ]);
    indexesEnsured = true;
  } catch (e) {
    // Non-blocking
  }
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();

    try {
      // ===== HEALTH CHECK =====
      if (path === '' || path === '/' || path === '/health') {
        return jsonResponse({
          success: true,
          status: 'ok',
          service: 'Walk Nepal Walk Cloudflare API',
          timestamp: new Date().toISOString(),
        });
      }

      // ===== TREKS & ADMIN ITINERARIES ENDPOINTS =====
      
      // GET /treks or GET /admin/itineraries - List all treks with server-side anonymous participant aggregation
      if (method === 'GET' && (path === '/treks' || path === '/admin/itineraries')) {
        if (!env.DB) return jsonResponse({ success: true, data: [] });

        const isFresh = url.searchParams.has('fresh') || url.searchParams.has('forceFresh');
        
        // 1. Check Cloudflare Global Edge Cache first (0 D1 row reads)
        if (!isFresh) {
          const cached = await matchEdgeCache(request);
          if (cached) {
            return cached;
          }
        }
        
        let results = [];
        try {
          const { results: joined } = await env.DB.prepare(`
            SELECT 
              t.*,
              e.execution_status,
              e.is_cancelled as exec_is_cancelled,
              e.cancellation_reason as exec_cancellation_reason,
              e.capacity as exec_capacity,
              e.assigned_leader as exec_assigned_leader
            FROM treks t
            LEFT JOIN event_executions e ON t.hike_number = e.hike_number
            ORDER BY t.created_at DESC
          `).all();
          results = joined;
        } catch (joinErr) {
          console.warn('Failed to join treks with event_executions:', joinErr);
          const { results: rawTreks } = await env.DB.prepare(
            'SELECT * FROM treks ORDER BY created_at DESC'
          ).all();
          results = rawTreks;
        }

        // Server-Side Anonymous Aggregate:
        // Uses GROUP BY on indexed hike_number to avoid scanning all raw registrations
        let aggMap = cachedTrekAggMap;
        if (!aggMap || isFresh || (Date.now() - lastTrekAggTime > TREK_AGG_TTL)) {
          aggMap = new Map();
          try {
            const { results: aggRows } = await env.DB.prepare(`
              SELECT 
                hike_number,
                COUNT(*) as total_bookings,
                SUM(COALESCE(CAST(pax AS INTEGER), 1)) as total_pax,
                SUM(CASE WHEN LOWER(gender) LIKE 'f%' THEN COALESCE(CAST(pax AS INTEGER), 1) ELSE 0 END) as female_pax,
                SUM(CASE WHEN LOWER(gender) NOT LIKE 'f%' THEN COALESCE(CAST(pax AS INTEGER), 1) ELSE 0 END) as male_pax
              FROM registrations
              WHERE hike_number IS NOT NULL AND hike_number != ''
              GROUP BY hike_number
            `).all();

            for (const r of (aggRows || [])) {
              const hn = String(r.hike_number || '').trim();
              if (!hn) continue;
              aggMap.set(hn, {
                total: Number(r.total_pax) || 0,
                male: Number(r.male_pax) || 0,
                female: Number(r.female_pax) || 0,
                recent: [],
              });
            }

            // Fetch top recent attendees with strict LIMIT 40 to avoid scanning large historical datasets
            try {
              const { results: recentRows } = await env.DB.prepare(`
                SELECT hike_number, full_name, gender
                FROM registrations
                WHERE hike_number IS NOT NULL AND hike_number != '' AND full_name IS NOT NULL AND full_name != ''
                ORDER BY timestamp DESC
                LIMIT 40
              `).all();

              for (const r of (recentRows || [])) {
                const hn = String(r.hike_number || '').trim();
                if (!hn || !aggMap.has(hn)) continue;
                const stat = aggMap.get(hn);
                if (stat.recent.length < 5) {
                  const rawName = (r.full_name || '').trim();
                  const isFemale = String(r.gender || '').toLowerCase().startsWith('f');
                  const parts = rawName.split(/\s+/).filter(Boolean);
                  const anonymized = parts.length > 1
                    ? `${parts[0]} ${parts[1].charAt(0)}.`
                    : (parts[0] || 'Hiker');
                  stat.recent.push({
                    name: anonymized,
                    gender: isFemale ? 'f' : 'm',
                  });
                }
              }
            } catch (_) {}

            cachedTrekAggMap = aggMap;
            lastTrekAggTime = Date.now();
          } catch (aggErr) {
            console.warn('Could not compute registration aggregates in D1:', aggErr);
          }
        }

        const data = (results || []).map((row) => {
          let parsedData = {};
          try {
            const rawData = row.data_json || row.data || '{}';
            parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            cleanLightweightData(parsedData);
          } catch (e) {}

          // Merge event_executions values into parsedData
          if (row.exec_is_cancelled !== undefined) {
            parsedData.is_cancelled = row.exec_is_cancelled === 1;
          }
          if (row.exec_cancellation_reason !== undefined) {
            parsedData.cancellation_reason = row.exec_cancellation_reason;
          }
          if (row.execution_status !== undefined) {
            parsedData.execution_status = row.execution_status;
          }
          if (row.exec_capacity !== undefined) {
            parsedData.maxCapacity = row.exec_capacity;
          }
          if (row.exec_assigned_leader !== undefined) {
            parsedData.teamLeader = row.exec_assigned_leader;
          }

          const hn = String(row.hike_number || '').trim();
          const trekId = String(row.id || '').trim();
          const agg = aggMap.get(hn) || aggMap.get(trekId) || { total: 0, male: 0, female: 0, recent: [] };

          return {
            ...row,
            max_capacity: row.exec_capacity !== undefined ? row.exec_capacity : row.max_capacity,
            team_leader: row.exec_assigned_leader !== undefined ? row.exec_assigned_leader : row.team_leader,
            hikeNumber: row.hike_number,
            hike_number: row.hike_number,
            participants: agg.total,
            registered_pax: agg.total,
            participants_by_gender: {
              total: agg.total,
              male: agg.male,
              female: agg.female,
            },
            recent_participants: agg.recent,
            data: parsedData,
          };
        });

        const resp = jsonResponse({ success: true, data }, 200, {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Edge-Cache': 'MISS'
        });

        // Store in Cloudflare Edge Cache asynchronously
        await putEdgeCache(request, resp, ctx, 300);

        return resp;
      }

      // GET /treks/:id or GET /admin/itineraries/:id - Get single trek
      if (method === 'GET' && (path.startsWith('/treks/') || path.startsWith('/admin/itineraries/'))) {
        const idOrNum = decodeURIComponent(path.replace(/^\/(treks|admin\/itineraries)\//, ''));
        if (!env.DB) return errorResponse('Database not bound', 500);

        const isFresh = url.searchParams.has('fresh') || url.searchParams.has('forceFresh');
        if (!isFresh) {
          const cached = await matchEdgeCache(request);
          if (cached) return cached;
        }

        const row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        if (!row) {
          return errorResponse('Trek not found', 404);
        }

        // Strict hike_number matching for live roster with anonymous privacy protection
        const regs = await env.DB.prepare(
          'SELECT * FROM registrations WHERE hike_number = ?'
        ).bind(String(row.hike_number || '')).all();

        const roster = regs.results || [];
        const total_pax = roster.reduce((acc, r) => acc + (Number(r.pax) || 1), 0);
        let male_count = 0;
        let female_count = 0;
        const recent_participants = [];
        const seenNames = new Set();

        for (const r of roster) {
          const pCount = Number(r.pax) || 1;
          const isFemale = String(r.gender || '').toLowerCase().startsWith('f');
          if (isFemale) female_count += pCount;
          else male_count += pCount;

          const rawName = (r.full_name || '').trim();
          const lowerName = rawName.toLowerCase();
          if (rawName && !seenNames.has(lowerName) && recent_participants.length < 6) {
            seenNames.add(lowerName);
            const parts = rawName.split(/\s+/).filter(Boolean);
            const anonymized = parts.length > 1
              ? `${parts[0]} ${parts[1].charAt(0)}.`
              : (parts[0] || 'Hiker');
            recent_participants.push({
              name: anonymized,
              gender: isFemale ? 'f' : 'm',
            });
          }
        }

        const sanitizedRoster = roster.map((r) => {
          const rawName = (r.full_name || '').trim();
          const parts = rawName.split(/\s+/).filter(Boolean);
          const anonymized = parts.length > 1
            ? `${parts[0]} ${parts[1].charAt(0)}.`
            : (parts[0] || 'Hiker');
          return {
            full_name: anonymized,
            gender: r.gender,
            pax: r.pax,
            hike_number: r.hike_number,
            timestamp: r.timestamp,
          };
        });

        let parsedData = {};
        try {
          const rawData = row.data_json || row.data || '{}';
          parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch (e) {}

        const trekObj = {
          ...row,
          hikeNumber: row.hike_number,
          hike_number: row.hike_number,
          participants: total_pax,
          registered_pax: total_pax,
          participants_by_gender: {
            total: total_pax,
            male: male_count,
            female: female_count,
          },
          recent_participants,
          data: parsedData,
        };

        const resp = jsonResponse({
          success: true,
          data: trekObj,
          trek: trekObj,
          roster: sanitizedRoster,
          total_pax,
        }, 200, {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Edge-Cache': 'MISS'
        });

        await putEdgeCache(request, resp, ctx, 300);
        return resp;
      }

      // POST /admin/sync-all - Bulk sync trigger
      if (method === 'POST' && path === '/admin/sync-all') {
        return jsonResponse({
          success: true,
          message: '🎉 Successfully synced all itineraries to Cloudflare D1!',
        });
      }

      // POST /admin/itineraries/:id/status - Update status
      if (method === 'POST' && path.match(/^\/admin\/itineraries\/[^\/]+\/status$/)) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const parts = path.split('/');
        const idOrNum = decodeURIComponent(parts[3]);
        const body = await request.json();
        const newStatus = body.status || 'published';

        await env.DB.prepare(
          'UPDATE treks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR hike_number = ?'
        ).bind(newStatus, idOrNum, idOrNum).run();

        return jsonResponse({ success: true, message: `Status updated to ${newStatus}` });
      }

      // POST /admin/itineraries/:id/clone - Clone trek
      if (method === 'POST' && path.match(/^\/admin\/itineraries\/[^\/]+\/clone$/)) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const parts = path.split('/');
        const idOrNum = decodeURIComponent(parts[3]);

        const row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        if (!row) {
          return errorResponse('Trek not found to clone', 404);
        }

        const newId = `hike-clone-${Date.now()}`;
        const newTitle = `${row.title || 'Trek'} (Copy)`;

        await env.DB.prepare(`
          INSERT INTO treks (
            id, hike_number, title, category, status, cover_image_url, hike_date,
            min_price, max_price, currency, meeting_point, meeting_time, expected_duration,
            difficulty, approx_distance, elevation_range, elevation_gross, ending_point,
            team_leader, whatsapp_link, itinerary_link, faq_link, max_capacity, data_json, author_email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          newId,
          'TBD',
          newTitle,
          row.category || 'Overnight Bus Hikes',
          'draft',
          row.cover_image_url || '',
          row.hike_date || '',
          row.min_price || 0,
          row.max_price || 0,
          row.currency || 'NPR',
          row.meeting_point || '',
          row.meeting_time || '',
          row.expected_duration || '',
          row.difficulty || 'Moderate',
          row.approx_distance || '',
          row.elevation_range || '',
          row.elevation_gross || '',
          row.ending_point || '',
          row.team_leader || '',
          row.whatsapp_link || '',
          row.itinerary_link || '',
          row.faq_link || '',
          row.max_capacity || 25,
          row.data_json || '{}',
          row.author_email || 'walknepalwalk@gmail.com'
        ).run();

        return jsonResponse({
          success: true,
          message: 'Trek cloned successfully',
          data: { id: newId, title: newTitle },
        });
      }

      // PATCH /admin/itineraries/:id - Event Execution Details
      if (method === 'PATCH' && path.startsWith('/admin/itineraries/')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const idOrNum = decodeURIComponent(path.replace('/admin/itineraries/', ''));
        const body = await request.json();

        // 1. Fetch current trek record
        const row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        if (!row) {
          return errorResponse('Trek not found to update execution', 404);
        }

        let parsedData = {};
        try {
          const rawData = row.data_json || row.data || '{}';
          parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch (e) {}

        // Merge incoming Event Execution updates strictly
        const maxCapacity = body.capacity !== undefined ? Number(body.capacity) : row.max_capacity;
        const teamLeader = body.leader !== undefined ? body.leader : row.team_leader;
        
        if (body.data) {
          parsedData = {
            ...parsedData,
            ...body.data,
            maxCapacity: body.capacity !== undefined ? Number(body.capacity) : parsedData.maxCapacity,
            teamLeader: body.leader !== undefined ? body.leader : parsedData.teamLeader,
          };
        }

        const dataJson = JSON.stringify(parsedData);

        // Map status based on execution status
        let newStatus = row.status;
        if (body.data && body.data.execution_status) {
          const execStat = String(body.data.execution_status).toLowerCase();
          newStatus = execStat === 'cancelled' ? 'draft' : 'published';
        }

        await env.DB.prepare(`
          UPDATE treks SET
            max_capacity = ?,
            team_leader = ?,
            status = ?,
            data_json = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? OR hike_number = ?
        `).bind(
          maxCapacity,
          teamLeader,
          newStatus,
          dataJson,
          row.id,
          row.hike_number
        ).run();

        // 2. Upsert into event_executions table
        try {
          const hikeNum = row.hike_number || idOrNum;
          const trekName = row.title || '';
          const eventDate = row.hike_date || '';
          
          const existingExec = await env.DB.prepare(
            'SELECT id FROM event_executions WHERE hike_number = ?'
          ).bind(hikeNum).first();

          if (existingExec) {
            await env.DB.prepare(`
              UPDATE event_executions SET
                execution_status = ?,
                is_cancelled = ?,
                cancellation_reason = ?,
                capacity = ?,
                assigned_leader = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE hike_number = ?
            `).bind(
              body.data?.execution_status || 'Scheduled',
              body.data?.is_cancelled ? 1 : 0,
              body.data?.cancellation_reason || '',
              maxCapacity,
              teamLeader,
              hikeNum
            ).run();
          } else {
            await env.DB.prepare(`
              INSERT INTO event_executions (
                hike_number, trek_name, event_date, execution_status, is_cancelled,
                cancellation_reason, capacity, assigned_leader, leader_phone, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(
              hikeNum,
              trekName,
              eventDate,
              body.data?.execution_status || 'Scheduled',
              body.data?.is_cancelled ? 1 : 0,
              body.data?.cancellation_reason || '',
              maxCapacity,
              teamLeader,
              body.data?.leader_phone || '',
            ).run();
          }
        } catch (execErr) {
          console.warn('Error syncing event_executions table, proceeding:', execErr);
        }

        return jsonResponse({
          success: true,
          message: 'Event Execution updated in D1 successfully',
          data: {
            id: row.id,
            hike_number: row.hike_number,
            max_capacity: maxCapacity,
            team_leader: teamLeader
          }
        });
      }

      // POST /treks/batch - Bulk upsert historical and sheet treks in a single atomic D1 transaction
      if (method === 'POST' && path === '/treks/batch') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const records = Array.isArray(body) ? body : (body.records || body.treks || []);
        if (!Array.isArray(records) || records.length === 0) {
          return errorResponse('records array required', 400);
        }

        // Optional: Save copy of imported dataset to R2 as historical backup in 1 PUT request
        const bucket = env.TRAILS_BUCKET || env.BUCKET;
        if (bucket && body.backupToR2) {
          try {
            const backupKey = `backups/historical_treks_${Date.now()}.json`;
            await bucket.put(backupKey, JSON.stringify(records, null, 2), {
              httpMetadata: { contentType: 'application/json' }
            });
          } catch (r2Err) {
            console.warn('Backup to R2 failed (non-blocking):', r2Err);
          }
        }

        const stmts = [];
        for (const t of records) {
          const hikeNum = String(t.hike_number || t.hikeNumber || '').trim();
          if (!hikeNum) continue;

          const title = String(t.title || t.name || t.trek_name || `Hike #${hikeNum}`).trim();
          const category = String(t.category || 'Day Hike').trim();
          const approxDistance = String(t.approx_distance || (t.distance ? `${t.distance} km` : '') || '').trim();
          const hikeDate = String(t.hike_date || t.date || '').trim();
          const expectedDuration = String(t.expected_duration || t.days || '1 Day').trim();
          const difficulty = String(t.difficulty || 'Moderate').trim();
          const teamLeader = String(t.team_leader || t.leader || '').trim();
          const status = String(t.status || 'published').trim();
          const trekId = String(t.id || `hike-${hikeNum.toLowerCase().replace(/\s+/g, '-')}`).trim();

          const dataJson = typeof t.data_json === 'string'
            ? t.data_json
            : JSON.stringify(t.data || {
                hikeNumber: hikeNum,
                title,
                category,
                hikeDate,
                teamLeader,
                overview: {
                  approxDistance,
                  expectedDuration,
                  difficulty
                }
              });

          stmts.push(
            env.DB.prepare(`
              INSERT INTO treks (
                id, hike_number, title, category, status, cover_image_url, hike_date,
                min_price, max_price, currency, expected_duration,
                difficulty, approx_distance, team_leader, data_json, author_email, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(hike_number) DO UPDATE SET
                title = CASE WHEN treks.title IS NULL OR treks.title = '' OR treks.title LIKE 'Hike #%' THEN EXCLUDED.title ELSE treks.title END,
                approx_distance = CASE WHEN treks.approx_distance IS NULL OR treks.approx_distance = '' THEN EXCLUDED.approx_distance ELSE treks.approx_distance END,
                team_leader = CASE WHEN treks.team_leader IS NULL OR treks.team_leader = '' THEN EXCLUDED.team_leader ELSE treks.team_leader END,
                difficulty = CASE WHEN treks.difficulty IS NULL OR treks.difficulty = '' THEN EXCLUDED.difficulty ELSE treks.difficulty END,
                expected_duration = CASE WHEN treks.expected_duration IS NULL OR treks.expected_duration = '' THEN EXCLUDED.expected_duration ELSE treks.expected_duration END,
                hike_date = CASE WHEN treks.hike_date IS NULL OR treks.hike_date = '' THEN EXCLUDED.hike_date ELSE treks.hike_date END,
                category = CASE WHEN treks.category IS NULL OR treks.category = '' THEN EXCLUDED.category ELSE treks.category END,
                updated_at = CURRENT_TIMESTAMP
            `).bind(
              trekId,
              hikeNum,
              title,
              category,
              status,
              t.cover_image_url || '',
              hikeDate,
              Number(t.min_price) || 0,
              Number(t.max_price) || 0,
              t.currency || 'NPR',
              expectedDuration,
              difficulty,
              approxDistance,
              teamLeader,
              dataJson,
              'walknepalwalk@gmail.com'
            )
          );
        }

        if (stmts.length === 0) {
          return errorResponse('No valid trek records found to insert', 400);
        }

        // Execute batch in chunks of 50 to stay well under D1 batch limits
        const chunkSize = 50;
        let totalInserted = 0;
        for (let i = 0; i < stmts.length; i += chunkSize) {
          const chunk = stmts.slice(i, i + chunkSize);
          await env.DB.batch(chunk);
          totalInserted += chunk.length;
        }

        cachedTrekAggMap = null; // Invalidate cache so new treks appear instantly
        return jsonResponse({
          success: true,
          message: `Successfully processed ${totalInserted} treks into Cloudflare D1`,
          processedCount: totalInserted
        });
      }

      // POST /treks/sync, POST /treks, POST /admin/itineraries, PUT /admin/itineraries/:id - Upsert trek
      if (
        (method === 'POST' || method === 'PUT') &&
        (path === '/treks/sync' || path === '/treks' || path === '/admin/itineraries' || path.startsWith('/admin/itineraries/'))
      ) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const url = new URL(request.url);
        const urlOrigin = url.origin;

        // If body.data is present as a string, let's parse it first so we can traverse it
        if (body.data && typeof body.data === 'string') {
          try {
            body.data = JSON.parse(body.data);
          } catch (e) {}
        }
        // If data_json is a string and body.data is not present, parse data_json into body.data
        if (!body.data && body.data_json && typeof body.data_json === 'string') {
          try {
            body.data = JSON.parse(body.data_json);
          } catch (e) {}
        }

        const dataObj = body.data || body;
        const hikeNum = String(body.hike_number || body.hikeNumber || dataObj.hikeNumber || dataObj.hike_number || 'TBD').trim();

        // Process any Base64 images recursively in-memory, upload to R2, and replace with clean public URLs
        await processBase64Images(body, env, urlOrigin, `trek_${hikeNum !== 'TBD' ? hikeNum : 'draft'}`);

        let pathId = '';
        if (path.startsWith('/admin/itineraries/')) {
          pathId = decodeURIComponent(path.replace('/admin/itineraries/', ''));
        }

        const trekId = body.id || pathId || (hikeNum !== 'TBD' ? `hike-${hikeNum}` : `hike-${Date.now()}`);
        const title = body.title || dataObj.title || body.trek_name || 'Walk Nepal Walk Hike';
        const dataJson = typeof body.data === 'object' ? JSON.stringify(body.data) : (body.data_json || '{}');

        // Check if existing record exists safely by ID or unique hike_number
        let existing = null;
        if (trekId) {
          existing = await env.DB.prepare('SELECT id FROM treks WHERE id = ?').bind(trekId).first();
        }
        if (!existing && hikeNum && hikeNum !== 'TBD') {
          existing = await env.DB.prepare('SELECT id FROM treks WHERE hike_number = ?').bind(hikeNum).first();
        }

        const priceTiers = dataObj.priceTiers || [];
        const calculatedMinPrice = priceTiers.length > 0 ? Math.min(...priceTiers.map((t) => Number(t.price) || 0)) : 0;
        const calculatedMaxPrice = priceTiers.length > 0 ? Math.max(...priceTiers.map((t) => Number(t.price) || 0)) : 0;

        if (existing) {
          // Update existing trek
          await env.DB.prepare(`
            UPDATE treks SET
              title = ?, category = ?, status = ?, cover_image_url = ?, hike_date = ?,
              min_price = ?, max_price = ?, currency = ?, meeting_point = ?, meeting_time = ?,
              expected_duration = ?, difficulty = ?, approx_distance = ?, elevation_range = ?,
              elevation_gross = ?, ending_point = ?, team_leader = ?, whatsapp_link = ?,
              itinerary_link = ?, faq_link = ?, max_capacity = ?, data_json = ?,
              author_email = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            title,
            body.category || dataObj.category || 'Overnight Bus Hikes',
            body.status || dataObj.status || 'published',
            body.cover_image_url || body.featured_image || dataObj.coverImageUrl || dataObj.cover_image_url || '',
            body.hike_date || body.date || dataObj.hikeDate || dataObj.hike_date || '',
            Number(body.min_price) || calculatedMinPrice,
            Number(body.max_price) || calculatedMaxPrice,
            body.currency || dataObj.currency || 'NPR',
            body.meeting_point || body.start_location || dataObj.overview?.meetingPoint || dataObj.meetingPoint || '',
            body.meeting_time || dataObj.overview?.meetingTime || dataObj.meetingTime || '',
            body.expected_duration || body.days || dataObj.overview?.expectedDuration || '',
            body.difficulty || dataObj.overview?.difficulty || 'Moderate',
            body.approx_distance || dataObj.overview?.approxDistance || '',
            body.elevation_range || body.elevation || dataObj.overview?.elevationRange || '',
            body.elevation_gross || dataObj.overview?.elevationGross || '',
            body.ending_point || dataObj.overview?.endingPoint || '',
            body.team_leader || body.leader || dataObj.teamLeader || '',
            body.whatsapp_link || dataObj.whatsappLink || '',
            body.itinerary_link || dataObj.itineraryLink || '',
            body.faq_link || dataObj.faqLink || '',
            Number(body.max_capacity || body.capacity || dataObj.maxCapacity) || 25,
            dataJson,
            body.author_email || body.authorEmail || 'walknepalwalk@gmail.com',
            existing.id
          ).run();
        } else {
          // Insert new trek
          await env.DB.prepare(`
            INSERT INTO treks (
              id, hike_number, title, category, status, cover_image_url, hike_date,
              min_price, max_price, currency, meeting_point, meeting_time, expected_duration,
              difficulty, approx_distance, elevation_range, elevation_gross, ending_point,
              team_leader, whatsapp_link, itinerary_link, faq_link, max_capacity, data_json, author_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            trekId,
            hikeNum,
            title,
            body.category || dataObj.category || 'Overnight Bus Hikes',
            body.status || dataObj.status || 'published',
            body.cover_image_url || body.featured_image || dataObj.coverImageUrl || dataObj.cover_image_url || '',
            body.hike_date || body.date || dataObj.hikeDate || dataObj.hike_date || '',
            Number(body.min_price) || calculatedMinPrice,
            Number(body.max_price) || calculatedMaxPrice,
            body.currency || dataObj.currency || 'NPR',
            body.meeting_point || body.start_location || dataObj.overview?.meetingPoint || dataObj.meetingPoint || '',
            body.meeting_time || dataObj.overview?.meetingTime || dataObj.meetingTime || '',
            body.expected_duration || body.days || dataObj.overview?.expectedDuration || '',
            body.difficulty || dataObj.overview?.difficulty || 'Moderate',
            body.approx_distance || dataObj.overview?.approxDistance || '',
            body.elevation_range || body.elevation || dataObj.overview?.elevationRange || '',
            body.elevation_gross || dataObj.overview?.elevationGross || '',
            body.ending_point || dataObj.overview?.endingPoint || '',
            body.team_leader || body.leader || dataObj.teamLeader || '',
            body.whatsapp_link || dataObj.whatsappLink || '',
            body.itinerary_link || dataObj.itineraryLink || '',
            body.faq_link || dataObj.faqLink || '',
            Number(body.max_capacity || body.capacity || dataObj.maxCapacity) || 25,
            dataJson,
            body.author_email || body.authorEmail || 'walknepalwalk@gmail.com'
          ).run();
        }

        return jsonResponse({
          success: true,
          message: 'Trek synced to Cloudflare D1 successfully',
          data: {
            id: trekId,
            hike_number: hikeNum,
            status: body.status || dataObj.status || 'published',
          },
        });
      }

      // DELETE /treks/:id or DELETE /admin/itineraries/:id - Delete trek
      if (method === 'DELETE' && (path.startsWith('/treks/') || path.startsWith('/admin/itineraries/'))) {
        const idOrNum = decodeURIComponent(path.replace(/^\/(treks|admin\/itineraries)\//, ''));
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        await env.DB.prepare(
          'DELETE FROM treks WHERE hike_number = ? OR id = ?'
        ).bind(idOrNum, idOrNum).run();

        return jsonResponse({ success: true, message: `Deleted trek ${idOrNum}` });
      }

      // ===== REGISTRATIONS ENDPOINTS =====

      // GET /registrations - List registrations
      if (method === 'GET' && path === '/registrations') {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
        const email = url.searchParams.get('email');
        const hikeNum = url.searchParams.get('hike_number');
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const limit = limitParam ? parseInt(limitParam, 10) : 0;
        const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

        let query = 'SELECT * FROM registrations ORDER BY timestamp DESC';
        let stmt = env.DB.prepare(query);

        if (email) {
          query = 'SELECT * FROM registrations WHERE email_address = ? ORDER BY timestamp DESC';
          stmt = env.DB.prepare(query).bind(email);
        } else if (hikeNum) {
          query = 'SELECT * FROM registrations WHERE hike_number = ? ORDER BY timestamp DESC';
          stmt = env.DB.prepare(query).bind(hikeNum);
        }

        let baseJoinQuery = `
          SELECT 
            r.*,
            b.registration_status,
            b.payment_status as roster_payment_status,
            b.paid_amount as roster_paid_amount,
            b.due_amount as roster_due_amount,
            b.admin_notes as roster_admin_notes,
            b.pickup_point as roster_pickup_point,
            b.trek_date as roster_trek_date
          FROM registrations r
          LEFT JOIN bookings_roster b ON r.id = b.registration_id
        `;
        let joinParams = [];
        if (email) {
          baseJoinQuery += ' WHERE LOWER(r.email_address) = LOWER(?) OR LOWER(r.user_email) = LOWER(?)';
          joinParams.push(email.trim(), email.trim());
        } else if (hikeNum) {
          baseJoinQuery += ' WHERE r.hike_number = ?';
          joinParams.push(hikeNum.trim());
        }
        baseJoinQuery += ' ORDER BY r.timestamp DESC';

        const effectiveLimit = limit > 0 ? limit : (email || hikeNum ? 500 : 120);
        baseJoinQuery += ' LIMIT ? OFFSET ?';
        joinParams.push(effectiveLimit, offset);

        let results = [];
        try {
          const stmt = env.DB.prepare(baseJoinQuery);
          const { results: joined } = joinParams.length > 0 ? await stmt.bind(...joinParams).all() : await stmt.all();
          results = joined;
        } catch (joinErr) {
          console.warn('Failed to join registrations with bookings_roster, falling back:', joinErr);
          const { results: rawRegs } = await stmt.all();
          results = rawRegs;
        }

        const mapped = (results || []).map((r) => ({
          ...r,
          person_remarks: r.list_name || '', // Backward-compatibility mapping for companion parsing
          status: r.registration_status || r.status || 'Confirmed',
          payment_status: r.roster_payment_status || r.payment_status || 'Unpaid',
          paid_amount: r.roster_paid_amount !== undefined ? Number(r.roster_paid_amount) : 0,
          due_amount: r.roster_due_amount !== undefined ? Number(r.roster_due_amount) : 0,
          admin_notes: r.roster_admin_notes || r.admin_notes || '',
          pickup_point: r.roster_pickup_point || r.pickup_point || '',
        }));

        // Apply 2-month view limit on past registrations, while keeping any upcoming ones fully visible.
        const now = new Date();
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const filtered = mapped.filter((r) => {
          let compareDate = null;

          // Parse trek_date if available
          if (r.roster_trek_date) {
            const parsed = new Date(r.roster_trek_date.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) {
              compareDate = parsed;
            }
          }

          // Fallback to registration timestamp
          if (!compareDate && r.timestamp) {
            const parsed = new Date(r.timestamp.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) {
              compareDate = parsed;
            }
          }

          // If no parseable date is found, keep for safety
          if (!compareDate) return true;

          // Upcoming is always accessible
          if (compareDate >= now) return true;

          // Past events must be within the last 2 months
          return compareDate >= twoMonthsAgo;
        });

        const responseHeaders = {};
        if (hikeNum) {
          responseHeaders['Cache-Control'] = 'public, max-age=30, s-maxage=60';
        }

        return jsonResponse({ success: true, data: filtered }, 200, responseHeaders);
      }

      // PATCH /registrations/:id - Update Bookings & Roster details in Cloudflare D1
      if (method === 'PATCH' && path.startsWith('/registrations/')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const id = decodeURIComponent(path.replace('/registrations/', ''));
        const body = await request.json();

        // 1. Fetch the original registration record for pre-populating bookings_roster if needed
        let regRow = null;
        try {
          regRow = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(id).first();
          if (!regRow) {
            regRow = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(Number(id) || id).first();
          }
        } catch (regErr) {
          console.warn('Could not query registrations table:', regErr);
        }

        // 2. Strict target field mapping for Bookings & Roster edits
        const status = body.status !== undefined ? body.status : 'Confirmed';
        const payment_status = body.payment_status !== undefined ? body.payment_status : 'Unpaid';
        const paid = body.paid_amount !== undefined ? Number(body.paid_amount) : 0;
        const due = body.due_amount !== undefined ? Number(body.due_amount) : 0;
        const updates = body.admin_notes !== undefined ? body.admin_notes : '';
        const pickup_point = body.pickup_point !== undefined ? body.pickup_point : '';

        // 3. Upsert into bookings_roster table
        try {
          const existingRoster = await env.DB.prepare(
            'SELECT id FROM bookings_roster WHERE registration_id = ?'
          ).bind(String(id)).first();

          if (existingRoster) {
            await env.DB.prepare(`
              UPDATE bookings_roster SET
                registration_status = ?,
                payment_status = ?,
                paid_amount = ?,
                due_amount = ?,
                admin_notes = ?,
                pickup_point = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE registration_id = ?
            `).bind(
              status,
              payment_status,
              paid,
              due,
              updates,
              pickup_point,
              String(id)
            ).run();
          } else {
            await env.DB.prepare(`
              INSERT INTO bookings_roster (
                registration_id, hike_number, trek_name, trek_date, full_name, phone, email, whatsapp,
                registration_status, payment_status, paid_amount, due_amount, admin_notes, pickup_point, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(
              String(id),
              regRow ? String(regRow.hike_number || '') : '',
              regRow ? String(regRow.trek_name || '') : '',
              regRow ? String(regRow.trek_date || regRow.timestamp || '') : '',
              regRow ? String(regRow.full_name || '') : '',
              regRow ? String(regRow.phone || '') : '',
              regRow ? String(regRow.email_address || '') : '',
              regRow ? String(regRow.whatsapp || regRow.whatsapp_number || '') : '',
              status,
              payment_status,
              paid,
              due,
              updates,
              pickup_point
            ).run();
          }
        } catch (rosterErr) {
          console.error('Error syncing bookings_roster table:', rosterErr);
          return errorResponse(`D1 Bookings update error: ${rosterErr.message}`, 500);
        }

        return jsonResponse({
          success: true,
          message: 'Bookings & Roster details updated in D1 successfully'
        });
      }

      // DELETE /registrations/:id - Delete registration from Cloudflare D1
      if (method === 'DELETE' && path.startsWith('/registrations/')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const id = decodeURIComponent(path.replace('/registrations/', ''));

        try {
          await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(id).run();
          cachedTrekAggMap = null;
          return jsonResponse({ success: true, message: 'Registration deleted from D1 successfully' });
        } catch (dbErr) {
          console.error('Failed to delete registration from D1:', dbErr);
          try {
            await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(Number(id) || id).run();
            cachedTrekAggMap = null;
            return jsonResponse({ success: true, message: 'Registration deleted from D1 successfully (fallback ID type)' });
          } catch (fallbackErr) {
            return errorResponse(`D1 delete error: ${fallbackErr.message}`, 500);
          }
        }
      }

      // POST /registrations - Create registration
      if (method === 'POST' && path === '/registrations') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const whatsappVal = body.whatsapp_number || body.whatsapp || '';
        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Map list_name value dynamically as requested
        const finalListName = body.person_remarks || body.list_name || 'Solo registration';

        const regResult = await env.DB.prepare(`
          INSERT INTO registrations (
            hike_number, trek_name, full_name, email_address, phone, whatsapp_number,
            emergency_backup_contact, profession, part_of_group, pax, age_group, gender,
            fitness, medical_condition, recent_hikes, agreement, suggestions, guide_mode,
            transport_mode, list_name, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body.hike_number || ''),
          body.trek_name || '',
          body.full_name || 'Anonymous Hiker',
          body.email_address || '',
          body.phone || '',
          whatsappVal,
          body.emergency_backup_contact || '',
          body.profession || '',
          body.part_of_group || 'Solo',
          Number(body.pax) || 1,
          body.age_group || '',
          body.gender || '',
          body.fitness || '',
          body.medical_condition || 'No',
          body.recent_hikes || '',
          body.agreement || 'Yes',
          body.suggestions || '',
          body.guide_mode || 'Guided',
          body.transport_mode || 'Bus',
          finalListName,
          body.timestamp || currentTimestamp
        ).run();

        const insertedId = regResult?.meta?.last_row_id || regResult?.lastRowId;
        if (insertedId) {
          try {
            const paid = Number(body.paid_amount) || 0;
            const due = Number(body.due_amount) || 0;
            let payStatus = body.payment_status;
            if (!payStatus) {
              if (paid > 0 && due === 0) payStatus = 'Paid';
              else if (paid > 0 && due > 0) payStatus = 'Partial';
              else if (due > 0 && paid === 0) payStatus = 'Due';
              else payStatus = 'Unpaid';
            }

            await env.DB.prepare(`
              INSERT INTO bookings_roster (
                registration_id, hike_number, trek_name, trek_date, full_name, phone, email, whatsapp,
                registration_status, payment_status, paid_amount, due_amount, admin_notes, pickup_point, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(
              String(insertedId),
              String(body.hike_number || ''),
              body.trek_name || '',
              body.trek_date || body.timestamp || currentTimestamp,
              body.full_name || 'Anonymous Hiker',
              body.phone || '',
              body.email_address || '',
              whatsappVal,
              body.registration_status || 'Confirmed',
              payStatus,
              paid,
              due,
              body.admin_notes || '',
              body.pickup_point || body.pickupPoint || body.pickup || ''
            ).run();
          } catch (rErr) {
            console.warn('Error auto-populating bookings_roster from registration:', rErr);
          }
        }

        cachedTrekAggMap = null;
        return jsonResponse({ success: true, message: 'Registration saved successfully', id: insertedId });
      }

      // ===== FEEDBACK ENDPOINTS =====

      // GET /feedback
      if (method === 'GET' && path === '/feedback') {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
        const hikeNum = url.searchParams.get('hike_number');

        let stmt = env.DB.prepare('SELECT * FROM feedback ORDER BY submitted_at DESC');
        if (hikeNum) {
          stmt = env.DB.prepare('SELECT * FROM feedback WHERE hike_number = ? ORDER BY submitted_at DESC').bind(hikeNum);
        }

        const { results } = await stmt.all();
        return jsonResponse({ success: true, data: results || [] });
      }

      // POST /feedback
      if (method === 'POST' && path === '/feedback') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const userUid = body.uid || body.user_id || `user_${Date.now()}`;
        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await env.DB.prepare(`
          INSERT INTO feedback (
            uid, hike_number, trek_name, full_name, email_address,
            team_rating, team_feedback, overall_rating, overall_feedback, submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userUid,
          String(body.hike_number || ''),
          body.trek_name || '',
          body.full_name || body.name || 'Anonymous',
          body.email_address || body.email || '',
          Number(body.team_rating || body.teamRating) || 5,
          body.team_feedback || body.teamFeedback || '',
          Number(body.overall_rating || body.overallRating) || 5,
          body.overall_feedback || body.overallFeedback || '',
          currentTimestamp
        ).run();

        return jsonResponse({ success: true, message: 'Feedback submitted successfully' });
      }

      // ===== TREK PHOTOS ENDPOINTS (Cloudflare D1 Backend) =====

      // GET /trek_photos - List photos for a trek or all photos
      if (method === 'GET' && path === '/trek_photos') {
        const trekId = url.searchParams.get('trekId') || url.searchParams.get('trek_id');
        if (!env.DB) {
          return jsonResponse({ success: true, data: [] });
        }

        const isFresh = url.searchParams.has('fresh');
        if (!isFresh) {
          const cached = await matchEdgeCache(request);
          if (cached) return cached;
        }

        try {
          let stmt = env.DB.prepare('SELECT * FROM trek_photos ORDER BY uploaded_at DESC LIMIT 100');
          if (trekId) {
            stmt = env.DB.prepare('SELECT * FROM trek_photos WHERE trek_id = ? ORDER BY uploaded_at DESC LIMIT 100').bind(trekId);
          }
          const { results } = await stmt.all();
          const mapped = (results || []).map((r) => ({
            id: r.id,
            trekId: r.trek_id,
            hikeNumber: r.hike_number,
            trekName: r.trek_name,
            url: r.url,
            publicId: r.public_id,
            uploadedBy: r.uploaded_by,
            userUid: r.user_uid,
            uploadedAt: r.uploaded_at,
            caption: r.caption || '',
          }));

          const resp = jsonResponse({ success: true, data: mapped }, 200, {
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'X-Edge-Cache': 'MISS'
          });
          await putEdgeCache(request, resp, ctx, 300);
          return resp;
        } catch (err) {
          console.warn('Error querying trek_photos in Cloudflare D1:', err);
          return jsonResponse({ success: true, data: [] });
        }
      }

      // POST /trek_photos - Save photo record to Cloudflare D1
      if (method === 'POST' && path === '/trek_photos') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const photoId = body.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const currentTimestamp = body.uploadedAt || new Date().toISOString();

        try {
          await env.DB.prepare(`
            INSERT INTO trek_photos (
              id, trek_id, hike_number, trek_name, url, public_id, uploaded_by, user_uid, uploaded_at, caption
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            photoId,
            body.trekId || body.trek_id || '',
            body.hikeNumber || body.hike_number || '',
            body.trekName || body.trek_name || '',
            body.url || '',
            body.publicId || body.public_id || '',
            body.uploadedBy || body.uploaded_by || 'Nepal Hiker',
            body.userUid || body.user_uid || '',
            currentTimestamp,
            body.caption || ''
          ).run();

          return jsonResponse({
            success: true,
            message: 'Photo index saved to Cloudflare D1 successfully',
            photo: { id: photoId, ...body },
          });
        } catch (err) {
          console.error('Error saving trek_photo to Cloudflare D1:', err);
          return errorResponse(`Cloudflare D1 save error: ${err.message}`, 500);
        }
      }

      // DELETE /trek_photos/:id - Delete photo record from Cloudflare D1
      if (method === 'DELETE' && path.startsWith('/trek_photos/')) {
        const photoId = decodeURIComponent(path.replace('/trek_photos/', ''));
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        try {
          await env.DB.prepare('DELETE FROM trek_photos WHERE id = ?').bind(photoId).run();
          return jsonResponse({ success: true, message: 'Photo deleted from Cloudflare D1 successfully' });
        } catch (err) {
          return errorResponse(`Cloudflare D1 delete error: ${err.message}`, 500);
        }
      }

      // ===== PHOTO COMMENTS ENDPOINTS (Cloudflare D1) =====

      // GET /photo_comments - List comments for a photo
      if (method === 'GET' && path === '/photo_comments') {
        const photoId = url.searchParams.get('photoId') || url.searchParams.get('photo_id');
        if (!env.DB) {
          return jsonResponse({ success: true, data: [] });
        }

        try {
          let results = [];
          if (photoId) {
            const res = await env.DB.prepare(
              'SELECT * FROM photo_comments WHERE photo_id = ? ORDER BY created_at ASC'
            ).bind(photoId).all();
            results = res.results || [];
          } else {
            const res = await env.DB.prepare(
              'SELECT * FROM photo_comments ORDER BY created_at ASC LIMIT 100'
            ).all();
            results = res.results || [];
          }

          const mapped = results.map(r => ({
            id: r.id,
            photoId: r.photo_id,
            userUid: r.user_uid,
            userName: r.user_name,
            userAvatar: r.user_avatar || '',
            commentText: r.comment_text || '',
            createdAt: r.created_at,
          }));

          return jsonResponse({ success: true, data: mapped });
        } catch (err) {
          console.warn('Error querying photo_comments in D1:', err);
          return jsonResponse({ success: true, data: [] });
        }
      }

      // POST /photo_comments - Create comment in Cloudflare D1
      if (method === 'POST' && path === '/photo_comments') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const commentId = body.id || `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const currentTimestamp = body.createdAt || new Date().toISOString();

        try {
          await env.DB.prepare(`
            INSERT INTO photo_comments (
              id, photo_id, user_uid, user_name, user_avatar, comment_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            commentId,
            body.photoId || body.photo_id || '',
            body.userUid || body.user_uid || '',
            body.userName || body.user_name || 'Nepal Hiker',
            body.userAvatar || body.user_avatar || '',
            body.commentText || body.comment_text || '',
            currentTimestamp
          ).run();

          return jsonResponse({
            success: true,
            message: 'Comment saved to Cloudflare D1 successfully',
            data: {
              id: commentId,
              photoId: body.photoId || body.photo_id || '',
              userUid: body.userUid || body.user_uid || '',
              userName: body.userName || body.user_name || 'Nepal Hiker',
              userAvatar: body.userAvatar || body.user_avatar || '',
              commentText: body.commentText || body.comment_text || '',
              createdAt: currentTimestamp,
            }
          });
        } catch (err) {
          console.error('Error saving photo comment to Cloudflare D1:', err);
          return errorResponse(`Cloudflare D1 comment save error: ${err.message}`, 500);
        }
      }

      // DELETE /photo_comments/:id - Delete comment from Cloudflare D1
      if (method === 'DELETE' && path.startsWith('/photo_comments/')) {
        const commentId = decodeURIComponent(path.replace('/photo_comments/', ''));
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        try {
          await env.DB.prepare('DELETE FROM photo_comments WHERE id = ?').bind(commentId).run();
          return jsonResponse({ success: true, message: 'Comment deleted successfully' });
        } catch (err) {
          return errorResponse(`Cloudflare D1 comment delete error: ${err.message}`, 500);
        }
      }

      // ===== MAPMINERS / COMMUNITY TRAILS ENDPOINTS =====

      // GET /mapminers/trails or GET /community_trails - List trails
      if (method === 'GET' && (path === '/mapminers/trails' || path === '/community_trails')) {
        if (!env.DB) return jsonResponse({ success: true, data: [] });

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
          console.error('Error querying community_trails:', e);
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

      // GET /images/:fileName - Serve R2 uploaded images directly
      if (method === 'GET' && path.startsWith('/images/')) {
        const fileName = decodeURIComponent(path.replace('/images/', ''));
        const bucket = env.TRAILS_BUCKET || env.BUCKET;
        if (!bucket) return errorResponse('R2 Storage binding BUCKET missing', 500);

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

      // GET /mapminers/download/:fileName - Download file from R2
      if (method === 'GET' && (path.startsWith('/mapminers/download/') || path.startsWith('/community_trails/download/'))) {
        const fileName = decodeURIComponent(path.replace(/^\/(mapminers|community_trails)\/download\//, ''));
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

      // POST /mapminers/upload or POST /community_trails/upload (Fills all snake_case and camelCase metadata)
      if (method === 'POST' && (path === '/mapminers/upload' || path === '/community_trails/upload')) {
        if (!env.DB) return errorResponse('D1 Database binding (DB) missing', 500);

        const bucket = env.TRAILS_BUCKET || env.BUCKET;

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

        // Auto-create table if it doesn't exist in D1 yet
        try {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS community_trails (
              id TEXT PRIMARY KEY,
              file_name TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              difficulty TEXT DEFAULT 'Moderate',
              distance REAL DEFAULT 0,
              elevation_gain REAL DEFAULT 0,
              elevation_loss REAL DEFAULT 0,
              min_elevation REAL DEFAULT 0,
              max_elevation REAL DEFAULT 0,
              estimated_hours REAL DEFAULT 0,
              bounds TEXT,
              start_pos TEXT,
              contributor_name TEXT,
              contributor_email TEXT,
              province TEXT,
              district TEXT,
              nearby_city TEXT,
              highlights TEXT,
              uploaded_at TEXT,
              file_size INTEGER DEFAULT 0,
              status TEXT DEFAULT 'pending'
            )
          `).run();
        } catch (tblErr) {
          console.warn('Auto table creation notice:', tblErr);
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
              id, name, description, difficulty, distance, bounds, start_pos, contributor_email, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            trailId,
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

      return errorResponse(`Route ${method} ${path} not found`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  },
};
