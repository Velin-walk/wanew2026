import { Trek } from "../types";

export const API_BASE_URL = "/api";

export function apiUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `/api/${cleanPath}`;
}

export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}

export function normalizeTrek(row: any): Trek {
  // Returns a normalized Trek object from raw API response row
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
  
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
