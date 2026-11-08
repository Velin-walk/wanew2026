import React from 'react';
import { ShieldCheck, Camera } from 'lucide-react';

const steps = [
  { title: 'Pick day, destination, trail & grade', body: 'View Itinerary.' },
  { title: 'Fill Registration Form', body: 'Receive WhatsApp confirmation.' },
  { title: 'Come to meetup point', body: 'Hike with the Team.' },
];

export const BookingProcessBanner: React.FC = () => {
  return (
    <section
      aria-label="How to Join Walk Nepal Treks"
      className="relative w-full my-1 overflow-hidden rounded-2xl border border-[#E5E1DB] bg-[#F7F5F2] shadow-[0_12px_28px_-6px_rgba(0,0,0,0.08),0_4px_10px_-2px_rgba(0,0,0,0.03)]"
    >
      {/* Recessed header panel: heavy inner shadows from the top and sides make it look sunk into the frame */}
      <div
        className="relative m-2.5 sm:m-3 overflow-hidden rounded-xl bg-white border border-[#EFEAE4] px-4 py-5 sm:px-6 sm:py-6 space-y-1.5
        shadow-[inset_0_16px_26px_-8px_rgba(0,0,0,0.08),inset_0_6px_12px_-2px_rgba(0,0,0,0.05),inset_0_26px_36px_-20px_rgba(0,0,0,0.04),inset_6px_0_14px_-8px_rgba(0,0,0,0.03),inset_-6px_0_14px_-8px_rgba(0,0,0,0.03),inset_0_-1px_0_rgba(255,255,255,1)]"
      >
        {/* Top shade falloff */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-linear-to-b from-black/[0.05] to-transparent"
        />

        <div className="relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#7ABA42]/10 text-[#55862c] border border-[#7ABA42]/25 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7ABA42] animate-pulse" />
          <span>Registrations Open</span>
        </div>

        <h3 className="relative text-xl sm:text-2xl font-black text-[#1F1F1F] tracking-tight">
          How to <span className="text-[#7ABA42]">Join</span>
        </h3>

        <p className="relative text-xs sm:text-sm text-[#78726C]">
          Follow these simple steps to secure your spot on the trail
        </p>
      </div>

      {/* Steps: flat on the frame, with tinted bordered number chips */}
      <div className="px-4 sm:px-6 pt-2 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {steps.map((step, i) => (
          <div key={step.title} className="flex items-start gap-3 text-[#1F1F1F]">
            <span className="mt-0.5 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-md border border-[#7ABA42]/40 bg-[#7ABA42]/15 text-xs sm:text-sm font-black text-[#55862c] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold leading-snug">{step.title}</h4>
              <p className="text-[11px] sm:text-xs leading-relaxed text-[#78726C]">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reassurance ribbon: a second, shallower recess */}
      <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3">
        <div
          className="rounded-xl bg-white border border-[#EFEAE4] p-3 sm:p-3.5
          shadow-[inset_0_8px_14px_-6px_rgba(0,0,0,0.06),inset_0_2px_5px_-1px_rgba(0,0,0,0.04),inset_0_-1px_0_rgba(255,255,255,1)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-[#2C2825]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7ABA42] shrink-0" />
              <span className="text-[11px] sm:text-xs leading-snug">
                <strong className="font-bold text-[#1F1F1F]">40%+ Female &amp; Solo Hikers</strong>{' '}
                <span className="text-[#6E6862]">in every group.</span>
              </span>
            </div>

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
  );
};