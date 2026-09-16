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
  Search,
  Filter,
  User,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import { HikerStats, LeaderboardResponse } from '../types/leaderboard';
import { fetchLeaderboardData } from '../services/api';

type TimePeriod = 't30' | 't60' | 't90' | 't365' | 'overall';
type SortMetric = 'dist' | 'count';
type BoardCategory = 'all' | 'hikers' | 'trekkers';

export const LeaderboardScreen: React.FC = () => {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [period, setPeriod] = useState<TimePeriod>('t30');
  const [metric, setMetric] = useState<SortMetric>('dist');
  const [category, setCategory] = useState<BoardCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(20);
  const [selectedHiker, setSelectedHiker] = useState<HikerStats | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (!data || isRefresh) setLoading(true);
      setError(null);
      const res = await fetchLeaderboardData();
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

  // Filtered & Sorted Hikers list
  const filteredHikers = useMemo(() => {
    if (!data?.hikers) return [];
    const { d: distKey, c: countKey } = getKeys(category, period);

    let list = data.hikers.filter((h: any) => {
      const dist = (h[distKey] as number) || 0;
      const count = (h[countKey] as number) || 0;
      const hasActivity = metric === 'dist' ? dist > 0 : count > 0;
      if (!hasActivity) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (h.n || '').toLowerCase().includes(query);
      }
      return true;
    });

    list.sort((a: any, b: any) => {
      const aVal = (a[metric === 'dist' ? distKey : countKey] as number) || 0;
      const bVal = (b[metric === 'dist' ? distKey : countKey] as number) || 0;
      return bVal - aVal;
    });

    return list;
  }, [data, category, period, metric, searchQuery]);

  const visibleHikers = useMemo(() => {
    return filteredHikers.slice(0, limit);
  }, [filteredHikers, limit]);

  const currentStats = data?.stats;

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#1B361D] via-[#254A23] to-[#1E381C] text-white rounded-3xl p-5 sm:p-7 shadow-md relative overflow-hidden border border-[#7ABA42]/30">
        {/* Glow & ambient accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#E08828]/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none text-[#A8D878]">
          <Trophy className="w-56 h-56" />
        </div>

        <div className="relative z-10 w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E08828]/25 border border-[#F5A844]/50 text-[#FED7AA] text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-3xs">
              <Crown className="w-3.5 h-3.5 text-[#F5A844] shrink-0" />
              <span>Community Leadership Board</span>
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Refresh stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Top Himalayan Hikers &amp; Trekkers
          </h1>
          <p className="text-[#B5F07E] text-xs sm:text-sm mt-1 leading-relaxed font-bold tracking-wider uppercase">
            Celebrating endurance, camaraderie &amp; milestones
          </p>

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

      {/* Control Panel: Filters & Sorting */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5E1DB] shadow-xs space-y-3.5">
        {/* Category Tabs (All / Day Hikers / Multi-day Trekkers) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4EFEA] rounded-2xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => { setCategory('all'); setLimit(20); }}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
              category === 'all'
                ? 'bg-white text-[#1F1F1F] shadow-xs ring-1 ring-black/5'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Trophy className={`w-3.5 h-3.5 ${category === 'all' ? 'text-[#E08828]' : 'text-[#8B8680]'}`} />
            <span>Overall Board</span>
          </button>

          <button
            type="button"
            onClick={() => { setCategory('hikers'); setLimit(20); }}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
              category === 'hikers'
                ? 'bg-[#7ABA42] text-white shadow-xs font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Hikers (≤ 2 Days)</span>
          </button>

          <button
            type="button"
            onClick={() => { setCategory('trekkers'); setLimit(20); }}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
              category === 'trekkers'
                ? 'bg-[#4527A0] text-white shadow-xs font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Trekkers (&gt; 2 Days)</span>
          </button>
        </div>

        {/* Time Window Pills & Metric Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#F0EBE5]">
          {/* Timeframe */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-[#8B8680] mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#E08828]" /> Period:
            </span>
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
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer shadow-3xs select-none ${
                  period === t.id
                    ? 'bg-[#1B361D] text-white shadow-xs font-black'
                    : 'bg-[#F9F7F5] text-[#5A5551] border border-[#E5E1DB] hover:border-[#C8C2B8] hover:bg-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Metric Selector */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5E1DB] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => { setMetric('dist'); setLimit(20); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metric === 'dist'
                  ? 'bg-[#E08828] text-white font-black shadow-xs'
                  : 'text-[#6A645D] hover:text-[#1F1F1F]'
              }`}
            >
              By Distance (KM)
            </button>
            <button
              type="button"
              onClick={() => { setMetric('count'); setLimit(20); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metric === 'count'
                  ? 'bg-[#7ABA42] text-white font-black shadow-xs'
                  : 'text-[#6A645D] hover:text-[#1F1F1F]'
              }`}
            >
              By Hike Count
            </button>
          </div>
        </div>

        {/* Search Filter Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B8680]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hiker name..."
            className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#E08828]/40 focus:border-[#E08828] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8680] hover:text-[#1F1F1F]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard Table / Roster Cards */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#E08828] animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#5A5551]">Loading community hiker standings...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs font-bold text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="px-4 py-2 bg-[#E08828] text-white text-xs font-bold rounded-xl shadow-xs"
            >
              Retry
            </button>
          </div>
        ) : filteredHikers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Mountain className="w-8 h-8 text-[#C2BCB4] mx-auto" />
            <p className="text-xs font-bold text-[#5A5551]">No hikers found matching criteria</p>
            <p className="text-[11px] text-[#8B8680]">Try selecting a broader timeframe or clearing your search.</p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-3 bg-[#FAF8F5] border-b border-[#EFEAE4] text-[11px] font-black uppercase tracking-wider text-[#6A645D]">
              <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
              <div className="col-span-5 sm:col-span-6">Hiker</div>
              <div className="col-span-3 sm:col-span-3 text-right">Distance</div>
              <div className="col-span-2 sm:col-span-2 text-right">Hikes</div>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-[#F4EFEA]">
              {visibleHikers.map((hiker, idx) => {
                const { d: distKey, c: countKey } = getKeys(category, period);
                const distanceVal = ((hiker as any)[distKey] as number) || 0;
                const countVal = ((hiker as any)[countKey] as number) || 0;
                const isTopThree = idx < 3 && !searchQuery;

                return (
                  <div
                    key={`${hiker.n}-${idx}`}
                    onClick={() => setSelectedHiker(hiker)}
                    className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[#FFFDF9] transition-colors cursor-pointer group"
                  >
                    {/* Rank Badge */}
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                      {idx === 0 && !searchQuery ? (
                        <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center shadow-3xs border border-amber-300">
                          👑 1
                        </span>
                      ) : idx === 1 && !searchQuery ? (
                        <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shadow-3xs border border-slate-300">
                          🥈 2
                        </span>
                      ) : idx === 2 && !searchQuery ? (
                        <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-800 font-black text-xs flex items-center justify-center shadow-3xs border border-amber-200">
                          🥉 3
                        </span>
                      ) : (
                        <span className="text-xs font-black text-[#8B8680]">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Hiker Name & Badge */}
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
                            <span className="px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 text-[9px] font-bold border border-purple-200">
                              500KM Legend 💎
                            </span>
                          ) : hiker.d >= 200 ? (
                            <span className="px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200">
                              200KM Club 🌟
                            </span>
                          ) : hiker.d >= 100 ? (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                              100KM Century 💯
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#8B8680]">Trail Walker</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Distance Metric */}
                    <div className="col-span-3 sm:col-span-3 text-right">
                      <span className="text-xs sm:text-sm font-black text-[#1F5BBB] block">
                        {distanceVal.toLocaleString()} km
                      </span>
                      <span className="text-[10px] text-[#8B8680]">
                        {period === 'overall' ? 'lifetime' : period}
                      </span>
                    </div>

                    {/* Trips Count */}
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

            {/* Load More Button */}
            {visibleHikers.length < filteredHikers.length && (
              <div className="p-4 bg-[#FAF8F5] border-t border-[#EFEAE4] text-center">
                <button
                  type="button"
                  onClick={() => setLimit((prev) => prev + 20)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-[#F3EFEA] border-2 border-dashed border-[#7ABA42] text-[#1B5E20] font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  See More Hikers ⬇ ({filteredHikers.length - visibleHikers.length} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clubs & Milestones Showcase */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl border border-purple-200 text-center shadow-xs">
          <div className="text-2xl mb-1">👑</div>
          <h4 className="text-xs font-black text-purple-900 uppercase tracking-wider">500KM Ultra Club</h4>
          <p className="text-[11px] text-purple-700 font-medium mt-1">
            {data?.hikers ? data.hikers.filter((h) => h.d >= 500).length : 0} Legends Registered
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-200 text-center shadow-xs">
          <div className="text-2xl mb-1">💎</div>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider">200KM Summit Club</h4>
          <p className="text-[11px] text-blue-700 font-medium mt-1">
            {data?.hikers ? data.hikers.filter((h) => h.d >= 200 && h.d < 500).length : 0} Elite Trekkers
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-200 text-center shadow-xs">
          <div className="text-2xl mb-1">💯</div>
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
                  <span className="text-lg font-black text-[#2E7D32] block">
                    🥾 {selectedHiker.hc || 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
                    Day Hikes
                  </span>
                  <span className="text-xs font-bold text-[#2E7D32] block mt-1">
                    {(selectedHiker.hd || 0).toLocaleString()} km
                  </span>
                </div>

                <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-center">
                  <span className="text-lg font-black text-[#4527A0] block">
                    🏕 {selectedHiker.tc || 0}
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
  );
};
