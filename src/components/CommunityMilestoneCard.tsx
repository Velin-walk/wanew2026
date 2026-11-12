import React, { useState, useEffect, useMemo } from 'react';
import { Mountain, Footprints, Sparkles, Trophy, RotateCcw } from 'lucide-react';
import { LeaderboardResponse, JourneyPoint, TimePeriod } from '../types/leaderboard';
import { fetchLeaderboardData } from '../services/api';
import { MonthlyDistanceBarChart } from './MonthlyDistanceBarChart';
import { triggerHaptic } from '../utils/haptics';

interface CommunityMilestoneCardProps {
  data?: LeaderboardResponse | null;
  variant?: 'full' | 'chartOnly';
}

export const CommunityMilestoneCard: React.FC<CommunityMilestoneCardProps> = ({ data: externalData, variant = 'full' }) => {
  const [internalData, setInternalData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(!externalData);
  const [journeyPeriod, setJourneyPeriod] = useState<TimePeriod>('overall');
  const [activeJourneyPoint, setActiveJourneyPoint] = useState<any | null>(null);

  const data = externalData || internalData;

  useEffect(() => {
    if (!externalData) {
      let isMounted = true;
      const load = async () => {
        try {
          const res = await fetchLeaderboardData();
          if (isMounted) setInternalData(res);
        } catch (e) {
          console.warn('Milestone card fetch error:', e);
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      load();
      return () => { isMounted = false; };
    }
  }, [externalData]);

  const currentStats = data?.stats;

  const filteredGrowthCurve = useMemo(() => {
    const rawCurve = data?.growthCurve || data?.growth_curve;
    if (!rawCurve || rawCurve.length === 0) return [];

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

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-100 rounded" />
        <div className="h-32 w-full bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  if (variant === 'chartOnly') {
    return (
      <MonthlyDistanceBarChart
        points={filteredGrowthCurve}
        activePoint={activeJourneyPoint}
        onSelectPoint={(pt) => setActiveJourneyPoint(pt)}
      />
    );
  }

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] space-y-4 relative z-10 w-full overflow-hidden">
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

        <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => { triggerHaptic(10); setJourneyPeriod(t.id); }}
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

      <div className="w-full pt-1">
        <MonthlyDistanceBarChart
          points={filteredGrowthCurve}
          activePoint={activeJourneyPoint}
          onSelectPoint={(pt) => setActiveJourneyPoint(pt)}
        />
      </div>

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
  );
};
