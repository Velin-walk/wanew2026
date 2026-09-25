import React, { useMemo } from 'react';
import { X } from 'lucide-react';

export interface ReviewItem {
  id: string;
  full_name: string;
  trek_name: string;
  hike_number?: string;
  overall_rating: number;
  team_rating: number;
  overall_feedback: string;
  team_feedback?: string;
  submitted_at: string;
  is_verified?: boolean;
}

interface ReviewsAnalyticsBoardProps {
  reviews: ReviewItem[];
  selectedTrek?: string;
  onSelectTrek?: (trekName: string) => void;
  onSelectRating?: (rating: number | 'all') => void;
  selectedRating?: number | 'all';
}

export const ReviewsAnalyticsBoard: React.FC<ReviewsAnalyticsBoardProps> = ({
  reviews,
  selectedTrek,
  onSelectTrek,
  onSelectRating,
  selectedRating,
}) => {
  // Global Satisfaction Stats
  const globalStats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        avgScore: '5.0',
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.overall_rating) || 5))) as 1 | 2 | 3 | 4 | 5;
      counts[star]++;
      sum += Number(r.overall_rating) || 5;
    });

    const avgScore = (sum / total).toFixed(1);
    const percentages = {
      5: Math.round((counts[5] / total) * 100),
      4: Math.round((counts[4] / total) * 100),
      3: Math.round((counts[3] / total) * 100),
      2: Math.round((counts[2] / total) * 100),
      1: Math.round((counts[1] / total) * 100),
    };

    return { avgScore, total, distribution: counts, percentages };
  }, [reviews]);

  // Recent 10 Unique Treks from the chronological dataset (latest first)
  const recent10Treks = useMemo(() => {
    const treks: string[] = [];
    const seen = new Set<string>();

    for (const r of reviews) {
      const name = (r.trek_name || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        treks.push(name);
        if (treks.length >= 10) break;
      }
    }
    return treks;
  }, [reviews]);

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Top Row: Two Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Card: GLOBAL SATISFACTION */}
        <div className="lg:col-span-4 p-5 rounded-3xl bg-white border border-[#E5E1DB] shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-bold tracking-wider text-[#8B8680] uppercase">
              Global Satisfaction
            </h3>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold text-[#1F1F1F] tracking-tight leading-none">
                {globalStats.avgScore}
              </span>
              <span className="text-xl font-semibold text-[#8B8680]">/ 5.0</span>
            </div>

            <p className="text-[10px] font-medium tracking-wide text-[#8B8680] mt-1.5">
              Based on {globalStats.total} verified responses
            </p>
          </div>

          {/* Star Distribution Breakdown */}
          <div className="mt-5 space-y-2">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = globalStats.distribution[star];
              const pct = globalStats.percentages[star];
              const isSelected = selectedRating === star;

              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => onSelectRating && onSelectRating(isSelected ? 'all' : star)}
                  className={`w-full flex items-center gap-2.5 group text-left cursor-pointer transition-all rounded-md px-2 py-1 ${
                    isSelected ? 'bg-amber-50/80 ring-1 ring-amber-200' : 'hover:bg-[#FAF8F5]'
                  }`}
                  title={`Filter by ${star} star reviews (${count})`}
                >
                  <span className="text-[11px] font-semibold text-[#1F1F1F] w-3 shrink-0">{star}</span>
                  <div className="h-1.5 rounded-full bg-[#FEF3C7]/40 overflow-hidden flex-1 relative">
                    <div
                      className="h-full rounded-full bg-[#F59E0B] transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-[#6B6661] w-8 text-right shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Card: RECENT 10 TREKS */}
        <div className="lg:col-span-8 p-5 rounded-3xl bg-white border border-[#E5E1DB] shadow-2xs flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[10px] font-bold tracking-wider text-[#8B8680] uppercase">
              Recent 10 Treks
            </h3>
            {selectedTrek && (
              <button
                type="button"
                onClick={() => onSelectTrek && onSelectTrek('')}
                className="text-[10px] font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/60 cursor-pointer"
              >
                <span>Filtered: {selectedTrek.slice(0, 24)}</span>
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-wrap gap-1.5 content-start overflow-y-auto max-h-[190px] pr-1 scrollbar-thin">
            {recent10Treks.map((trek) => {
              const isSelected = selectedTrek?.toLowerCase() === trek.toLowerCase();
              return (
                <button
                  key={trek}
                  type="button"
                  onClick={() => onSelectTrek && onSelectTrek(isSelected ? '' : trek)}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-medium transition-all text-left truncate max-w-[240px] cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1F1F1F] text-white border-[#1F1F1F] shadow-xs'
                      : 'bg-[#FAF9F6] text-[#4A4540] border-[#EBE8E2] hover:bg-[#F2EFE9] hover:border-[#DFDAD2]'
                  }`}
                  title={`Filter by ${trek}`}
                >
                  {trek}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
