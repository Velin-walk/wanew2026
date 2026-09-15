import { Trek } from "../types";

export const CLOUDFLARE_WORKER_URL = "https://walk-nepal-walk-api.velinrai-vr.workers.dev";
export const LOCAL_API_URL = "/api";

export function apiUrl(path: string, directCloudflare = true): string {
  const cleanPath = path.replace(/^\/+/, "");
  if (directCloudflare) {
    return `${CLOUDFLARE_WORKER_URL}/${cleanPath}`;
  }
  return `/api/${cleanPath}`;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const cleanPath = path.replace(/^\/+/, "");
  const directUrl = `${CLOUDFLARE_WORKER_URL}/${cleanPath}`;

  // Direct fetch to Cloudflare Worker
  return fetch(directUrl, options);
}

export function normalizeTrek(row: any): Trek {
  // Returns a normalized Trek object from raw API response row
  let d: any = {};
  if (row.data) {
    if (typeof row.data === 'string') {
      try {
        d = JSON.parse(row.data);
      } catch (e) {
        console.warn('Failed to parse row.data JSON string:', row.data, e);
        d = {};
      }
    } else {
      d = row.data;
    }
  }
  
  // Prefer values from the nested data object if they exist
  const title = d.title || row.title || row.name || row.trek_name || "";
  const hikeNum = d.hikeNumber || row.hike_number || row.hikeNumber || "";
  const date = d.hikeDate || row.hike_date || row.date || "";
  const category = d.category || row.category || "";
  
  const difficulty = String(d.overview?.difficulty || row.difficulty || "Easy").toLowerCase();
  
  // Price logic: Prefer calculating from priceTiers in 'data' object
  let displayPrice = row.price || "";
  const prices = (d.priceTiers || []).map((t: any) => Number(t.price) || 0).filter((p: number) => p > 0);
  
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    displayPrice = max !== min 
      ? `${d.currency || 'NPR'} ${min.toLocaleString()} - ${max.toLocaleString()}`
      : `${d.currency || 'NPR'} ${min.toLocaleString()}`;
  } else if (!displayPrice && row.min_price) {
    displayPrice = row.max_price && row.max_price !== row.min_price
      ? `NPR ${row.min_price} - ${row.max_price}`
      : `NPR ${row.min_price}+`;
  }

  return {
    id: String(row.id || hikeNum || row.trek_id || title),
    hike_number: String(hikeNum),
    name: title,
    date: date,
    days: d.overview?.expectedDuration || row.expected_duration || row.days || "1",
    difficulty: difficulty === "hard" ? "difficult" : difficulty === "moderate" ? "moderate" : "easy",
    leader: row.team_leader || row.leader || "Walk Nepal Walk Guide",
    capacity: Number(row.max_capacity || row.capacity) || 25,
    participants: Number(row.participants ?? row.registered_pax) || 0,
    participants_by_gender: row.participants_by_gender,
    recent_participants: row.recent_participants,
    itinerary_link: row.itinerary_link || "",
    faq_link: row.faq_link || "",
    whatsapp_link: row.whatsapp_link || "",
    price: displayPrice,
    featured_image: d.coverImageUrl || row.cover_image_url || row.featured_image || row.thumbnail_url || "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop",
    fitness_level: d.overview?.difficulty || row.fitness_level || "All fitness levels",
    season: row.season || "Autumn / Year-round",
    type_of_trail: row.type_of_trail || "",
    start_location: d.overview?.meetingPoint || row.meeting_point || row.start_location || "",
    elevation: d.overview?.elevationRange || row.elevation_range || row.elevation || "",
    itinerary: row.itinerary || "",
    data: d,
  };
}

export function enrichTreksWithRegistrations(treks: Trek[], registrations: any[]): Trek[] {
  if (!Array.isArray(treks)) return [];
  if (!Array.isArray(registrations) || registrations.length === 0) return treks;

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return treks.map((trek) => {
    const tNum = String(trek.hike_number || trek.id || '').trim();
    const tName = norm(trek.name);

    const matched = registrations.filter((r) => {
      const rNum = String(r.hike_number || r.trek_id || '').trim();
      if (rNum && tNum && rNum === tNum) return true;

      const rTrekName = norm(r.trek_name);
      const rListName = norm(r.list_name);

      if (rTrekName && (rTrekName === tName || rTrekName.includes(tName) || tName.includes(rTrekName))) return true;
      if (rListName && (rListName.includes(tName) || tName.includes(rListName))) return true;
      return false;
    });

    let totalPax = 0;
    let maleCount = 0;
    let femaleCount = 0;
    const recentList: Array<{ name: string; gender: 'm' | 'f' }> = [];
    const seenNames = new Set<string>();

    for (const r of matched) {
      const name = (r.full_name || '').trim();
      if (name && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        const isFemale = String(r.gender || '').toLowerCase().startsWith('f');
        if (isFemale) femaleCount += 1;
        else maleCount += 1;
        totalPax += 1;

        recentList.unshift({
          name,
          gender: isFemale ? 'f' : 'm',
        });

        // Check for companions in team_members or person_remarks
        if (Array.isArray(r.team_members)) {
          for (const tm of r.team_members) {
            const tmName = (tm.full_name || '').trim();
            if (tmName && !seenNames.has(tmName.toLowerCase())) {
              seenNames.add(tmName.toLowerCase());
              totalPax += 1;
              const tmFemale = String(tm.gender || '').toLowerCase().startsWith('f');
              if (tmFemale) femaleCount += 1;
              else maleCount += 1;
              recentList.unshift({
                name: tmName,
                gender: tmFemale ? 'f' : 'm',
              });
            }
          }
        } else {
          const remarks = String(r.person_remarks || '');
          const matchComp = remarks.match(/companion\(?s?\)?:\s*([^,\n]+)/i);
          if (matchComp && matchComp[1]) {
            const compNames = matchComp[1].split(',').map((n: string) => n.trim()).filter(Boolean);
            for (const cName of compNames) {
              if (!seenNames.has(cName.toLowerCase())) {
                seenNames.add(cName.toLowerCase());
                totalPax += 1;
                femaleCount += 1;
                recentList.unshift({
                  name: cName,
                  gender: 'f',
                });
              }
            }
          }
        }
      }
    }

    // If total calculated from registrations is > 0, override the trek roster fields
    if (totalPax > 0 || recentList.length > 0) {
      return {
        ...trek,
        participants: totalPax,
        participants_by_gender: {
          total: totalPax,
          male: maleCount,
          female: femaleCount,
        },
        recent_participants: recentList,
      };
    }

    return trek;
  });
}
