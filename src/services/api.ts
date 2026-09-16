import { Trek } from "../types";

export const CLOUDFLARE_WORKER_URL = "https://walk-nepal-walk-api.velinrai-vr.workers.dev";
export const LOCAL_API_URL = "/api";

export interface ApiFetchOptions extends RequestInit {
  forceFresh?: boolean;
  cacheTtl?: number; // duration in milliseconds
}

interface CacheItem {
  data: any;
  timestamp: number;
  contentType: string;
}

// In-memory cache + persistent sessionStorage cache to minimize Cloudflare Worker and D1 queries
const memoryCache = new Map<string, CacheItem>();
export const DEFAULT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

function getSessionCache(key: string): CacheItem | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem('wnw_cache_' + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSessionCache(key: string, item: CacheItem) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    sessionStorage.setItem('wnw_cache_' + key, JSON.stringify(item));
  } catch {
    // Silently ignore quota / privacy mode errors
  }
}

function clearSessionCache(prefix?: string) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('wnw_cache_')) {
        if (!prefix || k.includes(prefix)) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    memoryCache.clear();
    clearSessionCache();
    return;
  }
  const cleanPrefix = pathPrefix.replace(/^\/+/, "");
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(cleanPrefix)) {
      memoryCache.delete(key);
    }
  }
  clearSessionCache(cleanPrefix);
}

export function apiUrl(path: string, directCloudflare = true): string {
  const cleanPath = path.replace(/^\/+/, "");
  if (directCloudflare) {
    return `${CLOUDFLARE_WORKER_URL}/${cleanPath}`;
  }
  return `/api/${cleanPath}`;
}

export async function apiFetch(path: string, options?: ApiFetchOptions): Promise<Response> {
  const cleanPath = path.replace(/^\/+/, "");
  const directUrl = `${CLOUDFLARE_WORKER_URL}/${cleanPath}`;
  const method = (options?.method || "GET").toUpperCase();

  // If this is a mutation (POST, PUT, DELETE, PATCH), invalidate relevant caches
  if (method !== "GET") {
    clearApiCache(); // Invalidate cached queries on any state mutation
    return fetch(directUrl, options);
  }

  const ttl = options?.cacheTtl ?? DEFAULT_CACHE_TTL;

  // Handle GET caching if forceFresh is not set
  if (!options?.forceFresh) {
    // 1. Check ultra-fast memory cache
    const cached = memoryCache.get(directUrl);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "X-WNW-Cache": "HIT-MEMORY",
        },
      });
    }

    // 2. Check persistent sessionStorage cache (persists across reloads/new tabs in session)
    const sessionItem = getSessionCache(directUrl);
    if (sessionItem && Date.now() - sessionItem.timestamp < ttl) {
      memoryCache.set(directUrl, sessionItem);
      return new Response(JSON.stringify(sessionItem.data), {
        status: 200,
        headers: {
          "Content-Type": sessionItem.contentType,
          "X-WNW-Cache": "HIT-STORAGE",
        },
      });
    }
  }

  // Perform live network fetch to Cloudflare Worker
  const res = await fetch(directUrl, options);

  // Cache successful JSON responses
  if (res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const cloned = res.clone();
        const json = await cloned.json();
        const cacheItem: CacheItem = {
          data: json,
          timestamp: Date.now(),
          contentType,
        };
        memoryCache.set(directUrl, cacheItem);
        setSessionCache(directUrl, cacheItem);
      } catch (err) {
        // Silently skip caching if unparseable
      }
    }
  }

  return res;
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
    is_cancelled: Boolean(d.is_cancelled || row.exec_is_cancelled || row.is_cancelled || (d.execution_status && d.execution_status.toLowerCase() === 'cancelled')),
    cancellation_reason: d.cancellation_reason || row.exec_cancellation_reason || row.cancellation_reason || "",
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

/**
 * High-performance single trek loader.
 * Fetches ONLY the requested itinerary and its targeted roster from Cloudflare D1.
 * Bypasses downloading the entire treks and registrations database.
 */
export async function fetchSingleTrek(idOrHikeNumber: string): Promise<Trek | null> {
  if (!idOrHikeNumber) return null;
  try {
    const cleanId = String(idOrHikeNumber).trim();
    const res = await apiFetch(`treks/${encodeURIComponent(cleanId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.trek || json.data;
    if (!raw) return null;
    const normalized = normalizeTrek(raw);
    if (json.roster && Array.isArray(json.roster)) {
      const enriched = enrichTreksWithRegistrations([normalized], json.roster);
      return enriched[0] || normalized;
    }
    return normalized;
  } catch (e) {
    console.warn(`Failed to fetch single trek ${idOrHikeNumber}:`, e);
    return null;
  }
}

/**
 * User-specific bookings loader.
 * Queries Cloudflare D1 with a targeted email filter instead of downloading all registrations.
 */
export async function fetchUserBookings(email: string): Promise<any[]> {
  if (!email || !email.trim()) return [];
  try {
    const cleanEmail = email.trim().toLowerCase();
    const res = await apiFetch(`registrations?email=${encodeURIComponent(cleanEmail)}`);
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json) ? json : json?.data;
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn(`Failed to fetch user bookings for ${email}:`, e);
    return [];
  }
}

/**
 * Fetch Leaderboard aggregated stats designed specifically for Community Dashboard.
 * Tries Cloudflare endpoint first, with fallback to Google Apps Script proxy.
 */
export async function fetchLeaderboardData(): Promise<any> {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyIT-PJSPuLLUT-7d3CYnyjg0juWHoLbkVDMrNh9GK7_KidnsZZBLkQiYVxyft29KtHvA/exec';
  
  // Try direct Cloudflare Worker endpoint first
  try {
    const cfRes = await apiFetch('leaderboard', { cacheTtl: 5 * 60 * 1000 });
    if (cfRes.ok) {
      const data = await cfRes.json();
      if (data && data.hikers && Array.isArray(data.hikers) && data.hikers.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Direct Cloudflare leaderboard fetch fallback to script source:', err);
  }

  // Fallback to Dashboard Apps Script API
  try {
    const gasRes = await fetch(GAS_URL);
    if (gasRes.ok) {
      const data = await gasRes.json();
      if (data && (data.ok || data.hikers)) {
        return data;
      }
    }
  } catch (gasErr) {
    console.warn('Dashboard script fetch error:', gasErr);
  }

  return null;
}

