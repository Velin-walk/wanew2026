import React, { useMemo, useRef, useState } from 'react';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Award,
  Calendar,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { EventReportItem } from './AdminReportsDashboard';
import { TimePeriod } from '../../types/leaderboard';

interface ParticipantsPerHikeChartProps {
  events: EventReportItem[];
}

interface HikePaxItem {
  key: string;
  eventNo: string;
  title: string;
  date: string;
  formattedDate: string;
  timestamp: number;
  pax: number;
  returningCount: number;
  newCount: number;
  leadGuide: string;
}

interface MonthGroup {
  key: string;
  label: string;
  year: number;
  month: number;
  totalPax: number;
  events: HikePaxItem[];
}

export const ParticipantsPerHikeChart: React.FC<ParticipantsPerHikeChartProps> = ({
  events,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<TimePeriod>('overall');
  const [visibleMonthsCount, setVisibleMonthsCount] = useState<number>(6);
  const [activeItem, setActiveItem] = useState<HikePaxItem | null>(null);

  const normalizedEvents = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return [];

    return events
      .filter((ev) => (ev.registrationsCount || 0) > 0)
      .map((ev, idx) => {
        let ts = typeof ev.timestamp === 'number' && !isNaN(ev.timestamp) ? ev.timestamp : 0;
        if (!ts && ev.date) {
          const parsed = new Date(ev.date);
          if (!isNaN(parsed.getTime())) ts = parsed.getTime();
        }

        const formattedDate = ts > 0
          ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : String(ev.date || 'Trek');

        const eventNo = String(ev.hikeNumber || idx + 1).trim();

        return {
          key: `${eventNo}-${ts}-${idx}`,
          eventNo,
          title: String(ev.title || `Hike #${eventNo}`).trim(),
          date: String(ev.date || formattedDate),
          formattedDate,
          timestamp: ts,
          pax: Number(ev.registrationsCount) || 0,
          returningCount: Number(ev.returningCount) || 0,
          newCount: Number(ev.newCount) || 0,
          leadGuide: String(ev.leadGuide || '').trim(),
        };
      });
  }, [events]);

  // Period filter (matching CommunityMilestoneCard filter function)
  const filteredEvents = useMemo(() => {
    if (period === 'overall') return normalizedEvents;

    const now = Date.now();
    const pastTimestamps = normalizedEvents
      .map((e) => e.timestamp)
      .filter((ts) => ts > 0 && ts <= now);
    const maxPastTs = pastTimestamps.length > 0 ? Math.max(...pastTimestamps) : now;
    const anchorTs = now - maxPastTs > 30 * 24 * 60 * 60 * 1000 ? maxPastTs : now;

    const days = period === 't30' ? 30 : period === 't60' ? 60 : period === 't90' ? 90 : 365;
    const cutoff = anchorTs - days * 24 * 60 * 60 * 1000;

    return normalizedEvents.filter((ev) => {
      if (!ev.timestamp) return true;
      return ev.timestamp >= cutoff;
    });
  }, [normalizedEvents, period]);

  // Group events by month with Month Totals at the top (matching MonthlyDistanceBarChart)
  const {
    monthGroups,
    maxPax,
    allMonthsCount,
    totalPax,
    totalEventsCount,
    avgPax,
    peakItem,
  } = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => {
      if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      const na = parseInt(a.eventNo.replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(b.eventNo.replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });

    const groupsMap = new Map<string, MonthGroup>();
    let globalMax = 0;
    let sumPax = 0;
    let peak: HikePaxItem | null = null;

    sorted.forEach((ev) => {
      if (ev.pax > globalMax) {
        globalMax = ev.pax;
        peak = ev;
      }
      sumPax += ev.pax;

      let key = 'undated';
      let label = 'Trail Archive';
      let year = 2020;
      let month = 1;

      if (ev.timestamp > 0) {
        const d = new Date(ev.timestamp);
        year = d.getFullYear();
        month = d.getMonth() + 1;
        key = `${year}-${String(month).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label,
          year,
          month,
          totalPax: 0,
          events: [],
        });
      }

      const g = groupsMap.get(key)!;
      g.totalPax += ev.pax;
      g.events.push(ev);
    });

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.key === 'undated') return 1;
      if (b.key === 'undated') return -1;
      return b.key.localeCompare(a.key);
    });

    // Latest event first within each month
    sortedGroups.forEach((g) => {
      g.events.reverse();
    });

    return {
      monthGroups: sortedGroups,
      maxPax: Math.max(1, globalMax),
      allMonthsCount: sortedGroups.length,
      totalPax: sumPax,
      totalEventsCount: sorted.length,
      avgPax: sorted.length > 0 ? Math.round((sumPax / sorted.length) * 10) / 10 : 0,
      peakItem: peak as HikePaxItem | null,
    };
  }, [filteredEvents]);

  const displayedMonthGroups = useMemo(() => {
    return monthGroups.slice(0, visibleMonthsCount);
  }, [monthGroups, visibleMonthsCount]);

  const hasMoreMonths = visibleMonthsCount < allMonthsCount;

  const handleScrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 320, behavior: 'smooth' });
  };

  const handleShowMore = () => {
    setVisibleMonthsCount((prev) => Math.min(allMonthsCount, prev + 6));
  };

  const handleShowAll = () => {
    setVisibleMonthsCount(allMonthsCount);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
      {/* Header + Period Filter (stolen from CommunityMilestoneCard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEAE4]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#FF6600] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#1F1F1F] tracking-tight">
                Participants per Hike
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-[#FF6600] border border-orange-200">
                Source: Per Event Report
              </span>
            </div>
            <p className="text-xs text-[#8B8680] mt-0.5">
              Monthly participant totals &amp; turnout per hike from Per Event Report
            </p>
          </div>
        </div>

        {/* Period Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] rounded-xl border border-[#EFEAE4] overflow-x-auto no-scrollbar">
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
                onClick={() => {
                  setPeriod(t.id);
                  setVisibleMonthsCount(6);
                  setActiveItem(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 cursor-pointer select-none ${
                  period === t.id
                    ? 'bg-[#FF6600] text-white shadow-xs'
                    : 'text-[#5A5551] hover:text-[#1F1F1F]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stat Tiles + Pan Controls */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 text-[11px] font-bold text-[#5A5551]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EFEAE4] text-[#1F1F1F] font-black">
            {totalPax.toLocaleString()} Total Pax
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EFEAE4]">
            {totalEventsCount} Hikes
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
            Avg {avgPax} / Hike
          </span>
          {peakItem && (
            <span
              className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 inline-flex items-center gap-1"
              title={peakItem.title}
            >
              <Award className="w-3 h-3 text-amber-600" />
              Peak: {peakItem.pax} (#{peakItem.eventNo})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] text-[#8B8680] font-extrabold uppercase bg-[#FAF8F5] px-2.5 py-1 rounded-full border border-[#EFEAE4]">
            {displayedMonthGroups.length} of {allMonthsCount} Months
          </span>

          {hasMoreMonths && (
            <button
              type="button"
              onClick={handleShowMore}
              className="px-2.5 py-1 text-[10px] font-black text-[#FF6600] bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all cursor-pointer"
              title="Load next 6 past months"
            >
              +6 Months
            </button>
          )}

          <div className="inline-flex items-center bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl p-0.5">
            <button
              type="button"
              onClick={handleScrollLeft}
              className="p-1 sm:px-1.5 text-[#5A5551] hover:text-[#FF6600] rounded-lg transition-all cursor-pointer"
              title="Scroll towards Recent Events (Left)"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[9px] font-black text-[#8B8680] uppercase tracking-widest">
              Pan
            </span>
            <button
              type="button"
              onClick={handleScrollRight}
              className="p-1 sm:px-1.5 text-[#5A5551] hover:text-[#FF6600] rounded-lg transition-all cursor-pointer"
              title="Scroll towards Past Events (Right)"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Month-Grouped Scrollable Bar Chart */}
      {monthGroups.length === 0 ? (
        <div className="p-8 text-center bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
          <Users className="w-8 h-8 text-[#FF6600] mx-auto mb-2" />
          <p className="text-xs font-bold text-[#8B8680]">
            No registered participants found for this timeframe
          </p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto pb-3 pt-6 bg-[#FAF8F5]/60 rounded-2xl p-3.5 sm:p-4 border border-[#EFEAE4] scroll-smooth touch-pan-x"
        >
          <div className="inline-flex items-stretch min-w-full">
            {displayedMonthGroups.map((group, groupIdx) => {
              const isLatestMonth = groupIdx === 0;
              const avgInMonth = Math.round((group.totalPax / Math.max(1, group.events.length)) * 10) / 10;

              return (
                <div
                  key={group.key}
                  className={`flex flex-col justify-between flex-shrink-0 w-auto min-w-[185px] ${
                    groupIdx > 0 ? 'border-l border-[#E5E1DB] ml-4 sm:ml-5 pl-4 sm:pl-5' : ''
                  }`}
                >
                  {/* Month Total Header at the TOP of each month column */}
                  <div className="pb-2.5 mb-2 border-b border-[#EFEAE4] flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-[#1F1F1F] tracking-tight whitespace-nowrap">
                          {group.label}
                        </span>
                        {isLatestMonth && (
                          <span className="text-[8px] font-black uppercase text-[#D85500] bg-orange-100 border border-orange-300 px-1.5 py-0.5 rounded-md shrink-0">
                            Latest
                          </span>
                        )}
                        <span className="text-[10px] text-[#8B8680] font-bold whitespace-nowrap">
                          &bull; {group.events.length} {group.events.length === 1 ? 'hike' : 'hikes'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[8px] font-extrabold uppercase text-[#8B8680] tracking-wider">
                          Total:
                        </span>
                        <span className="text-xs sm:text-sm font-black text-[#FF6600] leading-tight">
                          {group.totalPax.toLocaleString()}
                          <span className="text-[9px] font-bold text-[#8B8680] ml-0.5">pax</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-[#8B8680] font-bold">
                      <span>{group.events.length} {group.events.length === 1 ? 'event' : 'events'}</span>
                      <span className="text-[#5A5551] font-extrabold">
                        Avg {avgInMonth} pax/hike
                      </span>
                    </div>
                  </div>

                  {/* Continuous Flow of Bars */}
                  <div className="flex items-end gap-2.5 sm:gap-3 pt-2 pb-1 flex-1 min-h-[160px]">
                    {group.events.map((event) => {
                      const isSelected = activeItem?.key === event.key;
                      const ratio = Math.min(1, Math.max(0, event.pax / maxPax));
                      const barHeightPx = Math.max(12, Math.round(14 + ratio * (115 - 14)));

                      return (
                        <button
                          key={event.key}
                          type="button"
                          onClick={() => setActiveItem(event)}
                          className={`group flex-shrink-0 w-[52px] sm:w-[58px] flex flex-col items-center justify-end cursor-pointer transition-all duration-200 relative p-1 rounded-xl focus:outline-none ${
                            isSelected
                              ? 'bg-orange-100/80 ring-2 ring-[#FF6600]'
                              : 'hover:bg-orange-50/70'
                          }`}
                          title={`#${event.eventNo}: ${event.title} (${event.pax} pax)`}
                        >
                          <div className="mb-1 text-center w-full">
                            <span
                              className={`text-[10px] font-black block leading-none tabular-nums ${
                                isSelected ? 'text-[#D85500]' : 'text-[#1F1F1F] group-hover:text-[#FF6600]'
                              }`}
                            >
                              {event.pax}
                            </span>
                          </div>

                          <div
                            style={{ height: `${barHeightPx}px` }}
                            className={`w-full max-w-[32px] sm:max-w-[38px] rounded-t-md transition-all duration-200 ${
                              isSelected
                                ? 'bg-[#D85500] shadow-sm'
                                : 'bg-[#FF6600] group-hover:bg-[#D85500]'
                            }`}
                          />

                          <div className="mt-2 text-center w-full">
                            <span
                              className={`text-[9px] font-black uppercase block truncate max-w-full ${
                                isSelected ? 'text-[#D85500]' : 'text-[#1F1F1F]'
                              }`}
                            >
                              #{event.eventNo}
                            </span>
                            <span className="text-[8px] text-[#8B8680] font-bold block truncate max-w-full">
                              {event.formattedDate}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Show More Past Months at Far Right */}
            {hasMoreMonths && (
              <div className="flex-shrink-0 w-[180px] ml-4 sm:ml-5 pl-4 sm:pl-5 border-l border-[#E5E1DB] flex flex-col items-center justify-center text-center self-stretch py-4 space-y-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-100 text-[#FF6600] flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#1F1F1F]">Older History</h4>
                  <p className="text-[10px] text-[#8B8680] font-medium">
                    {allMonthsCount - visibleMonthsCount} past months
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleShowMore}
                    className="px-2.5 py-1 text-[10px] font-black text-white bg-[#FF6600] hover:bg-[#D85500] rounded-xl transition-all cursor-pointer"
                  >
                    +6 Months
                  </button>
                  <button
                    type="button"
                    onClick={handleShowAll}
                    className="px-2.5 py-1 text-[10px] font-black text-[#D85500] bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 transition-all cursor-pointer"
                  >
                    All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Hike Detail Strip (matching CommunityMilestoneCard) */}
      <div className="bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl p-3 transition-all">
        {activeItem ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-[10px] font-extrabold shrink-0">
                #{activeItem.eventNo}
              </span>
              <span className="font-black text-[#1F1F1F] truncate">{activeItem.title}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8B8680] shrink-0">
                <Calendar className="w-3 h-3" />
                {activeItem.date}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-black text-[#FF6600]">{activeItem.pax} Participants</span>
              <span className="text-[11px] font-bold text-[#5A5551]">
                Returning: {activeItem.returningCount} • New: {activeItem.newCount}
              </span>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="text-[10px] font-bold text-[#FF6600] hover:text-[#D85500] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-[#8B8680]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF6600] shrink-0" />
              <span className="font-semibold text-[11px] sm:text-xs">
                Click any hike bar to inspect participant breakdown
              </span>
            </div>
            {monthGroups.length > 0 && (
              <span className="text-[11px] font-black text-[#FF6600] shrink-0 pl-2">
                {monthGroups[0].label}: {monthGroups[0].totalPax.toLocaleString()} pax
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
