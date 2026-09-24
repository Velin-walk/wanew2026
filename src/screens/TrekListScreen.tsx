import React, { useState, useMemo } from 'react';
import { Trek } from '../types';
import { TrekCard } from '../components/TrekCard';
import { PastEventListItem } from '../components/PastEventListItem';
import { NepaliPrayerFlags, MiniPrayerFlags } from '../components/NepaliPrayerFlags';
import {
  Search,
  Mountain,
  SlidersHorizontal,
  Flame,
  ShieldCheck,
  Heart,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
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
  savedOnly?: boolean;
  onExploreAll?: () => void;
  onLeaveFeedback?: (trek: Trek) => void;
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
  savedOnly = false,
  onExploreAll,
  onLeaveFeedback,
}) => {
  const [tripTypeFilter, setTripTypeFilter] = useState<'all' | 'treks' | 'overnight' | 'day'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'moderate' | 'difficult'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pastLimit, setPastLimit] = useState(25);
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Helper to accurately parse trek date
  const parseTrekDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // Handle range formats like "Wed 14 Oct – Sun 18 Oct 2026 (5 Days)" or "14 Oct - 18 Oct 2026"
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

      const daysStr = String(trek.days || '').toLowerCase();
      const isDayHike =
        daysStr.includes('subs') ||
        daysStr.includes('sat') ||
        daysStr.includes('day bus') ||
        daysStr.includes('1 day') ||
        daysStr === '1';
      const isOvernight =
        daysStr.includes('overnight') ||
        daysStr.includes('1n') ||
        daysStr.includes('2d') ||
        daysStr === '2';
      const isMultiDayTrek = !isDayHike && !isOvernight;

      if (tripTypeFilter === 'treks' && !isMultiDayTrek) return false;
      if (tripTypeFilter === 'overnight' && !isOvernight) return false;
      if (tripTypeFilter === 'day' && !isDayHike) return false;

      if (difficultyFilter !== 'all') {
        const trekDiff = trek.difficulty?.toLowerCase();
        if (difficultyFilter === 'difficult' && trekDiff !== 'difficult' && trekDiff !== 'hard') {
          return false;
        }
        if (difficultyFilter !== 'difficult' && trekDiff !== difficultyFilter) {
          return false;
        }
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
  }, [treks, savedOnly, favorites, tripTypeFilter, difficultyFilter, searchQuery]);

  // Separate upcoming vs past events based on calendar date
  const { upcomingTreks, pastTreks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: Trek[] = [];
    const past: Trek[] = [];
    const seenIds = new Set<string>();

    for (const trek of filteredTreks) {
      if (!trek) continue;
      const tid = String(trek.id || '').trim();
      if (tid && seenIds.has(tid)) {
        continue;
      }
      if (tid) seenIds.add(tid);

      const dt = parseTrekDate(trek.date);
      if (!dt || dt.getTime() >= today.getTime()) {
        upcoming.push(trek);
      } else {
        past.push(trek);
      }
    }

    // Sort upcoming ascending (nearest first)
    upcoming.sort((a, b) => {
      const da = parseTrekDate(a.date)?.getTime() || 0;
      const db = parseTrekDate(b.date)?.getTime() || 0;
      return da - db;
    });

    // Sort past descending (most recent first)
    past.sort((a, b) => {
      const da = parseTrekDate(a.date)?.getTime() || 0;
      const db = parseTrekDate(b.date)?.getTime() || 0;
      return db - da;
    });

    return { upcomingTreks: upcoming, pastTreks: past };
  }, [filteredTreks]);

  return (
    <div className="space-y-4 w-full">
      {/* Authentic Nepali Lungta Prayer Flags Garland (Sticky Top) */}
      {!savedOnly && (
        <div className="sticky top-14 sm:top-16 z-30 w-full overflow-hidden select-none pointer-events-none">
          <NepaliPrayerFlags />
        </div>
      )}

      {/* Quick Roster Stats Bar */}
      {!savedOnly && (
        <div className="relative grid grid-cols-3 gap-1 sm:gap-2 bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-[#E5E1DB] shadow-2xs overflow-hidden">
          {/* Subtle miniature prayer flags draped across top-right of stats bar */}
          <div className="absolute -top-1 right-2 sm:right-6 w-24 xs:w-32 sm:w-36 pointer-events-none z-10 opacity-80 hidden xs:block">
            <MiniPrayerFlags variant="draped" count={5} />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-[#E08828]/10 text-[#E08828] shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-medium whitespace-nowrap leading-none">
              <strong className="text-[#1F1F1F] font-black text-[10.5px] xs:text-xs sm:text-sm">{upcomingTreks.length}</strong> Upcoming
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-[#7ABA42]/10 text-[#7ABA42] shrink-0">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-medium whitespace-nowrap leading-none">
              <strong className="text-[#1F1F1F] font-black text-[10.5px] xs:text-xs sm:text-sm">{pastTreks.length}</strong> Completed
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-semibold whitespace-nowrap leading-none">
              Friendly Team
            </span>
          </div>
        </div>
      )}

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
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-[#F0EBE5] shadow-xs space-y-3 w-full max-w-full">
        {/* Search Box */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8B8680]" />
          <input
            type="text"
            placeholder="Search by peak, hike #, location, or guide..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-[#E5E1DB] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#7ABA42] text-[#1F1F1F] placeholder:text-[#8B8680]"
          />
        </div>

        {/* Trip Type Pills - Fully Optimized for Mobile Views */}
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          <span className="text-[#8B8680] font-bold text-[10px] sm:text-[11px] flex items-center gap-1 mr-1 shrink-0 w-full sm:w-auto mb-0.5 sm:mb-0">
            Trip Category:
          </span>
          <div className="flex flex-wrap gap-1 w-full sm:w-auto">
            {(
              [
                { id: 'all', label: 'All Types' },
                { id: 'day', label: '1 Day Hikes' },
                { id: 'overnight', label: 'Overnight' },
                { id: 'treks', label: 'Multi-Day Treks' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTripTypeFilter(item.id)}
                className={`flex-1 sm:flex-initial text-center px-1.5 sm:px-2.5 py-1 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-3xs select-none ${
                  tripTypeFilter === item.id
                    ? 'bg-[#7ABA42] text-white shadow-sm ring-1 sm:ring-2 ring-[#7ABA42]/30 font-black'
                    : 'bg-[#F9F7F5] text-[#5A5551] border border-[#E5E1DB] hover:border-[#C8C2B8] hover:bg-white hover:text-[#1F1F1F]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grade / Difficulty Tags - Fully Optimized for Mobile Views */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-[#F0EBE5] text-xs">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[#8B8680] font-bold text-[10px] sm:text-[11px] flex items-center gap-1 mr-1 shrink-0 w-full sm:w-auto mb-0.5 sm:mb-0">
              <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Difficulty Grade:
            </span>
            <div className="flex flex-wrap gap-1 w-full sm:w-auto">
              {(['all', 'easy', 'moderate', 'difficult'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficultyFilter(diff)}
                  className={`flex-1 sm:flex-initial text-center px-1.5 sm:px-2.5 py-1 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold capitalize transition-all active:scale-95 cursor-pointer shadow-3xs select-none ${
                    difficultyFilter === diff
                      ? 'bg-[#1F1F1F] text-white shadow-xs font-black'
                      : 'bg-[#F9F7F5] text-[#5A5551] border border-[#E5E1DB] hover:border-[#C8C2B8] hover:bg-white hover:text-[#1F1F1F]'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[11px] text-[#8B8680] font-medium ml-auto w-full sm:w-auto text-right sm:text-left mt-1 sm:mt-0">
            Showing <strong className="text-[#1F1F1F]">{filteredTreks.length}</strong> events
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#8B8680]">
          <div className="w-8 h-8 border-3 border-[#E08828] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium uppercase tracking-wider">Loading trek roster...</p>
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
                  setDifficultyFilter('all');
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
          {/* 1. UPCOMING TREKS AS CARDS */}
          {upcomingTreks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#E08828]" />
                  <span>Upcoming Treks</span>
                </h3>
                <span className="text-xs font-semibold text-[#8B8680]">
                  {upcomingTreks.length} Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5 w-full">
                {upcomingTreks.map((trek, idx) => (
                  <TrekCard
                    key={trek.id ? `${trek.id}-${idx}` : `trek-${idx}`}
                    trek={trek}
                    isFavorited={favorites.includes(trek.id)}
                    onToggleFavorite={onToggleFavorite}
                    onRegister={onRegister}
                    onShare={onShare}
                    onViewItinerary={onViewItinerary}
                    onViewFaq={onViewFaq}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. PAST EVENTS AS LIST (Auto-expanded if no upcoming events to avoid blank screen) */}
          {pastTreks.length > 0 && (() => {
            const isArchiveOpen = showPastEvents || upcomingTreks.length === 0;
            return (
              <div className="pt-3 border-t border-[#F0EBE5]">
                {/* Subtle miniature Himalayan prayer flag strip divider */}
                <div className="mb-2 max-w-sm sm:max-w-md opacity-85">
                  <MiniPrayerFlags variant="card" count={7} withMountain={true} />
                </div>

                <div className="flex items-center justify-between">
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
                </div>

                {/* Collapsible Content */}
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
        </div>
      )}
    </div>
  );
};
