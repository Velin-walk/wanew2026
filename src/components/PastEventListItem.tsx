import React from 'react';
import { Trek } from '../types';
import { Calendar, UserCheck, FileText, ExternalLink, CheckCircle, Star } from 'lucide-react';

interface PastEventListItemProps {
  trek: Trek;
  onViewItinerary?: (trek: Trek) => void;
  onToggleFavorite?: (id: string) => void;
  isFavorited?: boolean;
  onLeaveFeedback?: (trek: Trek) => void;
}

export const PastEventListItem: React.FC<PastEventListItemProps> = ({
  trek,
  onViewItinerary,
  onLeaveFeedback,
}) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Past Event';
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
            year: 'numeric',
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
          year: 'numeric',
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'difficult':
      case 'hard':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  return (
    <div className="bg-white border border-[#EFEAE4] rounded-xl p-3 sm:p-3.5 hover:border-[#E08828]/40 hover:bg-[#FDFBF9] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      {/* Left: Hike info & metadata */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Date block */}
        <div className="bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl px-2.5 py-1.5 text-center shrink-0 min-w-[76px]">
          <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block">
            Completed
          </span>
          <span className="text-xs font-bold text-[#1F1F1F] block whitespace-nowrap mt-0.5">
            {formatDate(trek.date)}
          </span>
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {trek.hike_number && (
              <span className="text-[10px] font-bold text-[#5A5551] bg-[#F4EFEA] px-1.5 py-0.5 rounded border border-[#E5E1DB]">
                Hike #{trek.hike_number}
              </span>
            )}
            <span
              className={`text-[10px] font-semibold capitalize px-1.5 py-0.2 rounded border ${getDifficultyBadge(
                trek.difficulty
              )}`}
            >
              {trek.difficulty}
            </span>
            <span className="text-[10px] text-[#8B8680] font-medium bg-[#F9F7F5] px-1.5 py-0.2 rounded border border-[#EFEAE4] truncate max-w-[140px]">
              {trek.days}
            </span>
          </div>

          <h4 className="text-sm sm:text-base font-bold text-[#1F1F1F] truncate">
            {trek.name}
          </h4>

          <div className="flex items-center gap-3 text-[11px] text-[#8B8680] mt-0.5 flex-wrap">
            {trek.leader && (
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#7ABA42] shrink-0" />
                <span>Guide: <strong className="text-[#5A5551] font-semibold">{trek.leader}</strong></span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[#8B8680]">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>Concluded</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      {onLeaveFeedback && (
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => onLeaveFeedback(trek)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#4c8c4a] hover:text-[#2e7d32] bg-[#7ABA42]/10 hover:bg-[#7ABA42]/20 border border-[#7ABA42]/30 rounded-lg transition-all cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Rate Trek</span>
          </button>
        </div>
      )}
    </div>
  );
};
