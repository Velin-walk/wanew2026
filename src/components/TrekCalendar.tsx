import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trek } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ExternalLink,
  X,
} from 'lucide-react';

interface TrekCalendarProps {
  treks: Trek[];
  onSelectTrek?: (trek: Trek) => void;
  onViewItinerary?: (trek: Trek) => void;
  parseTrekDate: (dateStr?: string) => Date | null;
  parseTrekEndDate?: (dateStr?: string) => Date | null;
  getEventDurationDays?: (trek: Trek) => number;
}

export const TrekCalendar: React.FC<TrekCalendarProps> = ({
  treks,
  onSelectTrek,
  onViewItinerary,
  parseTrekDate,
  parseTrekEndDate,
  getEventDurationDays,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Determine initial calendar month based on earliest upcoming trek
  const initialMonth = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const trek of treks) {
      const dStr = trek.date || trek.data?.hikeDate || (trek as any).hike_date || '';
      const parsed = parseTrekDate(dStr);
      if (parsed && !isNaN(parsed.getTime())) {
        if (parsed.getTime() >= today.getTime()) {
          return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
        }
      }
    }

    for (const trek of treks) {
      const dStr = trek.date || trek.data?.hikeDate || (trek as any).hike_date || '';
      const parsed = parseTrekDate(dStr);
      if (parsed && !isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      }
    }

    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, [treks, parseTrekDate]);

  // Build scrollable list of months (at least 12 months, covering all upcoming treks)
  const monthsList = useMemo(() => {
    const today = new Date();
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startMonth = initialMonth.getTime() < todayMonth.getTime() ? initialMonth : todayMonth;

    let maxMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 11, 1);
    for (const trek of treks) {
      const dStr = trek.date || trek.data?.hikeDate || (trek as any).hike_date || '';
      const parsed = parseTrekDate(dStr);
      if (parsed && !isNaN(parsed.getTime())) {
        const trekMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
        if (trekMonth.getTime() > maxMonth.getTime()) {
          maxMonth = trekMonth;
        }
      }
    }

    const list: Date[] = [];
    let cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
    let guard = 0;
    while (cursor.getTime() <= maxMonth.getTime() && guard < 24) {
      list.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      guard++;
    }
    return list;
  }, [treks, initialMonth, parseTrekDate]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Scroll to a specific month inside the horizontal container
  const scrollToMonth = (targetMonth: Date, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const key = getMonthKey(targetMonth);
    const el = container.querySelector(`[data-month-key="${key}"]`) as HTMLElement | null;
    if (el) {
      container.scrollTo({
        left: el.offsetLeft - container.offsetLeft,
        behavior,
      });
    }
  };

  // Scroll to initialMonth when treks initialize
  useEffect(() => {
    if (!isCollapsed) {
      scrollToMonth(initialMonth, 'auto');
    }
  }, [initialMonth, isCollapsed]);

  // Check if a trek occurs on a specific day
  const isTrekOnDay = (trek: Trek, day: Date): boolean => {
    const dStr = trek.date || trek.data?.hikeDate || (trek as any).hike_date || '';
    if (!dStr) return false;
    const start = parseTrekDate(dStr);
    if (!start || isNaN(start.getTime())) return false;

    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 86400000 - 1;

    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const end = parseTrekEndDate ? parseTrekEndDate(dStr) : null;
    let endMs: number;
    if (end && !isNaN(end.getTime())) {
      endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() + 86400000 - 1;
    } else {
      const duration = getEventDurationDays ? getEventDurationDays(trek) : 1;
      endMs = startMs + duration * 86400000 - 1;
    }

    return dayEnd >= startMs && dayStart <= endMs;
  };

  const getTreksOnDay = (day: Date): Trek[] => {
    return treks.filter((trek) => isTrekOnDay(trek, day));
  };

  // Extract concise main text representing the trek name
  const getMainTrekName = (trek: Trek): string => {
    const raw = (trek.name || trek.title || 'Trek').trim();
    const cleaned = raw
      .replace(/^(?:hike|trek)\s*#?\s*\d*\s*[:\-–—]?\s*/i, '')
      .replace(/^#\d+\s*[:\-–—]?\s*/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s+(?:sat(?:urday)?\s+subs(?:cription)?\s+hike|subscription\s+hike|overnight\s+hike|day\s+hike|hike|trek)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleaned || raw;
  };

  // Build grid cells for a given month
  const buildMonthGrid = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();

    const cells: {
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSaturday: boolean;
      dayNumber: number;
      treks: Trek[];
    }[] = [];

    // Previous month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = new Date(year, month - 1, dayNum);
      cells.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        isSaturday: date.getDay() === 6,
        dayNumber: dayNum,
        treks: [],
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const date = new Date(year, month, dayNum);
      cells.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        isSaturday: date.getDay() === 6,
        dayNumber: dayNum,
        treks: getTreksOnDay(date),
      });
    }

    // Next month padding to complete final week row
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const date = new Date(year, month + 1, dayNum);
      cells.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        isSaturday: date.getDay() === 6,
        dayNumber: dayNum,
        treks: [],
      });
    }

    return cells;
  };

  // Count treks starting in a given month
  const getTreksCountForMonth = (monthDate: Date): number => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return treks.filter((trek) => {
      const dStr = trek.date || trek.data?.hikeDate || (trek as any).hike_date || '';
      if (!dStr) return false;
      const start = parseTrekDate(dStr);
      if (!start || isNaN(start.getTime())) return false;
      return start.getFullYear() === year && start.getMonth() === month;
    }).length;
  };

  // Horizontal scroll handlers
  const handleScrollByStep = (direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const firstCard = container.querySelector('[data-month-card="true"]') as HTMLElement | null;
    const step = firstCard ? firstCard.offsetWidth + 12 : container.clientWidth;
    container.scrollBy({
      left: direction * step,
      behavior: 'smooth',
    });
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedDate(now);
    scrollToMonth(new Date(now.getFullYear(), now.getMonth(), 1), 'smooth');
  };

  const handleCellClick = (date: Date, dayTreks: Trek[]) => {
    setSelectedDate(date);
    if (dayTreks.length === 1 && onSelectTrek) {
      onSelectTrek(dayTreks[0]);
    }
  };

  const selectedDayTreks = selectedDate ? getTreksOnDay(selectedDate) : [];

  return (
    <div className="bg-white rounded-xl border border-[#F0EBE5] p-2 sm:p-2.5 shadow-xs space-y-2">
      {/* Calendar Header Bar */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-[#1F1F1F] uppercase tracking-wide">
            Upcoming Treks Calendar
          </span>
          <span className="text-[10px] font-bold text-[#7ABA42] bg-[#7ABA42]/10 border border-[#7ABA42]/20 px-1.5 py-0.2 rounded-full leading-none">
            {treks.length} Upcoming
          </span>
        </div>

        {/* Scroll & View Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={handleToday}
            className="text-[10px] font-semibold text-[#5A5551] hover:text-[#1F1F1F] bg-[#FAF8F5] hover:bg-white border border-[#EBE6DF] px-1.5 py-0.5 rounded transition-all cursor-pointer"
            title="Jump to Today"
          >
            Today
          </button>
          <div className="flex items-center bg-[#FAF8F5] border border-[#EBE6DF] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleScrollByStep(-1)}
              className="p-1 text-[#5A5551] hover:text-[#1F1F1F] hover:bg-white rounded transition-colors cursor-pointer"
              aria-label="Scroll Previous Month"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#5A5551] px-1.5 select-none">
              Scroll Months
            </span>
            <button
              type="button"
              onClick={() => handleScrollByStep(1)}
              className="p-1 text-[#5A5551] hover:text-[#1F1F1F] hover:bg-white rounded transition-colors cursor-pointer"
              aria-label="Scroll Next Month"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#FAF8F5] border border-[#EBE6DF] rounded-lg transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Calendar' : 'Collapse Calendar'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Horizontally Scrollable Months Container:
              - Mobile (< md): 1 month card fits 100% width, rest scrollable horizontally
              - Desktop (>= md): 3 month cards side-by-side, rest scrollable horizontally */}
          <div
            ref={scrollContainerRef}
            className="relative flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth"
          >
            {monthsList.map((monthDate) => {
              const monthKey = getMonthKey(monthDate);
              const monthLabel = monthDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              });
              const monthTrekCount = getTreksCountForMonth(monthDate);
              const gridDays = buildMonthGrid(monthDate);

              return (
                <div
                  key={monthKey}
                  data-month-key={monthKey}
                  data-month-card="true"
                  className="w-full md:w-[calc((100%-1.5rem)/3)] shrink-0 snap-start bg-[#FAF8F5]/60 border border-[#EBE6DF] rounded-xl p-2 flex flex-col justify-between"
                >
                  <div>
                    {/* Month Card Title */}
                    <div className="flex items-center justify-between px-0.5 pb-1.5 mb-1 border-b border-[#EBE6DF]/70">
                      <span className="text-xs font-bold text-[#1F1F1F]">
                        {monthLabel}
                      </span>
                      {monthTrekCount > 0 ? (
                        <span className="text-[9px] font-bold text-[#7ABA42] bg-[#7ABA42]/10 border border-[#7ABA42]/20 px-1.5 py-0.5 rounded-full leading-none">
                          {monthTrekCount} {monthTrekCount === 1 ? 'trek' : 'treks'}
                        </span>
                      ) : (
                        <span className="text-[9px] text-[#B8B1A8] font-medium">
                          No treks
                        </span>
                      )}
                    </div>

                    {/* Days of week header */}
                    <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                        <div
                          key={d}
                          className={`text-[9px] font-bold py-0.5 uppercase ${
                            i === 6 ? 'text-amber-800 bg-amber-50/80 rounded' : 'text-[#8B8680]'
                          }`}
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* 7-column Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {gridDays.map((cell, idx) => {
                        const hasTreks = cell.isCurrentMonth && cell.treks.length > 0;
                        const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;

                        let cellStyle = 'bg-white border-[#F0EBE5] text-[#1F1F1F] hover:border-[#D1C9BF]';

                        if (!cell.isCurrentMonth) {
                          cellStyle = 'bg-transparent border-transparent text-[#C8C2B8]';
                        } else if (hasTreks) {
                          cellStyle =
                            'bg-[#7ABA42]/15 border-[#7ABA42]/45 text-[#2C5712] font-bold hover:bg-[#7ABA42]/25 hover:border-[#7ABA42]';
                        } else if (cell.isSaturday) {
                          cellStyle = 'bg-amber-50/40 border-amber-100/80 text-[#5A5551] hover:bg-amber-50/70';
                        }

                        if (cell.isToday && cell.isCurrentMonth) {
                          cellStyle += ' ring-1 ring-amber-400 font-bold';
                        }

                        if (isSelected && cell.isCurrentMonth) {
                          cellStyle += ' ring-2 ring-[#7ABA42] shadow-3xs';
                        }

                        return (
                          <div
                            key={`${monthKey}-day-${idx}`}
                            onClick={() => cell.isCurrentMonth && handleCellClick(cell.date, cell.treks)}
                            className={`min-h-[38px] sm:min-h-[42px] p-0.5 rounded-md border transition-all flex flex-col justify-between select-none relative ${
                              cell.isCurrentMonth ? 'cursor-pointer' : 'pointer-events-none'
                            } ${cellStyle}`}
                            title={
                              hasTreks
                                ? cell.treks
                                    .map((t) => {
                                      const rawNum = String(t.hike_number || t.data?.hikeNumber || '').replace(/[^\d]/g, '');
                                      return `Hike #${rawNum || '•'}: ${t.name || t.title}`;
                                    })
                                    .join('\n')
                                : cell.isCurrentMonth
                                ? cell.date.toLocaleDateString()
                                : undefined
                            }
                          >
                            {/* Day Number */}
                            <div className="flex items-center justify-between leading-none px-0.5 pt-0.5">
                              <span
                                className={`text-[10px] ${
                                  cell.isToday && cell.isCurrentMonth
                                    ? 'w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[9px]'
                                    : hasTreks
                                    ? 'font-black text-[#264D0F]'
                                    : ''
                                }`}
                              >
                                {cell.dayNumber}
                              </span>

                              {hasTreks && (
                                <span className="w-1 h-1 rounded-full bg-[#7ABA42] shrink-0" />
                              )}
                            </div>

                            {/* Trek Name Box(es) on this day */}
                            {hasTreks && (
                              <div className="mt-0.5 space-y-0.5">
                                {cell.treks.map((t, tIdx) => {
                                  const mainName = getMainTrekName(t);

                                  return (
                                    <div
                                      key={t.id || tIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(cell.date);
                                        if (onSelectTrek) onSelectTrek(t);
                                      }}
                                      className="text-[7px] sm:text-[8px] font-semibold text-white bg-[#7ABA42] hover:bg-[#6CA838] px-0.5 py-[1px] rounded text-center transition-transform active:scale-95 leading-[1.1] line-clamp-2 break-words"
                                    >
                                      {mainName}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Date Details Strip */}
          {selectedDate && (
            <div className="mt-1 p-2 sm:p-2.5 bg-[#FAF8F5] border border-[#EBE6DF] rounded-lg">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EBE6DF]/70">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] sm:text-xs font-bold text-[#1F1F1F]">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[10px] font-medium text-[#8B8680]">
                    ({selectedDayTreks.length} {selectedDayTreks.length === 1 ? 'trek scheduled' : 'treks scheduled'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="p-0.5 text-[#8B8680] hover:text-[#1F1F1F] rounded transition-colors cursor-pointer"
                  title="Close selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedDayTreks.length === 0 ? (
                <div className="pt-1.5 text-[11px] text-[#8B8680] italic">
                  No treks scheduled on this date.
                </div>
              ) : (
                <div className="pt-1.5 space-y-1.5">
                  {selectedDayTreks.map((trek, idx) => {
                    const rawHikeNum = String(trek.hike_number || trek.data?.hikeNumber || '').replace(/[^\d]/g, '');
                    const badge = rawHikeNum ? `#${rawHikeNum}` : `#${idx + 1}`;
                    const trekName = trek.name || trek.title || 'Untitled Trek';
                    const leader = trek.leader || trek.data?.teamLeader || '';
                    const rawPrice = trek.price || (trek.data?.priceTiers && trek.data.priceTiers[0]?.price ? `Rs. ${trek.data.priceTiers[0].price}` : '');
                    const price = typeof rawPrice === 'number' ? `Rs. ${rawPrice}` : String(rawPrice || '');

                    return (
                      <div
                        key={trek.id ? `cal-selected-${trek.id}-${idx}` : `cal-selected-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 bg-white border border-[#EBE6DF] rounded-lg"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="shrink-0 text-[10px] font-mono font-bold text-[#5A5551] bg-[#EDE9E3] px-1.5 py-0.5 rounded">
                            {badge}
                          </span>
                          <span className="text-xs font-bold text-[#1F1F1F] truncate">
                            {trekName}
                          </span>
                          {leader && (
                            <span className="text-[10px] text-[#8B8680] truncate hidden md:inline">
                              • Lead: {leader}
                            </span>
                          )}
                          {price && (
                            <span className="text-[10px] font-bold text-[#7ABA42] shrink-0">
                              {price}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {onSelectTrek && (
                            <button
                              type="button"
                              onClick={() => onSelectTrek(trek)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                              <span>Go to Card</span>
                            </button>
                          )}
                          {onViewItinerary && (
                            <button
                              type="button"
                              onClick={() => onViewItinerary(trek)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FAF8F5] hover:bg-white text-[#5A5551] hover:text-[#1F1F1F] border border-[#EBE6DF] text-[10px] font-bold rounded transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Itinerary</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Simple Legend */}
          <div className="flex items-center justify-between px-1 pt-0.5 text-[10px] text-[#8B8680]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-[#7ABA42]" />
                Scheduled Trek
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-amber-100 border border-amber-200" />
                Saturday
              </span>
            </div>
            <span className="hidden sm:inline">Scroll horizontally to browse months • Click a trek date to jump</span>
            <span className="sm:hidden">Swipe left/right for more months</span>
          </div>
        </>
      )}
    </div>
  );
};
