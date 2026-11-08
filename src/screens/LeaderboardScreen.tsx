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
  Tent,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { HikerStats, LeaderboardResponse } from '../types/leaderboard';
import { fetchLeaderboardData } from '../services/api';
import { LowPolyMountainTrailChart } from '../components/3d/LowPolyMountainTrailChart';
import { SpiralDistanceBarChart } from '../components/SpiralDistanceBarChart';
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

// Soft-UI Neumorphic Rank Badges inspired by squircle icon buttons in reference
const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) {
    return (
      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-50/90 text-amber-800 font-black text-[11px] sm:text-xs flex items-center justify-center gap-0.5 shadow-[2px_2px_6px_#c8d2df,-2px_-2px_6px_#ffffff] border border-amber-200/90 shrink-0">
        <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 fill-amber-400/40" /> 1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-slate-100/90 text-slate-800 font-black text-[11px] sm:text-xs flex items-center justify-center gap-0.5 shadow-[2px_2px_6px_#c8d2df,-2px_-2px_6px_#ffffff] border border-slate-200 shrink-0">
        <Medal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" /> 2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-orange-50/90 text-orange-900 font-black text-[11px] sm:text-xs flex items-center justify-center gap-0.5 shadow-[2px_2px_6px_#c8d2df,-2px_-2px_6px_#ffffff] border border-orange-200 shrink-0">
        <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600" /> 3
      </span>
    );
  }
  return (
    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-[#e8eef5] text-slate-500 font-extrabold text-[10px] sm:text-xs flex items-center justify-center shadow-[inset_1px_1px_3px_#c8d2df,inset_-1px_-1px_3px_#ffffff] shrink-0">
      #{rank}
    </span>
  );
};

export const getHikerTitleInfo = (distance: number, isTop3AllTime = false) => {
  if (isTop3AllTime) {
    return {
      title: distance >= 2000 ? '2000KM Trail Ambassador' : 'Trail Ambassador',
      shortTitle: 'Ambassador',
      style: 'bg-amber-50 text-amber-900 border-amber-300 shadow-[2px_2px_6px_#d5dde7,-2px_-2px_6px_#ffffff]',
      icon: 'crown'
    };
  }

  if (distance >= 2000) {
    return {
      title: '2000KM Trail Ambassador',
      shortTitle: 'Ambassador',
      style: 'bg-amber-50 text-amber-900 border-amber-300 shadow-[2px_2px_6px_#d5dde7,-2px_-2px_6px_#ffffff]',
      icon: 'crown'
    };
  }
  if (distance >= 1500) {
    return {
      title: '1500KM Senior Trail Leader',
      shortTitle: '1.5K Leader',
      style: 'bg-indigo-50 text-indigo-900 border-indigo-200',
      icon: 'award'
    };
  }
  if (distance >= 1000) {
    return {
      title: '1000KM Trail Leader',
      shortTitle: '1K Leader',
      style: 'bg-purple-50 text-purple-900 border-purple-200',
      icon: 'gem'
    };
  }
  if (distance >= 500) {
    return {
      title: '500KM Trail Blazer',
      shortTitle: '500KM',
      style: 'bg-orange-50 text-orange-900 border-orange-200',
      icon: 'sparkles'
    };
  }
  if (distance >= 400) {
    return {
      title: '400KM Explorer',
      shortTitle: '400KM',
      style: 'bg-sky-50 text-sky-900 border-sky-200',
      icon: 'compass'
    };
  }
  if (distance >= 300) {
    return {
      title: '300KM Trekker',
      shortTitle: '300KM',
      style: 'bg-violet-50 text-violet-900 border-violet-200',
      icon: 'mountain'
    };
  }
  if (distance >= 200) {
    return {
      title: '200KM Hiker',
      shortTitle: '200KM',
      style: 'bg-blue-50 text-blue-900 border-blue-200',
      icon: 'footprints'
    };
  }
  if (distance >= 100) {
    return {
      title: '100KM Walker',
      shortTitle: '100KM',
      style: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      icon: 'sparkles'
    };
  }
  return {
    title: 'Trail Walker',
    shortTitle: 'Walker',
    style: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: 'none'
  };
};

const HikerTierBadge: React.FC<{
  distance: number;
  isTop3AllTime?: boolean;
  isMobile?: boolean;
}> = ({ distance, isTop3AllTime, isMobile }) => {
  const { title, shortTitle, style, icon } = getHikerTitleInfo(distance, isTop3AllTime);
  const iconSize = isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`px-1.5 py-0.5 rounded-lg font-bold border inline-flex items-center gap-1 shrink-0 whitespace-nowrap ${style} ${
        isMobile ? 'text-[8px]' : 'text-[9px]'
      }`}
      title={title}
    >
      <span>{isMobile ? shortTitle : title}</span>
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
    all: <Trophy className="w-5 h-5 text-blue-600" />,
    hikers: <Footprints className="w-5 h-5 text-blue-600" />,
    trekkers: <Mountain className="w-5 h-5 text-indigo-600" />
  }[category];

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] overflow-hidden transition-all relative z-10">
      {/* Board Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 space-y-3 sm:space-y-4 bg-white">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-3">
            {/* Soft squircle icon button inspired by reference Home/Calendar icons */}
            <div className="w-10 h-10 rounded-2xl bg-[#f0f4f9] border border-slate-200/80 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] flex items-center justify-center shrink-0">
              {categoryIcon}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">{categoryTitle}</h2>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Top 100 Community Rankings</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[10px] font-black uppercase tracking-tight shrink-0 shadow-2xs">
            Top 100
          </div>
        </div>

        {/* Time Window Pills & Metric Toggle */}
        <div className="flex flex-col gap-3">
          {/* Recessed Time Period Track */}
          <div className="flex flex-col gap-1.5 w-full">
            <span className="text-[10px] font-extrabold text-slate-500 shrink-0 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Period
            </span>
            <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-[#e5ebf2] shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] border border-[#dce3ec] w-full">
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
                  className={`py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all active:scale-95 cursor-pointer select-none text-center whitespace-nowrap ${
                    period === t.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Switch Toggle (inspired directly by the ON/OFF pill switch in reference) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#e5ebf2] shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] border border-[#dce3ec] w-full shrink-0">
            <button
              type="button"
              onClick={() => { setMetric('dist'); setLimit(20); }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 select-none min-h-[38px] ${
                metric === 'dist'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>By KM</span>
            </button>
            <button
              type="button"
              onClick={() => { setMetric('count'); setLimit(20); }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-95 select-none min-h-[38px] ${
                metric === 'count'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)]'
                  : 'text-slate-600 hover:text-slate-900'
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
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-2xl bg-[#e8edf4] shadow-[inset_2px_2px_4px_#c8d2df,inset_-2px_-2px_4px_#ffffff] gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-7 h-7 rounded-xl bg-slate-300 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-28 bg-slate-300 rounded-md" />
                  <div className="h-2.5 w-16 bg-slate-200 rounded-md" />
                </div>
              </div>
              <div className="h-5 w-14 bg-slate-300 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-xs font-bold text-rose-600">{error}</p>
        </div>
      ) : filteredHikers.length === 0 ? (
        <div className="p-8 sm:p-10 text-center space-y-2">
          <Mountain className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-500">No activity recorded for this period</p>
        </div>
      ) : (
        <div className="p-2 sm:p-3">
          {/* Desktop Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 px-3 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 bg-slate-100/90 rounded-xl mb-1.5 border border-slate-200/70">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6">Hiker</div>
            <div className="col-span-3 text-right">Distance</div>
            <div className="col-span-2 text-right">Trips</div>
          </div>
          {/* Mobile Table Header */}
          <div className="sm:hidden flex items-center justify-between px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-100/90 rounded-xl mb-1.5 border border-slate-200/70">
            <div className="flex items-center gap-2">
              <span className="w-6 text-center">#</span>
              <span>Hiker</span>
            </div>
            <div className="text-right">
              <span>Distance · Trips</span>
            </div>
          </div>

          <div className="space-y-1.5 mt-1">
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
                  className={`transition-all cursor-pointer group active:scale-[0.99] rounded-2xl p-1.5 sm:p-2 border ${
                    isTop1
                      ? 'bg-amber-50/90 hover:bg-amber-100/90 border-amber-300 shadow-[2px_2px_8px_#d5dde7,-2px_-2px_8px_#ffffff]'
                      : isTop2
                      ? 'bg-slate-100/90 hover:bg-slate-200/90 border-slate-300 shadow-[2px_2px_8px_#d5dde7,-2px_-2px_8px_#ffffff]'
                      : isTop3
                      ? 'bg-orange-50/90 hover:bg-orange-100/90 border-orange-300 shadow-[2px_2px_8px_#d5dde7,-2px_-2px_8px_#ffffff]'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-[2px_2px_6px_#dce4ee,-2px_-2px_6px_#ffffff]'
                  }`}
                >
                  {/* Mobile Row Layout */}
                  <div className="sm:hidden flex items-center justify-between px-1.5 py-1 gap-2 min-h-[34px]">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <div className="w-6 shrink-0 flex items-center justify-center">
                        <RankBadge rank={idx + 1} />
                      </div>

                      <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate shrink-1">
                        {maskName(hiker.n)}
                      </span>

                      <HikerTierBadge distance={hiker.d} isTop3AllTime={isTop3AllTime} isMobile />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-right whitespace-nowrap pl-1 font-mono tabular-nums">
                      <span className="text-xs font-black text-blue-600">
                        {distanceVal.toLocaleString()}<span className="text-[10px] font-sans font-bold text-slate-500 ml-0.5">km</span>
                      </span>
                      <span className="text-slate-300 text-[10px] font-sans">·</span>
                      <span className="text-[11px] font-black text-slate-800">
                        {countVal}<span className="text-[9px] font-sans text-slate-500">{category === 'hikers' ? 'h' : category === 'trekkers' ? 't' : 'e'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Tablet / Desktop Grid Row Layout */}
                  <div className="hidden sm:grid sm:grid-cols-12 items-center px-2 py-1.5">
                    <div className="col-span-1 flex items-center justify-center">
                      <RankBadge rank={idx + 1} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2 pr-2 min-w-0 overflow-hidden">
                      <span className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {maskName(hiker.n)}
                      </span>
                      <HikerTierBadge distance={hiker.d} isTop3AllTime={isTop3AllTime} />
                    </div>

                    <div className="col-span-3 text-right">
                      <span className="text-xs sm:text-sm font-black text-blue-600">
                        {distanceVal.toLocaleString()} km
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold ml-1">
                        ({period === 'overall' ? 'lifetime' : period})
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {countVal}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium ml-1">
                        {category === 'hikers' ? 'hikes' : category === 'trekkers' ? 'treks' : 'trips'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* See More Tactile Action Button */}
          {visibleHikers.length < filteredHikers.length && (
            <div className="pt-3 pb-1 text-center">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + 20)}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#f0f4f9] hover:bg-white text-blue-600 font-black text-xs rounded-2xl border border-white/80 shadow-[4px_4px_12px_#d1d9e6,-4px_-4px_12px_#ffffff] hover:shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] active:shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] transition-all cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5 mx-auto active:scale-95"
              >
                <span>Load More Hikers</span>
                <ChevronDown className="w-4 h-4" />
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
  const [journeyPeriod, setJourneyPeriod] = useState<TimePeriod>('overall');
  const [chartView, setChartView] = useState<'spiral' | 'mountain'>('spiral');
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
    const baseline = new Date();
    baseline.setHours(0, 0, 0, 0);
    return baseline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' (Midnight)';
  }, [data]);

  const currentStats = data?.stats;

  const filteredGrowthCurve = useMemo(() => {
    const rawCurve = data?.growthCurve || data?.growth_curve;
    if (!rawCurve || rawCurve.length === 0) return [];

    // Pre-calculate individual event distances on the chronological curve so that
    // each bar represents that single event's total KM (relative to each other)
    const enrichedCurve = rawCurve.map((pt: any, idx: number) => {
      let eventKm = typeof pt.event_km === 'number' && pt.event_km > 0 ? pt.event_km : 0;
      let eventHikeKm = pt.event_hike_km ?? pt.hike_km ?? 0;
      let eventTrekKm = pt.event_trek_km ?? pt.trek_km ?? 0;

      if (!eventKm) {
        const prev = idx > 0 ? rawCurve[idx - 1] : null;
        if (prev && typeof pt.total_km === 'number' && typeof prev.total_km === 'number') {
          const diffTotal = pt.total_km - prev.total_km;
          if (diffTotal > 0) {
            eventKm = diffTotal;
            eventHikeKm = Math.max(0, (pt.hike_km || 0) - (prev.hike_km || 0));
            eventTrekKm = Math.max(0, (pt.trek_km || 0) - (prev.trek_km || 0));
          }
        } else if (typeof pt.total_km === 'number' && pt.total_km > 0 && pt.total_km <= 500) {
          eventKm = pt.total_km;
          eventHikeKm = pt.hike_km || 0;
          eventTrekKm = pt.trek_km || 0;
        } else {
          eventKm = 20;
        }
      }

      return {
        ...pt,
        event_km: Math.max(1, Math.round(eventKm * 10) / 10),
        event_hike_km: Math.max(0, Math.round(eventHikeKm * 10) / 10),
        event_trek_km: Math.max(0, Math.round(eventTrekKm * 10) / 10),
        cum_total_km: pt.cum_total_km ?? pt.total_km,
        cum_hike_km: pt.cum_hike_km ?? pt.hike_km,
        cum_trek_km: pt.cum_trek_km ?? pt.trek_km
      };
    });

    if (journeyPeriod === 'overall') return enrichedCurve;

    const days = journeyPeriod === 't30' ? 30 : journeyPeriod === 't60' ? 60 : journeyPeriod === 't90' ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return enrichedCurve.filter((pt) => {
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

  // Computed milestone target percentage for circular progress ring (inspired by 75% circular widget in reference)
  const milestoneProgress = useMemo(() => {
    const dist = currentStats?.totalDistance || 0;
    // Calculate progress towards next 10,000 KM threshold
    const nextTarget = Math.max(10000, Math.ceil(dist / 10000) * 10000);
    const pct = Math.min(100, Math.round((dist / nextTarget) * 100));
    return { pct, nextTarget };
  }, [currentStats?.totalDistance]);

  return (
    <div className="space-y-5 sm:space-y-7 w-full pb-12 relative text-slate-800">
      {/* Main Foreground Content */}
      <div className="relative z-10 space-y-5 sm:space-y-7">
        
        {/* Soft Neumorphic Hero Banner */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] relative overflow-hidden">
          {/* Subtle ambient electric blue glow in background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] text-blue-700 text-xs font-black uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Community Leadership Board</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-700 font-extrabold uppercase tracking-widest bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full shadow-[inset_1px_1px_3px_#c8d2df,inset_-1px_-1px_3px_#ffffff] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Updated: {lastUpdatedText}</span>
                </span>
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={loading}
                  title="Refresh & sync latest feed"
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-white text-slate-600 hover:text-blue-600 border border-slate-200 shadow-[2px_2px_5px_#c8d2df,-2px_-2px_5px_#ffffff] active:shadow-[inset_1px_1px_3px_#c8d2df] transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 my-2">
              <div className="max-w-2xl">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                  Celebrating Community Milestones
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Tracking Himalayan journeys, elevation ascents, and collective endurance records.
                </p>
              </div>

              {/* Circular Milestone Ring Gauge inspired directly by the 75% gauge in reference image */}
              <div className="hidden sm:flex items-center gap-4 bg-[#f0f4f9] p-3 rounded-2xl border border-white/90 shadow-[4px_4px_12px_#d1d9e6,-4px_-4px_12px_#ffffff] shrink-0">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                    {/* Background Track */}
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#dbe3ed"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    {/* Electric Blue Progress Arc */}
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#2563eb"
                      strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={2 * Math.PI * 26 * (1 - milestoneProgress.pct / 100)}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  {/* Embossed inner circle disc */}
                  <div className="absolute inset-2.5 rounded-full bg-[#f0f4f9] shadow-[2px_2px_5px_#c8d2df,-2px_-2px_5px_#ffffff] flex flex-col items-center justify-center">
                    <span className="text-[11px] font-black text-slate-900 leading-none">{milestoneProgress.pct}%</span>
                  </div>
                </div>
                <div className="text-left pr-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Goal Progress</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">
                    {currentStats?.totalDistance?.toLocaleString() || 0} / {milestoneProgress.nextTarget.toLocaleString()} km
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold block">Next major landmark</span>
                </div>
              </div>
            </div>

            {/* Tactile Neumorphic Stat Tiles */}
            {currentStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-slate-200/80">
                <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shrink-0">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider truncate">Walkers</span>
                    <strong className="text-xs sm:text-sm font-black text-slate-900">{currentStats.totalHikers?.toLocaleString() || '—'}</strong>
                  </div>
                </div>

                <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 flex items-center justify-center shrink-0">
                    <Mountain className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider truncate">Treks Held</span>
                    <strong className="text-xs sm:text-sm font-black text-slate-900">{currentStats.totalEvents?.toLocaleString() || '—'}</strong>
                  </div>
                </div>

                <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider truncate">Distance</span>
                    <strong className="text-xs sm:text-sm font-black text-slate-900">{currentStats.totalDistance ? `${currentStats.totalDistance.toLocaleString()} km` : '—'}</strong>
                  </div>
                </div>

                <div className="bg-[#f8fafc] rounded-2xl p-3 border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider truncate">Recent 30D</span>
                    <strong className="text-xs sm:text-sm font-black text-slate-900">{currentStats.hikesLast30 || 0} events</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Community KM Journey (Pre-computed Curve & Milestones) */}
        {data && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] space-y-4 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#f0f4f9] border border-slate-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center justify-center text-blue-600 shrink-0">
                  <Mountain className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">Community KM Journey</h2>
                  <p className="text-[11px] text-slate-600 font-bold">Cumulative walking trajectory across all organized treks</p>
                </div>
              </div>

              {/* View Mode Toggle & Time Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Spiral vs Mountain Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#e5ebf2] rounded-2xl shadow-[inset_1px_1px_3px_#c8d2df,inset_-1px_-1px_3px_#ffffff] border border-[#dce3ec] shrink-0">
                  <button
                    type="button"
                    onClick={() => setChartView('spiral')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer select-none flex items-center gap-1 active:scale-95 ${
                      chartView === 'spiral'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_3px_8px_rgba(37,99,235,0.35)]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🌀 Spiral Bar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('mountain')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer select-none flex items-center gap-1 active:scale-95 ${
                      chartView === 'mountain'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_3px_8px_rgba(37,99,235,0.35)]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>⛰️ Trail Chart</span>
                  </button>
                </div>

                {/* Time Filter Tabs in Recessed Track */}
                <div className="flex items-center gap-1 p-1 bg-[#e5ebf2] rounded-2xl shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] border border-[#dce3ec] overflow-x-auto no-scrollbar">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95 cursor-pointer select-none ${
                        journeyPeriod === t.id
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)]'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar with Soft-UI Tiles */}
            {currentStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#f0f4f9] rounded-2xl border border-white/90 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total KM</span>
                  <span className="text-base sm:text-lg font-black text-blue-600 block mt-0.5">
                    {currentStats.totalDistance?.toLocaleString() || '0'} km
                  </span>
                </div>
                <div className="p-3 bg-[#f0f4f9] rounded-2xl border border-white/90 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Events</span>
                  <span className="text-base sm:text-lg font-black text-slate-800 block mt-0.5">
                    {currentStats.totalEvents || 0} conducted
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff]">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Day Hike KM</span>
                  <span className="text-base sm:text-lg font-black text-emerald-700 block mt-0.5">
                    {currentStats.totalHikeDist?.toLocaleString() || '0'} km
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff]">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Trek KM</span>
                  <span className="text-base sm:text-lg font-black text-indigo-700 block mt-0.5">
                    {currentStats.totalTrekDist?.toLocaleString() || '0'} km
                  </span>
                </div>
              </div>
            )}

            {/* Circular Spiral Bar Chart or 3D Low-Poly Mountain Trail Chart Area */}
            <div className="w-full pt-1">
              {chartView === 'spiral' ? (
                <SpiralDistanceBarChart
                  points={filteredGrowthCurve}
                  activePoint={activeJourneyPoint}
                  onSelectPoint={(pt) => setActiveJourneyPoint(pt)}
                  milestones={data.milestones}
                  totalCommunityKm={currentStats?.totalDistance}
                />
              ) : (
                <LowPolyMountainTrailChart
                  points={filteredGrowthCurve}
                  mode="total"
                  activePoint={activeJourneyPoint}
                  onSelectPoint={(pt) => setActiveJourneyPoint(pt)}
                />
              )}
            </div>

            {/* Active Event Inspection Strip (designed like slider tooltip card in reference) */}
            <div className="bg-[#e5ebf2] border border-[#dce3ec] rounded-2xl p-3 sm:p-3.5 shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] transition-all">
              {activeJourneyPoint ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_10px_rgba(37,99,235,0.4)]">
                      <Footprints className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-slate-800">
                          {activeJourneyPoint.title || `Event #${activeJourneyPoint.event_no}`}
                        </span>
                        {activeJourneyPoint.date && (
                          <span className="text-[10px] font-bold text-slate-600 bg-white/90 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {activeJourneyPoint.date}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Event Total: <strong className="text-blue-700">{activeJourneyPoint.event_km || (activeJourneyPoint.hike_km + activeJourneyPoint.trek_km) || 0} km</strong>
                        {activeJourneyPoint.event_trek_km ? ` (Trek: ${activeJourneyPoint.event_trek_km} km)` : activeJourneyPoint.event_hike_km ? ` (Hike: ${activeJourneyPoint.event_hike_km} km)` : ''}
                        {' • '}
                        Community Total: <strong className="text-emerald-700">{(activeJourneyPoint.cum_total_km || activeJourneyPoint.total_km)?.toLocaleString()} km</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-300">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Event Distance</span>
                    <span className="text-sm sm:text-base font-black text-blue-600">
                      {activeJourneyPoint.event_km || (activeJourneyPoint.hike_km + activeJourneyPoint.trek_km) || 0} km
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold block">
                      Cum: {(activeJourneyPoint.cum_total_km || activeJourneyPoint.total_km)?.toLocaleString()} km
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-600 py-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-semibold text-slate-600 text-[11px] sm:text-xs">
                      Tap or scrub across the mountain curve to inspect any milestone
                    </span>
                  </div>
                  {filteredGrowthCurve.length > 0 && (
                    <span className="text-[11px] font-black text-blue-600 shrink-0 pl-2">
                      Latest: {filteredGrowthCurve[filteredGrowthCurve.length - 1].total_km?.toLocaleString()} km
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Milestones Ribbon */}
            {data.milestones && data.milestones.length > 0 && (
              <div className="pt-3 border-t border-slate-200/60">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                  Milestones Unlocked Along The Journey
                </span>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {data.milestones.map((m, idx) => (
                    <div key={idx} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0f4f9] border border-white/80 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] text-slate-800 text-[11px] font-bold">
                      <Trophy className="w-3.5 h-3.5 text-blue-600" />
                      <span>{m.km.toLocaleString()} km</span>
                      <span className="text-[10px] text-slate-500 font-medium">({m.trek})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile Quick Jump Anchors (styled as squircle navigation chips) */}
        <div className="lg:hidden sticky top-14 z-20 p-1.5 rounded-2xl bg-[#e5ebf2]/95 backdrop-blur-md shadow-[inset_2px_2px_5px_#c8d2df,inset_-2px_-2px_5px_#ffffff] border border-[#dce3ec] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('board-overall');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none bg-[#f0f4f9] text-slate-800 border border-white/90 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] hover:text-blue-600 active:scale-95 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-blue-600" />
            <span>Overall</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('board-hikers');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none bg-[#f0f4f9] text-slate-800 border border-white/90 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] hover:text-blue-600 active:scale-95 cursor-pointer"
          >
            <Footprints className="w-3.5 h-3.5 text-blue-600" />
            <span>Day Hikes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('board-trekkers');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex-1 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all select-none bg-[#f0f4f9] text-slate-800 border border-white/90 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] hover:text-blue-600 active:scale-95 cursor-pointer"
          >
            <Mountain className="w-3.5 h-3.5 text-indigo-600" />
            <span>Treks</span>
          </button>
        </div>

        {/* Leaderboard Boards Grid (All 3 boards visible on mobile and desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div id="board-overall" className="scroll-mt-28">
            <LeaderboardBoardSection
              category="all"
              data={data}
              loading={loading}
              error={error}
              setSelectedHiker={setSelectedHiker}
              top3AllTimeNames={top3AllTimeNames}
            />
          </div>

          <div id="board-hikers" className="scroll-mt-28">
            <LeaderboardBoardSection
              category="hikers"
              data={data}
              loading={loading}
              error={error}
              setSelectedHiker={setSelectedHiker}
              top3AllTimeNames={top3AllTimeNames}
            />
          </div>

          <div id="board-trekkers" className="scroll-mt-28">
            <LeaderboardBoardSection
              category="trekkers"
              data={data}
              loading={loading}
              error={error}
              setSelectedHiker={setSelectedHiker}
              top3AllTimeNames={top3AllTimeNames}
            />
          </div>
        </div>

        {/* Map Miners Community Contribution Board */}
        <MapContributionBoard onNavigateToMapMiners={onNavigateToMapMiners} />

        {/* Clubs & Milestones Showcase (styled like the bottom metric cards in reference) */}
        {/* Clubs & Milestones Showcase */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 relative z-10">
          <div className="p-3 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] text-center">
            <div className="w-9 h-9 sm:w-11 sm:h-11 mx-auto mb-2 rounded-2xl bg-purple-50 border border-purple-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center justify-center text-purple-600">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider truncate">500KM Ultra</h4>
            <p className="text-[10px] sm:text-xs text-purple-700 font-bold mt-0.5 sm:mt-1 truncate">
              {clubCounts.ultra} Legends
            </p>
          </div>

          <div className="p-3 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] text-center">
            <div className="w-9 h-9 sm:w-11 sm:h-11 mx-auto mb-2 rounded-2xl bg-blue-50 border border-blue-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center justify-center text-blue-600">
              <Gem className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider truncate">200KM Summit</h4>
            <p className="text-[10px] sm:text-xs text-blue-700 font-bold mt-0.5 sm:mt-1 truncate">
              {clubCounts.summit} Trekkers
            </p>
          </div>

          <div className="p-3 sm:p-5 bg-white rounded-3xl border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] text-center">
            <div className="w-9 h-9 sm:w-11 sm:h-11 mx-auto mb-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-[2px_2px_6px_#d1d9e6,-2px_-2px_6px_#ffffff] flex items-center justify-center text-emerald-600">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider truncate">100KM Century</h4>
            <p className="text-[10px] sm:text-xs text-emerald-700 font-bold mt-0.5 sm:mt-1 truncate">
              {clubCounts.century} Walkers
            </p>
          </div>
        </div>

        {/* Attached Hiker Reviews Extension */}
        <div className="relative z-10 bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] mt-6">
          <HikerReviewsSection initialVisibleCount={5} />
        </div>

        {/* Hiker Detail Modal (Styled with Soft-UI Neumorphic surfaces and electric blue CTA) */}
        {selectedHiker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 border border-blue-200/80 shadow-xs flex items-center justify-center text-blue-600 font-black text-base sm:text-lg shrink-0">
                    {(selectedHiker.n || 'H')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      {maskName(selectedHiker.n)}
                    </h3>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold">Verified Community Hiker</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHiker(null)}
                  className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all shrink-0 cursor-pointer"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content (Scrollable) */}
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 bg-white">
                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Lifetime Total Distance
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-600 mt-1 block">
                    {selectedHiker.d.toLocaleString()} KM
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-600 font-bold">
                    Completed across {selectedHiker.c} registered events
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-center">
                    <span className="text-base sm:text-lg font-black text-emerald-800 flex items-center justify-center gap-1">
                      <Compass className="w-4 h-4 text-emerald-600" /> {selectedHiker.hc || 0}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700 tracking-wider">
                      Day Hikes
                    </span>
                    <span className="text-xs font-bold text-emerald-800 block mt-0.5 sm:mt-1">
                      {(selectedHiker.hd || 0).toLocaleString()} km
                    </span>
                  </div>

                  <div className="p-3 sm:p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200/80 text-center">
                    <span className="text-base sm:text-lg font-black text-indigo-800 flex items-center justify-center gap-1">
                      <Tent className="w-4 h-4 text-indigo-600" /> {selectedHiker.tc || 0}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase text-indigo-700 tracking-wider">
                      Treks
                    </span>
                    <span className="text-xs font-bold text-indigo-800 block mt-0.5 sm:mt-1">
                      {(selectedHiker.td || 0).toLocaleString()} km
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Last 30 Days:</span>
                    <strong className="text-slate-900 font-bold">
                      {(selectedHiker.t30d || 0).toLocaleString()} km ({selectedHiker.t30c || 0} trips)
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Hiker Title:</span>
                    <strong className="text-blue-600 font-black">
                      {getHikerTitleInfo(
                        selectedHiker.d,
                        top3AllTimeNames.has((selectedHiker.n || '').trim().toLowerCase())
                      ).title}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Footer with Electric Blue CTA Button */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-center shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedHiker(null)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.4)] active:scale-98 transition-all min-h-[44px] flex items-center justify-center cursor-pointer"
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
