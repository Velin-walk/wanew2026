import React, { useState, useMemo } from 'react';
import { Trek } from '../types';
import { TrekCard } from '../components/TrekCard';
import { PastEventListItem } from '../components/PastEventListItem';
import { NepaliPrayerFlags, MiniPrayerFlags } from '../components/NepaliPrayerFlags';
import { HomepageHeroBanner, HeroStatsBar } from '../components/HomepageHeroBanner';
import { OffersBanner } from '../components/OffersBanner';
import { BookingProcessBanner } from '../components/BookingProcessBanner';
import { HomeGalleryReviewsSection } from '../components/HomeGalleryReviewsSection';

import { SubPageType } from '../components/InfoPagesModal';
import { trackFilterChange, trackSearchQuery } from '../services/behaviorTracker';
import {
  Search,
  Mountain,
  Calendar,
  Flame,
  ShieldCheck,
  Heart,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  MessageCircle,
} from 'lucide-react';

interface TrekListScreenProps {
  treks: Trek[];
  loading: boolean;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onRegister: (trek: Trek) => void;
  onShare: (trek: Trek) => void;
  onViewItinerary?: (trek: Trek) => void;
  onViewFaq?: (trek: Trek) => void;
  onViewGallery?: (trek?: Trek) => void;
  savedOnly?: boolean;
  onExploreAll?: () => void;
  onLeaveFeedback?: (trek: Trek) => void;
  activeInfoPage?: SubPageType | null;
  onOpenInfoPage?: (page: SubPageType) => void;
}

export const TrekListScreen: React.FC<TrekListScreenProps> = ({
  treks,
  loading,
  favorites,
  onToggleFavorite,
  onRegister,
  onShare,
  onViewItinerary,
  onViewFaq,
  onViewGallery,
  savedOnly = false,
  onExploreAll,
  onLeaveFeedback,
  activeInfoPage,
  onOpenInfoPage,
}) => {
  const [tripTypeFilter, setTripTypeFilter] = useState<'all' | 'treks' | 'overnight' | 'day'>('all');
  const [saturdayOnly, setSaturdayOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pastLimit, setPastLimit] = useState(25);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [highlightedTrekId, setHighlightedTrekId] = useState<string | null>(null);

  const handleSummaryClick = (trek: Trek, idx: number) => {
    const targetId = String(trek.id || idx);
    setHighlightedTrekId(targetId);

    const cardElement = document.getElementById(`trek-card-${targetId}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      setHighlightedTrekId((curr) => (curr === targetId ? null : curr));
    }, 2500);
  };

  // Helper to accurately parse trek date
  const parseTrekDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();

    // 1. Slash format: DD/MM/YYYY or YYYY/MM/DD
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        } else {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }

    // 2. Dash/Dot format: DD-MM-YYYY or DD.MM.YYYY
    if ((trimmed.includes('-') || trimmed.includes('.')) && !trimmed.match(/[a-zA-Z]/)) {
      const delimiter = trimmed.includes('-') ? '-' : '.';
      const parts = trimmed.split(delimiter);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
          }
        } else if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
          }
        }
      }
    }

    // 3. Direct JS Date constructor
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // 4. Handle range formats like "Wed 14 Oct – Sun 18 Oct 2026 (5 Days)" or "14 Oct - 18 Oct 2026"
    try {
      const yearMatch = trimmed.match(/\b(20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : '';
      const cleanRange = trimmed.replace(/\(.*?\)/g, '').trim();
      const parts = cleanRange.split(/[–—\-]/);
      if (parts.length > 1 && year) {
        const firstPart = parts[0].replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '').trim();
        const testStr = `${firstPart} ${year}`;
        const rangeDate = new Date(testStr);
        if (!isNaN(rangeDate.getTime())) return rangeDate;
      }
    } catch {}

    return null;
  };

  // Helper to extract end date from a range date string (e.g. "Wed 14 Oct – Sun 18 Oct 2026")
  const parseTrekEndDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const trimmed = String(dateStr).trim();
    try {
      const yearMatch = trimmed.match(/\b(20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : '';
      const cleanRange = trimmed.replace(/\(.*?\)/g, '').trim();
      const parts = cleanRange.split(/[–—\-]/);
      if (parts.length > 1 && year) {
        const secondPart = parts[1]
          .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '')
          .trim();
        const testStr = secondPart.includes(year) ? secondPart : `${secondPart} ${year}`;
        const rangeDate = new Date(testStr);
        if (!isNaN(rangeDate.getTime())) return rangeDate;
      }
    } catch {}
    return null;
  };

  // Helper to calculate event duration in calendar days
  const getEventDurationDays = (trek: Trek): number => {
    const daysStr = String(
      trek.days ||
      trek.days_label ||
      (trek as any).days_label ||
      (trek as any).expected_duration ||
      trek.data?.days ||
      trek.data?.overview?.days ||
      ''
    ).toLowerCase();

    const m = daysStr.match(/(\d+)\s*(?:d|day)/i) || daysStr.match(/^(\d+)$/);
    if (m) return Math.max(1, parseInt(m[1], 10));
    if (daysStr.includes('overnight') || daysStr.includes('1n') || daysStr.includes('2d')) return 2;
    return 1;
  };

  // Helper to determine if an event happens on a Saturday on the calendar
  const isSaturdayTrek = (trek: Trek): boolean => {
    const rawDate = String(
      trek.date ||
      trek.hike_date ||
      (trek as any).hike_date ||
      trek.data?.hikeDate ||
      trek.data?.date ||
      trek.data?.hike_date ||
      ''
    ).trim();

    const startDate = parseTrekDate(rawDate);

    // If we have a valid calendar start date
    if (startDate && !isNaN(startDate.getTime())) {
      // 1. Direct check: Start date is a Saturday
      if (startDate.getDay() === 6) {
        return true;
      }

      // 2. Check if a range end date exists in the date string (e.g. "Wed 14 Oct – Sun 18 Oct 2026")
      const endDate = parseTrekEndDate(rawDate);
      if (endDate && !isNaN(endDate.getTime()) && endDate >= startDate) {
        const cur = new Date(startDate);
        let count = 0;
        while (cur <= endDate && count < 30) {
          if (cur.getDay() === 6) return true;
          cur.setDate(cur.getDate() + 1);
          count++;
        }
      } else {
        // 3. Check event duration (e.g. 2D 1N, 3D 3N, 5 Days)
        const durationDays = getEventDurationDays(trek);
        if (durationDays > 1) {
          const cur = new Date(startDate);
          for (let i = 1; i < durationDays && i < 30; i++) {
            cur.setDate(cur.getDate() + 1);
            if (cur.getDay() === 6) return true;
          }
        }
      }
    }

    // 4. Fallback check: does raw date string, duration, or title explicitly mention Saturday or Sat
    const textToCheck = `${rawDate} ${trek.days || (trek as any).expected_duration || ''} ${trek.name || trek.title || ''}`.toLowerCase();
    if (/\b(sat|saturday)\b/i.test(textToCheck)) {
      return true;
    }

    return false;
  };

  // Base filtering logic
  const filteredTreks = useMemo(() => {
    return treks.filter((trek) => {
      // Exclude draft or archived treks from public display
      const trekStatus = (trek.status || trek.data?.status || '').toLowerCase().trim();
      if (trekStatus === 'draft' || trekStatus === 'archived') {
        return false;
      }

      if (savedOnly && !favorites.includes(trek.id)) {
        return false;
      }

      const catStr = String(trek.category || trek.data?.category || '').toLowerCase();
      const daysStr = String(trek.days || trek.data?.days || trek.data?.overview?.days || '').toLowerCase();
      const isOvernight =
        catStr.includes('overnight') ||
        daysStr.includes('overnight') ||
        daysStr.includes('1n') ||
        daysStr.includes('2d') ||
        daysStr === '2';
      const isMultiDayTrek =
        catStr.includes('multi') ||
        (!isOvernight && catStr.includes('trek') && !catStr.includes('day')) ||
        (!isOvernight && daysStr.includes('trek'));
      const isDayHike =
        !isOvernight &&
        !isMultiDayTrek &&
        (catStr.includes('day') ||
          daysStr.includes('subs') ||
          daysStr.includes('sat') ||
          daysStr.includes('day bus') ||
          daysStr.includes('1 day') ||
          daysStr === '1');

      if (tripTypeFilter === 'treks' && !isMultiDayTrek) return false;
      if (tripTypeFilter === 'overnight' && !isOvernight) return false;
      if (tripTypeFilter === 'day' && !isDayHike) return false;

      if (saturdayOnly && !isSaturdayTrek(trek)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = trek.name.toLowerCase().includes(q);
        const matchHikeNum = trek.hike_number?.toLowerCase().includes(q) || false;
        const matchLoc = trek.start_location?.toLowerCase().includes(q) || false;
        const matchLeader = trek.leader?.toLowerCase().includes(q) || false;
        if (!matchName && !matchHikeNum && !matchLoc && !matchLeader) return false;
      }

      return true;
    });
  }, [treks, savedOnly, favorites, tripTypeFilter, saturdayOnly, searchQuery]);

  // Separate upcoming vs past events based on calendar date
  const { upcomingTreks, pastTreks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: Trek[] = [];
    const past: Trek[] = [];
    const seenIds = new Set<string>();

    const getTrekDateStr = (t: Trek): string => {
      return t.date || t.data?.hikeDate || (t as any).hike_date || '';
    };

    const getHikeNum = (t: Trek): number => {
      const raw = String(t.hike_number || t.data?.hikeNumber || t.id || '').replace(/\D/g, '');
      return parseInt(raw, 10) || 0;
    };

    for (const trek of filteredTreks) {
      if (!trek) continue;
      const tid = String(trek.id || '').trim();
      if (tid && seenIds.has(tid)) {
        continue;
      }
      if (tid) seenIds.add(tid);

      const dt = parseTrekDate(getTrekDateStr(trek));
      if (!dt || dt.getTime() >= today.getTime()) {
        upcoming.push(trek);
      } else {
        past.push(trek);
      }
    }

    // Sort upcoming (closest upcoming hike first; ties broken by higher hike number first)
    upcoming.sort((a, b) => {
      const da = parseTrekDate(getTrekDateStr(a))?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = parseTrekDate(getTrekDateStr(b))?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return getHikeNum(b) - getHikeNum(a);
    });

    // Sort past descending (most recent past date first; ties broken by higher hike number first)
    past.sort((a, b) => {
      const da = parseTrekDate(getTrekDateStr(a))?.getTime() || 0;
      const db = parseTrekDate(getTrekDateStr(b))?.getTime() || 0;
      if (da !== db) return db - da;
      return getHikeNum(b) - getHikeNum(a);
    });

    return { upcomingTreks: upcoming, pastTreks: past };
  }, [filteredTreks]);

  // Debounced search query telemetry
  React.useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackSearchQuery(searchQuery.trim(), filteredTreks.length);
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, filteredTreks.length]);

  // Helpers for ultra-compact, structured upcoming trek summary
  const formatCompactDate = (dateStr?: string): string => {
    if (!dateStr) return 'TBD';
    const parsed = parseTrekDate(dateStr);
    if (parsed && !isNaN(parsed.getTime())) {
      const day = parsed.getDate();
      const month = parsed.toLocaleDateString('en-US', { month: 'short' });
      return `${day} ${month}`;
    }
    const clean = dateStr.replace(/\(.*?\)/g, '').trim().split(/[–—\-]/)[0].trim();
    return clean.length > 7 ? clean.slice(0, 7) : clean;
  };

  const getDaysBadge = (t: Trek): string => {
    const d = String(t.days || t.days_label || t.data?.days || t.data?.overview?.days || '').trim();
    if (!d) return '';
    if (/overnight|1n/i.test(d)) return 'Overnight';
    const m = d.match(/(\d+)\s*day/i) || d.match(/^(\d+)$/);
    if (m) return m[1] === '1' ? '1 Day' : `${m[1]}D`;
    if (/subs|sat/i.test(d)) return '1 Day';
    if (d.length <= 7) return d;
    return '';
  };

  return (
    <div className="space-y-4 w-full">
      {/* Authentic Nepali Lungta Prayer Flags Garland (Sticky Top) */}
      {!savedOnly && (
        <div className="sticky top-14 sm:top-16 z-30 -mt-3 sm:-mt-6 w-full overflow-hidden select-none pointer-events-none">
          <NepaliPrayerFlags />
        </div>
      )}

      {/* Hourly Rotating Homepage Hero Banner */}
      {!savedOnly && (
        <HomepageHeroBanner
          upcomingCount={upcomingTreks.length}
          completedCount={pastTreks.length}
          onOpenReviews={() => onOpenInfoPage?.('reviews')}
        />
      )}

      {/* Upcoming, Completed and Reviews Stats Bar right after hero section */}
      {!savedOnly && (
        <HeroStatsBar
          upcomingCount={upcomingTreks.length}
          completedCount={pastTreks.length}
          onOpenReviews={() => onOpenInfoPage?.('reviews')}
        />
      )}

      {/* Offers / Flashcards Banner (in between hero card and search box) */}
      {!savedOnly && <OffersBanner />}

      {/* 3-Step Booking Process & Reassurance Badges */}
      {!savedOnly && <BookingProcessBanner />}

      {/* Saved header if in saved mode */}
      {savedOnly && (
        <div className="relative bg-white rounded-xl border border-[#F0EBE5] p-4 flex items-center justify-between shadow-xs overflow-hidden">
          {/* Subtle miniature prayer flags draped across corner of saved header */}
          <div className="absolute -top-1 right-2 sm:right-6 w-24 xs:w-32 sm:w-36 pointer-events-none z-10 opacity-80 hidden xs:block">
            <MiniPrayerFlags variant="draped" count={5} />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Heart className="w-4 h-4 fill-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F1F1F]">Saved Himalayan Treks</h2>
              <p className="text-[11px] text-[#8B8680]">Bookmarked itineraries for fast registration</p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
            {favorites.length} Saved
          </span>
        </div>
      )}

      {/* Filter and Search Controls - Clean Mobile Layout */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-3 w-full max-w-full">
        {/* Search Box */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8B8680]" />
            <input
              type="text"
              placeholder="Search by peak, hike #, location, or guide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-[#E5E1DB] rounded-xl bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#7ABA42] text-[#1F1F1F] placeholder:text-[#8B8680] transition-colors"
            />
          </div>
          <a
            href="https://wa.me/9779803568612"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 transition-all shadow-2xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="whitespace-nowrap">Talk to Sales</span>
          </a>
        </div>

        {/* Filter Bar: Segmented Categories + Saturday Hikes + Showing Events */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#F0EBE5] text-xs">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Segmented Control for Categories */}
            <div className="inline-flex items-center bg-[#F4EFEA] p-0.5 rounded-xl border border-[#EBE6DF]">
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'day', label: '1 Day Hikes' },
                  { id: 'overnight', label: 'Overnight' },
                  { id: 'treks', label: 'Multi-Day' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTripTypeFilter(item.id);
                    trackFilterChange('trip_type', item.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    tripTypeFilter === item.id
                      ? 'bg-white text-[#1F1F1F] shadow-2xs font-extrabold'
                      : 'text-[#6E6862] hover:text-[#1F1F1F]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Saturday Hikes Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setSaturdayOnly((prev) => !prev);
                trackFilterChange('saturday_filter', !saturdayOnly ? 'saturday' : 'all');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-3xs select-none border ${
                saturdayOnly
                  ? 'bg-[#1F1F1F] text-white border-[#1F1F1F] shadow-xs'
                  : 'bg-white text-[#5A5551] border-[#E5E1DB] hover:border-[#C8C2B8] hover:text-[#1F1F1F]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Saturday Hikes</span>
              {saturdayOnly && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#7ABA42] ml-0.5" />
              )}
            </button>
          </div>

          <span className="text-[11px] text-[#8B8680] font-medium ml-auto w-full sm:w-auto text-right sm:text-left">
            Showing <strong className="text-[#1F1F1F] font-black">{filteredTreks.length}</strong> events
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5 w-full">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border-2 border-[#E5E1DB]/60 p-4 space-y-4 animate-pulse">
              <div className="bg-stone-200 h-40 sm:h-48 w-full rounded-xl" />
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="bg-stone-200 h-4 w-12 rounded" />
                  <div className="bg-stone-200 h-4 w-16 rounded" />
                </div>
                <div className="bg-stone-200 h-5 w-5/6 rounded" />
                <div className="bg-stone-200 h-4 w-1/2 rounded" />
              </div>
              <div className="bg-stone-200 h-7 w-full rounded-lg" />
              <div className="bg-stone-200 h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredTreks.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#F0EBE5] p-8 sm:p-12 text-center shadow-xs">
          {savedOnly ? (
            <>
              <Heart className="w-10 h-10 text-rose-300 mx-auto mb-2.5" />
              <h3 className="text-base font-bold text-[#1F1F1F]">No Saved Treks</h3>
              <p className="text-xs text-[#8B8680] mt-1 max-w-xs mx-auto">
                Tap the heart icon on any trek card to save it for quick reference and booking.
              </p>
              {onExploreAll && (
                <button
                  type="button"
                  onClick={onExploreAll}
                  className="mt-4 px-4 py-2 bg-[#7ABA42] text-white text-xs font-bold rounded-lg hover:bg-[#6CA838] transition-all"
                >
                  Browse Available Treks
                </button>
              )}
            </>
          ) : (
            <>
              <Mountain className="w-10 h-10 text-[#E5E1DB] mx-auto mb-2.5" />
              <h3 className="text-base font-bold text-[#1F1F1F]">No Events Found</h3>
              <p className="text-xs text-[#8B8680] mt-1 max-w-xs mx-auto">
                No treks matched your current filter criteria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTripTypeFilter('all');
                  setSaturdayOnly(false);
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 bg-[#7ABA42] text-white text-xs font-bold rounded-lg hover:bg-[#6CA838] transition-all"
              >
                Reset All Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ultra-Compact Structured Upcoming Treks Summary */}
          {upcomingTreks.length > 0 && (
            <div className="bg-white rounded-xl border border-[#F0EBE5] p-2 sm:p-2.5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#1F1F1F] uppercase tracking-wide">
                    Upcoming Treks Summary
                  </span>
                  <span className="text-[10px] font-bold text-[#7ABA42] bg-[#7ABA42]/10 border border-[#7ABA42]/20 px-1.5 py-0.2 rounded-full leading-none">
                    {upcomingTreks.length}
                  </span>
                </div>
                <span className="text-[10px] text-[#8B8680] font-medium hidden sm:inline">
                  Click to view card
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {upcomingTreks.map((trek, idx) => {
                  const trekDateStr = trek.date || trek.data?.hikeDate || trek.hike_date || '';
                  const compactDate = formatCompactDate(trekDateStr);
                  const trekName = trek.name || trek.title || 'Untitled Trek';
                  const rawHikeNum = String(trek.hike_number || trek.data?.hikeNumber || '').replace(/[^\d]/g, '');
                  const hikeBadge = rawHikeNum ? `#${rawHikeNum}` : `#${idx + 1}`;
                  const daysBadge = getDaysBadge(trek);

                  return (
                    <div
                      key={trek.id ? `summary-${trek.id}-${idx}` : `summary-${idx}`}
                      onClick={() => handleSummaryClick(trek, idx)}
                      title={`${hikeBadge}: ${trekName} (${trekDateStr || compactDate}) - Click to view card`}
                      className="flex items-center gap-1.5 px-2 py-1 bg-[#FAF8F5] hover:bg-white border border-[#EBE6DF] hover:border-[#7ABA42] rounded-lg transition-all cursor-pointer group shadow-3xs select-none"
                    >
                      <span className="shrink-0 text-[10px] font-mono font-bold text-[#5A5551] bg-[#EDE9E3] px-1.5 py-0.5 rounded text-center min-w-[34px] sm:min-w-[36px]">
                        {hikeBadge}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded text-center whitespace-nowrap min-w-[54px] sm:min-w-[58px]">
                        {compactDate}
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold text-[#1F1F1F] truncate flex-1 group-hover:text-[#7ABA42] transition-colors">
                        {trekName}
                      </span>
                      {daysBadge && (
                        <span className="shrink-0 text-[9px] font-medium text-[#7D7771] bg-white border border-[#E5E1DB] px-1 py-0.5 rounded whitespace-nowrap hidden xs:inline-block">
                          {daysBadge}
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-[#B8B1A8] group-hover:text-[#7ABA42] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. UPCOMING HIKES */}
          {upcomingTreks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E08828]" />
                  <span>Upcoming Hikes</span>
                </h3>
                <span className="text-xs font-semibold text-[#8B8680]">
                  {upcomingTreks.length} Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5 w-full">
                {upcomingTreks.map((trek, idx) => {
                  const targetId = String(trek.id || idx);
                  const isHighlighted = highlightedTrekId === targetId;

                  return (
                    <div
                      key={trek.id ? `${trek.id}-${idx}` : `trek-${idx}`}
                      id={`trek-card-${targetId}`}
                      className={`transition-all duration-500 rounded-2xl ${
                        isHighlighted
                          ? 'ring-4 ring-[#7ABA42] ring-offset-4 ring-offset-[#FAF8F5] shadow-[0_0_35px_rgba(122,186,66,0.6)] scale-[1.02] -translate-y-1'
                          : ''
                      }`}
                    >
                      <TrekCard
                        trek={trek}
                        isFavorited={favorites.includes(trek.id)}
                        onToggleFavorite={onToggleFavorite}
                        onRegister={onRegister}
                        onShare={onShare}
                        onViewItinerary={onViewItinerary}
                        onViewFaq={onViewFaq}
                        onViewGallery={onViewGallery}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Banner if Trip Category filter is active and has no upcoming hikes */}
          {tripTypeFilter !== 'all' && upcomingTreks.length === 0 && pastTreks.length > 0 && (
            <div className="bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-[#5A5551]">
                No upcoming hikes scheduled in this category right now.
              </p>
              <p className="text-[11px] text-[#8B8680] mt-0.5">
                Browse completed past hikes in this category below.
              </p>
            </div>
          )}

          {/* 2. PAST HIKES */}
          {pastTreks.length > 0 && (() => {
            const isCategoryActive = tripTypeFilter !== 'all';
            const isArchiveOpen = isCategoryActive || showPastEvents || upcomingTreks.length === 0;
            return (
              <div className="pt-3 border-t border-[#F0EBE5] space-y-3">
                {/* Full-width Himalayan prayer flag strip banner */}
                <div className="mb-3 w-full opacity-90 rounded-2xl overflow-hidden border border-[#E5E1DB]/70 bg-gradient-to-r from-amber-50/30 via-white/50 to-emerald-50/30 shadow-3xs">
                  <MiniPrayerFlags variant="card" count={16} withMountain={true} />
                </div>

                <div className="flex items-center justify-between">
                  {isCategoryActive ? (
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#7ABA42] shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
                        Past Hikes
                      </h3>
                      <span className="text-xs font-semibold text-[#8B8680]">
                        ({pastTreks.length} Completed)
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="toggle-past-events-archive-btn"
                      onClick={() => setShowPastEvents((prev) => !prev)}
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] py-1 transition-colors cursor-pointer group"
                      aria-expanded={isArchiveOpen}
                    >
                      <History className="w-3.5 h-3.5 text-[#7ABA42] group-hover:scale-110 transition-transform shrink-0" />
                      <span>
                        {upcomingTreks.length === 0
                          ? `Recent & Completed Events (${pastTreks.length})`
                          : `Past Events Archive (${pastTreks.length} Completed)`}
                      </span>
                      <span className="text-[#8B8680] font-normal group-hover:text-[#5A5551]">
                        — {isArchiveOpen ? 'click to hide' : 'click to view'}
                      </span>
                      {isArchiveOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#7ABA42]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#7ABA42]" />
                      )}
                    </button>
                  )}
                </div>

                {/* Collapsible / Categorized Content */}
                {isArchiveOpen && (
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                      {pastTreks.slice(0, pastLimit).map((trek, idx) => (
                        <PastEventListItem
                          key={trek.id ? `past-${trek.id}-${idx}` : `past-${idx}`}
                          trek={trek}
                          onViewItinerary={onViewItinerary}
                          onToggleFavorite={onToggleFavorite}
                          isFavorited={favorites.includes(trek.id)}
                          onLeaveFeedback={onLeaveFeedback}
                        />
                      ))}
                    </div>

                    {/* Load more if list is long */}
                    {pastTreks.length > pastLimit && (
                      <div className="col-span-1 lg:col-span-2 text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setPastLimit((prev) => prev + 25)}
                          className="px-4 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#5A5551] hover:bg-[#F9F7F5] shadow-xs transition-all cursor-pointer"
                        >
                          Load More Past Events (Showing {pastLimit} of {pastTreks.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. COMMUNITY GALLERY & REVIEWS PREVIEW (Desktop 2-Col, Mobile Stacked) */}
          {!savedOnly && (
            <HomeGalleryReviewsSection
              treks={treks}
              onViewGallery={onViewGallery}
              onOpenInfoPage={onOpenInfoPage}
            />
          )}
        </div>
      )}
    </div>
  );
};
