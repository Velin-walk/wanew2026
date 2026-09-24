import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Flame,
  Footprints,
  Mountain,
  Compass,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
  Crown,
  RefreshCw,
  Filter,
  User,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X,
  Medal,
  Gem,
  Tent
} from 'lucide-react';
import { HikerStats, LeaderboardResponse } from '../types/leaderboard';
import { fetchLeaderboardData } from '../services/api';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Himalayan3DBackground } from '../components/3d/Himalayan3DBackground';

type TimePeriod = 't30' | 't60' | 't90' | 't365' | 'overall';
type SortMetric = 'dist' | 'count';
type BoardCategory = 'all' | 'hikers' | 'trekkers';

// Safe privacy masking
const maskName = (name?: string) => {
  if (!name || !name.trim()) return 'Anonymous Hiker';
  const parts = name.trim().split(/\s+/);
  const first = parts[0].slice(0, 3);
  const last = parts.slice(1).join(' ');
  return last ? `${first}. ${last}` : first;
};

// Helper to extract keys by category and period
const getKeys = (cat: BoardCategory, per: TimePeriod) => {
  if (cat === 'hikers') {
    const px = 'h';
    if (per === 'overall') return { d: 'hd', c: 'hc' };
    return { d: `${px}${per}d`, c: `${px}${per}c` };
  }
  if (cat === 'trekkers') {
    const px = 't';
    if (per === 'overall') return { d: 'td', c: 'tc' };
    return { d: `${px}${per}d`, c: `${px}${per}c` };
  }
  // Overall
  if (per === 'overall') return { d: 'd', c: 'c' };
  return { d: `${per}d`, c: `${per}c` };
};

interface LeaderboardSectionProps {
  category: BoardCategory;
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  setSelectedHiker: (hiker: HikerStats) => void;
  maskName: (name?: string) => string;
  getKeys: (cat: BoardCategory, per: TimePeriod) => { d: string; c: string };
}

const LeaderboardBoardSection: React.FC<LeaderboardSectionProps> = ({
  category,
  data,
  loading,
  error,
  setSelectedHiker,
  maskName,
  getKeys
}) => {
  const [period, setPeriod] = useState<TimePeriod>('t30');
  const [metric, setMetric] = useState<SortMetric>('dist');
  const [limit, setLimit] = useState(20);

  // Filtered & Sorted Hikers list
  const filteredHikers = useMemo(() => {
    if (!data?.hikers) return [];
    const { d: distKey, c: countKey } = getKeys(category, period);

    let list = data.hikers.filter((h: any) => {
      const dist = (h[distKey] as number) || 0;
      const count = (h[countKey] as number) || 0;
      const hasActivity = metric === 'dist' ? dist > 0 : count > 0;
      return hasActivity;
    });

    list.sort((a: any, b: any) => {
      const aVal = (a[metric === 'dist' ? distKey : countKey] as number) || 0;
      const bVal = (b[metric === 'dist' ? distKey : countKey] as number) || 0;
      return bVal - aVal;
    });

    return list.slice(0, 100);
  }, [data, category, period, metric, getKeys]);

  const visibleHikers = useMemo(() => {
    return filteredHikers.slice(0, limit);
  }, [filteredHikers, limit]);

  const categoryTitle = {
    all: 'Overall Standing',
    hikers: 'Day Hiker Standing',
    trekkers: 'Multi-day Trekker Standing'
  }[category];

  const categoryIcon = {
    all: <Trophy className="w-5 h-5 text-[#E08828]" />,
    hikers: <Footprints className="w-5 h-5 text-[#E08828]" />,
    trekkers: <Mountain className="w-5 h-5 text-[#4527A0]" />
  }[category];

  return (
    <div className="rounded-3xl border border-[#E5E1DB] bg-white/96 backdrop-blur-md shadow-md overflow-hidden">
      {/* Board Header & Controls */}
      <div className="p-5 border-b border-[#F0EBE5] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FAF8F5]">
              {categoryIcon}
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1F1F1F]">{categoryTitle}</h2>
              <p className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Community Top 100 Rankings</p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-tighter shadow-3xs">
            Top 100
          </div>
        </div>

        {/* Time Window Pills & Metric Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-stone-600 mr-1 shrink-0 flex items-center gap-1.5 w-full sm:w-auto mb-1 sm:mb-0 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-[#E08828]" /> Period:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 't30', label: '30 Days' },
                  { id: 't60', label: '60 Days' },
                  { id: 't90', label: '90 Days' },
                  { id: 't365', label: '1 Year' },
                  { id: 'overall', label: 'All Time' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setPeriod(t.id); setLimit(20); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer select-none border ${
                    period === t.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/20'
                      : 'bg-white text-stone-700 border-stone-250 hover:border-[#E08828] hover:text-[#E08828] hover:bg-amber-50/40 shadow-2xs'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 bg-stone-100 p-1.5 rounded-2xl border border-stone-250 shadow-inner w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => { setMetric('dist'); setLimit(20); }}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 select-none ${
                metric === 'dist'
                  ? 'bg-[#E08828] text-white shadow-md shadow-[#E08828]/30 ring-2 ring-[#E08828]/25'
                  : 'bg-white/80 hover:bg-white text-stone-700 hover:text-stone-950 border border-stone-200/80 shadow-2xs'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>By KM</span>
            </button>
            <button
              type="button"
              onClick={() => { setMetric('count'); setLimit(20); }}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 select-none ${
                metric === 'count'
                  ? 'bg-stone-900 text-white shadow-md shadow-stone-900/30 ring-2 ring-stone-900/25'
                  : 'bg-white/80 hover:bg-white text-stone-700 hover:text-stone-950 border border-stone-200/80 shadow-2xs'
              }`}
            >
              <Mountain className="w-4 h-4" />
              <span>By Trips</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#E08828] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#5A5551]">Loading hiker standings...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-xs font-bold text-rose-600">{error}</p>
        </div>
      ) : filteredHikers.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <Mountain className="w-8 h-8 text-[#C2BCB4] mx-auto" />
          <p className="text-xs font-bold text-[#5A5551]">No activity found for this period</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-12 px-4 py-3 bg-[#FAF8F5] border-b border-[#EFEAE4] text-[11px] font-black uppercase tracking-wider text-[#6A645D]">
            <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
            <div className="col-span-5 sm:col-span-6">Hiker</div>
            <div className="col-span-3 sm:col-span-3 text-right">Distance</div>
            <div className="col-span-2 sm:col-span-2 text-right">Trips</div>
          </div>

          <div className="divide-y divide-[#F4EFEA]">
            {visibleHikers.map((hiker, idx) => {
              const { d: distKey, c: countKey } = getKeys(category, period);
              const distanceVal = ((hiker as any)[distKey] as number) || 0;
              const countVal = ((hiker as any)[countKey] as number) || 0;

              return (
                <div
                  key={`${hiker.n}-${idx}`}
                  onClick={() => setSelectedHiker(hiker)}
                  className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[#FFFDF9] transition-colors cursor-pointer group"
                >
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                    {idx === 0 ? (
                      <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-amber-300">
                        <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30" /> 1
                      </span>
                    ) : idx === 1 ? (
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-slate-300">
                        <Medal className="w-3.5 h-3.5 text-slate-500" /> 2
                      </span>
                    ) : idx === 2 ? (
                      <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-800 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-amber-200">
                        <Award className="w-3.5 h-3.5 text-amber-700" /> 3
                      </span>
                    ) : (
                      <span className="text-xs font-black text-[#8B8680]">#{idx + 1}</span>
                    )}
                  </div>

                  <div className="col-span-5 sm:col-span-6 flex items-center gap-2 pr-2">
                    <div className="w-8 h-8 rounded-xl bg-[#FAF6F0] border border-[#E5E1DB] flex items-center justify-center text-xs font-black text-[#5A5551] shrink-0 group-hover:border-[#E08828]/40 transition-colors">
                      {(hiker.n || 'H')[0]?.toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-xs sm:text-sm font-bold text-[#1F1F1F] group-hover:text-[#E08828] transition-colors block truncate">
                        {maskName(hiker.n)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {hiker.d >= 500 ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[9px] font-bold border border-purple-200 flex items-center gap-1">
                            500KM Legend <Gem className="w-3 h-3 text-purple-600" />
                          </span>
                        ) : hiker.d >= 100 ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200 flex items-center gap-1">
                            100KM Century <Sparkles className="w-3 h-3 text-emerald-600" />
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#8B8680]">Trail Walker</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-3 text-right">
                    <span className="text-xs sm:text-sm font-black text-[#1F5BBB] block">
                      {distanceVal.toLocaleString()} km
                    </span>
                    <span className="text-[10px] text-[#8B8680]">
                      {period === 'overall' ? 'lifetime' : period}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-2 text-right">
                    <span className="text-xs sm:text-sm font-black text-[#7ABA42] block">
                      {countVal}
                    </span>
                    <span className="text-[10px] text-[#8B8680]">
                      {category === 'hikers' ? 'hikes' : category === 'trekkers' ? 'treks' : 'trips'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleHikers.length < filteredHikers.length && (
            <div className="p-4 bg-[#FAF8F5] border-t border-[#EFEAE4] text-center">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + 20)}
                className="w-full sm:w-auto px-6 py-2 bg-white hover:bg-[#F3EFEA] border-2 border-dashed border-[#7ABA42] text-[#1B5E20] font-black text-[11px] rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                See More ⬇
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LeaderboardScreen: React.FC = () => {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [journeyPeriod, setJourneyPeriod] = useState<TimePeriod>('overall');
  const [selectedHiker, setSelectedHiker] = useState<HikerStats | null>(null);
  const [activeJourneyPoint, setActiveJourneyPoint] = useState<any | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (!data || isRefresh) setLoading(true);
      setError(null);
      const res = await fetchLeaderboardData(isRefresh);
      if (res && res.hikers) {
        setData(res);
      } else {
        throw new Error('Could not retrieve leaderboard data.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Computed dynamic last updated timestamp matching the cache cycle
  const lastUpdatedText = useMemo(() => {
    if (data?.last_updated) {
      try {
        const d = new Date(data.last_updated);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { /* ignore */ }
    }
    if (data?.updated_at) {
      try {
        const d = new Date(data.updated_at);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { /* ignore */ }
    }
    // Dynamic fallback to the most recent midnight (sync baseline)
    const baseline = new Date();
    baseline.setHours(0, 0, 0, 0);
    return baseline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' (Midnight)';
  }, [data]);

  const currentStats = data?.stats;

  const filteredGrowthCurve = useMemo(() => {
    const curve = data?.growthCurve || data?.growth_curve;
    if (!curve || curve.length === 0) return [];
    if (journeyPeriod === 'overall') return curve;

    const days = journeyPeriod === 't30' ? 30 : journeyPeriod === 't60' ? 60 : journeyPeriod === 't90' ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return curve.filter((pt) => {
      if (!pt.date) return true;
      return new Date(pt.date) >= cutoff;
    });
  }, [data?.growthCurve, data?.growth_curve, journeyPeriod]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-10 relative">
      {/* Real-life 3D Himalayan Environment with Stupa, Prayer Flags & Scroll Parallax */}
      <Himalayan3DBackground opacity={0.85} />

      {/* Main Foreground Content */}
      <div className="relative z-10 space-y-4 sm:space-y-6">
        {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#9E4700] via-[#E08828] to-[#732D00] text-white rounded-3xl p-5 sm:p-7 shadow-md relative overflow-hidden border border-[#F5A844]/30">
        {/* Glow & ambient accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none text-[#FED7AA]">
          <Trophy className="w-56 h-56" />
        </div>

        <div className="relative z-10 w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 border border-white/20 text-[#FED7AA] text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-3xs">
              <Crown className="w-3.5 h-3.5 text-[#F5A844] shrink-0" />
              <span>Community Leadership Board</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] text-[#FFE8D1] font-extrabold uppercase tracking-widest bg-black/35 border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Last updated: {lastUpdatedText}</span>
              </span>
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Celebrating Community Milestones
          </h1>

          {/* Quick Summary Strip */}
          {currentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3.5 border-t border-white/15 text-[11px]">
              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#E08828]/20 text-[#F5A844]">
                  <Footprints className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-300 block">Total Walkers</span>
                  <strong className="text-sm font-black text-white">{currentStats.totalHikers?.toLocaleString() || '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#7ABA42]/20 text-[#A8E063]">
                  <Mountain className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-300 block">Hikes Conducted</span>
                  <strong className="text-sm font-black text-white">{currentStats.totalEvents?.toLocaleString() || '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-300 block">Community Distance</span>
                  <strong className="text-sm font-black text-white">{currentStats.totalDistance ? `${currentStats.totalDistance.toLocaleString()} km` : '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-stone-300 block">Recent 30 Days</span>
                  <strong className="text-sm font-black text-white">{currentStats.hikesLast30 || '0'} events</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Community KM Journey (Pre-computed Curve & Milestones) */}
      {data && (
        <div className="bg-white/96 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-[#E5E1DB] shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EBE5]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1B361D] text-[#A8E063]">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#1F1F1F]">Community KM Journey</h2>
                <p className="text-[11px] text-[#6A645D] font-bold">Cumulative walking trajectory across all organized treks</p>
              </div>
            </div>

            {/* Time Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: 'overall', label: 'All Time' },
                  { id: 't365', label: '1 Year' },
                  { id: 't90', label: '90 Days' },
                  { id: 't60', label: '60 Days' },
                  { id: 't30', label: '30 Days' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setJourneyPeriod(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 cursor-pointer select-none border ${
                    journeyPeriod === t.id
                      ? 'bg-[#1B361D] text-white border-[#1B361D] shadow-md shadow-[#1B361D]/25 ring-2 ring-[#1B361D]/20'
                      : 'bg-white text-stone-700 border-stone-250 hover:border-[#1B361D] hover:text-[#1B361D] hover:bg-emerald-50/40 shadow-2xs'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {currentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">Total KM</span>
                <span className="text-base sm:text-lg font-black text-[#1B5E20] block mt-0.5">
                  {currentStats.totalDistance?.toLocaleString() || '0'} km
                </span>
              </div>
              <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">Events</span>
                <span className="text-base sm:text-lg font-black text-[#1F1F1F] block mt-0.5">
                  {currentStats.totalEvents || 0} conducted
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/60">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Day Hike KM</span>
                <span className="text-base sm:text-lg font-black text-emerald-900 block mt-0.5">
                  {currentStats.totalHikeDist?.toLocaleString() || '0'} km
                </span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/60">
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Trek KM</span>
                <span className="text-base sm:text-lg font-black text-purple-900 block mt-0.5">
                  {currentStats.totalTrekDist?.toLocaleString() || '0'} km
                </span>
              </div>
            </div>
          )}

          {/* Chart Area */}
          <div className="h-48 sm:h-56 w-full pt-2">
            {filteredGrowthCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredGrowthCurve}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setActiveJourneyPoint(state.activePayload[0].payload);
                    }
                  }}
                  onMouseDown={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setActiveJourneyPoint(state.activePayload[0].payload);
                    }
                  }}
                  onMouseMove={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setActiveJourneyPoint(state.activePayload[0].payload);
                    }
                  }}
                  onTouchStart={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setActiveJourneyPoint(state.activePayload[0].payload);
                    }
                  }}
                  onTouchMove={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length) {
                      setActiveJourneyPoint(state.activePayload[0].payload);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7ABA42" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#7ABA42" stopOpacity={0.03}/>
                    </linearGradient>
                    <linearGradient id="colorTrek" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4527A0" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4527A0" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="event_no" tick={{ fontSize: 10, fill: '#8B8680' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8680' }} tickLine={false} tickFormatter={(val) => `${Math.round(val / 1000)}k`} />
                  <Tooltip
                    cursor={{ stroke: '#1B5E20', strokeWidth: 1.5, strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-xs p-2 sm:p-2.5 rounded-xl shadow-lg border border-[#E5E1DB] text-[10px] sm:text-[11px] space-y-0.5 sm:space-y-1 pointer-events-none max-w-[180px] sm:max-w-none">
                            <strong className="block text-[#1F1F1F] font-black truncate">{pt.title || `Event #${pt.event_no}`}</strong>
                            <span className="text-[9px] sm:text-[10px] text-[#8B8680] block">{pt.date}</span>
                            <div className="text-emerald-700 font-bold">Total: {pt.total_km?.toLocaleString()} km</div>
                            <div className="text-stone-500 text-[9px] sm:text-[10px]">Hike: {pt.hike_km?.toLocaleString()}k • Trek: {pt.trek_km?.toLocaleString()}k</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total_km"
                    stroke="#1B5E20"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    activeDot={{ r: 5, fill: '#1B5E20', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="trek_km"
                    stroke="#4527A0"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorTrek)"
                    activeDot={{ r: 4, fill: '#4527A0', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8B8680]">
                Growth curve updates with completed treks
              </div>
            )}
          </div>

          {/* Active Event Inspection Strip (Docked under chart so mobile chart view is never disrupted) */}
          <div className="bg-[#FAF8F5] border border-[#EFEAE4] rounded-2xl p-3 sm:p-3.5 transition-all">
            {activeJourneyPoint ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1B361D] text-[#A8E063] flex items-center justify-center shrink-0 shadow-2xs">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#1F1F1F]">
                        {activeJourneyPoint.title || `Event #${activeJourneyPoint.event_no}`}
                      </span>
                      {activeJourneyPoint.date && (
                        <span className="text-[10px] font-bold text-[#8B8680] bg-white px-2 py-0.5 rounded-md border border-[#E5E1DB]">
                          {activeJourneyPoint.date}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6A645D] font-medium mt-0.5">
                      Day Hike: <strong className="text-emerald-800">{activeJourneyPoint.hike_km?.toLocaleString() || 0} km</strong> • Multi-day Trek: <strong className="text-purple-800">{activeJourneyPoint.trek_km?.toLocaleString() || 0} km</strong>
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#EFEAE4]">
                  <span className="text-[9px] uppercase font-bold text-[#8B8680] block tracking-wider">Cumulative Total</span>
                  <span className="text-sm sm:text-base font-black text-[#1B5E20]">
                    {activeJourneyPoint.total_km?.toLocaleString()} km
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-[#8B8680] py-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E08828] shrink-0" />
                  <span className="font-semibold text-stone-600 text-[11px] sm:text-xs">
                    Tap or scrub across the curve to inspect any milestone
                  </span>
                </div>
                {filteredGrowthCurve.length > 0 && (
                  <span className="text-[11px] font-black text-[#1B5E20] shrink-0 pl-2">
                    Latest: {filteredGrowthCurve[filteredGrowthCurve.length - 1].total_km?.toLocaleString()} km
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Milestones Ribbon */}
          {data.milestones && data.milestones.length > 0 && (
            <div className="pt-3 border-t border-[#F0EBE5]">
              <span className="text-[10px] font-black uppercase text-[#8B8680] tracking-wider block mb-2">
                Milestones Unlocked Along The Journey
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {data.milestones.map((m, idx) => (
                  <div key={idx} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                    <span>{m.km.toLocaleString()} km</span>
                    <span className="text-[10px] text-amber-700/80 font-medium">({m.trek})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Separate Boards for Overall, Hikers, and Trekkers */}
      <LeaderboardBoardSection
        category="all"
        data={data}
        loading={loading}
        error={error}
        setSelectedHiker={setSelectedHiker}
        maskName={maskName}
        getKeys={getKeys}
      />

      <LeaderboardBoardSection
        category="hikers"
        data={data}
        loading={loading}
        error={error}
        setSelectedHiker={setSelectedHiker}
        maskName={maskName}
        getKeys={getKeys}
      />

      <LeaderboardBoardSection
        category="trekkers"
        data={data}
        loading={loading}
        error={error}
        setSelectedHiker={setSelectedHiker}
        maskName={maskName}
        getKeys={getKeys}
      />

      {/* Clubs & Milestones Showcase */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-purple-50/95 to-purple-100/80 backdrop-blur-md rounded-2xl border border-purple-200 text-center shadow-xs">
          <Crown className="w-6 h-6 text-purple-600 mx-auto mb-1" />
          <h4 className="text-xs font-black text-purple-900 uppercase tracking-wider">500KM Ultra Club</h4>
          <p className="text-[11px] text-purple-700 font-medium mt-1">
            {data?.hikers ? data.hikers.filter((h) => h.d >= 500).length : 0} Legends Registered
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-blue-50/95 to-blue-100/80 backdrop-blur-md rounded-2xl border border-blue-200 text-center shadow-xs">
          <Gem className="w-6 h-6 text-blue-600 mx-auto mb-1" />
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider">200KM Summit Club</h4>
          <p className="text-[11px] text-blue-700 font-medium mt-1">
            {data?.hikers ? data.hikers.filter((h) => h.d >= 200 && h.d < 500).length : 0} Elite Trekkers
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50/95 to-emerald-100/80 backdrop-blur-md rounded-2xl border border-emerald-200 text-center shadow-xs">
          <Sparkles className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
          <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">100KM Century Club</h4>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            {data?.hikers ? data.hikers.filter((h) => h.d >= 100 && h.d < 200).length : 0} Century Walkers
          </p>
        </div>
      </div>

      {/* Hiker Detail Modal */}
      {selectedHiker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-5 border-b border-[#EFEAE4] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-black text-lg">
                  {(selectedHiker.n || 'H')[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1F1F1F]">
                    {maskName(selectedHiker.n)}
                  </h3>
                  <span className="text-[11px] text-[#8B8680]">Verified Community Hiker</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHiker(null)}
                className="p-2 text-[#8B8680] hover:text-[#1F1F1F] rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-center p-4 bg-[#F9F7F5] rounded-2xl border border-[#E5E1DB]">
                <span className="text-[11px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  Lifetime Total Distance
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#1B5E20] mt-1 block">
                  {selectedHiker.d.toLocaleString()} KM
                </span>
                <span className="text-xs text-[#6A645D] font-bold">
                  Completed across {selectedHiker.c} registered events
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-lg font-black text-[#2E7D32] flex items-center justify-center gap-1">
                    <Compass className="w-4 h-4 text-emerald-700" /> {selectedHiker.hc || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
                    Day Hikes
                  </span>
                  <span className="text-xs font-bold text-[#2E7D32] block mt-1">
                    {(selectedHiker.hd || 0).toLocaleString()} km
                  </span>
                </div>

                <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-center">
                  <span className="text-lg font-black text-[#4527A0] flex items-center justify-center gap-1">
                    <Tent className="w-4 h-4 text-purple-700" /> {selectedHiker.tc || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider">
                    Treks
                  </span>
                  <span className="text-xs font-bold text-[#4527A0] block mt-1">
                    {(selectedHiker.td || 0).toLocaleString()} km
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#8B8680]">Last 30 Days:</span>
                  <strong className="text-[#1F1F1F]">
                    {(selectedHiker.t30d || 0).toLocaleString()} km ({selectedHiker.t30c || 0} trips)
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8B8680]">Hiker Club Tier:</span>
                  <strong className="text-[#E08828]">
                    {selectedHiker.d >= 500
                      ? 'Ultra Legend (500KM+)'
                      : selectedHiker.d >= 200
                      ? 'Summit Trekker (200KM+)'
                      : selectedHiker.d >= 100
                      ? 'Century Walker (100KM+)'
                      : 'Trail Explorer'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#FAF6F0] border-t border-[#EFEAE4] text-center">
              <button
                type="button"
                onClick={() => setSelectedHiker(null)}
                className="w-full py-2.5 bg-[#1B361D] text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
