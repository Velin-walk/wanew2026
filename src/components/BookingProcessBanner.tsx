import React from 'react';
import { ShieldCheck, Camera } from 'lucide-react';

export const BookingProcessBanner: React.FC = () => {
  return (
    <div className="relative w-full my-1">
      {/* Multi-layer Deck Foundation (creates 3D stacked box depth illusion beneath the section) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-3 -bottom-2 h-6 bg-[#E3DCD1]/80 rounded-2xl -z-20 border border-[#D6CFC3] shadow-xs"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-1.5 -bottom-1 h-6 bg-[#EFE9DF] rounded-2xl -z-10 border border-[#DFD8CC] shadow-xs"
      />

      <section
        aria-label="How to Join Walk Nepal Treks"
        className="relative bg-linear-to-b from-white via-[#FCFAF8] to-[#FBF8F3] rounded-2xl border border-[#DDD6CB] p-4 sm:p-5 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.08),0_4px_10px_-2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] space-y-4 sm:space-y-5 w-full"
      >
        {/* Top Header Card - Layered Box with under-layer slab */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[#E6DFD3] rounded-xl translate-y-1 -z-10 shadow-2xs"
          />
          <div className="relative bg-linear-to-b from-[#FCFBF9] to-[#F4EFE7] rounded-xl border border-[#DFD8CC] p-4 sm:p-5 space-y-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(0,0,0,0.03)]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#7ABA42]/10 text-[#55862c] border border-[#7ABA42]/25 shadow-3xs">
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
        </div>

        {/* Steps Grid - Multi-layer Box UI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Step 1 */}
          <div className="relative flex flex-col">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[#E5DFD4] rounded-xl translate-y-1 -z-10 shadow-2xs"
            />
            <div className="relative flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-linear-to-b from-white to-[#FAF8F5] border border-[#DDD5C7] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-transform duration-150 h-full">
              <div className="relative shrink-0 mt-0.5">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#D6CEBF] rounded-lg translate-y-0.5 -z-10"
                />
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-linear-to-b from-white to-[#F2EDE4] border border-[#D5CDC0] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  1
                </div>
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
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[#E5DFD4] rounded-xl translate-y-1 -z-10 shadow-2xs"
            />
            <div className="relative flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-linear-to-b from-white to-[#FAF8F5] border border-[#DDD5C7] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-transform duration-150 h-full">
              <div className="relative shrink-0 mt-0.5">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#D6CEBF] rounded-lg translate-y-0.5 -z-10"
                />
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-linear-to-b from-white to-[#F2EDE4] border border-[#D5CDC0] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  2
                </div>
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
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[#E5DFD4] rounded-xl translate-y-1 -z-10 shadow-2xs"
            />
            <div className="relative flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-linear-to-b from-white to-[#FAF8F5] border border-[#DDD5C7] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-transform duration-150 h-full">
              <div className="relative shrink-0 mt-0.5">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#D6CEBF] rounded-lg translate-y-0.5 -z-10"
                />
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-linear-to-b from-white to-[#F2EDE4] border border-[#D5CDC0] text-[#55862c] font-black text-xs sm:text-sm flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  3
                </div>
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
        </div>

        {/* Reassurance Standards Ribbon - Inset multi-layer tray */}
        <div className="relative pt-1">
          <div className="relative rounded-xl bg-linear-to-b from-[#F9F7F3] to-[#F1EBE1] p-3 sm:p-3.5 border border-[#E3DBD0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03),0_1px_0_rgba(255,255,255,0.9)]">
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
        </div>
      </section>
    </div>
  );
};
