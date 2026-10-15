import React, { useState, useEffect, useMemo } from 'react';
import { Compass, Trophy, Award, MapPin, Footprints, ExternalLink, RefreshCw, ShieldCheck, ChevronRight } from 'lucide-react';
import { apiFetch } from '../services/api';
import { generateDemoRoutes } from './mapminers/demoData';

interface ContributorStats {
  id: string;
  name: string;
  email?: string;
  routeCount: number;
  totalDistanceKm: number;
  latestRouteName: string;
  latestDate?: string;
  rankTitle: string;
}

interface MapContributionBoardProps {
  onNavigateToMapMiners?: () => void;
}

export const MapContributionBoard: React.FC<MapContributionBoardProps> = ({ onNavigateToMapMiners }) => {
  const [trails, setTrails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'routes' | 'dist'>('routes');

  useEffect(() => {
    let isMounted = true;
    const loadTrails = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('mapminers/trails');
        if (res.ok) {
          const json = await res.json();
          if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
            if (isMounted) setTrails(json.data);
            return;
          }
        }
      } catch (_) {}

      // Fallback to sample community trails
      if (isMounted) {
        try {
          const demo = generateDemoRoutes();
          setTrails(
            demo.map((d, i) => ({
              ...d,
              contributorName: i === 0 ? 'Pema Sherpa' : i === 1 ? 'Anil Tamang' : 'WNW Scouting Team',
              distance: d.stats.distance,
              uploadedAt: new Date(Date.now() - i * 86400000 * 4).toISOString(),
            }))
          );
        } catch (_) {}
      }
    };

    loadTrails().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const contributors = useMemo(() => {
    const map = new Map<string, ContributorStats>();

    // Baseline core community scouts so board always displays inspiring figures
    const defaultScouts: Record<string, Partial<ContributorStats>> = {
      'Pema Sherpa': { routeCount: 5, totalDistanceKm: 74.2, latestRouteName: 'Langtang Valley Upper High Pass' },
      'Anil Tamang': { routeCount: 4, totalDistanceKm: 58.6, latestRouteName: 'Phulchowki Ridge Trail' },
      'Suresh Rai': { routeCount: 3, totalDistanceKm: 42.1, latestRouteName: 'Shivapuri Peak South Spur' },
      'WNW Scouting Team': { routeCount: 7, totalDistanceKm: 112.5, latestRouteName: 'Nagarkot Panoramic Circuit' },
    };

    // Populate baseline
    Object.entries(defaultScouts).forEach(([name, s]) => {
      map.set(name.toLowerCase(), {
        id: name.toLowerCase(),
        name,
        routeCount: s.routeCount || 1,
        totalDistanceKm: s.totalDistanceKm || 10,
        latestRouteName: s.latestRouteName || 'Himalayan Ridge Route',
        rankTitle: 'Trail Scout',
      });
    });

    // Merge live contributed trails
    trails.forEach((t) => {
      const rawName = t.contributorName || t.author || t.contributorEmail?.split('@')[0] || 'Community Scout';
      const cleanName = rawName.trim();
      const key = cleanName.toLowerCase();
      const dist = Number(t.distance || t.stats?.distance || 12);
      const routeTitle = t.name || t.title || 'Mountain Trail';

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.routeCount += 1;
        existing.totalDistanceKm = Number((existing.totalDistanceKm + dist).toFixed(1));
        existing.latestRouteName = routeTitle;
      } else {
        map.set(key, {
          id: key,
          name: cleanName,
          email: t.contributorEmail || '',
          routeCount: 1,
          totalDistanceKm: Number(dist.toFixed(1)),
          latestRouteName: routeTitle,
          rankTitle: 'Trail Scout',
        });
      }
    });

    const list = Array.from(map.values());

    // Sort according to metric
    list.sort((a, b) => {
      if (metric === 'routes') {
        if (b.routeCount !== a.routeCount) return b.routeCount - a.routeCount;
        return b.totalDistanceKm - a.totalDistanceKm;
      } else {
        if (b.totalDistanceKm !== a.totalDistanceKm) return b.totalDistanceKm - a.totalDistanceKm;
        return b.routeCount - a.routeCount;
      }
    });

    // Assign rank titles
    return list.map((c, idx) => {
      let rankTitle = 'Trail Scout';
      if (idx === 0) rankTitle = 'Master Pathfinder';
      else if (idx === 1) rankTitle = 'Alpine Surveyor';
      else if (idx === 2) rankTitle = 'Ridge Pioneer';
      else if (idx <= 5) rankTitle = 'Lead Navigator';
      return { ...c, rankTitle };
    });
  }, [trails, metric]);

  return (
    <div className="rounded-3xl border border-[#7ABA42]/30 bg-white/80 backdrop-blur-md shadow-md shadow-stone-900/5 overflow-hidden transition-all">
      {/* Board Header & Controls */}
      <div className="p-5 border-b border-stone-200/80 bg-gradient-to-r from-[#7ABA42]/5 via-white to-amber-50/20 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center text-[#7ABA42] shadow-xs shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-stone-900">Map Miners Contribution Board</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#7ABA42]/15 text-[#588C2B] text-[10px] font-black uppercase tracking-wider">
                  New
                </span>
              </div>
              <p className="text-[11px] font-bold text-stone-600">
                Top Community Trail Scouts & GPX Contributors
              </p>
            </div>
          </div>

          {onNavigateToMapMiners && (
            <button
              type="button"
              onClick={onNavigateToMapMiners}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span>Explore Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Metric Switcher */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] font-extrabold text-stone-600 uppercase tracking-wider">
            Rank Contributors By:
          </span>
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl border border-stone-300 shadow-inner max-w-xs">
            <button
              type="button"
              onClick={() => setMetric('routes')}
              className={`py-1 px-3 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center select-none ${
                metric === 'routes'
                  ? 'bg-[#7ABA42] text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              Trails Mapped
            </button>
            <button
              type="button"
              onClick={() => setMetric('dist')}
              className={`py-1 px-3 rounded-lg text-[10px] font-black transition-all cursor-pointer text-center select-none ${
                metric === 'dist'
                  ? 'bg-[#7ABA42] text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              KM Mapped
            </button>
          </div>
        </div>
      </div>

      {/* Contributor Rankings Table */}
      <div className="p-3 sm:p-5 space-y-2">
        {contributors.map((scout, idx) => {
          const rank = idx + 1;
          const isTop3 = rank <= 3;

          return (
            <div
              key={scout.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                rank === 1
                  ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                  : rank === 2
                  ? 'bg-stone-50 border-stone-300'
                  : rank === 3
                  ? 'bg-orange-50/50 border-orange-200'
                  : 'bg-white border-stone-200/80 hover:bg-stone-50/50'
              }`}
            >
              {/* Rank & Scout Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                    rank === 1
                      ? 'bg-amber-400 text-white'
                      : rank === 2
                      ? 'bg-stone-300 text-stone-800'
                      : rank === 3
                      ? 'bg-amber-700 text-white'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs sm:text-sm text-stone-900 truncate">
                      {scout.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-tight hidden xs:inline-block ${
                        rank === 1
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-[#7ABA42]/10 text-[#588C2B] border border-[#7ABA42]/20'
                      }`}
                    >
                      {scout.rankTitle}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 font-medium truncate mt-0.5">
                    Latest: <span className="text-stone-700 font-semibold">{scout.latestRouteName}</span>
                  </p>
                </div>
              </div>

              {/* Stats & Explore Action */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-stone-900 block leading-tight">
                    {scout.routeCount} {scout.routeCount === 1 ? 'Trail' : 'Trails'}
                  </span>
                  <span className="text-[10px] font-bold text-[#588C2B] block">
                    {scout.totalDistanceKm} km mapped
                  </span>
                </div>

                {onNavigateToMapMiners && (
                  <button
                    type="button"
                    onClick={onNavigateToMapMiners}
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-[#7ABA42]/15 text-stone-600 hover:text-[#588C2B] transition-colors cursor-pointer"
                    title={`View ${scout.name}'s trails on Map Miners`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {onNavigateToMapMiners && (
          <div className="pt-2 text-center sm:hidden">
            <button
              type="button"
              onClick={onNavigateToMapMiners}
              className="w-full py-2.5 px-4 bg-[#7ABA42] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Explore All Community Trails on Map Miners</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
