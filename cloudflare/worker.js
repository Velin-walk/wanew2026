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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(errorMsg, status = 500) {
  return jsonResponse({ success: false, error: errorMsg }, status);
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

      // ===== TREKS ENDPOINTS =====
      
      // GET /treks - List all treks (with CPU exhaustion optimization)
      if (method === 'GET' && path === '/treks') {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
        const { results } = await env.DB.prepare(
          'SELECT * FROM treks ORDER BY created_at DESC'
        ).all();

        const data = (results || []).map((row) => {
          let parsedData = {};
          try {
            const rawData = row.data_json || row.data || '{}';
            parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          } catch (e) {}

          return {
            ...row,
            hikeNumber: row.hike_number,
            hike_number: row.hike_number,
            data: parsedData,
          };
        });

        return jsonResponse({ success: true, data });
      }

      // GET /treks/:id - Get single trek
      if (method === 'GET' && path.startsWith('/treks/')) {
        const idOrNum = decodeURIComponent(path.replace('/treks/', ''));
        if (!env.DB) return errorResponse('Database not bound', 500);

        const row = await env.DB.prepare(
          'SELECT * FROM treks WHERE id = ? OR hike_number = ?'
        ).bind(idOrNum, idOrNum).first();

        if (!row) {
          return errorResponse('Trek not found', 404);
        }

        // Strict hike_number matching for live roster
        const regs = await env.DB.prepare(
          'SELECT * FROM registrations WHERE hike_number = ?'
        ).bind(String(row.hike_number || '')).all();

        const roster = regs.results || [];
        const total_pax = roster.reduce((acc, r) => acc + (Number(r.pax) || 1), 0);

        let parsedData = {};
        try {
          const rawData = row.data_json || row.data || '{}';
          parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch (e) {}

        return jsonResponse({
          success: true,
          trek: {
            ...row,
            hikeNumber: row.hike_number,
            hike_number: row.hike_number,
            data: parsedData,
          },
          roster,
          total_pax,
        });
      }

      // POST /treks/sync or POST /treks - Upsert trek
      if (method === 'POST' && (path === '/treks/sync' || path === '/treks')) {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const hikeNum = String(body.hike_number || body.hikeNumber || 'TBD').trim();
        const title = body.title || body.trek_name || 'Walk Nepal Walk Hike';
        const trekId = body.id || `hike-${hikeNum !== 'TBD' ? hikeNum + '-' : ''}${Date.now()}`;
        const dataJson = typeof body.data === 'object' ? JSON.stringify(body.data) : (body.data_json || '{}');

        // Check if existing record exists by hike_number or id
        const existing = await env.DB.prepare(
          'SELECT id FROM treks WHERE hike_number = ? OR id = ?'
        ).bind(hikeNum, trekId).first();

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
            WHERE id = ? OR hike_number = ?
          `).bind(
            title,
            body.category || 'Overnight Bus Hikes',
            body.status || 'published',
            body.cover_image_url || body.featured_image || '',
            body.hike_date || body.date || '',
            Number(body.min_price) || 0,
            Number(body.max_price) || 0,
            body.currency || 'NPR',
            body.meeting_point || body.start_location || '',
            body.meeting_time || '',
            body.expected_duration || body.days || '',
            body.difficulty || 'Moderate',
            body.approx_distance || '',
            body.elevation_range || body.elevation || '',
            body.elevation_gross || '',
            body.ending_point || '',
            body.team_leader || body.leader || '',
            body.whatsapp_link || '',
            body.itinerary_link || '',
            body.faq_link || '',
            Number(body.max_capacity || body.capacity) || 25,
            dataJson,
            body.author_email || body.authorEmail || 'walknepalwalk@gmail.com',
            existing.id,
            hikeNum
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
            body.category || 'Overnight Bus Hikes',
            body.status || 'published',
            body.cover_image_url || body.featured_image || '',
            body.hike_date || body.date || '',
            Number(body.min_price) || 0,
            Number(body.max_price) || 0,
            body.currency || 'NPR',
            body.meeting_point || body.start_location || '',
            body.meeting_time || '',
            body.expected_duration || body.days || '',
            body.difficulty || 'Moderate',
            body.approx_distance || '',
            body.elevation_range || body.elevation || '',
            body.elevation_gross || '',
            body.ending_point || '',
            body.team_leader || body.leader || '',
            body.whatsapp_link || '',
            body.itinerary_link || '',
            body.faq_link || '',
            Number(body.max_capacity || body.capacity) || 25,
            dataJson,
            body.author_email || body.authorEmail || 'walknepalwalk@gmail.com'
          ).run();
        }

        return jsonResponse({
          success: true,
          message: 'Trek synced to Cloudflare D1 successfully',
          hike_number: hikeNum,
        });
      }

      // DELETE /treks/:hikeNumber - Delete trek
      if (method === 'DELETE' && path.startsWith('/treks/')) {
        const idOrNum = decodeURIComponent(path.replace('/treks/', ''));
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

        let query = 'SELECT * FROM registrations ORDER BY timestamp DESC';
        let stmt = env.DB.prepare(query);

        if (email) {
          query = 'SELECT * FROM registrations WHERE email_address = ? ORDER BY timestamp DESC';
          stmt = env.DB.prepare(query).bind(email);
        } else if (hikeNum) {
          query = 'SELECT * FROM registrations WHERE hike_number = ? ORDER BY timestamp DESC';
          stmt = env.DB.prepare(query).bind(hikeNum);
        }

        const { results } = await stmt.all();
        return jsonResponse({ success: true, data: results || [] });
      }

      // POST /registrations - Create registration
      if (method === 'POST' && path === '/registrations') {
        if (!env.DB) return errorResponse('Database binding DB missing', 500);

        const body = await request.json();
        const whatsappVal = body.whatsapp_number || body.whatsapp || '';
        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await env.DB.prepare(`
          INSERT INTO registrations (
            hike_number, trek_name, full_name, email_address, phone, whatsapp, whatsapp_number,
            emergency_backup_contact, profession, pickup_point, part_of_group, pax, age_group, gender,
            fitness, medical_condition, recent_hikes, agreement, suggestions, guide_mode,
            transport_mode, distance, difficulty, season, type_of_trail, person_remarks,
            updates, due, paid, list_name, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body.hike_number || ''),
          body.trek_name || '',
          body.full_name || 'Anonymous Hiker',
          body.email_address || '',
          body.phone || '',
          whatsappVal,
          whatsappVal,
          body.emergency_backup_contact || '',
          body.profession || '',
          body.pickup_point || '',
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
          body.distance || '',
          body.difficulty || '',
          body.season || '',
          body.type_of_trail || '',
          body.person_remarks || '',
          body.updates || '',
          body.due || '',
          body.paid || '',
          body.list_name || '',
          currentTimestamp
        ).run();

        return jsonResponse({ success: true, message: 'Registration saved successfully' });
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

      // ===== MAPMINERS / COMMUNITY TRAILS ENDPOINTS =====

      // GET /mapminers/trails or GET /community_trails - List trails
      if (method === 'GET' && (path === '/mapminers/trails' || path === '/community_trails')) {
        if (!env.DB) return jsonResponse({ success: true, data: [] });
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
        }));

        return jsonResponse({ success: true, data });
      }

      // GET /mapminers/download/:fileName - Download file from R2
      if (method === 'GET' && (path.startsWith('/mapminers/download/') || path.startsWith('/community_trails/download/'))) {
        const fileName = decodeURIComponent(path.replace(/^\/(mapminers|community_trails)\/download\//, ''));
        if (!env.BUCKET) return errorResponse('R2 Storage binding BUCKET missing', 500);

        const object = await env.BUCKET.get(fileName);
        if (!object) {
          return errorResponse('Trail file not found in R2 storage', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Type', headers.get('Content-Type') || 'application/xml');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // POST /mapminers/upload or POST /community_trails/upload (Fills all snake_case and camelCase metadata)
      if (method === 'POST' && (path === '/mapminers/upload' || path === '/community_trails/upload')) {
        if (!env.DB || !env.BUCKET) return errorResponse('DB or BUCKET binding missing', 500);

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

        // Put file in R2
        if (fileContent) {
          await env.BUCKET.put(fileName, fileContent, {
            httpMetadata: { contentType: 'application/xml' },
          });
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
        const province = body.province || '';
        const district = body.district || '';
        const nearby_city = body.nearbyCity || body.nearby_city || '';
        const highlights = body.highlights || '';
        const trailId = body.id || `trail_${Date.now()}`;

        // Store in D1 community_trails table filling both snake_case and camelCase columns exactly matching schema
        await env.DB.prepare(`
          INSERT INTO community_trails (
            id, file_name, fileName, name, description, difficulty, distance,
            elevation_gain, elevation_loss, min_elevation, max_elevation,
            estimated_hours, bounds, start_pos, contributor_name, contributor_email, contributorEmail,
            province, district, nearby_city, highlights, uploaded_at, file_size, fileSize
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        `).bind(
          trailId,
          fileName,
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
          contributor_email,
          province,
          district,
          nearby_city,
          highlights,
          fileContent.length,
          fileContent.length
        ).run();

        return jsonResponse({ success: true, message: 'Trail uploaded successfully to D1', id: trailId, fileName });
      }

      return errorResponse(`Route ${method} ${path} not found`, 404);
    } catch (err) {
      return errorResponse(err.message || 'Server error', 500);
    }
  },
};
