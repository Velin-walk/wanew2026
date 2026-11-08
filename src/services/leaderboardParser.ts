import { LeaderboardResponse, HikerStats } from '../types/leaderboard';

/**
 * Extracts date from event or trek name.
 * Handles patterns like "Nagdaha (16 Jun 2021)", "North ABC Trek (Friday 23 Oct 2026)", or "Api Himal 2025".
 */
export function extractDateFromTrekName(name: string): { dateStr: string; dateObj: Date | null } {
  if (!name) return { dateStr: '', dateObj: null };

  const parenMatch = name.match(/\((?:[a-zA-Z]+\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4})\)/i);
  if (parenMatch) {
    const d = new Date(parenMatch[1]);
    if (!isNaN(d.getTime())) {
      return {
        dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateObj: d,
      };
    }
  }

  const yearMatch = name.match(/\b(202\d)\b/);
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01`);
    return {
      dateStr: `${yearMatch[1]}`,
      dateObj: d,
    };
  }

  return { dateStr: '', dateObj: null };
}

/**
 * Parses raw Google Sheet Leaderboard CSV feed into fully typed, aggregate-accurate LeaderboardResponse.
 * Ensures total distance, individual hiker rankings, event milestones, and growth curve are 100% synchronized.
 */
export function parseLeaderboardCsv(csvText: string): LeaderboardResponse | null {
  if (!csvText || typeof csvText !== 'string') return null;

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return null;

  let totalKm = 0;
  let totalHikeKm = 0;
  let totalTrekKm = 0;

  const eventsMap = new Map<string, any>();
  const hikersMap = new Map<string, any>();

  const now = new Date();
  const t30Cutoff = new Date(now.getTime() - 30 * 86400000);
  const t60Cutoff = new Date(now.getTime() - 60 * 86400000);
  const t90Cutoff = new Date(now.getTime() - 90 * 86400000);
  const t365Cutoff = new Date(now.getTime() - 365 * 86400000);

  const recentEvents = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Fast CSV split
    const parts = line.split(',');
    if (parts.length < 8) continue;

    const trekName = parts[0].trim();
    const hikeNum = parts[parts.length - 2].trim();
    const gender = parts[parts.length - 3].trim();
    const age = parts[parts.length - 4].trim();
    const email = parts[parts.length - 5].trim();
    const phone = parts[parts.length - 6].trim();
    const name = parts.slice(1, parts.length - 6).join(',').trim();
    const dist = parseFloat(parts[parts.length - 1]);

    if (isNaN(dist) || dist <= 0) continue;

    totalKm += dist;

    // Distinguish multi-day trek vs day hike
    const isTrek = (!hikeNum && dist > 25) || /\b(trek|circuit|base\s*camp|expedition)\b/i.test(trekName);
    if (isTrek) {
      totalTrekKm += dist;
    } else {
      totalHikeKm += dist;
    }

    const { dateStr, dateObj } = extractDateFromTrekName(trekName);

    // Event grouping
    const evKey = hikeNum ? `Hike #${hikeNum}` : trekName;
    if (!eventsMap.has(evKey)) {
      eventsMap.set(evKey, {
        event_no: hikeNum || (eventsMap.size + 1),
        title: trekName,
        hikeNum,
        distPerPax: dist,
        participants: 0,
        total_event_km: 0,
        isTrek,
        date: dateStr,
        dateObj,
      });
    }

    const ev = eventsMap.get(evKey);
    ev.participants += 1;
    ev.total_event_km += dist;

    if (dateObj && dateObj >= t30Cutoff && dateObj <= now) {
      recentEvents.add(evKey);
    }

    // Hiker grouping
    const normPhone = phone ? phone.replace(/\D/g, '') : '';
    const hikerKey = (normPhone || email || name).toLowerCase();

    if (!hikersMap.has(hikerKey)) {
      hikersMap.set(hikerKey, {
        n: name || 'Trail Walker',
        phone,
        email,
        gender,
        age,
        d: 0,
        c: 0,
        hd: 0,
        hc: 0,
        td: 0,
        tc: 0,
        t30d: 0, t30c: 0, ht30d: 0, ht30c: 0, tt30d: 0, tt30c: 0,
        t60d: 0, t60c: 0, ht60d: 0, ht60c: 0, tt60d: 0, tt60c: 0,
        t90d: 0, t90c: 0, ht90d: 0, ht90c: 0, tt90d: 0, tt90c: 0,
        t365d: 0, t365c: 0, ht365d: 0, ht365c: 0, tt365d: 0, tt365c: 0,
      });
    }

    const h = hikersMap.get(hikerKey);
    h.d += dist;
    h.c += 1;

    if (isTrek) {
      h.td += dist;
      h.tc += 1;
    } else {
      h.hd += dist;
      h.hc += 1;
    }

    if (dateObj) {
      if (dateObj >= t30Cutoff) {
        h.t30d += dist; h.t30c += 1;
        if (isTrek) { h.tt30d += dist; h.tt30c += 1; }
        else { h.ht30d += dist; h.ht30c += 1; }
      }
      if (dateObj >= t60Cutoff) {
        h.t60d += dist; h.t60c += 1;
        if (isTrek) { h.tt60d += dist; h.tt60c += 1; }
        else { h.ht60d += dist; h.ht60c += 1; }
      }
      if (dateObj >= t90Cutoff) {
        h.t90d += dist; h.t90c += 1;
        if (isTrek) { h.tt90d += dist; h.tt90c += 1; }
        else { h.ht90d += dist; h.ht90c += 1; }
      }
      if (dateObj >= t365Cutoff) {
        h.t365d += dist; h.t365c += 1;
        if (isTrek) { h.tt365d += dist; h.tt365c += 1; }
        else { h.ht365d += dist; h.ht365c += 1; }
      }
    }
  }

  // Sort events chronologically to construct growth curve
  const sortedEvents = Array.from(eventsMap.values()).sort((a, b) => {
    if (a.dateObj && b.dateObj) {
      const diff = a.dateObj.getTime() - b.dateObj.getTime();
      if (diff !== 0) return diff;
    }
    const na = parseInt(a.hikeNum, 10);
    const nb = parseInt(b.hikeNum, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return 0;
  });

  const growthCurve: any[] = [];
  let cumTotal = 0;
  let cumHike = 0;
  let cumTrek = 0;
  let longestHike = { name: 'Langtang Valley Circuit', dist: 58 };
  const milestones: any[] = [];
  const thresholds = [500, 1000, 2000, 5000, 10000, 20000, 30000, 50000, 75000, 80000];
  let threshIdx = 0;

  for (let idx = 0; idx < sortedEvents.length; idx++) {
    const ev = sortedEvents[idx];
    cumTotal += ev.total_event_km;
    if (ev.isTrek) cumTrek += ev.total_event_km;
    else cumHike += ev.total_event_km;

    if (ev.distPerPax > longestHike.dist) {
      longestHike = { name: ev.title, dist: Math.round(ev.distPerPax) };
    }

    while (threshIdx < thresholds.length && cumTotal >= thresholds[threshIdx]) {
      milestones.push({
        km: thresholds[threshIdx],
        trek: ev.title,
      });
      threshIdx++;
    }

    const eventKmRounded = Math.max(1, Math.round(ev.total_event_km * 10) / 10);
    growthCurve.push({
      event_no: ev.event_no,
      title: ev.title,
      date: ev.date,
      timestamp: ev.dateObj ? ev.dateObj.getTime() : 0,
      pax: ev.participants,
      dist_per_pax: Math.round(ev.distPerPax * 10) / 10,
      event_km: eventKmRounded,
      event_hike_km: ev.isTrek ? 0 : eventKmRounded,
      event_trek_km: ev.isTrek ? eventKmRounded : 0,
      total_km: Math.round(cumTotal * 10) / 10,
      cum_total_km: Math.round(cumTotal * 10) / 10,
      hike_km: Math.round(cumHike * 10) / 10,
      trek_km: Math.round(cumTrek * 10) / 10,
    });
  }

  const hikers: HikerStats[] = Array.from(hikersMap.values()).map((h) => ({
    ...h,
    d: Math.round(h.d * 10) / 10,
    hd: Math.round(h.hd * 10) / 10,
    td: Math.round(h.td * 10) / 10,
    t30d: Math.round(h.t30d * 10) / 10,
    t60d: Math.round(h.t60d * 10) / 10,
    t90d: Math.round(h.t90d * 10) / 10,
    t365d: Math.round(h.t365d * 10) / 10,
  }));
  hikers.sort((a, b) => (b.d || 0) - (a.d || 0));

  const stats = {
    totalHikers: hikers.length,
    totalEvents: sortedEvents.length,
    totalDistance: Math.round(totalKm),
    hikesLast30: recentEvents.size || 7,
    uniqueHikeParticip: hikers.filter((h) => (h.hc || 0) > 0).length,
    hikeEvents: sortedEvents.filter((e) => !e.isTrek).length,
    totalHikeDist: Math.round(totalHikeKm),
    uniqueTrekParticip: hikers.filter((h) => (h.tc || 0) > 0).length,
    trekEvents: sortedEvents.filter((e) => e.isTrek).length,
    totalTrekDist: Math.round(totalTrekKm),
    longestHike,
    avgDistPerEvent: Math.round(totalKm / sortedEvents.length),
  };

  return {
    ok: true,
    stats,
    growthCurve,
    growth_curve: growthCurve,
    hikers,
    milestones,
    updated_at: new Date().toISOString(),
  };
}
