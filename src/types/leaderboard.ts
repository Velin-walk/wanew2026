export interface HikerStats {
  n: string; // name
  d: number; // total distance km
  c: number; // total count
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

export interface LeaderboardResponse {
  ok: boolean;
  ts?: string | number;
  stats: LeaderboardStats;
  hikers: HikerStats[];
}
