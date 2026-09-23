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

function formatDisplayName(fullName, rankTitle) {
  const rawName = String(fullName || 'Hiker').trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  let displayName = rawName;
  if (parts.length >= 2) {
    const first = parts[0].length > 3 ? parts[0].slice(0, 3) + '.' : parts[0];
    displayName = `${first} ${parts.slice(1).join(' ')}`;
  }
  if (rankTitle && (rankTitle.includes('Veteran') || rankTitle.includes('Summit') || rankTitle.includes('Leader'))) {
    displayName += ' 👑';
  }
  return displayName;
}

function cleanLightweightData(parsedObj, isListView = true, depth = 0) {
  if (!parsedObj || typeof parsedObj !== 'object' || depth > 8) return parsedObj;
  
  for (const key in parsedObj) {
    if (Object.prototype.hasOwnProperty.call(parsedObj, key)) {
      if (typeof parsedObj[key] === 'string') {
        // Strip duplicate heavy base64 strings (such as cover images or day-by-day images)
        if (parsedObj[key].startsWith('data:image') || (isListView && parsedObj[key].startsWith('data:'))) {
          parsedObj[key] = '';
        }
        // Truncate extremely long texts/coordinates in list view to keep payload under 100KB
        else if (isListView && parsedObj[key].length > 500) {
          parsedObj[key] = parsedObj[key].substring(0, 200) + '... (truncated for list performance)';
        }
        else if (parsedObj[key].length > 10000) {
          parsedObj[key] = parsedObj[key].substring(0, 100) + '... (truncated for performance)';
        }
      } else if (typeof parsedObj[key] === 'object' && parsedObj[key] !== null) {
        cleanLightweightData(parsedObj[key], isListView, depth + 1);
      }
    }
  }
  return parsedObj;
}

const MAX_BASE64_DEPTH = 8;
const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB guard against Worker RAM limit

async function processBase64Images(obj, env, urlOrigin, prefix = 'img', depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > MAX_BASE64_DEPTH) return obj;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('data:image/') && val.includes(';base64,')) {
        if (val.length > MAX_BASE64_SIZE) {
          console.warn(`[Base64] Skipping oversized base64 image (${Math.round(val.length / 1024)} KB)`);
          continue;
        }
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

          // Trek cover images MUST use Core Worker's BUCKET only, never MapMiners' TRAILS_BUCKET
          const bucket = env.BUCKET;
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
        await processBase64Images(val, env, urlOrigin, prefix, depth + 1);
      }
    }
  }
  return obj;
}

// Performance & Rate-Limit Optimization: In-memory cache for aggregate trek counts
let cachedTrekAggMap = null;
let lastTrekAggTime = 0;
const TREK_AGG_TTL = 15 * 60 * 1000; // 15 minutes in ms

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

async function logAdminActivity(env, request, actionType, description, metadata = {}) {
  if (!env || !env.DB) return;
  try {
    const rawEmail = request.headers.get('X-Admin-Email') || request.headers.get('x-admin-email');
    const adminEmail = (rawEmail || 'walknepalwalk@gmail.com').trim().toLowerCase();
    await env.DB.prepare(`
      INSERT INTO admin_activity_logs (admin_email, action_type, description, metadata_json)
      VALUES (?, ?, ?, ?)
    `).bind(
      adminEmail,
      actionType,
      description,
      JSON.stringify(metadata)
    ).run();
  } catch (err) {
    console.error('Failed to log admin activity:', err);
  }
}

/**
 * Recomputes the unified Leaderboard Master Snapshot from D1 registration data and treks.
 * Stored in system_snapshots table for O(1) single-read and Edge-cached delivery.
 */
async function recomputeLeaderboardSnapshot(env, force = false) {
  if (!env || !env.DB) return null;

  try {
    // Check if we can bypass recomputation (throttle for 30 minutes unless forced)
    if (!force) {
      try {
        const lastSnap = await env.DB.prepare(`
          SELECT data_json, updated_at 
          FROM system_snapshots 
          WHERE key = 'leaderboard_master'
        `).first();
        if (lastSnap && lastSnap.updated_at && lastSnap.data_json) {
          const lastUpdated = new Date(lastSnap.updated_at.replace(' ', 'T') + 'Z').getTime();
          const ageMs = Date.now() - lastUpdated;
          if (ageMs < 30 * 60 * 1000) { // 30 minutes throttle
            console.log(`[Leaderboard] Serving throttled snapshot (age: ${Math.round(ageMs/1000)}s)`);
            return typeof lastSnap.data_json === 'string' ? JSON.parse(lastSnap.data_json) : lastSnap.data_json;
          }
        }
      } catch (throttleErr) {
        console.warn('Leaderboard throttle check error:', throttleErr);
      }
    }

    // 2. Fetch completed treks for community timeline and duration classifications
    let completedTreks = [];
    try {
      const { results } = await env.DB.prepare(`
        SELECT hike_number, title, category, hike_date, approx_distance, expected_duration, max_capacity, status
        FROM treks
        WHERE status IS NULL OR status != 'draft'
        ORDER BY hike_date ASC, hike_number ASC
        LIMIT 1000
      `).all();
      completedTreks = results || [];
    } catch (tErr) {
      console.warn('Notice querying treks for leaderboard snapshot:', tErr);
    }

    const trekLookup = new Map();
    let totalCommunityKm = 0;
    let totalHikeKm = 0;
    let totalTrekKm = 0;
    let hikeEventsCount = 0;
    let trekEventsCount = 0;
    let hikesLast30 = 0;
    let longestHike = { name: 'Longest Expedition', dist: 0 };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const growthCurve = [];
    const milestones = [];
    const milestoneThresholds = [500, 1000, 2000, 5000, 10000, 20000, 30000, 50000, 75000, 100000];
    let nextMilestoneIdx = 0;

    for (const trek of completedTreks) {
      const hn = String(trek.hike_number || '').trim();
      const distMatch = String(trek.approx_distance || '').match(/(\d+(\.\d+)?)/);
      const dist = distMatch ? parseFloat(distMatch[1]) : 15;

      const durStr = String(trek.expected_duration || '').toLowerCase();
      const durDays = durStr.match(/(\d+)\s*day/);
      const isMultiDayTrek =
        (durDays && parseInt(durDays[1]) > 2) ||
        String(trek.category || '').toLowerCase().includes('trek');

      if (dist > longestHike.dist) {
        longestHike = { name: trek.title || `Hike #${hn}`, dist: Math.round(dist) };
      }

      const participants = Math.max(Number(trek.max_capacity) || 20, 15);
      const communityEventKm = Math.round(dist * participants);

      if (isMultiDayTrek) {
        totalTrekKm += communityEventKm;
        trekEventsCount++;
      } else {
        totalHikeKm += communityEventKm;
        hikeEventsCount++;
      }
      totalCommunityKm = totalHikeKm + totalTrekKm;

      if (trek.hike_date) {
        const tDate = new Date(trek.hike_date);
        if (tDate >= thirtyDaysAgo && tDate <= now) {
          hikesLast30++;
        }
      }

      while (nextMilestoneIdx < milestoneThresholds.length && totalCommunityKm >= milestoneThresholds[nextMilestoneIdx]) {
        milestones.push({
          km: milestoneThresholds[nextMilestoneIdx],
          trek: trek.title || `Hike #${hn}`
        });
        nextMilestoneIdx++;
      }

      if (hn) {
        trekLookup.set(hn, {
          dist,
          isMultiDayTrek,
          date: trek.hike_date || ''
        });
      }

      growthCurve.push({
        event_no: hn || growthCurve.length + 1,
        title: trek.title,
        date: trek.hike_date || '',
        hike_km: totalHikeKm,
        trek_km: totalTrekKm,
        total_km: totalCommunityKm
      });
    }

    // 3. Leaderboard Stats aggregation
    const totalEvents = hikeEventsCount + trekEventsCount;
    const avgDist = totalEvents > 0 ? Math.round(totalCommunityKm / totalEvents) : 25;

    // Use existing snapshot as a base for hikers and stats if available
    // Since the user stated the leaderboard is entirely served from Google Sheet GAS,
    // we preserve the 'stats', 'hikers', 'growthCurve' and 'milestones' fields from the existing snapshot if they exist.
    let existingHikers = [];
    let existingStats = null;
    let existingGrowthCurve = null;
    let existingMilestones = null;
    try {
      const lastSnap = await env.DB.prepare(`
        SELECT data_json FROM system_snapshots WHERE key = 'leaderboard_master'
      `).first();
      if (lastSnap && lastSnap.data_json) {
        const snap = typeof lastSnap.data_json === 'string' ? JSON.parse(lastSnap.data_json) : lastSnap.data_json;
        existingHikers = snap.hikers || [];
        existingStats = snap.stats || null;
        existingGrowthCurve = snap.growthCurve || snap.growth_curve || null;
        existingMilestones = snap.milestones || null;
      }
    } catch (_) {}

    const stats = existingStats || {
      totalHikers: existingHikers.length,
      totalEvents: totalEvents || completedTreks.length,
      totalDistance: totalCommunityKm,
      hikesLast30,
      uniqueHikeParticip: Math.round(existingHikers.length * 0.94),
      hikeEvents: hikeEventsCount || completedTreks.length,
      totalHikeDist: totalHikeKm,
      uniqueTrekParticip: Math.round(existingHikers.length * 0.08),
      trekEvents: trekEventsCount || 16,
      totalTrekDist: totalTrekKm,
      avgDistPerEvent: avgDist,
      longestHike: longestHike.dist > 0 ? longestHike : { name: 'Langtang Valley Circuit', dist: 58 }
    };

    const snapshotPayload = {
      ok: true,
      ts: Date.now(),
      updated_at: new Date().toISOString(),
      stats,
      hikers: existingHikers,
      growthCurve: existingGrowthCurve || growthCurve,
      growth_curve: existingGrowthCurve || growthCurve, // Alias for backward compatibility
      milestones: existingMilestones || milestones
    };

    // 4. Save directly into system_snapshots
    await env.DB.prepare(`
      INSERT INTO system_snapshots (key, data_json, updated_at)
      VALUES ('leaderboard_master', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = CURRENT_TIMESTAMP
    `).bind(JSON.stringify(snapshotPayload)).run();

    return snapshotPayload;
  } catch (err) {
    console.error('Critical error in recomputeLeaderboardSnapshot:', err);
    return null;
  }
}

/**
 * Syncs aggregated participant statistics into the precomputed trek_participant_summary table.
 * Keeps total_pax, male_pax, female_pax, and recent_participants immediately fresh and fast.
 */
async function updateTrekParticipantSummary(env, hikeNumber) {
  if (!env || !env.DB) return;
  try {
    const hikeNumbers = [];
    if (hikeNumber) {
      hikeNumbers.push(String(hikeNumber).trim());
    } else {
      const { results: allHikes } = await env.DB.prepare(
        'SELECT DISTINCT hike_number FROM registrations WHERE hike_number IS NOT NULL AND hike_number != ""'
      ).all();
      if (allHikes) {
        for (const row of allHikes) {
          if (row.hike_number) hikeNumbers.push(String(row.hike_number).trim());
        }
      }
    }

    for (const hNum of hikeNumbers) {
      if (!hNum) continue;

      let regList = [];
      try {
        const { results } = await env.DB.prepare(`
          SELECT 
            r.id, r.hike_number, r.full_name, r.gender, r.pax, r.profession, r.part_of_group, r.timestamp,
            COALESCE(b.registration_status, 'Confirmed') as active_status
          FROM registrations r
          LEFT JOIN bookings_roster b ON CAST(r.id AS TEXT) = b.registration_id
          WHERE r.hike_number = ?
          ORDER BY r.id DESC
        `).bind(hNum).all();
        regList = results || [];
      } catch (err) {
        try {
          const { results } = await env.DB.prepare(
            'SELECT id, hike_number, full_name, gender, pax, profession, part_of_group, timestamp FROM registrations WHERE hike_number = ? ORDER BY id DESC'
          ).bind(hNum).all();
          regList = results || [];
        } catch (_) {
          regList = [];
        }
      }

      let totalPax = 0;
      let malePax = 0;
      let femalePax = 0;
      const recentParticipants = [];
      const seenNames = new Set();

      for (const reg of regList) {
        const status = String(reg.active_status || 'Confirmed').toLowerCase();
        if (status === 'cancelled' || status === 'rejected') {
          continue;
        }

        const count = Number(reg.pax) || 1;
        totalPax += count;

        const g = String(reg.gender || '').trim().toLowerCase();
        if (g.startsWith('m')) {
          malePax += count;
        } else if (g.startsWith('f')) {
          femalePax += count;
        }

        const rawName = (reg.full_name || '').trim();
        const lowerName = rawName.toLowerCase();
        if (rawName && !seenNames.has(lowerName) && recentParticipants.length < 10) {
          seenNames.add(lowerName);
          const parts = rawName.split(/\s+/).filter(Boolean);
          const anonymized = parts.length > 1
            ? `${parts[0]} ${parts[1].charAt(0)}.`
            : (parts[0] || 'Hiker');
          recentParticipants.push({
            name: anonymized,
            gender: g.startsWith('f') ? 'f' : 'm',
            profession: reg.profession || '',
            part_of_group: reg.part_of_group || '',
            timestamp: reg.timestamp || ''
          });
        }
      }

      const recentJson = JSON.stringify(recentParticipants);

      await env.DB.prepare(`
        INSERT INTO trek_participant_summary (hike_number, total_pax, male_pax, female_pax, recent_participants, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(hike_number) DO UPDATE SET
          total_pax = excluded.total_pax,
          male_pax = excluded.male_pax,
          female_pax = excluded.female_pax,
          recent_participants = excluded.recent_participants,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        hNum,
        totalPax,
        malePax,
        femalePax,
        recentJson
      ).run();
    }
  } catch (err) {
    console.warn('Notice updating trek_participant_summary table:', err);
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

      // GET /images/:fileName - Serve R2 uploaded trek cover images
      if (method === 'GET' && path.startsWith('/images/')) {
        const fileName = decodeURIComponent(path.replace('/images/', ''));
        const bucket = env.BUCKET;
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
        
        return new Response(object.body, {
          headers: {
            ...Object.fromEntries(headers),
            ...corsHeaders
          }
        });
      }

      // ===== TREKS & ADMIN ITINERARIES ENDPOINTS =====
      
      // GET /treks or GET /admin/itineraries - List all treks with server-side anonymous participant aggregation
      if (method === 'GET' && (path === '/treks' || path === '/admin/itineraries')) {
        if (!env.DB) return jsonResponse({ success: true, data: [] });

        const isAdminPath = path.startsWith('/admin');
        const isFresh = isAdminPath ||
          url.searchParams.has('fresh') ||
          url.searchParams.has('forceFresh') ||
          url.searchParams.has('_t') ||
          request.headers.get('Cache-Control')?.includes('no-cache') ||
          request.headers.has('X-Admin-Email');
        
        // 1. Check Cloudflare Global Edge Cache first for public cached requests
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
              e.assigned_leader as exec_assigned_leader,
              s.total_pax as agg_total_pax,
              s.male_pax as agg_male_pax,
              s.female_pax as agg_female_pax,
              s.recent_participants as agg_recent_json
            FROM treks t
            LEFT JOIN event_executions e ON t.hike_number = e.hike_number
            LEFT JOIN trek_participant_summary s ON t.hike_number = s.hike_number
            ORDER BY t.created_at DESC
          `).all();
          results = joined;
        } catch (joinErr) {
          console.warn('Failed to join treks with summary table:', joinErr);
          try {
            const { results: rawTreks } = await env.DB.prepare(
              'SELECT * FROM treks ORDER BY created_at DESC'
            ).all();
            results = rawTreks;
          } catch (_) {
            results = [];
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

          let recentParticipants = [];
          try {
            if (row.agg_recent_json) {
              recentParticipants = typeof row.agg_recent_json === 'string'
                ? JSON.parse(row.agg_recent_json)
                : row.agg_recent_json;
            }
          } catch (_) {}

          const totalPax = Number(row.agg_total_pax) || 0;
          const malePax = Number(row.agg_male_pax) || 0;
          const femalePax = Number(row.agg_female_pax) || 0;

          return {
            ...row,
            max_capacity: row.exec_capacity !== undefined ? row.exec_capacity : row.max_capacity,
            team_leader: row.exec_assigned_leader !== undefined ? row.exec_assigned_leader : row.team_leader,
            hikeNumber: row.hike_number,
            hike_number: row.hike_number,
            participants: totalPax,
            registered_pax: totalPax,
            participants_by_gender: {
              total: totalPax,
              male: malePax,
              female: femalePax,
            },
            recent_participants: recentParticipants,
            data: parsedData,
          };
        });

        const resp = jsonResponse({ success: true, data }, 200, {
          'Cache-Control': isAdminPath || isFresh ? 'no-cache, no-store, must-revalidate' : 'public, max-age=60, s-maxage=60',
          'X-Edge-Cache': 'MISS'
        });

        // Store in Cloudflare Edge Cache asynchronously only for public cached GET requests
        if (!isAdminPath && !isFresh) {
          await putEdgeCache(request, resp, ctx, 60);
        }

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

      // POST /admin/sync-all - Trigger community leaderboard recomputation and participant summary sync
      if (method === 'POST' && path === '/admin/sync-all') {
        await recomputeLeaderboardSnapshot(env);
        await updateTrekParticipantSummary(env);

        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(logAdminActivity(env, request, 'SYNC_LEADERBOARD', 'Recomputed community stats, leaderboard, and participant summaries from D1 tables'));
        } else {
          await logAdminActivity(env, request, 'SYNC_LEADERBOARD', 'Recomputed community stats, leaderboard, and participant summaries from D1 tables');
        }

        return jsonResponse({
          success: true,
          message: '🎉 Successfully updated community stats, recomputed leaderboard, and synchronized participant summaries.'
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

        await logAdminActivity(env, request, 'UPDATE_TREK_STATUS', `Updated trek ${idOrNum} status to '${newStatus}'`, { trekId: idOrNum, status: newStatus });

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

        await logAdminActivity(env, request, 'CLONE_TREK', `Cloned trek '${row.title || 'Trek'}' as '${newTitle}'`, { originalId: idOrNum, clonedId: newId });

        return jsonResponse({
          success: true,
          message: 'Trek cloned successfully',
          data: { id: newId, title: newTitle },
        });
      }

      // PATCH /admin/itineraries/:id/status or PATCH /treks/:id/status - Update Status Toggle (Draft / Published / Archived)
      if (
        method === 'PATCH' &&
        path.includes('/status') &&
        (path.startsWith('/admin/itineraries/') || path.startsWith('/treks/'))
      ) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const rawId = path.replace(/^\/(admin\/itineraries|treks)\//, '').replace(/\/status$/, '');
        const idOrNum = decodeURIComponent(rawId);
        const body = await request.json();
        const newStatus = body.status || (body.data && body.data.status) || 'published';

        const row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        if (!row) {
          return errorResponse('Trek not found to update status', 404);
        }

        let parsedData = {};
        try {
          const rawData = row.data_json || row.data || '{}';
          parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch (e) {}
        parsedData.status = newStatus;

        await env.DB.prepare(`
          UPDATE treks SET
            status = ?,
            data_json = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? OR hike_number = ?
        `).bind(
          newStatus,
          JSON.stringify(parsedData),
          row.id,
          row.hike_number
        ).run();

        await logAdminActivity(env, request, 'UPDATE_TREK_STATUS', `Changed status of '${row.title || 'Trek'}' (#${row.hike_number || idOrNum}) to ${newStatus}`, {
          hike_number: row.hike_number || idOrNum,
          newStatus
        });

        // Invalidate Cloudflare Edge Cache immediately
        await purgeEdgeCache([
          `${url.origin}/treks`,
          `${url.origin}/admin/itineraries`,
          `${url.origin}/treks/${idOrNum}`,
          `${url.origin}/admin/itineraries/${idOrNum}`,
          `${url.origin}/treks/${row.id}`,
          `${url.origin}/admin/itineraries/${row.id}`,
          `${url.origin}/treks/${row.hike_number}`,
          `${url.origin}/admin/itineraries/${row.hike_number}`
        ], ctx);

        return jsonResponse({
          success: true,
          message: `Trek status updated to ${newStatus}`,
          data: {
            id: row.id,
            hike_number: row.hike_number,
            status: newStatus
          }
        });
      }

      // PATCH /admin/itineraries/:id - Event Execution Details
      if (method === 'PATCH' && path.startsWith('/admin/itineraries/')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const idOrNum = decodeURIComponent(path.replace('/admin/itineraries/', ''));
        const body = await request.json();

        // 1. Fetch current trek record
        let row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        const cleanHikeNum = String(idOrNum).match(/\d+/)?.[0] || '';
        if (!row && cleanHikeNum) {
          row = await env.DB.prepare(
            'SELECT * FROM treks WHERE hike_number = ? OR id = ?'
          ).bind(cleanHikeNum, `hike-${cleanHikeNum}`).first();
        }

        if (!row) {
          // If not in treks table yet, create it so execution changes persist cleanly
          const newId = idOrNum.startsWith('v-') ? `hike-${cleanHikeNum || idOrNum}` : idOrNum;
          const initialTitle = body.name || body.title || (cleanHikeNum ? `Hike #${cleanHikeNum}` : 'Himalayan Hike');
          const initialData = {
            title: initialTitle,
            hikeNumber: cleanHikeNum || idOrNum,
            maxCapacity: body.capacity !== undefined ? Number(body.capacity) : 25,
            teamLeader: body.leader || 'Walk Nepal Walk Guide',
            is_cancelled: !!body.data?.is_cancelled,
            cancellation_reason: body.data?.cancellation_reason || '',
            execution_status: body.data?.execution_status || (body.data?.is_cancelled ? 'Cancelled' : 'Active'),
            ...(body.data || {}),
          };

          await env.DB.prepare(`
            INSERT INTO treks (id, hike_number, title, category, max_capacity, team_leader, status, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(
            newId,
            cleanHikeNum || idOrNum,
            initialTitle,
            'Overnight Bus Hikes',
            initialData.maxCapacity,
            initialData.teamLeader,
            'published',
            JSON.stringify(initialData)
          ).run();

          row = {
            id: newId,
            hike_number: cleanHikeNum || idOrNum,
            title: initialTitle,
            max_capacity: initialData.maxCapacity,
            team_leader: initialData.teamLeader,
            status: 'published',
            data_json: JSON.stringify(initialData)
          };
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
        if (body.status) {
          newStatus = body.status;
        }
        // Note: We preserve 'published' status so the public schedule displays the event with the CANCELLED badge and reason instead of hiding it into drafts.

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

        await logAdminActivity(env, request, 'UPDATE_EVENT_EXECUTION', `Updated event execution for trek '${row.title}' (#${row.hike_number || idOrNum})`, {
          hike_number: row.hike_number || idOrNum,
          execution_status: body.data?.execution_status || 'Scheduled',
          assigned_leader: teamLeader,
          capacity: maxCapacity
        });

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
          existing = await env.DB.prepare('SELECT id, hike_number FROM treks WHERE id = ?').bind(trekId).first();
        }
        if (!existing && hikeNum && hikeNum !== 'TBD') {
          existing = await env.DB.prepare('SELECT id, hike_number FROM treks WHERE hike_number = ?').bind(hikeNum).first();
        }

        const priceTiers = dataObj.priceTiers || [];
        const calculatedMinPrice = priceTiers.length > 0 ? Math.min(...priceTiers.map((t) => Number(t.price) || 0)) : 0;
        const calculatedMaxPrice = priceTiers.length > 0 ? Math.max(...priceTiers.map((t) => Number(t.price) || 0)) : 0;

        if (existing) {
          // If hike_number has changed on an existing hike, cascade update registrations, roster, and executions
          if (existing.hike_number && existing.hike_number !== 'TBD' && hikeNum && hikeNum !== 'TBD' && existing.hike_number !== hikeNum) {
            try {
              await env.DB.prepare('UPDATE registrations SET hike_number = ? WHERE hike_number = ?').bind(hikeNum, existing.hike_number).run();
            } catch (_) {}
            try {
              await env.DB.prepare('UPDATE bookings_roster SET hike_number = ? WHERE hike_number = ?').bind(hikeNum, existing.hike_number).run();
            } catch (_) {}
            try {
              await env.DB.prepare('UPDATE event_executions SET hike_number = ? WHERE hike_number = ?').bind(hikeNum, existing.hike_number).run();
            } catch (_) {}
          }

          // Update existing trek including hike_number
          await env.DB.prepare(`
            UPDATE treks SET
              hike_number = ?,
              title = ?, category = ?, status = ?, cover_image_url = ?, hike_date = ?,
              min_price = ?, max_price = ?, currency = ?, meeting_point = ?, meeting_time = ?,
              expected_duration = ?, difficulty = ?, approx_distance = ?, elevation_range = ?,
              elevation_gross = ?, ending_point = ?, team_leader = ?, whatsapp_link = ?,
              itinerary_link = ?, faq_link = ?, max_capacity = ?, data_json = ?,
              author_email = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? OR (id IS NULL AND hike_number = ?)
          `).bind(
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
            body.author_email || body.authorEmail || 'walknepalwalk@gmail.com',
            existing.id || trekId,
            existing.hike_number || hikeNum
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

        await logAdminActivity(env, request, 'UPSERT_TREK', `Upserted trek '${title || 'Trek'}' (#${hikeNum})`, {
          trekId,
          hike_number: hikeNum,
          title
        });

        // Invalidate Cloudflare Edge Cache immediately
        await purgeEdgeCache([
          `${url.origin}/treks`,
          `${url.origin}/admin/itineraries`,
          `${url.origin}/treks/${trekId}`,
          `${url.origin}/admin/itineraries/${trekId}`,
          `${url.origin}/treks/${hikeNum}`,
          `${url.origin}/admin/itineraries/${hikeNum}`
        ], ctx);

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

        await logAdminActivity(env, request, 'DELETE_TREK', `Deleted trek '${idOrNum}'`, { trekId: idOrNum });

        // Invalidate Cloudflare Edge Cache immediately
        await purgeEdgeCache([
          `${url.origin}/treks`,
          `${url.origin}/admin/itineraries`,
          `${url.origin}/treks/${idOrNum}`,
          `${url.origin}/admin/itineraries/${idOrNum}`
        ], ctx);

        return jsonResponse({ success: true, message: `Deleted trek ${idOrNum}` });
      }

      // ===== REGISTRATIONS ENDPOINTS =====

      // GET /registrations - List registrations (Optimized Single LEFT JOIN query)
      if (method === 'GET' && path === '/registrations') {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
        const email = url.searchParams.get('email');
        const phone = url.searchParams.get('phone');
        const hikeNum = url.searchParams.get('hike_number');
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const limit = limitParam ? parseInt(limitParam, 10) : 0;
        const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

        let regSql = `
          SELECT 
            r.*,
            b.registration_status AS roster_registration_status,
            b.payment_status AS roster_payment_status,
            b.paid_amount AS roster_paid_amount,
            b.due_amount AS roster_due_amount,
            b.admin_notes AS roster_admin_notes,
            b.pickup_point AS roster_pickup_point,
            b.trek_date AS roster_trek_date
          FROM registrations r
          LEFT JOIN bookings_roster b ON b.registration_id = CAST(r.id AS TEXT)
        `;
        let regParams = [];
        if (email && phone) {
          const cleanEmail = email.trim().toLowerCase();
          const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
          regSql += ' WHERE (LOWER(r.email_address) = ? OR LOWER(r.user_email) = ?) OR (r.phone LIKE ? OR r.whatsapp_number LIKE ?)';
          regParams.push(cleanEmail, cleanEmail, `%${cleanPhone}%`, `%${cleanPhone}%`);
        } else if (email) {
          const cleanEmail = email.trim().toLowerCase();
          regSql += ' WHERE LOWER(r.email_address) = ? OR LOWER(r.user_email) = ?';
          regParams.push(cleanEmail, cleanEmail);
        } else if (phone) {
          const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
          regSql += ' WHERE (r.phone LIKE ? OR r.whatsapp_number LIKE ?)';
          regParams.push(`%${cleanPhone}%`, `%${cleanPhone}%`);
        } else if (hikeNum) {
          regSql += ' WHERE r.hike_number = ?';
          regParams.push(hikeNum.trim());
        }
        regSql += ' ORDER BY r.timestamp DESC';

        const effectiveLimit = limit > 0 ? limit : (email || hikeNum ? 500 : 120);
        regSql += ' LIMIT ? OFFSET ?';
        regParams.push(effectiveLimit, offset);

        let rawRows = [];
        try {
          const stmt = env.DB.prepare(regSql);
          const { results } = regParams.length > 0 ? await stmt.bind(...regParams).all() : await stmt.all();
          rawRows = results || [];
        } catch (err) {
          console.error('Error fetching registrations with LEFT JOIN from D1:', err);
          return errorResponse('Failed to fetch registrations', 500);
        }

        const mapped = rawRows.map((r) => ({
          ...r,
          person_remarks: r.list_name || '', // Backward-compatibility mapping for companion parsing
          registration_status: r.roster_registration_status || r.registration_status || 'Confirmed',
          status: r.roster_registration_status || r.registration_status || r.status || 'Confirmed',
          payment_status: r.roster_payment_status || r.payment_status || 'Unpaid',
          paid_amount: r.roster_paid_amount !== undefined ? Number(r.roster_paid_amount) : 0,
          due_amount: r.roster_due_amount !== undefined ? Number(r.roster_due_amount) : 0,
          admin_notes: r.roster_admin_notes || r.admin_notes || '',
          pickup_point: r.roster_pickup_point || r.pickup_point || '',
        }));

        const responseHeaders = {};
        if (hikeNum) {
          responseHeaders['Cache-Control'] = 'public, max-age=30, s-maxage=60';
        }

        return jsonResponse({ success: true, data: mapped }, 200, responseHeaders);
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

        // 2. Fetch existing bookings_roster record to preserve unmodified fields
        let existingRoster = null;
        try {
          existingRoster = await env.DB.prepare(
            'SELECT * FROM bookings_roster WHERE registration_id = ?'
          ).bind(String(id)).first();
        } catch (_) {}

        // Strict target field mapping: preserve existing field values when omitted in partial requests
        const status = body.status !== undefined ? body.status : (existingRoster?.registration_status ?? (regRow?.status || 'Confirmed'));
        const payment_status = body.payment_status !== undefined ? body.payment_status : (existingRoster?.payment_status ?? 'Unpaid');
        const paid = body.paid_amount !== undefined ? Number(body.paid_amount) : (existingRoster?.paid_amount !== undefined ? Number(existingRoster.paid_amount) : 0);
        const due = body.due_amount !== undefined ? Number(body.due_amount) : (existingRoster?.due_amount !== undefined ? Number(existingRoster.due_amount) : 0);
        const updates = body.admin_notes !== undefined ? body.admin_notes : (existingRoster?.admin_notes ?? '');
        const pickup_point = body.pickup_point !== undefined ? body.pickup_point : (existingRoster?.pickup_point ?? (regRow?.pickup_point || ''));

        // Keep raw registrations table status in sync if status was explicitly updated
        if (body.status !== undefined) {
          try {
            await env.DB.prepare('UPDATE registrations SET status = ? WHERE id = ?').bind(body.status, String(id)).run();
          } catch (_) {}
        }

        // 3. Upsert into bookings_roster table
        try {
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

        // Sync precomputed trek participant summary table for this hike
        const targetHikeNum = body.hike_number || regRow?.hike_number || existingRoster?.hike_number;
        if (targetHikeNum) {
          await updateTrekParticipantSummary(env, targetHikeNum);
        }

        await logAdminActivity(env, request, 'UPDATE_BOOKING', `Updated booking/roster for '${regRow?.full_name || 'Hiker'}' (#${regRow?.hike_number || ''})`, {
          registration_id: id,
          status,
          payment_status,
          paid_amount: paid,
          due_amount: due,
          admin_notes: updates,
          pickup_point
        });

        return jsonResponse({
          success: true,
          message: 'Bookings & Roster details updated in D1 successfully'
        });
      }

      // DELETE /registrations/:id - Delete registration from Cloudflare D1
      if (method === 'DELETE' && path.startsWith('/registrations/')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const id = decodeURIComponent(path.replace('/registrations/', ''));

        let regHikeNum = null;
        try {
          const rRow = await env.DB.prepare('SELECT hike_number FROM registrations WHERE id = ?').bind(id).first();
          if (rRow && rRow.hike_number) regHikeNum = rRow.hike_number;
        } catch (_) {}

        try {
          await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(id).run();
          await env.DB.prepare('DELETE FROM bookings_roster WHERE registration_id = ?').bind(String(id)).run();
          cachedTrekAggMap = null;
          if (regHikeNum) await updateTrekParticipantSummary(env, regHikeNum);
          await logAdminActivity(env, request, 'DELETE_REGISTRATION', `Deleted registration ID ${id}`, { registration_id: id });
          return jsonResponse({ success: true, message: 'Registration deleted from D1 successfully' });
        } catch (dbErr) {
          console.error('Failed to delete registration from D1:', dbErr);
          try {
            await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(Number(id) || id).run();
            await env.DB.prepare('DELETE FROM bookings_roster WHERE registration_id = ?').bind(String(id)).run();
            cachedTrekAggMap = null;
            if (regHikeNum) await updateTrekParticipantSummary(env, regHikeNum);
            await logAdminActivity(env, request, 'DELETE_REGISTRATION', `Deleted registration ID ${id}`, { registration_id: id });
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
        if (body.hike_number) {
          await updateTrekParticipantSummary(env, body.hike_number);
        }
        return jsonResponse({ success: true, message: 'Registration saved successfully', id: insertedId });
      }

      // POST /registrations/batch - Bulk create registrations & roster entries efficiently in D1 batch transactions
      if (method === 'POST' && path === '/registrations/batch') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const records = Array.isArray(body) ? body : (body.records || body.registrations || []);
        if (!Array.isArray(records) || records.length === 0) {
          return errorResponse('records array required', 400);
        }

        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const affectedEmails = new Set();
        const affectedHikeNumbers = new Set();
        const chunkSize = 25;

        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const stmts = [];

          for (const item of chunk) {
            const hikeNum = String(item.hike_number || item.hikeNumber || '').trim();
            if (hikeNum) affectedHikeNumbers.add(hikeNum);
            const trekName = String(item.trek_name || item.trekName || item.which_hike || '').trim();
            const fullName = String(item.full_name || item.name || 'Anonymous Hiker').trim();
            const email = String(item.email_address || item.email || '').trim().toLowerCase();
            const phone = String(item.phone || '').trim();
            const whatsapp = String(item.whatsapp_number || item.whatsapp || phone || '').trim();
            const backupContact = String(item.emergency_backup_contact || '').trim();
            const profession = String(item.profession || '').trim();
            const partOfGroup = String(item.part_of_group || (item.pax && Number(item.pax) > 1 ? 'Group' : 'Solo')).trim();
            const pax = Number(item.pax) || (item.pax_desc ? (parseInt(item.pax_desc, 10) || 1) : 1);
            const ageGroup = String(item.age_group || '').trim();
            const gender = String(item.gender || '').trim();
            const fitness = String(item.fitness || item.fitness_level || '').trim();
            const medicalCondition = String(item.medical_condition || 'No').trim();
            const recentHikes = String(item.recent_hikes || '').trim();
            const agreement = String(item.agreement || 'Yes').trim();
            const suggestions = String(item.suggestions || '').trim();
            const guideMode = String(item.guide_mode || 'Guided').trim();
            const transportMode = String(item.transport_mode || 'Bus').trim();
            const listName = String(item.list_name || item.person_remarks || (pax > 1 ? `${pax} pax` : 'Solo')).trim();
            const regTimestamp = String(item.timestamp || currentTimestamp).trim();
            const paid = Number(item.paid_amount !== undefined ? item.paid_amount : item.paid) || 0;
            const due = Number(item.due_amount !== undefined ? item.due_amount : item.due) || 0;
            const pickupPoint = String(item.pickup_point || item.pickupPoint || '').trim();

            let payStatus = item.payment_status;
            if (!payStatus) {
              if (paid > 0 && due === 0) payStatus = 'Paid';
              else if (paid > 0 && due > 0) payStatus = 'Partial';
              else if (due > 0 && paid === 0) payStatus = 'Due';
              else payStatus = 'Unpaid';
            }

            if (email) affectedEmails.add(email);

            stmts.push(
              env.DB.prepare(`
                INSERT INTO registrations (
                  hike_number, trek_name, full_name, email_address, phone, whatsapp_number,
                  emergency_backup_contact, profession, part_of_group, pax, age_group, gender,
                  fitness, medical_condition, recent_hikes, agreement, suggestions, guide_mode,
                  transport_mode, list_name, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                hikeNum, trekName, fullName, email, phone, whatsapp,
                backupContact, profession, partOfGroup, pax, ageGroup, gender,
                fitness, medicalCondition, recentHikes, agreement, suggestions, guideMode,
                transportMode, listName, regTimestamp
              )
            );

            stmts.push(
              env.DB.prepare(`
                INSERT INTO bookings_roster (
                  hike_number, trek_name, trek_date, full_name, phone, email, whatsapp,
                  registration_status, payment_status, paid_amount, due_amount, pickup_point,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(
                hikeNum, trekName, regTimestamp, fullName, phone, email, whatsapp,
                payStatus, paid, due, pickupPoint
              )
            );
          }

          if (stmts.length > 0) {
            await env.DB.batch(stmts);
          }
        }

        cachedTrekAggMap = null;

        // Synchronize precomputed trek participant summaries for all affected hikes
        for (const hn of affectedHikeNumbers) {
          await updateTrekParticipantSummary(env, hn);
        }

        return jsonResponse({
          success: true,
          message: `Successfully batch inserted ${records.length} registrations and bookings`,
          count: records.length,
          uniqueHikers: affectedEmails.size
        });
      }

      // ===== HIKER PROFILE & LEADERBOARD ENDPOINTS =====

      // GET /hiker/profile - REMOVED

      // POST or PUT /hiker/profile - REMOVED

      // GET /hiker/history - REMOVED

      // POST /hiker/history - REMOVED

      // GET /leaderboard or GET /leaderboard/master - Returns the single pre-computed snapshot
      if (method === 'GET' && (path === '/leaderboard' || path === '/leaderboard/master')) {
        if (!env.DB) return jsonResponse({ ok: true, success: true, stats: {}, hikers: [] });

        const isFresh = url.searchParams.has('fresh');
        if (!isFresh) {
          const cached = await matchEdgeCache(request);
          if (cached) return cached;
        }

        let snapshot = null;
        try {
          const row = await env.DB.prepare(
            "SELECT data_json FROM system_snapshots WHERE key = 'leaderboard_master'"
          ).first();
          if (row && row.data_json) {
            snapshot = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
          }
        } catch (_) {}

        if (!snapshot) {
          // If no snapshot exists and we can't build one, return defaults.
          // Note: recomputeLeaderboardSnapshot is now primarily for merging D1 milestones/growth curve
          // into existing Sheet data, not for bootstrapping a full leaderboard.
          snapshot = { ok: true, stats: {}, hikers: [] };
        }

        const resp = jsonResponse({
          ok: true,
          success: true,
          ...snapshot,
          data: snapshot.hikers || []
        }, 200, {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Edge-Cache': 'MISS'
        });

        await putEdgeCache(request, resp, ctx, 300);
        return resp;
      }

      // POST /admin/recompute-leaderboard - Trigger manual snapshot calculation
      if (method === 'POST' && path === '/admin/recompute-leaderboard') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        const snapshot = await recomputeLeaderboardSnapshot(env, true);
        return jsonResponse({
          success: true,
          message: 'Leaderboard master snapshot recomputed and stored in system_snapshots',
          stats: snapshot?.stats,
          hikersCount: snapshot?.hikers?.length || 0
        });
      }

      // POST /admin/recompute-participant-summary - Trigger participant summary recalculation
      if (method === 'POST' && (path === '/admin/recompute-participant-summary' || path === '/admin/recompute-summaries')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        await updateTrekParticipantSummary(env);
        return jsonResponse({
          success: true,
          message: 'Trek participant summary table refreshed and synchronized successfully.'
        });
      }

      // POST /admin/sync-leaderboard-sheet or POST /leaderboard/sync - Ingest leaderboard data from Google Sheet GAS URL
      if (method === 'POST' && (path === '/admin/sync-leaderboard-sheet' || path === '/leaderboard/sync')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);
        
        const body = await request.json();
        const gasUrl = body.gasUrl;
        
        if (!gasUrl) return errorResponse('Missing gasUrl in request body', 400);

        try {
          const res = await fetch(gasUrl);
          if (!res.ok) throw new Error(`Google Sheets API returned ${res.status}`);
          
          const sheetData = await res.json();
          if (!sheetData || (sheetData.ok === false) || !Array.isArray(sheetData.hikers)) {
            throw new Error(sheetData.error || 'Invalid data format from Google Sheets');
          }

          // Force update the system snapshot
          await env.DB.prepare(
            "INSERT OR REPLACE INTO system_snapshots (key, data_json, updated_at) VALUES (?, ?, ?)"
          ).bind('leaderboard_master', JSON.stringify(sheetData), new Date().toISOString()).run();

          // Log the action
          await env.DB.prepare(
            "INSERT INTO admin_activity_logs (admin_email, action_type, description, created_at) VALUES (?, ?, ?, ?)"
          ).bind(
            body.adminEmail || 'admin@walknepalwalk.com', 
            'SYNC_LEADERBOARD', 
            `Leaderboard synced from Google Sheets. ${sheetData.hikers.length} hikers, ${sheetData.growthCurve?.length || 0} events updated.`,
            new Date().toISOString()
          ).run();

          return jsonResponse({
            success: true,
            message: `Successfully synced ${sheetData.hikers.length} hikers from Google Sheets.`,
            count: sheetData.hikers.length,
            stats: sheetData.stats
          });
        } catch (err) {
          return errorResponse('Failed to sync from Google Sheets: ' + err.message, 500);
        }
      }

      // GET /admin/logs - Query activity logs with pagination and filters
      if (method === 'GET' && path === '/admin/logs') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
        const action = url.searchParams.get('action');
        const searchEmail = url.searchParams.get('email');

        let query = 'SELECT id, admin_email, action_type, description, metadata_json, created_at FROM admin_activity_logs';
        let countQuery = 'SELECT COUNT(*) as total FROM admin_activity_logs';
        let conditions = [];
        let params = [];

        if (action) {
          conditions.push('action_type = ?');
          params.push(action);
        }
        if (searchEmail) {
          conditions.push('admin_email = ?');
          params.push(searchEmail.trim().toLowerCase());
        }

        if (conditions.length > 0) {
          const condStr = ' WHERE ' + conditions.join(' AND ');
          query += condStr;
          countQuery += condStr;
        }

        query += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
        
        const countParams = [...params];
        const selectParams = [...params, limit, offset];

        try {
          const batchResults = await env.DB.batch([
            env.DB.prepare(countQuery).bind(...countParams),
            env.DB.prepare(query).bind(...selectParams)
          ]);

          const total = batchResults[0]?.results?.[0]?.total || 0;
          const logs = batchResults[1]?.results || [];

          return jsonResponse({
            success: true,
            total,
            limit,
            offset,
            data: logs
          });
        } catch (err) {
          return errorResponse('Failed to fetch activity logs: ' + err.message, 500);
        }
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

      return errorResponse(`Route ${method} ${path} not found`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  },
};
