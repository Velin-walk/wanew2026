import React, { useState, useMemo } from 'react';
import { Trek } from '../types';
import { TrekCard } from '../components/TrekCard';
import { PastEventListItem } from '../components/PastEventListItem';
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
    return isNaN(d.getTime()) ? null : d;
  };

  // Base filtering logic
  const filteredTreks = useMemo(() => {
    return treks.filter((trek) => {
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

    for (const trek of filteredTreks) {
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
      {/* Hero Banner with Nepal Himalayan vibe - mobile optimized */}
      {!savedOnly && (
        <div className="bg-gradient-to-br from-[#1F1F1F] via-[#2A2521] to-[#1F1F1F] text-white rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden border border-neutral-800">
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Mountain className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10 w-full">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E08828]/20 border border-[#E08828]/40 text-[#F5A844] text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
              <Flame className="w-3 h-3 text-[#E08828] shrink-0" />
              <span>All season Himalayan treks & hikes</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
              Trek Schedule & Archive
            </h1>
            <p className="text-neutral-300 text-xs sm:text-sm mt-1 leading-relaxed font-semibold tracking-wider text-[#A8D878]">
              FITNESS . FUN . FRIENDSHIP
            </p>

            {/* Quick Mobile Roster Stats */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-[11px] text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                <span className="truncate">
                  <strong className="text-white">{upcomingTreks.length}</strong> Upcoming
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                <span className="truncate">
                  <strong className="text-white">{pastTreks.length}</strong> Completed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="truncate">Official Guides</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved header if in saved mode */}
      {savedOnly && (
        <div className="bg-white rounded-xl border border-[#F0EBE5] p-4 flex items-center justify-between shadow-xs">
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

        {/* Trip Type Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[#8B8680] font-medium text-[11px] flex items-center gap-1 mr-1 shrink-0">
            Trip:
          </span>
          {(
            [
              { id: 'all', label: 'All Types' },
              { id: 'day', label: '1 Day Hikes' },
              { id: 'overnight', label: 'Overnight Hikes' },
              { id: 'treks', label: 'Multi-Day Treks' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTripTypeFilter(item.id)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all shrink-0 active:scale-95 cursor-pointer ${
                tripTypeFilter === item.id
                  ? 'bg-[#7ABA42] text-white shadow-xs'
                  : 'bg-[#F9F7F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3F1ED]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Grade / Difficulty Tags */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#F0EBE5] text-xs">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[#8B8680] font-medium text-[11px] flex items-center gap-1 mr-1 shrink-0">
              <SlidersHorizontal className="w-3 h-3" /> Grade:
            </span>
            {(['all', 'easy', 'moderate', 'difficult'] as const).map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => setDifficultyFilter(diff)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize transition-all shrink-0 ${
                  difficultyFilter === diff
                    ? 'bg-[#1F1F1F] text-white'
                    : 'bg-[#F9F7F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3F1ED]'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-[#8B8680] font-medium ml-auto">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5 w-full">
                {upcomingTreks.map((trek) => (
                  <TrekCard
                    key={trek.id}
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

          {/* 2. PAST EVENTS AS LIST (Hidden by default, simple single line text toggle) */}
          {pastTreks.length > 0 && (
            <div className="pt-3 border-t border-[#F0EBE5]">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  id="toggle-past-events-archive-btn"
                  onClick={() => setShowPastEvents((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] py-1 transition-colors cursor-pointer group"
                  aria-expanded={showPastEvents}
                >
                  <History className="w-3.5 h-3.5 text-[#7ABA42] group-hover:scale-110 transition-transform shrink-0" />
                  <span>Past Events Archive ({pastTreks.length} Completed)</span>
                  <span className="text-[#8B8680] font-normal group-hover:text-[#5A5551]">
                    — {showPastEvents ? 'click to hide' : 'click to view'}
                  </span>
                  {showPastEvents ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#7ABA42]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#7ABA42]" />
                  )}
                </button>
              </div>

              {/* Collapsible Content */}
              {showPastEvents && (
                <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                    {pastTreks.slice(0, pastLimit).map((trek) => (
                      <PastEventListItem
                        key={trek.id}
                        trek={trek}
                        onViewItinerary={onViewItinerary}
                        onToggleFavorite={onToggleFavorite}
                        isFavorited={favorites.includes(trek.id)}
                        onLeaveFeedback={onLeaveFeedback}
                      />
                    ))}

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
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
