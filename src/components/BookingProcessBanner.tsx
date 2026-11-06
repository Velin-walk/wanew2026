import React from 'react';
import { ShieldCheck, Camera } from 'lucide-react';

export const BookingProcessBanner: React.FC = () => {
  return (
    <section
      aria-label="How to Join Walk Nepal Treks"
      className="bg-white rounded-2xl border border-[#E5E1DB] p-4 sm:p-5 shadow-2xs space-y-4 sm:space-y-5 w-full"
    >
      {/* Top Header Card - Inspired by design reference */}
      <div className="bg-[#FAF8F5] rounded-xl border border-[#EFEAE4] p-4 sm:p-5 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#7ABA42]/10 text-[#55862c] border border-[#7ABA42]/25">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7ABA42] animate-pulse" />
          <span>Registrations Open</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-[#1F1F1F] tracking-tight">
          How to <span className="text-[#7ABA42]">Join</span>
        </h3>

        <p className="text-xs sm:text-sm text-[#78726C]">
          Follow these simple steps to secure your spot on the trail
        </p>
      </div>

      {/* Steps Grid - Numbered boxes with title and description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Step 1 */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FAF8F5] border border-[#E5E1DB] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-3xs">
            1
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#1F1F1F] leading-snug">
              Pick day, destination, trail &amp; grade
            </h4>
            <p className="text-[11px] sm:text-xs text-[#78726C] leading-relaxed">
              View Itinerary.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FAF8F5] border border-[#E5E1DB] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-3xs">
            2
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#1F1F1F] leading-snug">
              Fill Registration Form
            </h4>
            <p className="text-[11px] sm:text-xs text-[#78726C] leading-relaxed">
              Receive WhatsApp confirmation.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FAF8F5] border border-[#E5E1DB] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-3xs">
            3
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#1F1F1F] leading-snug">
              Come to meetup point
            </h4>
            <p className="text-[11px] sm:text-xs text-[#78726C] leading-relaxed">
              Hike with the Team.
            </p>
          </div>
        </div>
      </div>

      {/* Reassurance Standards Ribbon */}
      <div className="pt-3 border-t border-[#F0EBE5]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-[#2C2825]">
          {/* Badge 1 */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7ABA42] shrink-0" />
            <span className="text-[11px] sm:text-xs leading-snug">
              <strong className="font-bold text-[#1F1F1F]">40%+ Female &amp; Solo Hikers</strong>{' '}
              <span className="text-[#6E6862]">in every group.</span>
            </span>
          </div>

          {/* Badge 2 */}
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[#E08828] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="5" width="20" height="15" rx="3" />
              <path d="M12 9v7" />
              <path d="M8.5 12.5h7" />
              <path d="M9 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span className="text-[11px] sm:text-xs leading-snug">
              <strong className="font-bold text-[#1F1F1F]">Wilderness First-Aid Kit &amp; Experienced Leaders</strong>{' '}
              <span className="text-[#6E6862]">on every trail.</span>
            </span>
          </div>

          {/* Badge 3 */}
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-stone-700 shrink-0" />
            <span className="text-[11px] sm:text-xs leading-snug">
              <strong className="font-bold text-[#1F1F1F]">Hike Photography &amp; Video Moments</strong>{' '}
              <span className="text-[#6E6862]">shared after every hike.</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
