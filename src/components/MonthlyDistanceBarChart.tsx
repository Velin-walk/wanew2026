import React, { useMemo, useState, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Mountain, Footprints, Sparkles, ArrowRight, RotateCcw, X } from 'lucide-react';
import { JourneyPoint } from '../types/leaderboard';
import { triggerHaptic } from '../utils/haptics';

interface MonthlyDistanceBarChartProps {
  points: JourneyPoint[];
  activePoint?: JourneyPoint | null;
  onSelectPoint?: (pt: JourneyPoint) => void;
  distanceMode?: 'community' | 'singleEvent';
}

interface MonthGroup {
  key: string; // YYYY-MM
  label: string; // e.g. "Nov 2024"
  year: number;
  month: number;
  totalKm: number;
  events: JourneyPoint[];
}

export const MonthlyDistanceBarChart: React.FC<MonthlyDistanceBarChartProps> = ({
  points,
  activePoint,
  onSelectPoint,
  distanceMode = 'community',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleMonthsCount, setVisibleMonthsCount] = useState<number>(6);

  // Derive per-event distance and sort points
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => {
      if (a.date && b.date) {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (!isNaN(da) && !isNaN(db) && da !== db) {
          return da - db;
        }
      }
      const numA = Number(String(a.event_no || '').replace(/\D/g, '')) || 0;
      const numB = Number(String(b.event_no || '').replace(/\D/g, '')) || 0;
      if (numA && numB && numA !== numB) {
        return numA - numB;
      }
      return (a.total_km || 0) - (b.total_km || 0);
    });
  }, [points]);

  // Group events by month (Newest month first on left; scroll right for past events)
  const { monthGroups, maxEventKm, effectiveMaxKm, totalEventsCount, allMonthsCount } = useMemo(() => {
    let globalMax = 20;
    const groupsMap = new Map<string, MonthGroup>();

    sortedPoints.forEach((pt, idx) => {
      let eventKm = 20;
      if (distanceMode === 'singleEvent') {
        const single = (pt as any).dist_per_pax ?? (pt as any).distance ?? (pt as any).dist ?? pt.hike_km;
        if (typeof single === 'number' && single > 0) {
          eventKm = single;
        } else if (typeof pt.event_km === 'number' && pt.event_km > 0 && (pt as any).pax) {
          eventKm = pt.event_km / Math.max(1, (pt as any).pax);
        } else if (typeof pt.event_km === 'number' && pt.event_km > 0) {
          eventKm = pt.event_km;
        } else {
          eventKm = 20;
        }
      } else {
        if (typeof pt.event_km === 'number' && pt.event_km > 0) {
          eventKm = pt.event_km;
        } else {
          const prev = idx > 0 ? sortedPoints[idx - 1] : null;
          if (prev && typeof pt.total_km === 'number' && typeof prev.total_km === 'number' && pt.total_km >= prev.total_km) {
            const diff = pt.total_km - prev.total_km;
            if (diff > 0) eventKm = diff;
          } else if (typeof pt.total_km === 'number' && pt.total_km > 0 && pt.total_km <= 500) {
            eventKm = pt.total_km;
          }
        }
      }
      eventKm = Math.max(1, Math.round(eventKm * 10) / 10);
      if (eventKm > globalMax) globalMax = eventKm;

      // Determine Date & Month Key
      let dateObj: Date | null = null;
      if (pt.date) {
        const parsed = new Date(pt.date);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
      }
      if (!dateObj && (pt as any).timestamp) {
        const parsed = new Date((pt as any).timestamp);
        if (!isNaN(parsed.getTime())) dateObj = parsed;
      }

      let key = 'undated';
      let label = 'Trail Archive';
      let year = 2020;
      let month = 1;

      if (dateObj) {
        year = dateObj.getFullYear();
        month = dateObj.getMonth() + 1;
        key = `${year}-${String(month).padStart(2, '0')}`;
        label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      const enrichedPt = {
        ...pt,
        event_km: eventKm,
        cum_total_km: pt.cum_total_km || pt.total_km,
        formattedDate: dateObj
          ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : pt.date || 'Trek'
      };

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label,
          year,
          month,
          totalKm: 0,
          events: []
        });
      }

      const g = groupsMap.get(key)!;
      g.totalKm = Math.round((g.totalKm + eventKm) * 10) / 10;
      g.events.push(enrichedPt);
    });

    // Sort months descending (newest month on the left; scroll right to view past months)
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.key === 'undated') return 1;
      if (b.key === 'undated') return -1;
      return b.key.localeCompare(a.key);
    });

    // Reverse events within each month to show the latest first and so on
    sortedGroups.forEach((g) => {
      g.events.reverse();
    });

    // Calculate a robust scale ceiling (95th percentile if enough points, or globalMax)
    // so a single multi-person outlier does not squash all standard hikes into identical flat stubs
    let effectiveMaxKm = globalMax;
    if (sortedPoints.length >= 6) {
      const allKms = sortedPoints
        .map((p) => (p as any).event_km || 20)
        .sort((a, b) => a - b);
      const p95Index = Math.min(allKms.length - 1, Math.floor(allKms.length * 0.95));
      effectiveMaxKm = Math.max(20, allKms[p95Index]);
    }

    return {
      monthGroups: sortedGroups,
      maxEventKm: globalMax,
      effectiveMaxKm,
      totalEventsCount: sortedPoints.length,
      allMonthsCount: sortedGroups.length
    };
  }, [sortedPoints, distanceMode]);

  // Sliced visible months (default 6 months at a glance)
  const displayedMonthGroups = useMemo(() => {
    return monthGroups.slice(0, visibleMonthsCount);
  }, [monthGroups, visibleMonthsCount]);

  const hasMoreMonths = visibleMonthsCount < allMonthsCount;

  // Horizontal scroll helpers
  const handleScrollRight = () => {
    triggerHaptic(10);
    scrollContainerRef.current?.scrollBy({ left: 320, behavior: 'smooth' });
  };

  const handleScrollLeft = () => {
    triggerHaptic(10);
    scrollContainerRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
  };

  const handleShowMore = () => {
    triggerHaptic(15);
    setVisibleMonthsCount((prev) => Math.min(allMonthsCount, prev + 6));
  };

  const handleShowAll = () => {
    triggerHaptic(15);
    setVisibleMonthsCount(allMonthsCount);
  };

  if (monthGroups.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
        <Sparkles className="w-8 h-8 text-orange-500 mx-auto mb-2 animate-bounce" />
        <p className="text-xs font-bold text-slate-600">No events recorded for this timeframe</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col select-none space-y-3">
      {/* Header Bar: Status Pill, Legend & Sideways Scroll Navigation */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 px-1 text-[11px] font-bold text-slate-600">
        {/* Orange Theme Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200/80 px-3 py-1.5 rounded-full shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-orange-950 font-black text-[10px] sm:text-[11px]">
              Combined Community Milestone
            </span>
          </div>
        </div>

        {/* Scroll Nav & Month Count Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase bg-slate-100 px-2 sm:px-2.5 py-1 rounded-full border border-slate-200">
            {displayedMonthGroups.length} of {allMonthsCount} Months
          </span>

          {hasMoreMonths && (
            <button
              type="button"
              onClick={handleShowMore}
              className="px-2.5 py-1 text-[10px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/90 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Load next 6 past months"
            >
              +6 Months
            </button>
          )}

          {/* Sideways Scroll Buttons */}
          <div className="inline-flex items-center bg-[#f0f4f9] border border-slate-200/90 rounded-xl p-0.5 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]">
            <button
              type="button"
              onClick={handleScrollLeft}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-orange-600 rounded-lg transition-all active:scale-90 cursor-pointer"
              title="Scroll towards Recent Events (Left)"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Pan
            </span>
            <button
              type="button"
              onClick={handleScrollRight}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-orange-600 rounded-lg transition-all active:scale-90 cursor-pointer"
              title="Scroll towards Past Events (Right)"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Sideways Continuous Scrollable Track (Continuous Bars with Month Header Info at Beginning of Each Month) */}
      <div
        ref={scrollContainerRef}
        className="-mx-3.5 w-[calc(100%+1.75rem)] sm:mx-0 sm:w-full overflow-x-auto pb-3 pt-10 no-scrollbar sm:scroll-smooth touch-pan-x bg-white rounded-none sm:rounded-3xl p-3.5 sm:p-5 border-y border-x-0 sm:border border-slate-200/90 shadow-[4px_4px_16px_#d1d9e6,-4px_-4px_16px_#ffffff]"
      >
        <div className="inline-flex items-stretch min-w-full">
          {displayedMonthGroups.map((group, groupIdx) => {
            const isLatestMonth = groupIdx === 0;

            return (
              <div
                key={group.key}
                className={`flex flex-col justify-between flex-shrink-0 w-auto min-w-[170px] ${
                  groupIdx > 0 ? 'border-l border-slate-200/80 ml-3.5 sm:ml-5 pl-3.5 sm:pl-5' : ''
                }`}
              >
                {/* Total Distance & Associated Info at the TOP of the chart */}
                <div className="pb-2.5 mb-2 border-b border-slate-100 flex flex-col gap-1 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight whitespace-nowrap">
                        {group.label}
                      </span>
                      {isLatestMonth && (
                        <span className="text-[8px] font-black uppercase text-orange-700 bg-orange-100 border border-orange-300 px-1.5 py-0.2 rounded-md shrink-0">
                          Latest
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                        &bull; {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                      </span>
                    </div>

                    {/* Total Distance Info at the Top */}
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-[8px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Total:
                      </span>
                      <span className="text-xs sm:text-sm font-black text-orange-600 leading-tight">
                        {group.totalKm.toLocaleString()}
                        <span className="text-[9px] font-bold text-slate-400 ml-0.5">km</span>
                      </span>
                    </div>
                  </div>

                  {/* Associated Average Cadence Info at the Top */}
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-bold">
                    <span>Cadence: {group.events.length} walks</span>
                    <span className="text-slate-500 font-extrabold">
                      Avg {Math.round(group.totalKm / Math.max(1, group.events.length))} km/event
                    </span>
                  </div>
                </div>

                {/* Continuous Flow of Bars: completely uninterrupted along the bottom baseline */}
                <div className="flex items-end gap-2.5 sm:gap-3.5 pt-2 pb-1 flex-1 min-h-[165px]">
                  {group.events.map((event, eventIdx) => {
                    const isSelected = activePoint && (
                      String(activePoint.event_no) === String(event.event_no) ||
                      (activePoint.date && activePoint.date === event.date && activePoint.total_km === event.cum_total_km)
                    );

                    // Proportional height for the orange bar (scaled smoothly between 14px and 115px)
                    const eventKm = event.event_km || 20;
                    const safeMax = Math.max(20, effectiveMaxKm || maxEventKm);
                    const ratio = Math.min(1, Math.max(0, eventKm / safeMax));
                    const barHeightPx = Math.max(12, Math.round(14 + ratio * (115 - 14)));

                    return (
                      <div
                        key={`event-${event.event_no ?? ''}-${event.date ?? ''}-${eventIdx}`}
                        onClick={() => {
                          triggerHaptic(12);
                          onSelectPoint(event);
                        }}
                        className={`group flex-shrink-0 w-[52px] sm:w-[60px] flex flex-col items-center justify-end cursor-pointer transition-all duration-200 relative p-1 rounded-xl ${
                          isSelected
                            ? 'bg-orange-100/70 ring-2 ring-orange-500 shadow-[inset_1px_1px_3px_#fbd38d]'
                            : 'hover:bg-orange-50/60 active:scale-95'
                        }`}
                        title={`Event #${event.event_no}: ${event.title || 'Hike'} (${eventKm} km)`}
                      >
                        {/* Compact Text Pop-up above the clicked bar */}
                        {isSelected && (
                          <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-md border border-slate-700 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150 flex items-center gap-1">
                            <span>{event.title || `Event #${event.event_no}`}</span>
                            <span className="text-orange-400 font-black">• {eventKm} km</span>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
                          </div>
                        )}

                        {/* Event Distance Pill above the bar */}
                        <div className="mb-1 text-center w-full">
                          <span
                            className={`text-[9px] font-black block transition-colors leading-none truncate ${
                              isSelected ? 'text-orange-700' : 'text-slate-700 group-hover:text-orange-600'
                            }`}
                          >
                            {eventKm}
                            <span className="text-[7px] text-slate-400 ml-0.2">k</span>
                          </span>
                        </div>

                        {/* Solid Angular (rounded-none) Orange Distance Bar */}
                        <div
                          style={{ height: `${barHeightPx}px` }}
                          className={`w-full max-w-[34px] sm:max-w-[42px] rounded-none transition-all duration-200 relative ${
                            isSelected
                              ? 'bg-orange-600 ring-2 ring-orange-500 shadow-[0_4px_12px_rgba(249,115,22,0.45)]'
                              : 'bg-orange-500 hover:bg-orange-600'
                          }`}
                        />

                        {/* Event Details: Event Number & Date */}
                        <div className="mt-2 text-center w-full">
                          <span
                            className={`text-[9px] font-black uppercase block truncate max-w-full ${
                              isSelected ? 'text-orange-700' : 'text-slate-800'
                            }`}
                          >
                            #{event.event_no}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold block truncate max-w-full">
                            {(event as any).formattedDate}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Show More Past Months at Far Right */}
          {hasMoreMonths && (
            <div className="flex-shrink-0 w-[180px] sm:w-[200px] ml-4 sm:ml-5 pl-4 sm:pl-5 border-l border-slate-200/80 flex flex-col items-center justify-center text-center self-stretch py-4 space-y-2.5 transition-all">
              <div className="w-9 h-9 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
                <ArrowRight className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800">
                  Older History
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  {allMonthsCount - visibleMonthsCount} past months
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleShowMore}
                  className="px-2.5 py-1 text-[10px] font-black text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  +6 Months
                </button>
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-2.5 py-1 text-[10px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 transition-all cursor-pointer"
                >
                  All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helpful Hint Strip */}
      <div className="w-full flex items-center justify-end px-1 text-[11px] text-slate-500 font-medium">
        {activePoint && (
          <button
            type="button"
            onClick={() => onSelectPoint(null as any)}
            className="text-[10px] font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear Selection</span>
          </button>
        )}
      </div>
    </div>
  );
};
