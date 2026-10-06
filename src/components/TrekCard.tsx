import React, { useState, useMemo } from 'react';
import { Trek } from '../types';
import { ParticipantStack } from './ParticipantStack';
import { useAuth } from '../context/AuthContext';
import { TrekPhotosModal } from './TrekPhotosModal';
import { GuideProfileModal } from './GuideProfileModal';
import { MiniPrayerFlags } from './NepaliPrayerFlags';
import {
  Calendar,
  Clock,
  Mountain,
  Compass,
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  FileText,
  HelpCircle,
  AlertCircle,
  Ban,
  Camera,
} from 'lucide-react';

interface TrekCardProps {
  trek: Trek;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  onRegister: (trek: Trek) => void;
  onShare: (trek: Trek) => void;
  onViewItinerary?: (trek: Trek) => void;
  onViewFaq?: (trek: Trek) => void;
}

export const TrekCard: React.FC<TrekCardProps> = ({
  trek,
  isFavorited = false,
  onToggleFavorite,
  onRegister,
  onShare,
  onViewItinerary,
  onViewFaq,
}) => {
  const [showItinerary, setShowItinerary] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const { isAdmin } = useAuth();

  const isEventDayOrOnward = () => {
    if (!trek.date) return false;
    
    // Get current date at 00:00:00 local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse trek.date
    let trekDate: Date | null = null;

    if (trek.date.includes('-')) {
      const parts = trek.date.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          trekDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          trekDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    } else if (trek.date.includes('/')) {
      const parts = trek.date.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          trekDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          trekDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    } else {
      const parsed = Date.parse(trek.date);
      if (!isNaN(parsed)) {
        trekDate = new Date(parsed);
      }
    }

    if (!trekDate || isNaN(trekDate.getTime())) return false;
    trekDate.setHours(0, 0, 0, 0);

    return today.getTime() >= trekDate.getTime();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        }
      }
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  const getDifficultyBadge = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()?.trim()) {
      case 'easy':
        return {
          bg: 'bg-emerald-600 text-white border-emerald-700',
          text: 'text-emerald-600',
          label: 'Easy',
        };
      case 'moderate':
        return {
          bg: 'bg-amber-400 text-amber-950 border-amber-500',
          text: 'text-amber-600',
          label: 'Moderate',
        };
      case 'hard':
      case 'difficult':
        return {
          bg: 'bg-orange-600 text-white border-orange-700',
          text: 'text-orange-600',
          label: difficulty?.toLowerCase() === 'hard' ? 'Hard' : 'Difficult',
        };
      case 'extreme':
        return {
          bg: 'bg-red-600 text-white border-red-700',
          text: 'text-red-600',
          label: 'Extreme',
        };
      default:
        return {
          bg: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          text: 'text-neutral-600',
          label: difficulty || 'General',
        };
    }
  };

  const hasDbCustomData = trek.data && typeof trek.data === 'object' && (trek.data as any).title;
  const dbData = hasDbCustomData ? (trek.data as any) : null;
  const effectiveDifficulty = dbData?.overview?.difficulty || trek.difficulty;
  const effectiveDistance =
    dbData?.overview?.approxDistance ||
    trek.data?.overview?.approxDistance ||
    trek.distance ||
    '';

  const badge = getDifficultyBadge(effectiveDifficulty);
  const currentParticipants = trek.participants || 0;
  const execStatus = trek.data?.execution_status;
  const isCancelled = Boolean(trek.is_cancelled || trek.data?.is_cancelled || execStatus === 'Cancelled');
  const isCompleted = execStatus === 'Completed';
  const isClosedByAdmin = execStatus === 'Registration Closed';
  const isFull = currentParticipants >= trek.capacity;
  const isRegistrationDisabled = isFull || isCancelled || isCompleted || isClosedByAdmin;
  const fillPercentage = Math.min(100, Math.round((currentParticipants / Math.max(1, trek.capacity)) * 100));

  const getBorderColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()?.trim()) {
      case 'easy':
        return 'border-[#7ABA42]/75 hover:border-[#7ABA42]';
      case 'moderate':
        return 'border-yellow-400/75 hover:border-yellow-500';
      case 'hard':
      case 'difficult':
        return 'border-orange-500/75 hover:border-orange-600';
      case 'extreme':
        return 'border-red-600/75 hover:border-red-700';
      default:
        return 'border-[#D8D2C9] hover:border-[#8B8680]';
    }
  };

  const borderClass = getBorderColor(effectiveDifficulty);

  const getCalendarDaysLabel = (): string => {
    // 1. Prioritize configured Days (example 3D 2N) from Section 2 & 3
    if (dbData?.overview?.days && String(dbData.overview.days).trim()) {
      return String(dbData.overview.days).trim();
    }
    if ((trek as any)?.days_label && String((trek as any).days_label).trim()) {
      return String((trek as any).days_label).trim();
    }

    const rawDate = String(dbData?.hikeDate || trek.date || '').trim();
    if (!rawDate) return '1D';

    const parenMatch = rawDate.match(/\((\d+)\s*days?\)/i);
    if (parenMatch && parenMatch[1]) {
      const d = parseInt(parenMatch[1], 10);
      if (d > 1) return `${d}D ${d - 1}N`;
      if (d === 1) return '1D';
    }

    const cleanStr = rawDate.replace(/\(.*?\)/g, '').trim();
    const rangeParts = cleanStr.split(/\s*(?:[–—]|\bto\b)\s*|\s+-\s+/i);
    if (rangeParts.length === 2) {
      const yearMatch = cleanStr.match(/\b(20\d\d)\b/);
      const fallbackYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
      const stripWeekday = (s: string) =>
        s.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+/i, '').trim();

      const parsePart = (part: string): Date | null => {
        const s = stripWeekday(part);
        const withYear = /\b20\d\d\b/.test(s) ? s : `${s} ${fallbackYear}`;
        const parsed = new Date(withYear);
        if (!isNaN(parsed.getTime())) return parsed;
        return null;
      };

      const d1 = parsePart(rangeParts[0]);
      const d2 = parsePart(rangeParts[1]);
      if (d1 && d2) {
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 1) return `${diff}D ${diff - 1}N`;
        if (diff === 1) return '1D';
      }
    }

    return '1D';
  };

  const calendarDaysLabel = getCalendarDaysLabel();

  return (
    <div className={`bg-white rounded-2xl border-2 ${borderClass} shadow-[0_6px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.11)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between w-full max-w-full overflow-hidden`}>
      {/* Card Image */}
      <div className="relative h-40 sm:h-48 w-full overflow-hidden group">
        <img
          src={dbData?.cardImageUrl || trek.featured_image}
          alt={trek.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

        {/* Auspicious miniature prayer flag garland draped over card */}
        <div className="absolute -top-1 left-2 sm:left-3 w-28 xs:w-32 sm:w-36 z-20 pointer-events-none drop-shadow-md">
          <MiniPrayerFlags variant="draped" count={5} />
        </div>
        
        {/* Price Tag */}
        {trek.price && (
          <div className="absolute bottom-3 right-3 bg-[#E08828] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm border border-white/20">
            {trek.price}
          </div>
        )}

        {/* Favorite Button on Image */}
        <button
          type="button"
          onClick={() => onToggleFavorite?.(trek.id)}
          className={`absolute top-3 right-3 p-2 rounded-xl transition-all active:scale-90 shadow-md ${
            isFavorited
              ? 'text-rose-500 bg-white border border-rose-200'
              : 'text-white bg-black/20 hover:bg-white hover:text-rose-500 backdrop-blur-md border border-white/30'
          }`}
          title={isFavorited ? 'Remove from favorites' : 'Save trek'}
          aria-label="Toggle Favorite"
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500' : ''}`} />
        </button>
      </div>

      <div className="p-3.5 sm:p-4">
        {/* Card Top */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {trek.is_cancelled ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                  <Ban className="w-3 h-3 text-rose-600" /> Cancelled
                </span>
              ) : (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.bg}`}
                >
                  {badge.label}
                </span>
              )}
              {trek.hike_number && (
                <span className="text-[10px] font-bold text-[#5A5551] bg-[#F4EFEA] px-2 py-0.5 rounded-md border border-[#E5E1DB]">
                  Hike #{trek.hike_number}
                </span>
              )}
              {(effectiveDistance || trek.elevation) && (
                <span className="text-[10px] font-semibold text-[#8B8680] flex items-center gap-0.5 bg-[#F9F7F5] px-1.5 py-0.5 rounded-md border border-[#E5E1DB]">
                  <Mountain className="w-3 h-3 text-[#E08828]" />
                  {[effectiveDistance, trek.elevation].filter(Boolean).join(' ')}
                </span>
              )}
            </div>

            {trek.is_cancelled && trek.cancellation_reason && (
              <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug font-medium">
                  <strong>Notice:</strong> {trek.cancellation_reason}
                </span>
              </div>
            )}

            <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F] leading-snug">
              {trek.name}
            </h3>

            <div className="flex items-center gap-2.5 text-xs text-[#8B8680] mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                {formatDate(trek.date)}
              </span>
              {trek.start_location && (
                <span className="flex items-center gap-1 truncate max-w-[160px] font-medium">
                  <Compass className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                  {trek.start_location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-1.5 my-3 py-2 px-2.5 bg-[#F5F2ED] rounded-xl border border-[#E2DDD5] text-center">
          <div>
            <span className="text-[9px] font-bold uppercase text-[#8B8680] tracking-wider block truncate">
              Duration
            </span>
            <span className="text-xs font-bold text-[#1F1F1F] flex items-center justify-center gap-1 mt-0.5 truncate">
              <Clock className="w-3 h-3 text-[#E08828] shrink-0" />
              <span className="truncate">{trek.days}</span>
            </span>
          </div>

          <div className="border-x border-[#E5E1DB]">
            <span className="text-[9px] font-bold uppercase text-[#8B8680] tracking-wider block">
              Days
            </span>
            <span className="text-xs font-bold text-[#1F1F1F] mt-0.5 block truncate">
              {calendarDaysLabel}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase text-[#8B8680] tracking-wider block">
              Slots
            </span>
            <span className="text-xs font-bold text-[#1F1F1F] mt-0.5 block">
              {currentParticipants}/{trek.capacity}
            </span>
          </div>
        </div>

        {/* Capacity Bar */}
        <div className="mb-2.5">
          <div className="w-full bg-[#E5E1DB] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                fillPercentage > 90
                  ? 'bg-[#EF4444]'
                  : fillPercentage > 70
                  ? 'bg-[#E08828]'
                  : 'bg-[#7ABA42]'
              }`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#8B8680] mt-1">
            <span>Roster status</span>
            <span className="font-semibold text-[#1F1F1F]">
              {trek.capacity - currentParticipants > 0
                ? `${trek.capacity - currentParticipants} spots left`
                : 'Full roster'}
            </span>
          </div>
        </div>

        {/* Participant Stack */}
        <ParticipantStack
          participantsCount={trek.participants_by_gender}
          recentParticipants={trek.recent_participants}
          totalCount={currentParticipants}
          trekName={trek.name}
          hikeNumber={trek.hike_number}
          trekId={trek.id}
        />

        {/* Leader Info */}
        {trek.leader && (
          <div className="flex items-center justify-between gap-1.5 text-[11px] text-[#5A5551] pt-1.5 border-t border-[#F0EBE5]">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="font-medium text-[#8B8680]">Lead Guide:</span>
              <button
                type="button"
                onClick={() => setGuideModalOpen(true)}
                className="font-bold text-[#E08828] hover:text-[#C86B1A] underline decoration-[#E08828]/60 hover:decoration-[#C86B1A] underline-offset-2 transition-colors truncate cursor-pointer text-left"
                title={`View guide profile for ${trek.leader}`}
              >
                <span className="truncate">{trek.leader}</span>
              </button>
            </div>
            
            {/* Photos / Gallery Button */}
            <button
              type="button"
              onClick={() => setPhotosOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF8F0] hover:bg-[#FFEEDD] border border-[#E08828]/40 hover:border-[#E08828]/70 text-[#E08828] font-bold text-[10px] rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Gallery</span>
            </button>
          </div>
        )}

        {/* In-card text itinerary if available */}
        {trek.itinerary && (
          <div className="mt-1.5 text-xs">
            <button
              type="button"
              onClick={() => setShowItinerary(!showItinerary)}
              className="text-[#E08828] hover:text-[#C86B1A] font-semibold flex items-center gap-1 py-1 text-[11px]"
            >
              {showItinerary ? (
                <>
                  Hide Overview <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Quick Summary <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
            {showItinerary && (
              <div className="mt-1.5 p-2.5 bg-[#F9F7F5] rounded-xl border border-[#F0EBE5] text-[#5A5551] whitespace-pre-line leading-relaxed text-[11px]">
                {trek.itinerary}
              </div>
            )}
          </div>
        )}
      </div>

      <TrekPhotosModal
        isOpen={photosOpen}
        onClose={() => setPhotosOpen(false)}
        trek={trek}
      />

      {trek.leader && (
        <GuideProfileModal
          isOpen={guideModalOpen}
          onClose={() => setGuideModalOpen(false)}
          guideName={trek.leader}
          currentTrek={trek}
        />
      )}

      {/* Action Buttons */}
      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1">
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#F0EBE5]">
          <button
            type="button"
            id={`trek-card-itinerary-btn-${trek.id}`}
            onClick={() => onViewItinerary?.(trek)}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 text-xs font-black text-[#E08828] bg-[#FFF8F0] hover:bg-[#FFEEDD] border-2 border-[#E08828]/30 hover:border-[#E08828]/60 rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer select-none group"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" />
            <span>Itinerary</span>
          </button>

          <button
            type="button"
            id={`trek-card-invite-btn-${trek.id}`}
            onClick={() => onShare(trek)}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 text-xs font-bold text-[#4A4540] bg-[#FAF8F5] hover:bg-white border-2 border-[#E5E1DB] hover:border-[#C8C2B8] rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer select-none group"
          >
            <Share2 className="w-3.5 h-3.5 text-[#E08828] shrink-0 transition-transform group-hover:scale-110" />
            <span>Invite</span>
          </button>

          <button
            type="button"
            id={`trek-card-register-btn-${trek.id}`}
            disabled={isRegistrationDisabled}
            onClick={() => onRegister(trek)}
            className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 text-xs font-black rounded-xl transition-all shadow-sm select-none ${
              isCancelled
                ? 'bg-rose-100 text-rose-700 border-2 border-rose-300 cursor-not-allowed opacity-90'
                : isRegistrationDisabled
                ? 'bg-[#8B8680] text-white cursor-not-allowed opacity-75'
                : 'bg-[#FC4C02] hover:bg-[#E03E00] hover:shadow-md active:scale-95 text-white cursor-pointer ring-2 ring-[#FC4C02]/25 shadow-orange-500/20'
            }`}
          >
            <span>
              {isCancelled
                ? 'Cancelled'
                : isCompleted
                ? 'Completed'
                : isFull
                ? 'Waitlist'
                : isClosedByAdmin
                ? 'Closed'
                : 'Register'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
