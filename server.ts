import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Trek, Booking, Invite } from './src/types';
import { DEFAULT_SAVED_HIKES, SavedHikeRecord } from './src/data/defaultItineraryTemplate';
import { FALLBACK_TREKS } from './src/data/fallbackTreks';
import { generateDemoRoutes } from './src/components/mapminers/demoData';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  // Cloudflare Worker Base URL
  const CLOUDFLARE_WORKER_URL = (
    process.env.CLOUDFLARE_WORKER_URL || 'https://walknepalwalk-api.velinrai-vr.workers.dev'
  ).replace(/\/+$/, '');

  console.log(`[Cloudflare Integration] Configured Worker URL: ${CLOUDFLARE_WORKER_URL}`);

  // In-memory local fallback data storage
  let bookings: Booking[] = [];
  let invites: Record<string, Invite> = {};
  let feedbacks: any[] = [];
  let nextBookingId = 1;

  // MapMiners Trail Storage (seeded with demo routes as local fallback)
  let mapminersTrails: Record<string, any> = {};
  const demoRoutes = generateDemoRoutes();
  demoRoutes.forEach((route) => {
    mapminersTrails[route.fileName] = {
      ...route,
      startPos: route.coordinates[0] ? { lat: route.coordinates[0].lat, lng: route.coordinates[0].lng } : { lat: 27.7, lng: 85.3 },
      calculatedDifficulty: route.difficulty,
      file_name: route.fileName,
      fileContent: `<gpx version="1.1"><trk><name>${route.name}</name></trk></gpx>`,
    };
  });

  // Itinerary disk persistence setup
  let itinerariesFilePath = path.join(process.cwd(), 'data', 'itineraries.json');
  const fallbackFilePath = path.join('/tmp', 'itineraries.json');

  function loadSavedItineraries(): SavedHikeRecord[] {
    try {
      if (fs.existsSync(fallbackFilePath)) {
        const raw = fs.readFileSync(fallbackFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          itinerariesFilePath = fallbackFilePath;
          return parsed;
        }
      }
      if (fs.existsSync(itinerariesFilePath)) {
        const raw = fs.readFileSync(itinerariesFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Itineraries] Failed reading itineraries.json, using defaults:', e);
    }
    return DEFAULT_SAVED_HIKES;
  }

  function saveItinerariesToDisk(records: SavedHikeRecord[]) {
    try {
      const dir = path.dirname(itinerariesFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(itinerariesFilePath, JSON.stringify(records, null, 2), 'utf-8');
    } catch (e) {
      try {
        itinerariesFilePath = fallbackFilePath;
        fs.writeFileSync(itinerariesFilePath, JSON.stringify(records, null, 2), 'utf-8');
      } catch (fallbackErr) {
        console.error('[Itineraries] Error saving to disk:', fallbackErr);
      }
    }
  }

  let savedItineraries: SavedHikeRecord[] = loadSavedItineraries();

  function convertSavedHikeToTrek(record: SavedHikeRecord): Trek {
    const data = record.data;
    const diffRaw = (data?.overview?.difficulty || 'Moderate').toLowerCase();
    const diff: 'easy' | 'moderate' | 'difficult' =
      diffRaw.includes('hard') || diffRaw.includes('challeng')
        ? 'difficult'
        : diffRaw.includes('easy')
        ? 'easy'
        : 'moderate';

    let priceDisplay = '';
    if (data?.priceTiers && data.priceTiers.length > 0) {
      const prices = data.priceTiers.map((t) => Number(t.price) || 0).filter((p) => p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        priceDisplay = `${data.currency || 'NPR'} ${minP.toLocaleString()}${
          maxP !== minP ? ` - ${maxP.toLocaleString()}` : ''
        }`;
      }
    }

    return {
      id: record.id || `hike-${record.hikeNumber}`,
      hike_number: record.hikeNumber,
      name: record.title || data?.title || 'Walk Nepal Walk Hike',
      date: data?.hikeDate || 'Upcoming',
      days: data?.overview?.expectedDuration || '1 Day',
      difficulty: diff,
      leader: data?.teamLeader || 'Walk Nepal Walk Guide',
      capacity: Number(data?.maxCapacity) || 25,
      participants: 0,
      itinerary_link: data?.itineraryLink || '',
      faq_link: data?.faqLink || '',
      whatsapp_link: data?.whatsappLink || '',
      price: priceDisplay,
      featured_image:
        data?.coverImageUrl ||
        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
      fitness_level: 'All fitness levels',
      season: 'Year-round',
      type_of_trail: record.category || 'Overnight Bus Hikes',
      start_location: data?.overview?.meetingPoint || 'Kathmandu, Nepal',
      elevation: data?.overview?.elevationRange || '',
      itinerary: '',
      data: data,
    };
  }

  function getLocalActiveTreks(): Trek[] {
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const trekMap = new Map<string, Trek>();

    const published = savedItineraries.filter((h) => h.status === 'published');
    for (const record of published) {
      const trek = convertSavedHikeToTrek(record);
      trekMap.set(trek.id, trek);
    }

    for (const fb of FALLBACK_TREKS) {
      if (!Array.from(trekMap.values()).some((t) => norm(t.name) === norm(fb.name) || t.id === fb.id)) {
        trekMap.set(fb.id, { ...fb });
      }
    }

    const trekList = Array.from(trekMap.values());

    for (const trek of trekList) {
      let totalPax = 0;
      let maleCount = 0;
      let femaleCount = 0;
      const recentList: Array<{ name: string; gender: 'm' | 'f' }> = [];
      const seenNames = new Set<string>();

      const matchedBookings = bookings.filter((b) => {
        return (
          b.trek_id === trek.id ||
          b.trek_id === trek.hike_number ||
          norm(b.trek_name) === norm(trek.name)
        );
      });

      for (const b of matchedBookings) {
        const bName = b.full_name?.trim();
        if (bName && !seenNames.has(bName.toLowerCase())) {
          seenNames.add(bName.toLowerCase());
          const bPax = 1 + (Array.isArray(b.team_members) ? b.team_members.length : 0);
          totalPax += bPax;

          const isFemale = String(b.gender || '').toLowerCase().startsWith('f');
          if (isFemale) femaleCount += 1;
          else maleCount += 1;

          recentList.unshift({
            name: bName,
            gender: isFemale ? 'f' : 'm',
          });

          for (const tm of b.team_members || []) {
            if (tm.full_name && !seenNames.has(tm.full_name.toLowerCase().trim())) {
              seenNames.add(tm.full_name.toLowerCase().trim());
              const tmFemale = String(tm.gender || '').toLowerCase().startsWith('f');
              if (tmFemale) femaleCount += 1;
              else maleCount += 1;
              recentList.unshift({
                name: tm.full_name.trim(),
                gender: tmFemale ? 'f' : 'm',
              });
            }
          }
        }
      }

      trek.participants = totalPax > 0 ? totalPax : trek.participants || 0;
      trek.participants_by_gender = {
        total: trek.participants,
        male: maleCount,
        female: femaleCount,
      };
      trek.recent_participants = recentList;
    }

    return trekList;
  }

  // Cloudflare D1 Helper Functions
  async function syncItineraryToCloudflare(record: SavedHikeRecord): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${CLOUDFLARE_WORKER_URL}/treks/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log(`[Cloudflare D1] Successfully synced Hike #${record.hikeNumber} to Worker D1`);
        return { success: true };
      }
      const errTxt = await res.text().catch(() => '');
      console.warn(`[Cloudflare D1] Sync status ${res.status}:`, errTxt);
      return { success: false, error: `Cloudflare ${res.status}: ${errTxt}` };
    } catch (e: any) {
      console.warn(`[Cloudflare D1] Sync exception for Hike #${record.hikeNumber}:`, e?.message);
      return { success: false, error: e?.message || 'Network error connecting to Cloudflare' };
    }
  }

  async function deleteItineraryFromCloudflare(hikeNumber: string) {
    try {
      await fetch(`${CLOUDFLARE_WORKER_URL}/treks/${encodeURIComponent(hikeNumber)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[Cloudflare D1] Deleted Hike #${hikeNumber}`);
    } catch (e: any) {
      console.warn(`[Cloudflare D1] Delete warning:`, e?.message);
    }
  }

  // ===== PUBLIC API ENDPOINTS =====

  // GET /api/treks - Get all upcoming treks (Cloudflare Worker D1 + Local fallback)
  app.get('/api/treks', async (req, res) => {
    let cfTreks: Trek[] = [];
    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/treks`, { signal: AbortSignal.timeout(5000) });
      if (cfRes.ok) {
        const json = await cfRes.json();
        const rawTreks = json.data || json.treks || (Array.isArray(json) ? json : []);
        if (Array.isArray(rawTreks) && rawTreks.length > 0) {
          cfTreks = rawTreks.map((t: any) => {
            if (t.data && typeof t.data === 'object' && t.data.title) {
              return convertSavedHikeToTrek({
                id: t.id || `hike-${t.hike_number}`,
                hikeNumber: t.hike_number || t.hikeNumber || 'TBD',
                title: t.title || t.data.title,
                category: t.category || 'Overnight Bus Hikes',
                status: t.status || 'published',
                createdAt: t.created_at || new Date().toISOString(),
                updatedAt: t.updated_at || new Date().toISOString(),
                authorEmail: t.author_email || 'admin@walknepalwalk.com',
                data: t.data,
              });
            }
            return t;
          });
        }
      }
    } catch (e: any) {
      console.warn('[Cloudflare Treks Fetch] Cloudflare Worker offline/unreachable, using local itineraries:', e?.message);
    }

    const localTreks = getLocalActiveTreks();
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Merge Cloudflare treks & local treks smoothly
    const mergedMap = new Map<string, Trek>();
    for (const t of localTreks) mergedMap.set(t.id, t);
    for (const t of cfTreks) {
      if (t.id || t.name) {
        const existingKey = Array.from(mergedMap.keys()).find(
          (k) => k === t.id || norm(mergedMap.get(k)!.name) === norm(t.name)
        );
        if (existingKey) {
          mergedMap.set(existingKey, { ...mergedMap.get(existingKey)!, ...t });
        } else {
          mergedMap.set(t.id || `cf-${Date.now()}`, t);
        }
      }
    }

    res.json({
      success: true,
      data: Array.from(mergedMap.values()),
    });
  });

  // GET /api/treks/:trekId - Get single trek
  app.get('/api/treks/:trekId', async (req, res) => {
    const { trekId } = req.params;
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    let cfTrek: Trek | null = null;
    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/treks/${encodeURIComponent(trekId)}`, { signal: AbortSignal.timeout(4000) });
      if (cfRes.ok) {
        const json = await cfRes.json();
        if (json && (json.id || json.name || json.title)) {
          cfTrek = json;
        }
      }
    } catch (e) {}

    const localTreks = getLocalActiveTreks();
    const trek = cfTrek || localTreks.find(
      (t) => t.id === trekId || t.hike_number === trekId || norm(t.name) === norm(trekId)
    );

    if (!trek) {
      return res.status(404).json({ error: 'Trek not found' });
    }
    res.json(trek);
  });

  // GET /api/invites/join - Join trek via invite code
  app.get('/api/invites/join', (req, res) => {
    const code = (req.query.code as string) || '';
    if (!code) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    const invite = invites[code.toUpperCase()];
    if (!invite) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    invite.used_count += 1;
    const localTreks = getLocalActiveTreks();
    const trek = localTreks.find((t) => t.id === invite.trek_id || t.hike_number === invite.trek_id);

    res.json({
      invite,
      trek,
      message: 'Invite code verified successfully',
    });
  });

  // POST /api/treks/:trekId/invite - Create invite link
  app.post('/api/treks/:trekId/invite', (req, res) => {
    const { trekId } = req.params;
    const { user_email = 'velinrai.VR@gmail.com' } = req.body;

    const localTreks = getLocalActiveTreks();
    const trek = localTreks.find((t) => t.id === trekId || t.hike_number === trekId);
    if (!trek) {
      return res.status(404).json({ error: 'Trek not found' });
    }

    const code = 'WN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newInvite: Invite = {
      code,
      trek_id: trekId,
      created_by: user_email,
      used_count: 0,
      created_at: new Date().toISOString(),
    };

    invites[code] = newInvite;

    res.json({
      code,
      link: `/?invite=${code}`,
    });
  });

  // ===== BOOKINGS ENDPOINTS =====

  // GET /api/bookings (Cloudflare D1 + Local Memory)
  app.get('/api/bookings', async (req, res) => {
    const email = (req.query.email as string) || '';
    let cfBookings: Booking[] = [];
    try {
      const url = email
        ? `${CLOUDFLARE_WORKER_URL}/registrations?email=${encodeURIComponent(email)}`
        : `${CLOUDFLARE_WORKER_URL}/registrations`;
      const cfRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (cfRes.ok) {
        const json = await cfRes.json();
        if (Array.isArray(json)) cfBookings = json;
      }
    } catch (e: any) {
      console.warn('[Cloudflare Bookings Fetch] Using local bookings list:', e?.message);
    }

    const localFiltered = email
      ? bookings.filter((b) => b.user_email.toLowerCase() === email.toLowerCase())
      : bookings;

    // Merge and deduplicate bookings
    const combinedMap = new Map<string, Booking>();
    for (const b of localFiltered) combinedMap.set(String(b.id || b.full_name), b);
    for (const b of cfBookings) combinedMap.set(String(b.id || b.full_name), b);

    res.json(Array.from(combinedMap.values()));
  });

  // POST /api/bookings (Sync to Cloudflare D1 + Local)
  app.post('/api/bookings', async (req, res) => {
    try {
      const {
        trek_id,
        trek_name,
        user_email = 'velinrai.VR@gmail.com',
        full_name,
        phone,
        whatsapp,
        emergency_contact,
        email,
        profession,
        is_group,
        age_group,
        gender,
        team_members = [],
        has_medical,
        specify_medical,
        recent_hikes,
        agree_rules,
        guide_preference,
        transport_preference,
        suggestions,
      } = req.body;

      if (!trek_id || !full_name || !phone || !age_group || !gender) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const localTreks = getLocalActiveTreks();
      const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const trek = localTreks.find(
        (t) =>
          t.id === trek_id ||
          t.hike_number === trek_id ||
          (t.name && trek_name && norm(t.name) === norm(trek_name))
      );

      const bookingId = nextBookingId++;
      const newBooking: Booking = {
        id: bookingId,
        trek_id,
        user_email: email || user_email,
        full_name,
        phone,
        whatsapp: whatsapp || phone,
        emergency_contact,
        email: email || user_email,
        profession,
        is_group,
        age_group,
        gender,
        joined_at: new Date().toISOString(),
        trek_name: trek?.name || trek_name || 'Walk Nepal Walk Hike',
        trek_date: trek?.date || 'Upcoming',
        trek_difficulty: trek?.difficulty || 'moderate',
        trek_days: trek?.days || '1 Day',
        team_members: Array.isArray(team_members) ? team_members : [],
        has_medical,
        specify_medical,
        recent_hikes,
        agree_rules,
        guide_preference,
        transport_preference,
        suggestions,
      };

      bookings.unshift(newBooking);

      // Async sync to Cloudflare D1
      let cfSynced = false;
      try {
        const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/registrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newBooking),
          signal: AbortSignal.timeout(5000),
        });
        if (cfRes.ok) {
          cfSynced = true;
          console.log(`[Cloudflare D1] Registration saved for ${full_name}`);
        }
      } catch (cfErr: any) {
        console.warn('[Cloudflare D1] Could not sync registration:', cfErr?.message);
      }

      res.json({
        success: true,
        booking_id: bookingId,
        message: cfSynced ? 'Successfully registered & saved to Cloudflare D1!' : 'Successfully registered!',
        booking: newBooking,
        cloudflare_synced: cfSynced,
      });
    } catch (err: any) {
      console.error('Error handling booking:', err);
      res.status(500).json({ error: err.message || 'Server error processing booking' });
    }
  });

  // DELETE /api/bookings/:bookingId
  app.delete('/api/bookings/:bookingId', (req, res) => {
    const bookingId = parseInt(req.params.bookingId);
    const index = bookings.findIndex((b) => b.id === bookingId);

    if (index !== -1) {
      bookings.splice(index, 1);
    }
    res.json({ success: true, message: 'Booking canceled successfully' });
  });

  // ===== FEEDBACK ENDPOINTS =====

  // POST /api/feedback (Sync to Cloudflare D1 + Local)
  app.post('/api/feedback', async (req, res) => {
    try {
      const {
        name,
        email,
        recentWalk,
        hikeNumber,
        teamFeedback = '',
        teamRating = 5,
        overallFeedback = '',
        overallRating = 5,
      } = req.body;

      const newFeedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: name || 'Anonymous Hiker',
        email: email || '',
        recentWalk: recentWalk || '',
        hikeNumber: hikeNumber || '',
        teamFeedback,
        teamRating: Number(teamRating) || 5,
        overallFeedback,
        overallRating: Number(overallRating) || 5,
        submittedAt: new Date().toISOString(),
      };

      feedbacks.unshift(newFeedback);

      // Sync to Cloudflare
      try {
        await fetch(`${CLOUDFLARE_WORKER_URL}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newFeedback),
          signal: AbortSignal.timeout(4000),
        });
      } catch (e) {}

      res.json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback: newFeedback,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to save feedback' });
    }
  });

  // GET /api/feedback
  app.get('/api/feedback', async (req, res) => {
    const hikeNumber = req.query.hikeNumber as string;
    let cfFeedback: any[] = [];
    try {
      const url = hikeNumber
        ? `${CLOUDFLARE_WORKER_URL}/feedback?hike_number=${encodeURIComponent(hikeNumber)}`
        : `${CLOUDFLARE_WORKER_URL}/feedback`;
      const cfRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (cfRes.ok) {
        const json = await cfRes.json();
        if (Array.isArray(json)) cfFeedback = json;
      }
    } catch (e) {}

    const localFiltered = hikeNumber
      ? feedbacks.filter((f) => f.hikeNumber === hikeNumber)
      : feedbacks;

    const merged = [...cfFeedback, ...localFiltered];
    res.json(merged);
  });

  // ===== MAPMINERS ENDPOINTS (Cloudflare + Local Fallback) =====

  // GET /api/mapminers/trails - Get all trails metadata
  app.get('/api/mapminers/trails', async (req, res) => {
    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/mapminers/trails`, { signal: AbortSignal.timeout(5000) });
      if (cfRes.ok) {
        const json = await cfRes.json();
        const cfData = json.data || json;
        if (cfData && typeof cfData === 'object' && Object.keys(cfData).length > 0) {
          // Combine Cloudflare trails and local demo trails
          return res.json({
            success: true,
            data: { ...mapminersTrails, ...cfData },
          });
        }
      }
    } catch (err: any) {
      console.warn('[MapMiners] Cloudflare Worker unreachable, serving demo trails:', err?.message);
    }

    res.json({
      success: true,
      data: mapminersTrails,
    });
  });

  // GET /api/mapminers/download/:fileName - Stream GPX/KML file from Cloudflare R2 or local
  app.get('/api/mapminers/download/:fileName', async (req, res) => {
    const cleanFileName = req.params.fileName;

    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/mapminers/download/${encodeURIComponent(cleanFileName)}`, { signal: AbortSignal.timeout(5000) });
      if (cfRes.ok) {
        const xmlText = await cfRes.text();
        res.setHeader('Content-Type', 'text/xml');
        return res.send(xmlText);
      }
    } catch (e: any) {
      console.warn(`[MapMiners] Cloudflare download error for ${cleanFileName}:`, e?.message);
    }

    const trail = mapminersTrails[cleanFileName] || Object.values(mapminersTrails).find((t: any) => t.fileName === cleanFileName || t.file_name === cleanFileName);
    if (trail && trail.fileContent) {
      res.setHeader('Content-Type', 'text/xml');
      return res.send(trail.fileContent);
    }

    res.status(404).json({ error: 'Trail file not found in storage' });
  });

  // POST /api/mapminers/upload & POST /api/mapminers/contribute - Save to Cloudflare R2/D1 & local
  app.post(['/api/mapminers/upload', '/api/mapminers/contribute'], async (req, res) => {
    try {
      const { fileName, fileContent, name, description, difficultyOverride, hoursOverride, province, district, nearbyCity, highlights, contributorName, contributorEmail } = req.body;

      if (!fileName || !name) {
        return res.status(400).json({ error: 'Missing required parameters: fileName or name' });
      }

      const newTrail = {
        id: `trail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        fileName,
        file_name: fileName,
        name,
        description: description || '',
        difficultyOverride: difficultyOverride || 'Auto',
        hoursOverride: hoursOverride || 'Auto',
        province: province || 'Bagmati',
        district: district || 'Kathmandu',
        nearbyCity: nearbyCity || 'Kathmandu',
        highlights: highlights || '',
        uploadedAt: new Date().toISOString(),
        contributorName: contributorName || 'Community Member',
        contributorEmail: contributorEmail || '',
        fileContent: fileContent || `<gpx version="1.1"><trk><name>${name}</name></trk></gpx>`,
        startPos: { lat: 27.7, lng: 85.3 },
        bounds: [[27.6, 85.2], [27.8, 85.4]],
        stats: {
          distance: 12.5,
          elevationGain: 650,
          elevationLoss: 650,
          minElevation: 1400,
          maxElevation: 2050,
          estimatedHours: 5,
        },
      };

      mapminersTrails[fileName] = newTrail;

      // Sync to Cloudflare Worker
      let cfSynced = false;
      try {
        const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/mapminers/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTrail),
          signal: AbortSignal.timeout(6000),
        });
        if (cfRes.ok) cfSynced = true;
      } catch (err: any) {
        console.warn('[MapMiners] Could not sync trail upload to Cloudflare:', err?.message);
      }

      res.json({
        success: true,
        message: cfSynced ? 'Trail uploaded to Cloudflare R2 & D1 successfully' : 'Trail uploaded successfully',
        trail: newTrail,
        cloudflare_synced: cfSynced,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to process trail upload' });
    }
  });

  // ===== ITINERARY PREVIEW PROXY =====

  // GET /api/itinerary-preview
  app.get('/api/itinerary-preview', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return res.status(400).send('Invalid or missing URL parameter.');
    }

    try {
      let fetchUrl = targetUrl;
      if (fetchUrl.includes('docs.google.com/document/d/')) {
        fetchUrl = fetchUrl.replace(/\/edit(\?[^#]*)?/, '/preview');
      }

      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FAF8F5; color: #1F1F1F; text-align: center; padding: 20px; }
              .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #E5E1DB; max-width: 420px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              .btn { display: inline-block; background: #E08828; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h3>External Itinerary Document</h3>
              <p>Click below to open the complete itinerary in a new tab.</p>
              <a class="btn" href="${targetUrl}" target="_blank" rel="noopener noreferrer">Open Itinerary Link &rarr;</a>
            </div>
          </body>
          </html>
        `);
      }

      let html = await response.text();
      const baseTag = `<base href="${fetchUrl}" target="_blank">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else {
        html = baseTag + html;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err: any) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FAF8F5; text-align: center; padding: 20px; }
            .card { background: white; padding: 32px; border-radius: 16px; border: 1px solid #E5E1DB; max-width: 420px; }
            .btn { display: inline-block; background: #E08828; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h3>Itinerary Guide Link</h3>
            <p>Click below to view the guide.</p>
            <a class="btn" href="${targetUrl}" target="_blank" rel="noopener noreferrer">Open External Link &rarr;</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  // GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Walk Nepal Walk API',
      cloudflareWorkerUrl: CLOUDFLARE_WORKER_URL,
    });
  });

  // ===== ADMIN ITINERARY MANAGEMENT API =====

  // GET /api/admin/itineraries
  app.get('/api/admin/itineraries', (req, res) => {
    res.json({
      success: true,
      data: savedItineraries,
    });
  });

  // GET /api/admin/itineraries/:id
  app.get('/api/admin/itineraries/:id', (req, res) => {
    const item = savedItineraries.find((h) => h.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Hike not found' });
    }
    res.json({ success: true, data: item });
  });

  // POST /api/admin/itineraries
  app.post('/api/admin/itineraries', async (req, res) => {
    try {
      const { data, status = 'draft', authorEmail = 'admin@walknepalwalk.com' } = req.body;
      if (!data || !data.title) {
        return res.status(400).json({ success: false, error: 'Missing hike data or title' });
      }

      const hikeNum = (data.hikeNumber || '').trim();
      const slug = (data.title || 'hike')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const uniqueId = `hike-${hikeNum ? hikeNum + '-' : ''}${slug}-${Date.now().toString(36)}`;

      const newRecord: SavedHikeRecord = {
        id: uniqueId,
        hikeNumber: hikeNum || 'TBD',
        title: data.title,
        category: data.category || 'Overnight Bus Hikes',
        status: status as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorEmail,
        data,
      };

      savedItineraries.unshift(newRecord);
      saveItinerariesToDisk(savedItineraries);

      // Sync to Cloudflare D1
      const syncResult = await syncItineraryToCloudflare(newRecord);

      res.status(201).json({
        success: true,
        data: newRecord,
        sync: syncResult,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // PUT /api/admin/itineraries/:id
  app.put('/api/admin/itineraries/:id', async (req, res) => {
    try {
      const idx = savedItineraries.findIndex((h) => h.id === req.params.id);
      const { data, status } = req.body;

      let updatedRecord: SavedHikeRecord;
      if (idx === -1) {
        const hikeNum = (data?.hikeNumber || '').trim();
        updatedRecord = {
          id: req.params.id,
          hikeNumber: hikeNum || 'TBD',
          title: data?.title || 'Untitled Hike',
          category: data?.category || 'Overnight Bus Hikes',
          status: (status || 'draft') as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          authorEmail: 'admin@walknepalwalk.com',
          data: data || {},
        };
        savedItineraries.unshift(updatedRecord);
      } else {
        const existing = savedItineraries[idx];
        updatedRecord = {
          ...existing,
          hikeNumber: data?.hikeNumber ?? existing.hikeNumber,
          title: data?.title ?? existing.title,
          category: data?.category ?? existing.category,
          status: status ?? existing.status,
          updatedAt: new Date().toISOString(),
          data: data ?? existing.data,
        };
        savedItineraries[idx] = updatedRecord;
      }

      saveItinerariesToDisk(savedItineraries);

      // Sync to Cloudflare D1
      const syncResult = await syncItineraryToCloudflare(updatedRecord);

      res.json({ success: true, data: updatedRecord, sync: syncResult });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/admin/itineraries/:id/clone
  app.post('/api/admin/itineraries/:id/clone', async (req, res) => {
    try {
      const source = savedItineraries.find((h) => h.id === req.params.id);
      if (!source) {
        return res.status(404).json({ success: false, error: 'Source hike not found' });
      }

      const cloneId = `hike-copy-${Date.now().toString(36)}`;
      const clonedTitle = `${source.title} (Copy)`;
      const clonedData = JSON.parse(JSON.stringify(source.data));
      clonedData.title = clonedTitle;

      const clonedRecord: SavedHikeRecord = {
        ...source,
        id: cloneId,
        title: clonedTitle,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: clonedData,
      };

      savedItineraries.unshift(clonedRecord);
      saveItinerariesToDisk(savedItineraries);

      syncItineraryToCloudflare(clonedRecord).catch(() => {});

      res.status(201).json({ success: true, data: clonedRecord });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // PATCH /api/admin/itineraries/:id/status
  app.patch('/api/admin/itineraries/:id/status', async (req, res) => {
    try {
      const idx = savedItineraries.findIndex((h) => h.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Hike not found' });
      }

      const { status } = req.body;
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      savedItineraries[idx].status = status;
      savedItineraries[idx].updatedAt = new Date().toISOString();
      saveItinerariesToDisk(savedItineraries);

      syncItineraryToCloudflare(savedItineraries[idx]).catch(() => {});

      res.json({ success: true, data: savedItineraries[idx] });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // DELETE /api/admin/itineraries/:id
  app.delete('/api/admin/itineraries/:id', (req, res) => {
    try {
      const idx = savedItineraries.findIndex((h) => h.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Hike not found' });
      }

      const deleted = savedItineraries.splice(idx, 1)[0];
      saveItinerariesToDisk(savedItineraries);

      deleteItineraryFromCloudflare(deleted.hikeNumber);

      res.json({ success: true, data: deleted });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/admin/sync-all-to-cloudflare (Bulk push all saved itineraries to Cloudflare D1)
  app.post(['/api/admin/sync-all-to-cloudflare', '/api/admin/sync-all'], async (req, res) => {
    saveItinerariesToDisk(savedItineraries);
    const results = [];
    for (const item of savedItineraries) {
      const syncRes = await syncItineraryToCloudflare(item);
      results.push({ hikeNumber: item.hikeNumber, title: item.title, ...syncRes });
    }
    res.json({
      success: true,
      message: `Synced ${results.filter((r) => r.success).length}/${results.length} treks to Cloudflare D1 & database`,
      results,
    });
  });

  // POST /api/admin/diagnostics/cloudflare (Test connectivity to Cloudflare Worker)
  app.post(['/api/admin/diagnostics/cloudflare', '/api/admin/diagnostics'], async (req, res) => {
    const checks = [];
    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/treks`, { signal: AbortSignal.timeout(5000) });
      checks.push({ endpoint: '/treks', status: cfRes.status, ok: cfRes.ok });
    } catch (e: any) {
      checks.push({ endpoint: '/treks', status: 0, ok: false, error: e?.message });
    }

    try {
      const cfRes = await fetch(`${CLOUDFLARE_WORKER_URL}/registrations`, { signal: AbortSignal.timeout(5000) });
      checks.push({ endpoint: '/registrations', status: cfRes.status, ok: cfRes.ok });
    } catch (e: any) {
      checks.push({ endpoint: '/registrations', status: 0, ok: false, error: e?.message });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      workerUrl: CLOUDFLARE_WORKER_URL,
      checks,
    });
  });

  // ===== VITE MIDDLEWARE / STATIC SERVING =====
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
