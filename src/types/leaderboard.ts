export type TimePeriod = 't30' | 't60' | 't90' | 't365' | 'overall';

export interface HikerCompletedEvent {
  no?: string | number;
  name?: string;
  dist?: number;
  date?: string;
}

export interface HikerStats {
  n: string; // name
  d: number; // total distance km
  c: number; // total count
  phone?: string;
  p?: string;
  e?: string;
  hikes?: HikerCompletedEvent[];
  hd?: number; // hike distance km
  hc?: number; // hike count
  td?: number; // trek distance km
  tc?: number; // trek count
  t30d?: number;
  t30c?: number;
  t60d?: number;
  t60c?: number;
  t90d?: number;
  t90c?: number;
  t365d?: number;
  t365c?: number;
  ht30d?: number;
  ht30c?: number;
  ht60d?: number;
  ht60c?: number;
  ht90d?: number;
  ht90c?: number;
  ht365d?: number;
  ht365c?: number;
  tt30d?: number;
  tt30c?: number;
  tt60d?: number;
  tt60c?: number;
  tt90d?: number;
  tt90c?: number;
  tt365d?: number;
  tt365c?: number;
}

export interface LeaderboardStats {
  totalHikers: number;
  totalEvents: number;
  totalDistance: number;
  hikesLast30: number;
  uniqueHikeParticip: number;
  hikeEvents: number;
  totalHikeDist: number;
  uniqueTrekParticip: number;
  trekEvents: number;
  totalTrekDist: number;
  avgDistPerEvent: number;
  longestHike: { name: string; dist: number };
}

export interface JourneyPoint {
  event_no: string | number;
  title: string;
  date: string;
  timestamp?: number;
  hike_km: number;
  trek_km: number;
  total_km: number;
  event_km?: number;
  event_hike_km?: number;
  event_trek_km?: number;
  cum_total_km?: number;
  cum_hike_km?: number;
  cum_trek_km?: number;
  formattedDate?: string;
}

export interface LeaderboardResponse {
  ok: boolean;
  ts?: string | number;
  stats: LeaderboardStats;
  hikers: HikerStats[];
  last_updated?: string;
  updated_at?: string;
  growth_curve?: JourneyPoint[];
  growthCurve?: JourneyPoint[];
  milestones?: Array<{
    km: number;
    trek: string;
  }>;
}
