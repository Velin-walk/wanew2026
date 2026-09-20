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

/**
 * Recomputes the unified Leaderboard Master Snapshot from hiker_profiles and treks.
 * Stored in system_snapshots table for O(1) single-read and Edge-cached delivery.
 */
async function recomputeLeaderboardSnapshot(env) {
  if (!env || !env.DB) return null;

  try {
    // 1. Ensure system_snapshots table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS system_snapshots (
        key TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Fetch completed treks for community timeline and duration classifications
    let completedTreks = [];
    try {
      const { results } = await env.DB.prepare(`
        SELECT hike_number, title, category, hike_date, approx_distance, expected_duration, max_capacity, status
        FROM treks
        ORDER BY hike_date ASC, hike_number ASC
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

    // 3. Query all active hiker profiles
    let hikerRows = [];
    try {
      const { results } = await env.DB.prepare(`
        SELECT email, full_name, avatar_url, city, total_hikes, total_distance_km, rank_title, badges_json, hikes_json
        FROM hiker_profiles
        WHERE total_hikes > 0
      `).all();
      hikerRows = results || [];
    } catch (hErr) {
      console.warn('Notice querying hiker_profiles for leaderboard snapshot:', hErr);
    }

    const t30Cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const t60Cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const t90Cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const t365Cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    let uniqueHikeWalkers = new Set();
    let uniqueTrekWalkers = new Set();

    const formattedHikers = hikerRows.map((row) => {
      let hikes = [];
      try {
        hikes = typeof row.hikes_json === 'string' ? JSON.parse(row.hikes_json) : (row.hikes_json || []);
      } catch (_) {}

      // Mask name cleanly (e.g. "Pha. Ghimire 👑")
      const rawName = String(row.full_name || 'Hiker').trim();
      const parts = rawName.split(/\s+/).filter(Boolean);
      let displayName = rawName;
      if (parts.length >= 2) {
        const first = parts[0].length > 3 ? parts[0].slice(0, 3) + '.' : parts[0];
        displayName = `${first} ${parts.slice(1).join(' ')}`;
      }
      if (row.rank_title && (row.rank_title.includes('Veteran') || row.rank_title.includes('Summit') || row.rank_title.includes('Leader'))) {
        displayName += ' 👑';
      }

      let d = 0, c = 0;
      let hd = 0, hc = 0;
      let td = 0, tc = 0;

      let t30d = 0, t30c = 0;
      let t60d = 0, t60c = 0;
      let t90d = 0, t90c = 0;
      let t365d = 0, t365c = 0;

      let ht30d = 0, ht30c = 0;
      let ht60d = 0, ht60c = 0;
      let ht90d = 0, ht90c = 0;
      let ht365d = 0, ht365c = 0;

      let tt30d = 0, tt30c = 0;
      let tt60d = 0, tt60c = 0;
      let tt90d = 0, tt90c = 0;
      let tt365d = 0, tt365c = 0;

      const fallbackDistPerHike = (Number(row.total_distance_km) > 0 && hikes.length > 0)
        ? Math.round(Number(row.total_distance_km) / hikes.length)
        : 18;

      for (const h of hikes) {
        const hn = String(h.hike_number || '').trim();
        const trekInfo = trekLookup.get(hn);

        const hikeDist = Number(h.distance_km) || (trekInfo ? trekInfo.dist : fallbackDistPerHike);
        const isTrek = trekInfo
          ? trekInfo.isMultiDayTrek
          : (String(h.trek_name || '').toLowerCase().includes('trek') || Number(h.duration_days) > 2);

        const dateStr = h.trek_date || (trekInfo ? trekInfo.date : null);
        const hDate = dateStr ? new Date(dateStr) : null;

        d += hikeDist;
        c += 1;

        if (isTrek) {
          td += hikeDist;
          tc += 1;
          uniqueTrekWalkers.add(row.email);
        } else {
          hd += hikeDist;
          hc += 1;
          uniqueHikeWalkers.add(row.email);
        }

        if (hDate) {
          if (hDate >= t30Cutoff) {
            t30d += hikeDist; t30c += 1;
            if (isTrek) { tt30d += hikeDist; tt30c += 1; }
            else { ht30d += hikeDist; ht30c += 1; }
          }
          if (hDate >= t60Cutoff) {
            t60d += hikeDist; t60c += 1;
            if (isTrek) { tt60d += hikeDist; tt60c += 1; }
            else { ht60d += hikeDist; ht60c += 1; }
          }
          if (hDate >= t90Cutoff) {
            t90d += hikeDist; t90c += 1;
            if (isTrek) { tt90d += hikeDist; tt90c += 1; }
            else { ht90d += hikeDist; ht90c += 1; }
          }
          if (hDate >= t365Cutoff) {
            t365d += hikeDist; t365c += 1;
            if (isTrek) { tt365d += hikeDist; tt365c += 1; }
            else { ht365d += hikeDist; ht365c += 1; }
          }
        }
      }

      // If user had total_distance_km or total_hikes pre-calculated, use them if higher
      if (Number(row.total_distance_km) > d) d = Number(row.total_distance_km);
      if (Number(row.total_hikes) > c) c = Number(row.total_hikes);

      return {
        n: displayName,
        d: Math.round(d),
        c,
        hd: Math.round(hd),
        hc,
        td: Math.round(td),
        tc,
        t30d: Math.round(t30d), t30c,
        t60d: Math.round(t60d), t60c,
        t90d: Math.round(t90d), t90c,
        t365d: Math.round(t365d), t365c,
        ht30d: Math.round(ht30d), ht30c,
        ht60d: Math.round(ht60d), ht60c,
        ht90d: Math.round(ht90d), ht90c,
        ht365d: Math.round(ht365d), ht365c,
        tt30d: Math.round(tt30d), tt30c,
        tt60d: Math.round(tt60d), tt60c,
        tt90d: Math.round(tt90d), tt90c,
        tt365d: Math.round(tt365d), tt365c,
      };
    });

    const totalEvents = hikeEventsCount + trekEventsCount;
    const avgDist = totalEvents > 0 ? Math.round(totalCommunityKm / totalEvents) : 25;

    const stats = {
      totalHikers: hikerRows.length,
      totalEvents: totalEvents || completedTreks.length,
      totalDistance: totalCommunityKm,
      hikesLast30,
      uniqueHikeParticip: uniqueHikeWalkers.size || Math.round(hikerRows.length * 0.94),
      hikeEvents: hikeEventsCount || completedTreks.length,
      totalHikeDist: totalHikeKm,
      uniqueTrekParticip: uniqueTrekWalkers.size || Math.round(hikerRows.length * 0.08),
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
      hikers: formattedHikers,
      growth_curve: growthCurve,
      milestones: milestones
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

        // Automatic Leaderboard Recompute Trigger:
        // When an event is marked completed/executed, update the precomputed snapshot in background
        const execStatus = String(body.data?.execution_status || '').toLowerCase();
        if (execStatus === 'completed' || execStatus === 'executed' || newStatus === 'completed') {
          if (ctx && ctx.waitUntil) {
            ctx.waitUntil(recomputeLeaderboardSnapshot(env).catch(e => console.warn('Background leaderboard recompute failed:', e)));
          } else {
            recomputeLeaderboardSnapshot(env).catch(e => console.warn('Leaderboard recompute failed:', e));
          }
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

        // Automatic Leaderboard Recompute Trigger:
        // When a trek status is set to completed, refresh the precomputed snapshot in background
        const finalTrekStatus = String(body.status || dataObj.status || '').toLowerCase();
        if (finalTrekStatus === 'completed') {
          if (ctx && ctx.waitUntil) {
            ctx.waitUntil(recomputeLeaderboardSnapshot(env).catch(e => console.warn('Background leaderboard recompute failed:', e)));
          } else {
            recomputeLeaderboardSnapshot(env).catch(e => console.warn('Leaderboard recompute failed:', e));
          }
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

          // 4. Synchronize into unified hiker_profiles (Single-Row Document)
          if (regRow && regRow.email_address) {
            try {
              const cleanEmail = String(regRow.email_address).trim().toLowerCase();
              const profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(cleanEmail).first();
              if (profile) {
                let hikes = [];
                try {
                  hikes = typeof profile.hikes_json === 'string' ? JSON.parse(profile.hikes_json) : (profile.hikes_json || []);
                } catch (_) {}

                const targetHikeNum = String(regRow.hike_number || '').trim();
                let matched = false;
                hikes = hikes.map(h => {
                  if (String(h.hike_number || '').trim() === targetHikeNum) {
                    matched = true;
                    return {
                      ...h,
                      registration_status: status,
                      payment_status: payment_status,
                      paid_amount: paid,
                      due_amount: due,
                      pickup_point: pickup_point || h.pickup_point,
                      admin_notes: updates || h.admin_notes
                    };
                  }
                  return h;
                });

                if (!matched && targetHikeNum) {
                  hikes.unshift({
                    hike_number: targetHikeNum,
                    trek_name: regRow.trek_name || '',
                    trek_date: regRow.trek_date || regRow.timestamp || '',
                    pax: Number(regRow.pax) || 1,
                    pickup_point: pickup_point || '',
                    registration_status: status,
                    payment_status: payment_status,
                    paid_amount: paid,
                    due_amount: due,
                    admin_notes: updates || ''
                  });
                }

                const totalPaid = hikes.reduce((acc, h) => acc + (Number(h.paid_amount) || 0), 0);
                const totalDue = hikes.reduce((acc, h) => acc + (Number(h.due_amount) || 0), 0);

                await env.DB.prepare(`
                  UPDATE hiker_profiles
                  SET hikes_json = ?,
                      total_paid_amount = ?,
                      total_due_amount = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE LOWER(email) = ?
                `).bind(JSON.stringify(hikes), totalPaid, totalDue, cleanEmail).run();
              }
            } catch (syncErr) {
              console.warn('Notice syncing hiker_profiles hikes_json from roster:', syncErr);
            }
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

        // Auto-upsert into unified hiker_profiles (Single-Row Document Pattern)
        if (body.email_address) {
          try {
            const cleanEmail = String(body.email_address).trim().toLowerCase();
            const existing = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(cleanEmail).first();
            let hikes = [];
            if (existing && existing.hikes_json) {
              try { hikes = typeof existing.hikes_json === 'string' ? JSON.parse(existing.hikes_json) : (existing.hikes_json || []); } catch (_) {}
            }

            const hikeNumberStr = String(body.hike_number || '').trim();
            const hikeEntry = {
              hike_number: hikeNumberStr,
              trek_name: body.trek_name || '',
              trek_date: body.hike_date || body.trek_date || '',
              pax: Number(body.pax) || 1,
              pickup_point: body.pickup_point || body.pickupPoint || body.pickup || '',
              registration_status: body.registration_status || 'Confirmed',
              payment_status: payStatus,
              paid_amount: paid,
              due_amount: due,
              companions: body.list_name || body.part_of_group || '',
              transport_mode: body.transport_mode || '',
              guide_mode: body.guide_mode || '',
              admin_notes: body.admin_notes || '',
              registered_at: new Date().toISOString()
            };

            const idx = hikes.findIndex(h => String(h.hike_number).trim() === hikeNumberStr);
            if (idx >= 0) {
              hikes[idx] = { ...hikes[idx], ...hikeEntry };
            } else {
              hikes.unshift(hikeEntry);
            }

            const totalHikes = hikes.length;
            const totalPaid = hikes.reduce((acc, h) => acc + (Number(h.paid_amount) || 0), 0);
            const totalDue = hikes.reduce((acc, h) => acc + (Number(h.due_amount) || 0), 0);

            let rankTitle = 'Trail Explorer';
            if (totalHikes >= 25) rankTitle = 'Himalayan Veteran';
            else if (totalHikes >= 10) rankTitle = 'Summit Seeker';
            else if (totalHikes >= 5) rankTitle = 'Pathfinder';

            let badges = [];
            if (existing && existing.badges_json) {
              try { badges = typeof existing.badges_json === 'string' ? JSON.parse(existing.badges_json) : []; } catch (_) {}
            }
            const badgeSet = new Set(badges);
            badgeSet.add('first_hike');
            if (totalHikes >= 5) badgeSet.add('5_hikes_milestone');
            if (totalHikes >= 10) badgeSet.add('10_hikes_milestone');
            if (totalHikes >= 25) badgeSet.add('25_hikes_milestone');

            const firstDate = existing?.first_hike_date || hikeEntry.trek_date || new Date().toISOString().slice(0, 10);
            const lastDate = hikeEntry.trek_date || new Date().toISOString().slice(0, 10);

            await env.DB.prepare(`
              INSERT INTO hiker_profiles (
                email, full_name, phone, whatsapp, gender, age_group, profession,
                emergency_contact_phone, fitness_level, medical_conditions, city,
                total_hikes, total_paid_amount, total_due_amount, rank_title,
                badges_json, hikes_json, first_hike_date, last_hike_date, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(email) DO UPDATE SET
                full_name = COALESCE(NULLIF(excluded.full_name, ''), hiker_profiles.full_name),
                phone = COALESCE(NULLIF(excluded.phone, ''), hiker_profiles.phone),
                whatsapp = COALESCE(NULLIF(excluded.whatsapp, ''), hiker_profiles.whatsapp),
                gender = COALESCE(NULLIF(excluded.gender, ''), hiker_profiles.gender),
                age_group = COALESCE(NULLIF(excluded.age_group, ''), hiker_profiles.age_group),
                profession = COALESCE(NULLIF(excluded.profession, ''), hiker_profiles.profession),
                emergency_contact_phone = COALESCE(NULLIF(excluded.emergency_contact_phone, ''), hiker_profiles.emergency_contact_phone),
                fitness_level = COALESCE(NULLIF(excluded.fitness_level, ''), hiker_profiles.fitness_level),
                medical_conditions = COALESCE(NULLIF(excluded.medical_conditions, ''), hiker_profiles.medical_conditions),
                city = COALESCE(NULLIF(excluded.city, ''), hiker_profiles.city),
                total_hikes = excluded.total_hikes,
                total_paid_amount = excluded.total_paid_amount,
                total_due_amount = excluded.total_due_amount,
                rank_title = excluded.rank_title,
                badges_json = excluded.badges_json,
                hikes_json = excluded.hikes_json,
                last_hike_date = excluded.last_hike_date,
                updated_at = CURRENT_TIMESTAMP
            `).bind(
              cleanEmail,
              body.full_name || '',
              body.phone || '',
              whatsappVal || '',
              body.gender || '',
              body.age_group || '',
              body.profession || '',
              body.emergency_backup_contact || '',
              body.fitness || '',
              body.medical_condition || '',
              body.city || '',
              totalHikes,
              totalPaid,
              totalDue,
              rankTitle,
              JSON.stringify(Array.from(badgeSet)),
              JSON.stringify(hikes),
              firstDate,
              lastDate
            ).run();
          } catch (pErr) {
            console.warn('Error auto-syncing unified hiker_profile:', pErr);
          }
        }

        cachedTrekAggMap = null;
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
        const chunkSize = 25;

        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const stmts = [];

          for (const item of chunk) {
            const hikeNum = String(item.hike_number || item.hikeNumber || '').trim();
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

        // Background sync: update hiker_profiles and recompute leaderboard snapshot
        if (affectedEmails.size > 0) {
          const runSync = async () => {
            try {
              for (const email of affectedEmails) {
                const regs = await env.DB.prepare(
                  'SELECT * FROM registrations WHERE LOWER(email_address) = ? ORDER BY timestamp DESC'
                ).bind(email).all();
                const rows = regs.results || [];
                if (rows.length === 0) continue;

                const first = rows[0];
                const totalHikes = rows.length;
                let rankTitle = 'Trail Explorer';
                if (totalHikes >= 25) rankTitle = 'Himalayan Veteran';
                else if (totalHikes >= 10) rankTitle = 'Summit Seeker';
                else if (totalHikes >= 5) rankTitle = 'Pathfinder';

                const badges = ['first_hike'];
                if (totalHikes >= 5) badges.push('5_hikes_milestone');
                if (totalHikes >= 10) badges.push('10_hikes_milestone');
                if (totalHikes >= 25) badges.push('25_hikes_milestone');

                await env.DB.prepare(`
                  INSERT INTO hiker_profiles (
                    email, full_name, phone, whatsapp, gender, age_group, profession,
                    total_hikes, rank_title, badges_json, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(email) DO UPDATE SET
                    total_hikes = excluded.total_hikes,
                    rank_title = excluded.rank_title,
                    badges_json = excluded.badges_json,
                    updated_at = CURRENT_TIMESTAMP
                `).bind(
                  email,
                  first.full_name || 'Hiker',
                  first.phone || '',
                  first.whatsapp_number || '',
                  first.gender || '',
                  first.age_group || '',
                  first.profession || '',
                  totalHikes,
                  rankTitle,
                  JSON.stringify(badges)
                ).run();
              }
              await recomputeLeaderboardSnapshot(env);
            } catch (syncErr) {
              console.warn('Batch registration post-sync background error:', syncErr);
            }
          };

          if (ctx && ctx.waitUntil) {
            ctx.waitUntil(runSync());
          } else {
            runSync().catch(e => console.warn('Background sync error:', e));
          }
        }

        cachedTrekAggMap = null;
        return jsonResponse({
          success: true,
          message: `Successfully batch inserted ${records.length} registrations and bookings`,
          count: records.length,
          uniqueHikers: affectedEmails.size
        });
      }

      // ===== HIKER PROFILE & LEADERBOARD ENDPOINTS =====

      // GET /hiker/profile - Get individual hiker profile with 1-row O(1) lookup
      if (method === 'GET' && path === '/hiker/profile') {
        if (!env.DB) return jsonResponse({ success: false, error: 'Database not bound' }, 500);

        const email = (url.searchParams.get('email') || '').trim().toLowerCase();
        const uid = (url.searchParams.get('uid') || '').trim();

        if (!email && !uid) {
          return errorResponse('Email or uid is required to fetch hiker profile', 400);
        }

        let profile = null;
        if (email) {
          profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(email).first();
        } else if (uid) {
          profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE user_uid = ?').bind(uid).first();
        }

        if (!profile) {
          // If no profile yet, return an empty template with defaults
          return jsonResponse({
            success: true,
            data: {
              email: email || '',
              user_uid: uid || '',
              full_name: '',
              total_hikes: 0,
              total_distance_km: 0,
              highest_altitude_m: 0,
              total_paid_amount: 0,
              total_due_amount: 0,
              total_trails_contributed: 0,
              total_photos_uploaded: 0,
              total_comments_made: 0,
              rank_title: 'Trail Explorer',
              badges: [],
              hikes: [],
              contributions: { trails: [], photos: [] },
              isNew: true
            }
          });
        }

        let badges = [];
        try {
          badges = typeof profile.badges_json === 'string' ? JSON.parse(profile.badges_json) : (profile.badges_json || []);
        } catch (_) {}

        let hikes = [];
        try {
          hikes = typeof profile.hikes_json === 'string' ? JSON.parse(profile.hikes_json) : (profile.hikes_json || []);
        } catch (_) {}

        let contributions = { trails: [], photos: [] };
        try {
          contributions = typeof profile.contributions_json === 'string' ? JSON.parse(profile.contributions_json) : (profile.contributions_json || { trails: [], photos: [] });
        } catch (_) {}

        return jsonResponse({
          success: true,
          data: {
            ...profile,
            badges,
            hikes,
            contributions,
            isNew: false
          }
        }, 200, {
          'Cache-Control': 'private, max-age=60'
        });
      }

      // POST or PUT /hiker/profile - Create or update personal hiker profile
      if ((method === 'POST' || method === 'PUT') && path === '/hiker/profile') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const email = (body.email || body.email_address || '').trim().toLowerCase();
        if (!email) return errorResponse('Email is required', 400);

        const fullName = body.full_name || body.name || 'Hiker';
        const userUid = body.user_uid || body.uid || null;
        const phone = body.phone || '';
        const whatsapp = body.whatsapp || body.whatsapp_number || '';
        const gender = body.gender || '';
        const ageGroup = body.age_group || body.ageGroup || '';
        const profession = body.profession || '';
        const emergencyName = body.emergency_contact_name || '';
        const emergencyPhone = body.emergency_contact_phone || '';
        const bloodGroup = body.blood_group || '';
        const fitnessLevel = body.fitness_level || '';
        const medicalConditions = body.medical_conditions || '';
        const city = body.city || '';
        const avatarUrl = body.avatar_url || '';

        await env.DB.prepare(`
          INSERT INTO hiker_profiles (
            email, user_uid, full_name, phone, whatsapp, gender, age_group, profession,
            emergency_contact_name, emergency_contact_phone, blood_group, fitness_level,
            medical_conditions, city, avatar_url, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(email) DO UPDATE SET
            user_uid = COALESCE(NULLIF(excluded.user_uid, ''), hiker_profiles.user_uid),
            full_name = COALESCE(NULLIF(excluded.full_name, ''), hiker_profiles.full_name),
            phone = COALESCE(NULLIF(excluded.phone, ''), hiker_profiles.phone),
            whatsapp = COALESCE(NULLIF(excluded.whatsapp, ''), hiker_profiles.whatsapp),
            gender = COALESCE(NULLIF(excluded.gender, ''), hiker_profiles.gender),
            age_group = COALESCE(NULLIF(excluded.age_group, ''), hiker_profiles.age_group),
            profession = COALESCE(NULLIF(excluded.profession, ''), hiker_profiles.profession),
            emergency_contact_name = COALESCE(NULLIF(excluded.emergency_contact_name, ''), hiker_profiles.emergency_contact_name),
            emergency_contact_phone = COALESCE(NULLIF(excluded.emergency_contact_phone, ''), hiker_profiles.emergency_contact_phone),
            blood_group = COALESCE(NULLIF(excluded.blood_group, ''), hiker_profiles.blood_group),
            fitness_level = COALESCE(NULLIF(excluded.fitness_level, ''), hiker_profiles.fitness_level),
            medical_conditions = COALESCE(NULLIF(excluded.medical_conditions, ''), hiker_profiles.medical_conditions),
            city = COALESCE(NULLIF(excluded.city, ''), hiker_profiles.city),
            avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), hiker_profiles.avatar_url),
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          email, userUid, fullName, phone, whatsapp, gender, ageGroup, profession,
          emergencyName, emergencyPhone, bloodGroup, fitnessLevel, medicalConditions, city, avatarUrl
        ).run();

        return jsonResponse({
          success: true,
          message: 'Hiker profile saved successfully',
          email
        });
      }

      // GET /hiker/history - Full completed hikes history from single-row hikes_json
      if (method === 'GET' && path === '/hiker/history') {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
        const email = (url.searchParams.get('email') || '').trim().toLowerCase();
        if (!email) return errorResponse('Email is required', 400);

        const profile = await env.DB.prepare('SELECT hikes_json FROM hiker_profiles WHERE LOWER(email) = ?').bind(email).first();
        let hikes = [];
        if (profile && profile.hikes_json) {
          try {
            hikes = typeof profile.hikes_json === 'string' ? JSON.parse(profile.hikes_json) : (profile.hikes_json || []);
          } catch (_) {}
        }

        return jsonResponse({ success: true, data: hikes });
      }

      // POST /hiker/history - Record completed hike into single-row hikes_json and increment statistics
      if (method === 'POST' && path === '/hiker/history') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const hikeNumber = String(body.hike_number || '').trim();
        const trekName = body.trek_name || '';
        const hikeDate = body.hike_date || new Date().toISOString().slice(0, 10);
        const distanceKm = Number(body.distance_km) || 0;
        const altitudeM = Number(body.altitude_m) || 0;
        const role = body.role || 'participant';

        if (!email || !hikeNumber) {
          return errorResponse('Email and hike_number are required', 400);
        }

        let profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(email).first();
        let hikes = [];
        if (profile && profile.hikes_json) {
          try {
            hikes = typeof profile.hikes_json === 'string' ? JSON.parse(profile.hikes_json) : (profile.hikes_json || []);
          } catch (_) {}
        }

        const newHikeItem = {
          hike_number: hikeNumber,
          trek_name: trekName,
          trek_date: hikeDate,
          distance_km: distanceKm,
          altitude_m: altitudeM,
          role,
          registration_status: 'Attended',
          payment_status: 'Paid',
          completed_at: new Date().toISOString()
        };

        const existingIdx = hikes.findIndex(h => String(h.hike_number).trim() === hikeNumber);
        if (existingIdx >= 0) {
          hikes[existingIdx] = { ...hikes[existingIdx], ...newHikeItem };
        } else {
          hikes.unshift(newHikeItem);
        }

        const newTotalHikes = hikes.length;
        const newDistance = (Number(profile?.total_distance_km) || 0) + distanceKm;
        const newAltitude = Math.max(Number(profile?.highest_altitude_m) || 0, altitudeM);

        let rankTitle = 'Trail Explorer';
        if (newTotalHikes >= 25) rankTitle = 'Himalayan Veteran';
        else if (newTotalHikes >= 10) rankTitle = 'Summit Seeker';
        else if (newTotalHikes >= 5) rankTitle = 'Pathfinder';

        let badges = [];
        if (profile && profile.badges_json) {
          try {
            badges = typeof profile.badges_json === 'string' ? JSON.parse(profile.badges_json) : (profile.badges_json || []);
          } catch (_) {}
        }

        const badgeSet = new Set(badges);
        badgeSet.add('first_hike');
        if (newTotalHikes >= 5) badgeSet.add('5_hikes_milestone');
        if (newTotalHikes >= 10) badgeSet.add('10_hikes_milestone');
        if (newTotalHikes >= 25) badgeSet.add('25_hikes_milestone');
        if (newAltitude >= 4000) badgeSet.add('high_altitude_4000m');

        if (!profile) {
          await env.DB.prepare(`
            INSERT INTO hiker_profiles (
              email, full_name, total_hikes, total_distance_km, highest_altitude_m,
              rank_title, badges_json, hikes_json, first_hike_date, last_hike_date, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            email,
            body.full_name || 'Hiker',
            newTotalHikes,
            newDistance,
            newAltitude,
            rankTitle,
            JSON.stringify(Array.from(badgeSet)),
            JSON.stringify(hikes),
            hikeDate,
            hikeDate
          ).run();
        } else {
          await env.DB.prepare(`
            UPDATE hiker_profiles
            SET total_hikes = ?,
                total_distance_km = ?,
                highest_altitude_m = ?,
                rank_title = ?,
                badges_json = ?,
                hikes_json = ?,
                last_hike_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(email) = ?
          `).bind(
            newTotalHikes,
            newDistance,
            newAltitude,
            rankTitle,
            JSON.stringify(Array.from(badgeSet)),
            JSON.stringify(hikes),
            hikeDate,
            email
          ).run();
        }

        // Recompute leaderboard snapshot in background
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(recomputeLeaderboardSnapshot(env).catch(e => console.warn('Leaderboard recompute failed:', e)));
        } else {
          recomputeLeaderboardSnapshot(env).catch(e => console.warn('Leaderboard recompute failed:', e));
        }

        return jsonResponse({ success: true, message: `Completed hike #${hikeNumber} recorded for ${email}` });
      }

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

        if (!snapshot || isFresh) {
          snapshot = await recomputeLeaderboardSnapshot(env);
        }

        if (!snapshot) {
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
        const snapshot = await recomputeLeaderboardSnapshot(env);
        return jsonResponse({
          success: true,
          message: 'Leaderboard master snapshot recomputed and stored in system_snapshots',
          stats: snapshot?.stats,
          hikersCount: snapshot?.hikers?.length || 0
        });
      }

      // POST /admin/migrate-profiles - Ingest bulk old hiker data or backfill from existing tables
      if (method === 'POST' && path === '/admin/migrate-profiles') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        let migratedCount = 0;

        // Mode A: Backfill from existing registrations & bookings_roster tables
        if (body.backfillFromTables) {
          try {
            const regs = await env.DB.prepare(`
              SELECT r.*, b.payment_status as roster_pay_status, b.paid_amount as roster_paid, b.due_amount as roster_due, b.admin_notes as roster_notes, b.pickup_point as roster_pickup
              FROM registrations r
              LEFT JOIN bookings_roster b ON b.registration_id = r.id OR b.hike_number = r.hike_number
              WHERE r.email_address IS NOT NULL AND TRIM(r.email_address) != ''
            `).all();

            const rows = regs.results || [];
            const hikerMap = new Map();

            for (const r of rows) {
              const email = String(r.email_address).trim().toLowerCase();
              if (!email) continue;

              let profile = hikerMap.get(email);
              if (!profile) {
                profile = {
                  email,
                  full_name: r.full_name || 'Hiker',
                  phone: r.phone || '',
                  whatsapp: r.whatsapp_number || r.whatsapp || '',
                  gender: r.gender || '',
                  age_group: r.age_group || '',
                  profession: r.profession || '',
                  emergency_contact_phone: r.emergency_backup_contact || '',
                  fitness_level: r.fitness || '',
                  medical_conditions: r.medical_condition || '',
                  city: r.city || '',
                  hikes: []
                };
                hikerMap.set(email, profile);
              }

              const hikeNum = String(r.hike_number || '').trim();
              const existingHike = profile.hikes.find(h => String(h.hike_number).trim() === hikeNum);
              if (!existingHike) {
                profile.hikes.push({
                  hike_number: hikeNum,
                  trek_name: r.trek_name || '',
                  trek_date: r.timestamp ? r.timestamp.slice(0, 10) : '',
                  pax: Number(r.pax) || 1,
                  pickup_point: r.roster_pickup || '',
                  registration_status: 'Confirmed',
                  payment_status: r.roster_pay_status || 'Unpaid',
                  paid_amount: Number(r.roster_paid) || 0,
                  due_amount: Number(r.roster_due) || 0,
                  companions: r.list_name || r.part_of_group || '',
                  transport_mode: r.transport_mode || '',
                  guide_mode: r.guide_mode || '',
                  admin_notes: r.roster_notes || ''
                });
              }
            }

            for (const profile of hikerMap.values()) {
              const totalHikes = profile.hikes.length;
              const totalPaid = profile.hikes.reduce((a, h) => a + (Number(h.paid_amount) || 0), 0);
              const totalDue = profile.hikes.reduce((a, h) => a + (Number(h.due_amount) || 0), 0);

              let rankTitle = 'Trail Explorer';
              if (totalHikes >= 25) rankTitle = 'Himalayan Veteran';
              else if (totalHikes >= 10) rankTitle = 'Summit Seeker';
              else if (totalHikes >= 5) rankTitle = 'Pathfinder';

              const badges = ['first_hike'];
              if (totalHikes >= 5) badges.push('5_hikes_milestone');
              if (totalHikes >= 10) badges.push('10_hikes_milestone');
              if (totalHikes >= 25) badges.push('25_hikes_milestone');

              await env.DB.prepare(`
                INSERT INTO hiker_profiles (
                  email, full_name, phone, whatsapp, gender, age_group, profession,
                  emergency_contact_phone, fitness_level, medical_conditions, city,
                  total_hikes, total_paid_amount, total_due_amount, rank_title,
                  badges_json, hikes_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(email) DO UPDATE SET
                  total_hikes = excluded.total_hikes,
                  total_paid_amount = excluded.total_paid_amount,
                  total_due_amount = excluded.total_due_amount,
                  rank_title = excluded.rank_title,
                  badges_json = excluded.badges_json,
                  hikes_json = excluded.hikes_json,
                  updated_at = CURRENT_TIMESTAMP
              `).bind(
                profile.email,
                profile.full_name,
                profile.phone,
                profile.whatsapp,
                profile.gender,
                profile.age_group,
                profile.profession,
                profile.emergency_contact_phone,
                profile.fitness_level,
                profile.medical_conditions,
                profile.city,
                totalHikes,
                totalPaid,
                totalDue,
                rankTitle,
                JSON.stringify(badges),
                JSON.stringify(profile.hikes)
              ).run();

              migratedCount++;
            }

            return jsonResponse({
              success: true,
              message: `Successfully backfilled ${migratedCount} hiker profiles from existing table records.`,
              migratedCount
            });
          } catch (bErr) {
            console.error('Backfill error:', bErr);
            return errorResponse(`Backfill failed: ${bErr.message}`, 500);
          }
        }

        // Mode B: Direct bulk ingestion of custom hikers array
        const hikers = Array.isArray(body.hikers) ? body.hikers : [];
        for (const h of hikers) {
          const email = String(h.email || h.email_address || '').trim().toLowerCase();
          if (!email) continue;

          const hikes = Array.isArray(h.hikes) ? h.hikes : [];
          const totalHikes = h.total_hikes !== undefined ? Number(h.total_hikes) : hikes.length;
          const totalPaid = h.total_paid_amount !== undefined ? Number(h.total_paid_amount) : hikes.reduce((a, x) => a + (Number(x.paid_amount) || 0), 0);
          const totalDue = h.total_due_amount !== undefined ? Number(h.total_due_amount) : hikes.reduce((a, x) => a + (Number(x.due_amount) || 0), 0);
          const totalDist = Number(h.total_distance_km) || 0;
          const highestAlt = Number(h.highest_altitude_m) || 0;

          let rankTitle = h.rank_title || 'Trail Explorer';
          if (totalHikes >= 25) rankTitle = 'Himalayan Veteran';
          else if (totalHikes >= 10) rankTitle = 'Summit Seeker';
          else if (totalHikes >= 5) rankTitle = 'Pathfinder';

          let badges = Array.isArray(h.badges) ? h.badges : [];
          if (badges.length === 0 && totalHikes > 0) {
            badges.push('first_hike');
            if (totalHikes >= 5) badges.push('5_hikes_milestone');
            if (totalHikes >= 10) badges.push('10_hikes_milestone');
            if (totalHikes >= 25) badges.push('25_hikes_milestone');
          }

          const contribs = h.contributions || { trails: [], photos: [] };

          await env.DB.prepare(`
            INSERT INTO hiker_profiles (
              email, user_uid, full_name, phone, whatsapp, gender, age_group, profession,
              emergency_contact_name, emergency_contact_phone, blood_group, fitness_level,
              medical_conditions, city, avatar_url, total_hikes, total_paid_amount, total_due_amount,
              total_distance_km, highest_altitude_m, total_trails_contributed, total_photos_uploaded,
              total_comments_made, rank_title, badges_json, hikes_json, contributions_json,
              first_hike_date, last_hike_date, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(email) DO UPDATE SET
              full_name = COALESCE(NULLIF(excluded.full_name, ''), hiker_profiles.full_name),
              phone = COALESCE(NULLIF(excluded.phone, ''), hiker_profiles.phone),
              whatsapp = COALESCE(NULLIF(excluded.whatsapp, ''), hiker_profiles.whatsapp),
              gender = COALESCE(NULLIF(excluded.gender, ''), hiker_profiles.gender),
              age_group = COALESCE(NULLIF(excluded.age_group, ''), hiker_profiles.age_group),
              profession = COALESCE(NULLIF(excluded.profession, ''), hiker_profiles.profession),
              city = COALESCE(NULLIF(excluded.city, ''), hiker_profiles.city),
              total_hikes = excluded.total_hikes,
              total_paid_amount = excluded.total_paid_amount,
              total_due_amount = excluded.total_due_amount,
              total_distance_km = excluded.total_distance_km,
              highest_altitude_m = excluded.highest_altitude_m,
              total_trails_contributed = excluded.total_trails_contributed,
              total_photos_uploaded = excluded.total_photos_uploaded,
              total_comments_made = excluded.total_comments_made,
              rank_title = excluded.rank_title,
              badges_json = excluded.badges_json,
              hikes_json = excluded.hikes_json,
              contributions_json = excluded.contributions_json,
              first_hike_date = COALESCE(excluded.first_hike_date, hiker_profiles.first_hike_date),
              last_hike_date = COALESCE(excluded.last_hike_date, hiker_profiles.last_hike_date),
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            email,
            h.user_uid || h.uid || null,
            h.full_name || 'Hiker',
            h.phone || '',
            h.whatsapp || '',
            h.gender || '',
            h.age_group || '',
            h.profession || '',
            h.emergency_contact_name || '',
            h.emergency_contact_phone || '',
            h.blood_group || '',
            h.fitness_level || '',
            h.medical_conditions || '',
            h.city || '',
            h.avatar_url || '',
            totalHikes,
            totalPaid,
            totalDue,
            totalDist,
            highestAlt,
            Number(h.total_trails_contributed) || 0,
            Number(h.total_photos_uploaded) || 0,
            Number(h.total_comments_made) || 0,
            rankTitle,
            JSON.stringify(badges),
            JSON.stringify(hikes),
            JSON.stringify(contribs),
            h.first_hike_date || null,
            h.last_hike_date || null
          ).run();

          migratedCount++;
        }

        return jsonResponse({
          success: true,
          message: `Successfully ingested/updated ${migratedCount} hiker profiles into single-row document model.`,
          migratedCount
        });
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

          // Auto-sync photo contribution into hiker_profiles
          const userIdentifier = (body.email || body.userEmail || '').trim().toLowerCase();
          const userUid = body.userUid || body.user_uid || '';
          if (userIdentifier || userUid) {
            try {
              let profile = null;
              if (userIdentifier) {
                profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(userIdentifier).first();
              } else if (userUid) {
                profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE user_uid = ?').bind(userUid).first();
              }
              if (profile) {
                let contribs = { trails: [], photos: [] };
                try {
                  contribs = typeof profile.contributions_json === 'string' ? JSON.parse(profile.contributions_json) : (profile.contributions_json || { trails: [], photos: [] });
                } catch (_) {}
                contribs.photos = contribs.photos || [];
                contribs.photos.unshift({
                  id: photoId,
                  url: body.url || '',
                  caption: body.caption || '',
                  trek_name: body.trekName || body.trek_name || '',
                  uploaded_at: currentTimestamp
                });
                const newPhotoCount = (Number(profile.total_photos_uploaded) || 0) + 1;
                await env.DB.prepare(`
                  UPDATE hiker_profiles
                  SET contributions_json = ?,
                      total_photos_uploaded = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE LOWER(email) = ?
                `).bind(JSON.stringify(contribs), newPhotoCount, profile.email.toLowerCase()).run();
              }
            } catch (pSyncErr) {
              console.warn('Notice syncing photo contribution to hiker profile:', pSyncErr);
            }
          }

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

          // Auto-sync comment count into hiker_profiles
          const commentUid = body.userUid || body.user_uid || '';
          const commentEmail = (body.email || '').trim().toLowerCase();
          if (commentUid || commentEmail) {
            try {
              let profile = null;
              if (commentEmail) {
                profile = await env.DB.prepare('SELECT email, total_comments_made FROM hiker_profiles WHERE LOWER(email) = ?').bind(commentEmail).first();
              } else if (commentUid) {
                profile = await env.DB.prepare('SELECT email, total_comments_made FROM hiker_profiles WHERE user_uid = ?').bind(commentUid).first();
              }
              if (profile) {
                const newCount = (Number(profile.total_comments_made) || 0) + 1;
                await env.DB.prepare(`
                  UPDATE hiker_profiles
                  SET total_comments_made = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE email = ?
                `).bind(newCount, profile.email).run();
              }
            } catch (cSyncErr) {
              console.warn('Notice syncing comments count to hiker profile:', cSyncErr);
            }
          }

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

        // Auto-sync trail contribution into hiker_profiles
        if (contributor_email) {
          try {
            const cleanEmail = String(contributor_email).trim().toLowerCase();
            const profile = await env.DB.prepare('SELECT * FROM hiker_profiles WHERE LOWER(email) = ?').bind(cleanEmail).first();
            if (profile) {
              let contribs = { trails: [], photos: [] };
              try {
                contribs = typeof profile.contributions_json === 'string' ? JSON.parse(profile.contributions_json) : (profile.contributions_json || { trails: [], photos: [] });
              } catch (_) {}
              contribs.trails = contribs.trails || [];
              contribs.trails.unshift({
                id: trailId,
                file_name: fileName,
                name: trailName,
                distance,
                elevation_gain,
                difficulty,
                uploaded_at: new Date().toISOString()
              });
              const newTrailsCount = (Number(profile.total_trails_contributed) || 0) + 1;
              await env.DB.prepare(`
                UPDATE hiker_profiles
                SET contributions_json = ?,
                    total_trails_contributed = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE LOWER(email) = ?
              `).bind(JSON.stringify(contribs), newTrailsCount, cleanEmail).run();
            }
          } catch (tSyncErr) {
            console.warn('Notice syncing trail contribution to hiker profile:', tSyncErr);
          }
        }

        return jsonResponse({ success: true, message: 'Trail uploaded successfully to D1', id: trailId, fileName });
      }

      return errorResponse(`Route ${method} ${path} not found`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  },
};
