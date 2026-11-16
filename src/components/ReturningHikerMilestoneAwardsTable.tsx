import React from 'react';
import {
  Award,
  Sparkles,
  Footprints,
  Mountain,
  Compass,
  Gem,
  Crown,
} from 'lucide-react';

interface ReturningHikerMilestoneAwardsTableProps {
  className?: string;
}

const MILESTONE_TIERS = [
  {
    km: 'After 100KM',
    title: 'Walker',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    icon: <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />,
    benefit: 'Milestone badge.',
    rowClass: 'hover:bg-slate-50/80',
  },
  {
    km: 'After 200KM',
    title: 'Hiker',
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-200',
    icon: <Footprints className="w-3 h-3 text-blue-600 shrink-0" />,
    benefit: 'Milestone badge.',
    rowClass: 'hover:bg-slate-50/80',
  },
  {
    km: 'After 300KM',
    title: 'Trekker',
    badgeClass: 'bg-violet-50 text-violet-900 border-violet-200',
    icon: <Mountain className="w-3 h-3 text-violet-600 shrink-0" />,
    benefit: 'Milestone badge.',
    rowClass: 'hover:bg-slate-50/80',
  },
  {
    km: 'After 400KM',
    title: 'Explorer',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
    icon: <Compass className="w-3 h-3 text-sky-600 shrink-0" />,
    benefit: '5% discount on eligible hikes and treks.',
    rowClass: 'bg-sky-50/25 hover:bg-sky-50/60',
  },
  {
    km: 'After 500KM',
    title: 'Trail Blazer',
    badgeClass: 'bg-orange-50 text-orange-900 border-orange-200',
    icon: <Sparkles className="w-3 h-3 text-orange-600 shrink-0" />,
    benefit: '10% discount on eligible hikes and treks from this level onwards.',
    rowClass: 'bg-orange-50/30 hover:bg-orange-50/60',
  },
  {
    km: 'After 1000KM',
    title: 'Trail Leader',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
    icon: <Gem className="w-3 h-3 text-purple-600 shrink-0" />,
    benefit: 'Eligible to apply for volunteer leadership and trek contribution opportunities.',
    rowClass: 'hover:bg-slate-50/80',
  },
  {
    km: 'After 1500KM',
    title: 'Senior Trail Leader',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    icon: <Award className="w-3 h-3 text-indigo-600 shrink-0" />,
    benefit: 'Priority consideration for senior responsibilities and paid or subsidized roles.',
    rowClass: 'hover:bg-slate-50/80',
  },
  {
    km: 'After 2000KM',
    title: 'Trail Ambassador',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    icon: <Crown className="w-3 h-3 text-amber-600 shrink-0" />,
    benefit: 'Recognition as a senior community contributor; eligible for advanced leadership, paid assignments and ambassador roles.',
    rowClass: 'bg-amber-50/35 hover:bg-amber-50/70',
  },
];

export const ReturningHikerMilestoneAwardsTable: React.FC<ReturningHikerMilestoneAwardsTableProps> = ({
  className = '',
}) => {
  return (
    <section
      aria-label="Returning Hiker Milestone Awards"
      className={`rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-[6px_6px_20px_#d1d9e6,-6px_-6px_20px_#ffffff] relative z-10 ${className}`}
    >
      <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#f0f4f9] border border-slate-200/80 shadow-[3px_3px_8px_#d1d9e6,-3px_-3px_8px_#ffffff] flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
              Returning Hiker Milestone Awards
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              Milestones, discounts &amp; leadership pathways by cumulative distance
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-[10px] font-black uppercase tracking-wider shrink-0">
          100KM – 2000KM
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600">
              <th className="py-2.5 pl-4 pr-2 sm:pl-6 sm:pr-4 whitespace-nowrap">Milestone</th>
              <th className="py-2.5 px-2 sm:px-4 whitespace-nowrap">Title</th>
              <th className="py-2.5 pl-2 pr-4 sm:pl-4 sm:pr-6">Recognition &amp; Benefits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 text-xs">
            {MILESTONE_TIERS.map((tier) => (
              <tr key={tier.title} className={`transition-colors ${tier.rowClass}`}>
                <td className="py-2.5 pl-4 pr-2 sm:pl-6 sm:pr-4 font-mono tabular-nums text-[11px] sm:text-xs font-black text-slate-700 whitespace-nowrap align-middle">
                  {tier.km}
                </td>
                <td className="py-2.5 px-2 sm:px-4 whitespace-nowrap align-middle">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] sm:text-[11px] font-bold ${tier.badgeClass}`}
                  >
                    {tier.icon}
                    <span>{tier.title}</span>
                  </span>
                </td>
                <td className="py-2.5 pl-2 pr-4 sm:pl-4 sm:pr-6 text-[11px] sm:text-xs font-medium text-slate-700 leading-snug align-middle">
                  {tier.benefit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
