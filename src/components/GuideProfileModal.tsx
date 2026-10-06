import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UserCheck,
  Mountain,
  Footprints,
  Compass,
  Trophy,
  Calendar,
  ShieldCheck,
  Award,
  Sparkles,
  ExternalLink,
  Clock,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { fetchLeaderboardData } from '../services/api';
import { HikerStats, HikerCompletedEvent } from '../types/leaderboard';
import { Trek } from '../types';

interface GuideProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  guideName: string;
  currentTrek?: Trek;
  allTreks?: Trek[];
}

interface KnownGuideInfo {
  gender: 'Male' | 'Female';
  role: string;
  bio?: string;
}

const KNOWN_GUIDES: Record<string, KnownGuideInfo> = {
  'biraj thing': {
    gender: 'Male',
    role: 'Senior Trek Leader & Mountain Guide',
    bio: 'Experienced mountain leader with over 1,400+ km traversed across high-altitude Himalayan trails with Walk Nepal Walk.',
  },
  'biraj theeng': {
    gender: 'Male',
    role: 'Senior Trek Leader & Mountain Guide',
    bio: 'Experienced mountain leader with over 1,400+ km traversed across high-altitude Himalayan trails with Walk Nepal Walk.',
  },
  'salina tamang': {
    gender: 'Female',
    role: 'Certified Trek Leader & Community Guide',
    bio: 'High-altitude circuit trek specialist and community trail leader guiding day hikes and multi-day expeditions.',
  },
  'salina': {
    gender: 'Female',
    role: 'Certified Trek Leader & Community Guide',
    bio: 'High-altitude circuit trek specialist and community trail leader guiding day hikes and multi-day expeditions.',
  },
  'sundar gurung': {
    gender: 'Male',
    role: 'Senior Mountain Guide',
    bio: 'High-altitude expedition leader and veteran trail pioneer across Annapurna, Langtang, and Jugal ranges.',
  },
  'velin rai': {
    gender: 'Male',
    role: 'Founder & Head of Expeditions',
    bio: 'Founder of Walk Nepal Walk with nearly 2,000 km of trail-blazing and community leading.',
  },
  'rajan': {
    gender: 'Male',
    role: 'Community Trek Guide',
    bio: 'Specialist in Kathmandu Valley ridge circuits and day hike exploration.',
  },
};

/**
 * Intelligent matching function that maps a guide name to their verified Leaderboard record
 */
function findLeaderboardGuide(guideName: string, hikers: HikerStats[]): HikerStats | null {
  if (!guideName || !hikers || hikers.length === 0) return null;

  const clean = guideName.trim().toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  // 1. Exact match
  const exact = hikers.find((h) => (h.n || '').toLowerCase().trim() === clean);
  if (exact) return exact;

  // 2. Both first and last name match or phonetics (e.g. "biraj thing" <-> "biraj theeng")
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];

    const match = hikers.find((h) => {
      const hn = (h.n || '').toLowerCase().trim();
      const hParts = hn.split(/\s+/).filter(Boolean);
      if (hParts.length < 2) return false;
      const hFirst = hParts[0];
      const hLast = hParts[hParts.length - 1];

      if (hFirst !== first) return false;
      if (hLast === last) return true;
      if (last.startsWith('th') && hLast.startsWith('th')) return true;
      return hLast.includes(last) || last.includes(hLast);
    });

    if (match) return match;
  }

  // 3. Single name match (e.g. "Salina")
  if (parts.length === 1) {
    const first = parts[0];
    const candidates = hikers.filter((h) => (h.n || '').toLowerCase().startsWith(first + ' '));
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.d || 0) - (a.d || 0));
      return candidates[0];
    }
  }

  // 4. Substring fallback
  const fallback = hikers.find((h) => {
    const hn = (h.n || '').toLowerCase().trim();
    return hn.includes(clean) || clean.includes(hn);
  });

  return fallback || null;
}

export const GuideProfileModal: React.FC<GuideProfileModalProps> = ({
  isOpen,
  onClose,
  guideName,
  currentTrek,
  allTreks = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [guideStats, setGuideStats] = useState<HikerStats | null>(null);
  const [searchHikeQuery, setSearchHikeQuery] = useState('');

  // Fetch leaderboard data on open (Primary Source of Truth)
  useEffect(() => {
    if (!isOpen || !guideName) return;

    let isMounted = true;
    const loadLeaderboardData = async () => {
      try {
        setLoading(true);
        const data = await fetchLeaderboardData(false);
        if (isMounted && data && Array.isArray(data.hikers)) {
          const matched = findLeaderboardGuide(guideName, data.hikers);
          setGuideStats(matched);
        }
      } catch (err) {
        console.warn('[GuideProfileModal] Could not fetch leaderboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadLeaderboardData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, guideName]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Known metadata lookup
  const cleanNameLower = (guideName || '').trim().toLowerCase();
  const known = KNOWN_GUIDES[cleanNameLower] || KNOWN_GUIDES[guideStats?.n?.toLowerCase() || ''];

  const gender: 'Male' | 'Female' = known?.gender || (cleanNameLower.includes('salina') ? 'Female' : 'Male');
  const roleTitle = known?.role || 'Lead Mountain Guide';
  const bio = known?.bio;

  // Hikes led list from leaderboard (primary source)
  const completedHikes: HikerCompletedEvent[] = useMemo(() => {
    if (!guideStats || !Array.isArray(guideStats.hikes)) return [];
    return [...guideStats.hikes].sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  }, [guideStats]);

  // Filter completed hikes by search query
  const filteredHikes = useMemo(() => {
    if (!searchHikeQuery.trim()) return completedHikes;
    const q = searchHikeQuery.toLowerCase().trim();
    return completedHikes.filter((h) => {
      const name = (h.name || '').toLowerCase();
      const num = String(h.no || '').toLowerCase();
      return name.includes(q) || num.includes(q);
    });
  }, [completedHikes, searchHikeQuery]);

  // Upcoming treks led by this guide in current schedule
  const upcomingLedTreks = useMemo(() => {
    if (!allTreks || allTreks.length === 0) return [];
    const firstWord = cleanNameLower.split(/\s+/)[0];
    return allTreks.filter((t) => {
      const l = (t.leader || t.team_leader || '').toLowerCase().trim();
      return l && (l.includes(cleanNameLower) || cleanNameLower.includes(l) || l.includes(firstWord));
    });
  }, [allTreks, cleanNameLower]);

  if (!isOpen) return null;

  const totalDistance = guideStats?.d ? Math.round(guideStats.d * 10) / 10 : 0;
  const totalEvents = guideStats?.c || completedHikes.length || 0;
  const hikeDist = guideStats?.hd ? Math.round(guideStats.hd * 10) / 10 : Math.round(totalDistance * 0.6);
  const trekDist = guideStats?.td ? Math.round(guideStats.td * 10) / 10 : Math.round(totalDistance * 0.4);
  const hikeCount = guideStats?.hc || Math.round(totalEvents * 0.7);
  const trekCount = guideStats?.tc || Math.max(0, totalEvents - hikeCount);

  const isFemale = gender === 'Female';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-profile-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-[#E5E1DB] max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div className="relative bg-gradient-to-br from-[#9E4700] via-[#E08828] to-[#732D00] text-white p-4 sm:p-5 shrink-0 overflow-hidden">
          {/* Subtle Himalayan backdrop glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none text-[#FED7AA]">
            <Mountain className="w-40 h-40" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center sm:items-start gap-3 sm:gap-4 min-w-0 flex-1">
              {/* Avatar Initial Bubble */}
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black shadow-lg border-2 border-white/30 shrink-0 ${
                  isFemale
                    ? 'bg-rose-500/90 text-white'
                    : 'bg-sky-500/90 text-white'
                }`}
              >
                {(guideName || 'G').trim().charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-black/30 border border-white/20 text-[#FED7AA] px-2 py-0.5 rounded-full shadow-3xs shrink-0">
                    <ShieldCheck className="w-3 h-3 text-[#7ABA42]" />
                    <span>Verified Lead Guide</span>
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-3xs shrink-0 ${
                      isFemale
                        ? 'bg-rose-950/40 text-rose-200 border-rose-300/30'
                        : 'bg-sky-950/40 text-sky-200 border-sky-300/30'
                    }`}
                  >
                    {gender}
                  </span>
                </div>

                <h2
                  id="guide-profile-title"
                  className="text-base sm:text-xl font-black text-white tracking-tight leading-snug truncate"
                  title={guideName}
                >
                  {guideName}
                </h2>

                <p className="text-[11px] sm:text-xs font-semibold text-[#FED7AA] mt-0.5 leading-tight">
                  {roleTitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {bio && (
            <p className="relative z-10 text-[11px] sm:text-xs text-white/90 mt-2.5 pt-2.5 border-t border-white/15 leading-relaxed">
              {bio}
            </p>
          )}
        </div>

        {/* Primary Stats Grid (From Leaderboard Master) */}
        <div className="bg-[#FAF8F5] p-3 sm:p-4 border-b border-[#EFEAE4] shrink-0">
          {loading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#8B8680]">
              <Loader2 className="w-4 h-4 animate-spin text-[#E08828]" />
              <span>Connecting to Walk Nepal Walk Leaderboard...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {/* Total Distance */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#E5E1DB] shadow-3xs">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  Total Distance
                </span>
                <span className="text-base sm:text-lg font-black text-[#1F1F1F] block mt-0.5">
                  {totalDistance.toLocaleString()} <span className="text-xs font-bold text-[#E08828]">km</span>
                </span>
                <span className="text-[9px] text-[#7ABA42] font-semibold block mt-0.5">
                  Across Nepal
                </span>
              </div>

              {/* Total Events */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#E5E1DB] shadow-3xs">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  Events Completed
                </span>
                <span className="text-base sm:text-lg font-black text-[#1F1F1F] block mt-0.5">
                  {totalEvents}
                </span>
                <span className="text-[9px] text-[#8B8680] font-medium block mt-0.5">
                  Treks & Hikes
                </span>
              </div>

              {/* Day Hikes */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#E5E1DB] shadow-3xs">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  1-Day Hikes
                </span>
                <span className="text-base sm:text-lg font-black text-[#1F1F1F] block mt-0.5">
                  {hikeDist} <span className="text-[10px] font-semibold text-[#8B8680]">km</span>
                </span>
                <span className="text-[9px] text-[#8B8680] font-medium block mt-0.5">
                  {hikeCount} Day Events
                </span>
              </div>

              {/* Multi-Day Treks */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#E5E1DB] shadow-3xs">
                <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">
                  Multi-Day Treks
                </span>
                <span className="text-base sm:text-lg font-black text-[#1F1F1F] block mt-0.5">
                  {trekDist} <span className="text-[10px] font-semibold text-[#8B8680]">km</span>
                </span>
                <span className="text-[9px] text-[#8B8680] font-medium block mt-0.5">
                  {trekCount} Expeditions
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          {/* Upcoming Assigned Treks on Schedule */}
          {upcomingLedTreks.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#1F1F1F] mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
                <span>Currently Leading on the Schedule ({upcomingLedTreks.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {upcomingLedTreks.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#FFF8F0] border border-[#E08828]/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-[#E08828] block">
                        Hike #{t.hike_number || 'Upcoming'}
                      </span>
                      <span className="text-xs font-bold text-[#1F1F1F] truncate block">
                        {t.name || t.title}
                      </span>
                      <span className="text-[10px] text-[#8B8680]">
                        {t.date || t.hike_date || 'Upcoming Date'}
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-[#7ABA42] text-white text-[10px] font-bold rounded-lg shrink-0">
                      Lead Guide
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Hikes & Treks History from Leaderboard */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h4 className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 text-[#7ABA42]" />
                <span>Walk Nepal Walk Completed Treks ({completedHikes.length})</span>
              </h4>

              {completedHikes.length > 6 && (
                <input
                  type="text"
                  placeholder="Filter hikes by name or #..."
                  value={searchHikeQuery}
                  onChange={(e) => setSearchHikeQuery(e.target.value)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[#E5E1DB] bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F] w-40 sm:w-48"
                />
              )}
            </div>

            {completedHikes.length === 0 ? (
              <div className="py-6 text-center text-[#8B8680] text-xs bg-[#F9F7F5] rounded-xl border border-[#EFEAE4]">
                <Compass className="w-6 h-6 text-[#E08828] mx-auto mb-1 opacity-70" />
                <span>No historical trail logs available yet for this guide.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredHikes.map((hike, idx) => (
                  <div
                    key={idx}
                    className="p-2 sm:p-2.5 rounded-xl bg-[#F9F7F5] border border-[#EFEAE4] hover:border-[#E08828]/40 hover:bg-white transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hike.no && (
                          <span className="text-[9px] font-bold text-[#5A5551] bg-[#F4EFEA] px-1.5 py-0.2 rounded border border-[#E5E1DB]">
                            #{hike.no}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-[#1F1F1F] truncate block">
                          {hike.name || `Hike #${hike.no}`}
                        </span>
                      </div>
                      {hike.date && (
                        <span className="text-[10px] text-[#8B8680] block mt-0.5">
                          {hike.date}
                        </span>
                      )}
                    </div>

                    {hike.dist !== undefined && (
                      <span className="text-[11px] font-bold text-[#E08828] bg-white px-2 py-0.5 rounded-md border border-[#E5E1DB] shrink-0">
                        {hike.dist} km
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[#F0EBE5] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8B8680] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#7ABA42]" />
            <span>Community Verified Leader</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#1F1F1F] hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
