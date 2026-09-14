import React from 'react';
import { ParticipantCount } from '../types';

interface ParticipantStackProps {
  participantsCount?: ParticipantCount;
  recentParticipants?: Array<{ name: string; gender: 'm' | 'f' }>;
}

export const ParticipantStack: React.FC<ParticipantStackProps> = ({
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
}) => {
  const avatars = recentParticipants.slice(0, 8);
  const totalParticipants = participantsCount.total || recentParticipants.length || 0;
  const overflow = Math.max(0, totalParticipants - avatars.length);

  if (totalParticipants === 0 && avatars.length === 0) {
    return (
      <div className="my-2.5 py-1.5 px-2.5 bg-[#F9F7F5] rounded-lg border border-[#EFEAE4] flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#5A5551] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Roster Open
        </span>
        <span className="text-[10px] font-bold text-[#E08828]">Be first to join</span>
      </div>
    );
  }

  return (
    <div className="my-3">
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2 overflow-hidden items-center">
          {avatars.map((p, i) => (
            <div
              key={i}
              title={`${p.name} (${p.gender === 'f' ? 'Female' : 'Male'})`}
              className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-xs ${
                p.gender === 'f'
                  ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                  : 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
              }`}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-[#E5E1DB] text-[#5A5551] flex items-center justify-center text-[10px] font-bold shadow-xs">
              +{overflow}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Roster</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-medium text-[#8B8680] mt-1.5 uppercase tracking-wider">
        <span>
          M: <span className="font-semibold text-[#1F1F1F]">{participantsCount.male}</span> • F:{' '}
          <span className="font-semibold text-[#1F1F1F]">{participantsCount.female}</span>
        </span>
        <span className="font-semibold text-[#E08828] normal-case">
          Total: <span className="font-bold">{totalParticipants}</span>
        </span>
      </div>
    </div>
  );
};
