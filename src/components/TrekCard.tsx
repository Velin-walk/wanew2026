import React, { useState } from 'react';
import { Trek } from '../types';
import { ParticipantStack } from './ParticipantStack';
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
    switch (difficulty?.toLowerCase()) {
      case 'easy':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Easy',
        };
      case 'moderate':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'Moderate',
        };
      case 'difficult':
      case 'hard':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          label: 'Difficult',
        };
      default:
        return {
          bg: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          label: difficulty || 'General',
        };
    }
  };

  const badge = getDifficultyBadge(trek.difficulty);
  const currentParticipants = trek.participants || 0;
  const isFull = currentParticipants >= trek.capacity;
  const fillPercentage = Math.min(100, Math.round((currentParticipants / trek.capacity) * 100));

  return (
    <div className="bg-white rounded-2xl border border-[#D8D2C9] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between w-full max-w-full overflow-hidden">
      {/* Card Image */}
      <div className="relative h-40 sm:h-48 w-full overflow-hidden group">
        <img
          src={trek.featured_image}
          alt={trek.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
        
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
              {trek.elevation && (
                <span className="text-[10px] font-semibold text-[#8B8680] flex items-center gap-0.5 bg-[#F9F7F5] px-1.5 py-0.5 rounded-md border border-[#E5E1DB]">
                  <Mountain className="w-3 h-3 text-[#E08828]" />
                  {trek.elevation}
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
              Type / Duration
            </span>
            <span className="text-xs font-bold text-[#1F1F1F] flex items-center justify-center gap-1 mt-0.5 truncate">
              <Clock className="w-3 h-3 text-[#E08828] shrink-0" />
              <span className="truncate">{trek.days}</span>
            </span>
          </div>

          <div className="border-x border-[#E5E1DB]">
            <span className="text-[9px] font-bold uppercase text-[#8B8680] tracking-wider block">
              Grade
            </span>
            <span className="text-xs font-bold capitalize text-[#1F1F1F] mt-0.5 block truncate">
              {trek.difficulty}
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
        />

        {/* Leader Info */}
        {trek.leader && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#5A5551] pt-1.5 border-t border-[#F0EBE5]">
            <UserCheck className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
            <span className="font-medium text-[#8B8680]">Lead Guide:</span>
            <span className="font-semibold text-[#1F1F1F] truncate">{trek.leader}</span>
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

      {/* Action Buttons */}
      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1">
        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#F0EBE5]">
          <button
            type="button"
            onClick={() => onViewItinerary?.(trek)}
            className="flex items-center justify-center gap-1 min-h-[42px] px-1 text-xs font-semibold text-[#E08828] bg-[#E08828]/10 hover:bg-[#E08828]/15 border border-[#E08828]/20 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Itinerary</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(trek)}
            className="flex items-center justify-center gap-1.5 min-h-[42px] px-1 text-xs font-semibold text-[#5A5551] bg-[#F9F7F5] hover:bg-[#F0ECE7] border border-[#E5E1DB] rounded-xl active:scale-[0.98] transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
            <span>Invite</span>
          </button>

          <button
            type="button"
            disabled={isFull || trek.is_cancelled}
            onClick={() => onRegister(trek)}
            className={`flex items-center justify-center gap-1.5 min-h-[42px] px-1 text-xs font-bold rounded-xl transition-all text-white cursor-pointer ${
              trek.is_cancelled
                ? 'bg-rose-400 cursor-not-allowed opacity-80'
                : isFull
                ? 'bg-[#8B8680] cursor-not-allowed opacity-70'
                : 'bg-[#7ABA42] hover:bg-[#6CA838] active:scale-[0.98] shadow-xs'
            }`}
          >
            <span>{trek.is_cancelled ? 'Cancelled' : isFull ? 'Waitlist' : 'Register'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
