import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Footprints,
  Mountain,
  Compass,
  Calendar,
  Sparkles,
  Award,
  Crown,
  X,
  Medal,
  Gem,
  Tent
} from 'lucide-react';
import { HikerStats, LeaderboardResponse } from '../types/leaderboard';
import { fetchLeaderboardData } from '../services/api';
import { Himalayan3DBackground } from '../components/3d/Himalayan3DBackground';
import { LowPolyMountainTrailChart } from '../components/3d/LowPolyMountainTrailChart';
import { HikerReviewsSection } from '../components/InfoPagesModal';
import { MapContributionBoard } from '../components/MapContributionBoard';
import { isHikerAnonymous, useAnonymity } from '../utils/anonymity';

type TimePeriod = 't30' | 't60' | 't90' | 't365' | 'overall';
type SortMetric = 'dist' | 'count';
type BoardCategory = 'all' | 'hikers' | 'trekkers';

// Safe privacy masking
const maskName = (name?: string) => {
  if (!name || !name.trim()) return 'Anonymous Hiker';
  if (isHikerAnonymous({ name: name.trim() })) return 'Anonymous Hiker';
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

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) {
    return (
      <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-amber-300">
        <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30" /> 1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-800 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-slate-300">
        <Medal className="w-3.5 h-3.5 text-slate-500" /> 2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-900 font-black text-xs flex items-center justify-center gap-0.5 shadow-3xs border border-amber-300">
        <Award className="w-3.5 h-3.5 text-amber-700" /> 3
      </span>
    );
  }
  return <span className="text-xs font-black text-stone-500">#{rank}</span>;
};

export const getHikerTitleInfo = (distance: number, isTop3AllTime = false) => {
  // Top 3 of all time get Trail Ambassador title by default
  if (isTop3AllTime) {
    return {
      title: distance >= 2000 ? '2000KM Trail Ambassador' : 'Trail Ambassador',
      style: 'bg-amber-100 text-amber-900 border-amber-300 shadow-3xs',
      icon: 'crown'
    };
  }

  if (distance >= 2000) {
    return {
      title: '2000KM Trail Ambassador',
      style: 'bg-amber-100 text-amber-900 border-amber-300 shadow-3xs',
      icon: 'crown'
    };
  }
  if (distance >= 1500) {
    return {
      title: '1500KM Senior Trail Leader',
      style: 'bg-indigo-50 text-indigo-900 border-indigo-300',
      icon: 'award'
    };
  }
  if (distance >= 1000) {
    return {
      title: '1000KM Trail Leader',
      style: 'bg-purple-100 text-purple-900 border-purple-300',
      icon: 'gem'
    };
  }
  if (distance >= 500) {
    return {
      title: '500KM Trail Blazer',
      style: 'bg-orange-50 text-orange-900 border-orange-300',
      icon: 'sparkles'
    };
  }
  if (distance >= 400) {
    return {
      title: '400KM Explorer',
      style: 'bg-sky-50 text-sky-900 border-sky-300',
      icon: 'compass'
    };
  }
  if (distance >= 300) {
    return {
      title: '300KM Trekker',
      style: 'bg-violet-50 text-violet-900 border-violet-300',
      icon: 'mountain'
    };
  }
  if (distance >= 200) {
    return {
      title: '200KM Hiker',
      style: 'bg-blue-50 text-blue-900 border-blue-300',
      icon: 'footprints'
    };
  }
  if (distance >= 100) {
    return {
      title: '100KM Walker',
      style: 'bg-emerald-50 text-emerald-900 border-emerald-300',
      icon: 'sparkles'
    };
  }
  return {
    title: 'Trail Walker',
    style: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: 'none'
  };
};

const HikerTierBadge: React.FC<{
  distance: number;
  isTop3AllTime?: boolean;
  isMobile?: boolean;
}> = ({ distance, isTop3AllTime, isMobile }) => {
  const { title, style, icon } = getHikerTitleInfo(distance, isTop3AllTime);
  const iconSize = isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`px-1.5 py-0.5 rounded-md font-bold border inline-flex items-center gap-0.5 sm:gap-1 shrink-0 whitespace-nowrap ${style} ${
        isMobile ? 'text-[8px]' : 'text-[9px]'
      }`}
    >
      <span>{title}</span>
      {icon === 'crown' && <Crown className={`${iconSize} text-amber-600`} />}
      {icon === 'award' && <Award className={`${iconSize} text-indigo-600`} />}
      {icon === 'gem' && <Gem className={`${iconSize} text-purple-600`} />}
      {icon === 'sparkles' && (
        <Sparkles className={`${iconSize} ${distance < 200 ? 'text-emerald-600' : 'text-orange-600'}`} />
      )}
      {icon === 'compass' && <Compass className={`${iconSize} text-sky-600`} />}
      {icon === 'mountain' && <Mountain className={`${iconSize} text-violet-600`} />}
      {icon === 'footprints' && <Footprints className={`${iconSize} text-blue-600`} />}
    </span>
  );
};

interface LeaderboardSectionProps {
  category: BoardCategory;
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  setSelectedHiker: (hiker: HikerStats) => void;
  top3AllTimeNames: Set<string>;
}

const LeaderboardBoardSection: React.FC<LeaderboardSectionProps> = ({
  category,
  data,
  loading,
  error,
  setSelectedHiker,
  top3AllTimeNames
}) => {
  const [period, setPeriod] = useState<TimePeriod>('t30');
  const [metric, setMetric] = useState<SortMetric>('dist');
  const [limit, setLimit] = useState(20);

  // Filtered & Sorted Hikers list
  const filteredHikers = useMemo(() => {
    if (!data?.hikers) return [];
    const { d: distKey, c: countKey } = getKeys(category, period);

    const list = data.hikers.filter((h: any) => {
      const dist = (h[distKey] as number) || 0;
      const count = (h[countKey] as number) || 0;
      return metric === 'dist' ? dist > 0 : count > 0;
    });

    list.sort((a: any, b: any) => {
      const aVal = (a[metric === 'dist' ? distKey : countKey] as number) || 0;
      const bVal = (b[metric === 'dist' ? distKey : countKey] as number) || 0;
      return bVal - aVal;
    });

    return list.slice(0, 100);
  }, [data, category, period, metric]);

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
    <div className="rounded-3xl border border-stone-300 bg-white/70 backdrop-blur-md shadow-md shadow-stone-900/5 overflow-hidden transition-all">
      {/* Board Header & Controls */}
      <div className="p-3.5 sm:p-5 border-b border-stone-200 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-xl bg-stone-100 border border-stone-200/80 shrink-0">
              {categoryIcon}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">{categoryTitle}</h2>
              <p className="text-[9px] sm:text-[10px] font-bold text-stone-600 uppercase tracking-wider">Community Top 100 Rankings</p>
            </div>
          </div>
          <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter shadow-3xs shrink-0">
            Top 100
          </div>
        </div>

        {/* Time Window Pills & Metric Toggle */}
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="flex flex-col gap-1.5 w-full">
            <span className="text-[10px] font-extrabold text-stone-700 shrink-0 flex items-center gap-1 uppercase tracking-wider">
              <Calendar className="w-3 h-3 text-[#E08828]" /> Period:
            </span>
            <div className="grid grid-cols-5 gap-1 w-full">
              {(
                [
                  { id: 't30', label: '30D' },
                  { id: 't60', label: '60D' },
                  { id: 't90', label: '90D' },
                  { id: 't365', label: '1Y' },
                  { id: 'overall', label: 'All' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setPeriod(t.id); setLimit(20); }}
                  className={`px-0.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-black transition-all active:scale-95 cursor-pointer select-none border text-center whitespace-nowrap ${
                    period === t.id
                      ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-1 ring-stone-900/20'
                      : 'bg-white text-stone-700 border-stone-300 hover:border-[#E08828] hover:text-[#E08828] hover:bg-amber-50/50 shadow-2xs'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl border border-stone-300 shadow-inner w-full shrink-0">
            <button
              type="button"
              onClick={() => { setMetric('dist'); setLimit(20); }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1 active:scale-95 select-none min-h-[36px] ${
                metric === 'dist'
                  ? 'bg-[#E08828] text-white shadow-md shadow-[#E08828]/30 ring-1 ring-[#E08828]/25'
                  : 'bg-white hover:bg-white text-stone-700 hover:text-stone-950 border border-stone-300 shadow-2xs'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>By KM</span>
            </button>
            <button
              type="button"
              onClick={() => { setMetric('count'); setLimit(20); }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1 active:scale-95 select-none min-h-[36px] ${
                metric === 'count'
                  ? 'bg-stone-900 text-white shadow-md shadow-stone-900/30 ring-1 ring-stone-900/25'
                  : 'bg-white hover:bg-white text-stone-700 hover:text-stone-950 border border-stone-300 shadow-2xs'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>By Trips</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="divide-y divide-stone-200/60 animate-pulse p-3 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center justify-between py-2.5 px-2 gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-6 h-6 rounded-full bg-stone-200 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-28 bg-stone-200 rounded-md" />
                  <div className="h-2.5 w-16 bg-stone-100 rounded-md" />
                </div>
              </div>
              <div className="h-5 w-14 bg-stone-200 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-xs font-bold text-rose-600">{error}</p>
        </div>
      ) : filteredHikers.length === 0 ? (
        <div className="p-8 sm:p-10 text-center space-y-2">
          <Mountain className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="text-xs font-bold text-stone-600">No activity found for this period</p>
        </div>
      ) : (
        <div>
          {/* Desktop Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 px-4 py-3 bg-stone-100 border-b border-stone-200 text-[11px] font-black uppercase tracking-wider text-stone-700">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-6">Hiker</div>
            <div className="col-span-3 text-right">Distance</div>
            <div className="col-span-2 text-right">Trips</div>
          </div>
          {/* Mobile Table Header */}
          <div className="sm:hidden flex items-center justify-between px-3.5 py-2.5 bg-stone-100 border-b border-stone-200 text-[10px] font-black uppercase tracking-wider text-stone-700">
            <div className="flex items-center gap-2">
              <span className="w-7 text-center">#</span>
              <span>Hiker</span>
            </div>
            <div className="text-right">
              <span>Distance & Trips</span>
            </div>
          </div>

          <div className="divide-y divide-stone-200/80 bg-white/60">
            {visibleHikers.map((hiker, idx) => {
              const { d: distKey, c: countKey } = getKeys(category, period);
              const distanceVal = ((hiker as any)[distKey] as number) || 0;
              const countVal = ((hiker as any)[countKey] as number) || 0;
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;
              const isTop3AllTime = top3AllTimeNames.has((hiker.n || '').trim().toLowerCase());

              return (
                <div
                  key={`${hiker.n}-${idx}`}
                  onClick={() => setSelectedHiker(hiker)}
                  className={`transition-colors cursor-pointer group active:bg-stone-100/90 ${
                    isTop1
                      ? 'bg-amber-50/50 hover:bg-amber-100/60'
                      : isTop2
                      ? 'bg-slate-50/60 hover:bg-slate-100/70'
                      : isTop3
                      ? 'bg-amber-50/25 hover:bg-amber-100/50'
                      : 'bg-transparent hover:bg-stone-100/60'
                  }`}
                >
                  {/* Mobile Row Layout */}
                  <div className="sm:hidden flex items-center justify-between px-3 py-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 shrink-0 flex items-center justify-center">
                        <RankBadge rank={idx + 1} />
                      </div>

                      <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-[#E08828] transition-colors truncate">
                          {maskName(hiker.n)}
                        </span>
                        <HikerTierBadge distance={hiker.d} isTop3AllTime={isTop3AllTime} isMobile />
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-1">
                      <span className="text-xs font-black text-blue-700 block whitespace-nowrap">
                        {distanceVal.toLocaleString()} km
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium block whitespace-nowrap">
                        {countVal} {category === 'hikers' ? 'hikes' : category === 'trekkers' ? 'treks' : 'trips'}
                      </span>
                    </div>
                  </div>

                  {/* Tablet / Desktop Grid Row Layout */}
                  <div className="hidden sm:grid sm:grid-cols-12 items-center px-4 py-3">
                    <div className="col-span-1 flex items-center justify-center">
                      <RankBadge rank={idx + 1} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2 pr-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-900 group-hover:text-[#E08828] transition-colors truncate">
                        {maskName(hiker.n)}
                      </span>
                      <HikerTierBadge distance={hiker.d} isTop3AllTime={isTop3AllTime} />
                    </div>

                    <div className="col-span-3 text-right">
                      <span className="text-sm font-black text-blue-700 block">
                        {distanceVal.toLocaleString()} km
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {period === 'overall' ? 'lifetime' : period}
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="text-sm font-black text-emerald-700 block">
                        {countVal}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {category === 'hikers' ? 'hikes' : category === 'trekkers' ? 'treks' : 'trips'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleHikers.length < filteredHikers.length && (
            <div className="p-3.5 sm:p-4 bg-stone-50 border-t border-stone-200 text-center">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + 20)}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-white hover:bg-stone-100 border-2 border-dashed border-emerald-600 text-emerald-800 font-black text-xs sm:text-[11px] rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer min-h-[44px] flex items-center justify-center mx-auto"
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

export const LeaderboardScreen: React.FC<{ onNavigateToMapMiners?: () => void }> = ({ onNavigateToMapMiners }) => {
  useAnonymity();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [mobileCategory, setMobileCategory] = useState<BoardCategory>('all');
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

  // Top 3 hikers of all time sorted by total distance `d`
  const top3AllTimeNames = useMemo(() => {
    if (!data?.hikers || data.hikers.length === 0) return new Set<string>();
    const sorted = [...data.hikers].sort((a, b) => (b.d || 0) - (a.d || 0));
    return new Set(sorted.slice(0, 3).map((h) => (h.n || '').trim().toLowerCase()));
  }, [data?.hikers]);

  // Precomputed club counts for 500KM, 200KM, 100KM in a single fast pass
  const clubCounts = useMemo(() => {
    if (!data?.hikers) return { ultra: 0, summit: 0, century: 0 };
    let ultra = 0;
    let summit = 0;
    let century = 0;
    for (const h of data.hikers) {
      if (h.d >= 500) ultra++;
      else if (h.d >= 200) summit++;
      else if (h.d >= 100) century++;
    }
    return { ultra, summit, century };
  }, [data?.hikers]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-10 relative">
      {/* Main Foreground Content */}
      <div className="relative z-10 space-y-4 sm:space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#9E4700] via-[#E08828] to-[#732D00] text-white rounded-3xl p-4 sm:p-7 shadow-md relative overflow-hidden border border-[#F5A844]/40">
        {/* Glow & ambient accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none text-[#FED7AA]">
          <Trophy className="w-56 h-56" />
        </div>

        <div className="relative z-10 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/25 border border-white/20 text-[#FED7AA] text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-3xs">
              <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F5A844] shrink-0" />
              <span>Community Leadership Board</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] text-[#FFE8D1] font-extrabold uppercase tracking-widest bg-black/35 border border-white/10 px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 sm:mt-4 pt-3 sm:pt-3.5 border-t border-white/15 text-[11px]">
              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#E08828]/20 text-[#F5A844] shrink-0">
                  <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-stone-300 block truncate">Total Walkers</span>
                  <strong className="text-xs sm:text-sm font-black text-white">{currentStats.totalHikers?.toLocaleString() || '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#7ABA42]/20 text-[#A8E063] shrink-0">
                  <Mountain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-stone-300 block truncate">Hikes Conducted</span>
                  <strong className="text-xs sm:text-sm font-black text-white">{currentStats.totalEvents?.toLocaleString() || '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-stone-300 block truncate">Community Distance</span>
                  <strong className="text-xs sm:text-sm font-black text-white">{currentStats.totalDistance ? `${currentStats.totalDistance.toLocaleString()} km` : '—'}</strong>
                </div>
              </div>

              <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-white/10 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] sm:text-[10px] text-stone-300 block truncate">Recent 30 Days</span>
                  <strong className="text-xs sm:text-sm font-black text-white">{currentStats.hikesLast30 || 0} events</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Standalone 3D Himalayan Environment Resources Bar */}
      <Himalayan3DBackground mode="contained" />

      {/* Community KM Journey (Pre-computed Curve & Milestones) */}
      {data && (
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-stone-300 shadow-md shadow-stone-900/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1B361D] text-[#A8E063]">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">Community KM Journey</h2>
                <p className="text-[11px] text-stone-600 font-bold">Cumulative walking trajectory across all organized treks</p>
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
                      : 'bg-white text-stone-700 border-stone-300 hover:border-[#1B361D] hover:text-[#1B361D] hover:bg-emerald-50/40 shadow-2xs'
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
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Total KM</span>
                <span className="text-base sm:text-lg font-black text-[#1B5E20] block mt-0.5">
                  {currentStats.totalDistance?.toLocaleString() || '0'} km
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Events</span>
                <span className="text-base sm:text-lg font-black text-stone-900 block mt-0.5">
                  {currentStats.totalEvents || 0} conducted
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-300">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Day Hike KM</span>
                <span className="text-base sm:text-lg font-black text-emerald-900 block mt-0.5">
                  {currentStats.totalHikeDist?.toLocaleString() || '0'} km
                </span>
              </div>
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-300">
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Trek KM</span>
                <span className="text-base sm:text-lg font-black text-purple-900 block mt-0.5">
                  {currentStats.totalTrekDist?.toLocaleString() || '0'} km
                </span>
              </div>
            </div>
          )}

          {/* 3D Low-Poly Mountain Trail Chart Area */}
          <div className="w-full pt-1">
            <LowPolyMountainTrailChart
              points={filteredGrowthCurve}
              mode="total"
              activePoint={activeJourneyPoint}
              onSelectPoint={(pt) => setActiveJourneyPoint(pt)}
            />
          </div>

          {/* Active Event Inspection Strip */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 sm:p-3.5 transition-all">
            {activeJourneyPoint ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1B361D] text-[#A8E063] flex items-center justify-center shrink-0 shadow-2xs">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-stone-900">
                        {activeJourneyPoint.title || `Event #${activeJourneyPoint.event_no}`}
                      </span>
                      {activeJourneyPoint.date && (
                        <span className="text-[10px] font-bold text-stone-600 bg-white px-2 py-0.5 rounded-md border border-stone-300">
                          {activeJourneyPoint.date}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-600 font-medium mt-0.5">
                      Day Hike: <strong className="text-emerald-800">{activeJourneyPoint.hike_km?.toLocaleString() || 0} km</strong> (Cum: <strong className="text-emerald-800">{activeJourneyPoint.cum_hike_km?.toLocaleString() || activeJourneyPoint.hike_km?.toLocaleString() || 0} km</strong>) • Multi-day Trek: <strong className="text-purple-800">{activeJourneyPoint.trek_km?.toLocaleString() || 0} km</strong> (Cum: <strong className="text-purple-800">{activeJourneyPoint.cum_trek_km?.toLocaleString() || activeJourneyPoint.trek_km?.toLocaleString() || 0} km</strong>)
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                  <span className="text-[9px] uppercase font-bold text-stone-500 block tracking-wider">Cumulative Total</span>
                  <span className="text-sm sm:text-base font-black text-[#1B5E20]">
                    {activeJourneyPoint.total_km?.toLocaleString()} km
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-stone-600 py-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E08828] shrink-0" />
                  <span className="font-semibold text-stone-700 text-[11px] sm:text-xs">
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
            <div className="pt-3 border-t border-stone-200">
              <span className="text-[10px] font-black uppercase text-stone-600 tracking-wider block mb-2">
                Milestones Unlocked Along The Journey
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {data.milestones.map((m, idx) => (
                  <div key={idx} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                    <span>{m.km.toLocaleString()} km</span>
                    <span className="text-[10px] text-amber-800 font-medium">({m.trek})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Category Switcher (Tabs) */}
      <div className="lg:hidden bg-stone-100 p-1.5 rounded-2xl border border-stone-300 shadow-inner flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMobileCategory('all')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer ${
            mobileCategory === 'all'
              ? 'bg-[#1B361D] text-white shadow-md shadow-[#1B361D]/25 ring-1 ring-[#1B361D]/30'
              : 'text-stone-700 hover:text-stone-900 bg-white/70 border border-stone-200 shadow-2xs'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#E08828]" />
          <span>Overall</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileCategory('hikers')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer ${
            mobileCategory === 'hikers'
              ? 'bg-[#1B361D] text-white shadow-md shadow-[#1B361D]/25 ring-1 ring-[#1B361D]/30'
              : 'text-stone-700 hover:text-stone-900 bg-white/70 border border-stone-200 shadow-2xs'
          }`}
        >
          <Footprints className="w-3.5 h-3.5 text-[#E08828]" />
          <span>Day Hikes</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileCategory('trekkers')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer ${
            mobileCategory === 'trekkers'
              ? 'bg-[#1B361D] text-white shadow-md shadow-[#1B361D]/25 ring-1 ring-[#1B361D]/30'
              : 'text-stone-700 hover:text-stone-900 bg-white/70 border border-stone-200 shadow-2xs'
          }`}
        >
          <Mountain className="w-3.5 h-3.5 text-[#A8E063]" />
          <span>Treks</span>
        </button>
      </div>

      {/* Mobile: Selected Board Only */}
      <div className="lg:hidden">
        <LeaderboardBoardSection
          category={mobileCategory}
          data={data}
          loading={loading}
          error={error}
          setSelectedHiker={setSelectedHiker}
          top3AllTimeNames={top3AllTimeNames}
        />
      </div>

      {/* Desktop: Side-by-side 3-column Grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-5 items-start">
        <LeaderboardBoardSection
          category="all"
          data={data}
          loading={loading}
          error={error}
          setSelectedHiker={setSelectedHiker}
          top3AllTimeNames={top3AllTimeNames}
        />

        <LeaderboardBoardSection
          category="hikers"
          data={data}
          loading={loading}
          error={error}
          setSelectedHiker={setSelectedHiker}
          top3AllTimeNames={top3AllTimeNames}
        />

        <LeaderboardBoardSection
          category="trekkers"
          data={data}
          loading={loading}
          error={error}
          setSelectedHiker={setSelectedHiker}
          top3AllTimeNames={top3AllTimeNames}
        />
      </div>

      {/* Map Miners Community Contribution Board */}
      <MapContributionBoard onNavigateToMapMiners={onNavigateToMapMiners} />

      {/* Clubs & Milestones Showcase */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-purple-200 text-center shadow-xs shadow-purple-900/5">
          <div className="w-7 h-7 sm:w-9 sm:h-9 mx-auto mb-1.5 sm:mb-2 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>
          <h4 className="text-[10px] sm:text-xs font-black text-purple-950 uppercase tracking-wider truncate">500KM Ultra</h4>
          <p className="text-[9px] sm:text-[11px] text-purple-800 font-bold mt-0.5 sm:mt-1 truncate">
            {clubCounts.ultra} Legends
          </p>
        </div>

        <div className="p-2.5 sm:p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-blue-200 text-center shadow-xs shadow-blue-900/5">
          <div className="w-7 h-7 sm:w-9 sm:h-9 mx-auto mb-1.5 sm:mb-2 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
            <Gem className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>
          <h4 className="text-[10px] sm:text-xs font-black text-blue-950 uppercase tracking-wider truncate">200KM Summit</h4>
          <p className="text-[9px] sm:text-[11px] text-blue-800 font-bold mt-0.5 sm:mt-1 truncate">
            {clubCounts.summit} Trekkers
          </p>
        </div>

        <div className="p-2.5 sm:p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-emerald-200 text-center shadow-xs shadow-emerald-900/5">
          <div className="w-7 h-7 sm:w-9 sm:h-9 mx-auto mb-1.5 sm:mb-2 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>
          <h4 className="text-[10px] sm:text-xs font-black text-emerald-950 uppercase tracking-wider truncate">100KM Century</h4>
          <p className="text-[9px] sm:text-[11px] text-emerald-800 font-bold mt-0.5 sm:mt-1 truncate">
            {clubCounts.century} Walkers
          </p>
        </div>
      </div>

      {/* Attached Hiker Reviews Extension */}
      <div className="relative z-10 bg-white rounded-3xl border border-[#E5E1DB] p-4 sm:p-6 shadow-md mt-6">
        <HikerReviewsSection initialVisibleCount={5} />
      </div>

      {/* Hiker Detail Modal */}
      {selectedHiker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-4 sm:p-5 border-b border-[#EFEAE4] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-black text-base sm:text-lg shrink-0">
                  {(selectedHiker.n || 'H')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-[#1F1F1F] truncate">
                    {maskName(selectedHiker.n)}
                  </h3>
                  <span className="text-[10px] sm:text-[11px] text-[#8B8680]">Verified Community Hiker</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHiker(null)}
                className="w-10 h-10 flex items-center justify-center text-[#8B8680] hover:text-[#1F1F1F] rounded-full active:bg-stone-100 transition-colors shrink-0"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div className="text-center p-3.5 sm:p-4 bg-[#F9F7F5] rounded-2xl border border-[#E5E1DB]">
                <span className="text-[10px] sm:text-[11px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  Lifetime Total Distance
                </span>
                <span className="text-xl sm:text-3xl font-black text-[#1B5E20] mt-1 block">
                  {selectedHiker.d.toLocaleString()} KM
                </span>
                <span className="text-[11px] sm:text-xs text-[#6A645D] font-bold">
                  Completed across {selectedHiker.c} registered events
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="p-3 sm:p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-base sm:text-lg font-black text-[#2E7D32] flex items-center justify-center gap-1">
                    <Compass className="w-4 h-4 text-emerald-700" /> {selectedHiker.hc || 0}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
                    Day Hikes
                  </span>
                  <span className="text-xs font-bold text-[#2E7D32] block mt-0.5 sm:mt-1">
                    {(selectedHiker.hd || 0).toLocaleString()} km
                  </span>
                </div>

                <div className="p-3 sm:p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-center">
                  <span className="text-base sm:text-lg font-black text-[#4527A0] flex items-center justify-center gap-1">
                    <Tent className="w-4 h-4 text-purple-700" /> {selectedHiker.tc || 0}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase text-purple-800 tracking-wider">
                    Treks
                  </span>
                  <span className="text-xs font-bold text-[#4527A0] block mt-0.5 sm:mt-1">
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
                  <span className="text-[#8B8680]">Hiker Title:</span>
                  <strong className="text-[#E08828]">
                    {getHikerTitleInfo(
                      selectedHiker.d,
                      top3AllTimeNames.has((selectedHiker.n || '').trim().toLowerCase())
                    ).title}
                  </strong>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 bg-[#FAF6F0] border-t border-[#EFEAE4] text-center shrink-0">
              <button
                type="button"
                onClick={() => setSelectedHiker(null)}
                className="w-full py-2.5 bg-[#1B361D] text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all min-h-[44px] flex items-center justify-center cursor-pointer"
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
