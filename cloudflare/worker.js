/**
 * Cloudflare Worker API for Walk Nepal Walk & MapMiners
 * Integrates D1 Database (DB) and R2 Bucket (TRAILS_BUCKET)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    };

    try {
      // 1. HEALTH CHECK
      if (path === '/' || path === '/api/health') {
        return jsonResponse({ status: 'ok', service: 'Walk Nepal Walk Cloudflare Worker', timestamp: new Date().toISOString() });
      }

      // 2. GET ALL TREKS / ITINERARIES (/treks)
      if (path === '/treks' && method === 'GET') {
        if (!env.DB) return jsonResponse({ success: false, message: 'D1 binding missing' }, 500);
        const { results } = await env.DB.prepare("SELECT * FROM treks ORDER BY created_at DESC").all();
        const treks = (results || []).map(row => {
          let parsedData = {};
          try { parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch(e){}
          return {
            id: row.id,
            hike_number: row.hike_number,
            title: row.title,
            category: row.category,
            status: row.status,
            data: parsedData,
            ...parsedData
          };
        });
        return jsonResponse({ success: true, data: treks });
      }

      // 3. SINGLE TREK BY ID OR HIKE NUMBER (/treks/:id)
      if (path.startsWith('/treks/') && method === 'GET') {
        const id = path.replace('/treks/', '');
        if (id !== 'sync') {
          if (!env.DB) return jsonResponse({ error: 'D1 binding missing' }, 500);
          const row = await env.DB.prepare("SELECT * FROM treks WHERE id = ? OR hike_number = ? LIMIT 1").bind(id, id).first();
          if (!row) return jsonResponse({ error: 'Trek not found' }, 404);
          let parsedData = {};
          try { parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : {}; } catch(e){}
          return jsonResponse({ id: row.id, hike_number: row.hike_number, title: row.title, data: parsedData, ...parsedData });
        }
      }

      // 4. SYNC / SAVE ITINERARY (/treks/sync OR POST /treks)
      if ((path === '/treks/sync' || path === '/treks') && (method === 'POST' || method === 'PUT')) {
        if (!env.DB) return jsonResponse({ success: false, error: 'D1 binding missing' }, 500);
        const body = await request.json();
        const record = body.record || body;
        const hikeNumber = record.hikeNumber || record.hike_number || body.hikeNumber || 'TBD';
        const title = record.title || body.title || 'Untitled Hike';
        const id = record.id || `hike-${hikeNumber}-${Date.now()}`;
        const category = record.category || 'Overnight Bus Hikes';
        const status = record.status || 'published';
        const authorEmail = record.authorEmail || 'admin@walknepalwalk.com';
        const now = new Date().toISOString();
        const dataJson = JSON.stringify(record.data || body.data || record);

        await env.DB.prepare(`
          INSERT INTO treks (id, hike_number, title, category, status, author_email, created_at, updated_at, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            hike_number = excluded.hike_number,
            title = excluded.title,
            category = excluded.category,
            status = excluded.status,
            updated_at = excluded.updated_at,
            data = excluded.data
        `).bind(id, hikeNumber, title, category, status, authorEmail, now, now, dataJson).run();

        return jsonResponse({ success: true, message: `Synced Hike #${hikeNumber} to Cloudflare D1`, id, hikeNumber });
      }

      // 5. DELETE TREK (/treks/:id - DELETE)
      if (path.startsWith('/treks/') && method === 'DELETE') {
        const id = path.replace('/treks/', '');
        if (!env.DB) return jsonResponse({ error: 'D1 binding missing' }, 500);
        await env.DB.prepare("DELETE FROM treks WHERE id = ? OR hike_number = ?").bind(id, id).run();
        return jsonResponse({ success: true, message: `Deleted hike ${id}` });
      }

      // 6. REGISTRATIONS / BOOKINGS (/registrations)
      if (path === '/registrations' && method === 'GET') {
        if (!env.DB) return jsonResponse([], 200);
        const email = url.searchParams.get('email');
        let query = "SELECT * FROM registrations ORDER BY id DESC";
        let stmt = env.DB.prepare(query);
        if (email) {
          query = "SELECT * FROM registrations WHERE LOWER(user_email) = LOWER(?) ORDER BY id DESC";
          stmt = env.DB.prepare(query).bind(email);
        }
        const { results } = await stmt.all();
        const registrations = (results || []).map(r => ({
          ...r,
          team_members: r.team_members ? JSON.parse(r.team_members) : []
        }));
        return jsonResponse(registrations);
      }

      if (path === '/registrations' && method === 'POST') {
        if (!env.DB) return jsonResponse({ success: false, message: 'D1 binding missing' }, 500);
        const b = await request.json();
        const res = await env.DB.prepare(`
          INSERT INTO registrations (
            trek_id, user_email, full_name, phone, whatsapp, emergency_contact,
            profession, is_group, age_group, gender, joined_at, trek_name,
            trek_date, trek_difficulty, trek_days, team_members, has_medical,
            specify_medical, recent_hikes, agree_rules, guide_preference,
            transport_preference, suggestions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          b.trek_id || '', b.user_email || b.email || '', b.full_name || '',
          b.phone || '', b.whatsapp || b.phone || '', b.emergency_contact || '',
          b.profession || '', b.is_group ? 1 : 0, b.age_group || '', b.gender || '',
          new Date().toISOString(), b.trek_name || '', b.trek_date || '',
          b.trek_difficulty || '', b.trek_days || '', JSON.stringify(b.team_members || []),
          b.has_medical ? 1 : 0, b.specify_medical || '', b.recent_hikes || '',
          b.agree_rules ? 1 : 0, b.guide_preference || '', b.transport_preference || '', b.suggestions || ''
        ).run();

        return jsonResponse({ success: true, message: 'Registration saved to Cloudflare D1', result: res });
      }

      // 7. FEEDBACK (/feedback)
      if (path === '/feedback' && method === 'GET') {
        if (!env.DB) return jsonResponse([]);
        const hikeNum = url.searchParams.get('hike_number');
        let query = "SELECT * FROM feedback ORDER BY submitted_at DESC";
        let stmt = env.DB.prepare(query);
        if (hikeNum) {
          query = "SELECT * FROM feedback WHERE hike_number = ? ORDER BY submitted_at DESC";
          stmt = env.DB.prepare(query).bind(hikeNum);
        }
        const { results } = await stmt.all();
        return jsonResponse(results || []);
      }

      if (path === '/feedback' && method === 'POST') {
        if (!env.DB) return jsonResponse({ success: false, message: 'D1 binding missing' }, 500);
        const fb = await request.json();
        const id = fb.id || `fb_${Date.now()}`;
        await env.DB.prepare(`
          INSERT INTO feedback (id, name, email, recent_walk, hike_number, team_feedback, team_rating, overall_feedback, overall_rating, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, fb.name || '', fb.email || '', fb.recentWalk || '', fb.hikeNumber || '',
          fb.teamFeedback || '', Number(fb.teamRating) || 5, fb.overallFeedback || '', Number(fb.overallRating) || 5,
          new Date().toISOString()
        ).run();
        return jsonResponse({ success: true, message: 'Feedback saved to Cloudflare D1', id });
      }

      // 8. MAPMINERS TRAILS (/mapminers/trails)
      if (path === '/mapminers/trails' && method === 'GET') {
        if (!env.DB) return jsonResponse({ success: true, data: {} });
        const { results } = await env.DB.prepare("SELECT * FROM mapminers_trails").all();
        const map = {};
        (results || []).forEach(row => {
          map[row.file_name] = {
            id: row.id,
            fileName: row.file_name,
            file_name: row.file_name,
            name: row.name,
            description: row.description,
            difficultyOverride: row.difficulty_override,
            hoursOverride: row.hours_override,
            province: row.province,
            district: row.district,
            nearbyCity: row.nearby_city,
            highlights: row.highlights,
            uploadedAt: row.uploaded_at,
            contributorName: row.contributor_name,
            contributorEmail: row.contributor_email,
            startPos: { lat: row.start_lat || 27.7, lng: row.start_lng || 85.3 },
            stats: row.stats ? JSON.parse(row.stats) : {}
          };
        });
        return jsonResponse({ success: true, data: map });
      }

      // 9. MAPMINERS FILE DOWNLOAD (/mapminers/download/:fileName)
      if (path.startsWith('/mapminers/download/')) {
        const fileName = path.replace('/mapminers/download/', '');
        if (env.TRAILS_BUCKET) {
          const fileObj = await env.TRAILS_BUCKET.get(fileName);
          if (fileObj) {
            const body = await fileObj.arrayBuffer();
            return new Response(body, {
              headers: {
                'Content-Type': 'application/xml',
                ...corsHeaders
              }
            });
          }
        }
        return jsonResponse({ error: 'File not found in R2 bucket' }, 404);
      }

      // 10. MAPMINERS UPLOAD (/mapminers/upload OR /mapminers/contribute)
      if ((path === '/mapminers/upload' || path === '/mapminers/contribute') && method === 'POST') {
        const body = await request.json();
        const { fileName, fileContent, name, description, difficultyOverride, hoursOverride, province, district, nearbyCity, highlights, contributorName, contributorEmail, startPos, stats } = body;

        // Store file in R2 Bucket if available
        if (env.TRAILS_BUCKET && fileName && fileContent) {
          await env.TRAILS_BUCKET.put(fileName, fileContent, {
            httpMetadata: { contentType: 'application/xml' }
          });
        }

        // Store metadata in D1 if available
        if (env.DB && fileName && name) {
          const id = body.id || `trail_${Date.now()}`;
          await env.DB.prepare(`
            INSERT INTO mapminers_trails (id, file_name, name, description, difficulty_override, hours_override, province, district, nearby_city, highlights, uploaded_at, contributor_name, contributor_email, start_lat, start_lng, stats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_name) DO UPDATE SET
              name = excluded.name,
              description = excluded.description,
              highlights = excluded.highlights,
              stats = excluded.stats
          `).bind(
            id, fileName, name, description || '', difficultyOverride || 'Auto', hoursOverride || 'Auto',
            province || 'Bagmati', district || 'Kathmandu', nearbyCity || 'Kathmandu', highlights || '',
            new Date().toISOString(), contributorName || 'Community Member', contributorEmail || '',
            startPos?.lat || 27.7, startPos?.lng || 85.3, JSON.stringify(stats || {})
          ).run();
        }

        return jsonResponse({ success: true, message: 'Trail uploaded to Cloudflare R2 & D1', fileName });
      }

      return jsonResponse({ error: 'Endpoint not found' }, 404);

    } catch (err) {
      return jsonResponse({ error: err.message || 'Worker Internal Error' }, 500);
    }
  }
};
