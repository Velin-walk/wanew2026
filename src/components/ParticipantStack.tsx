import React from 'react';
import { ParticipantCount } from '../types';

interface ParticipantStackProps {
  participantsCount?: ParticipantCount;
  recentParticipants?: Array<{ name: string; gender: 'm' | 'f' }>;
  totalCount?: number;
}

export const ParticipantStack: React.FC<ParticipantStackProps> = ({
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
  totalCount,
}) => {
  const avatars = (recentParticipants || []).slice(0, 12);
  const totalParticipants =
    totalCount !== undefined && totalCount > 0
      ? totalCount
      : (participantsCount?.total || (recentParticipants ? recentParticipants.length : 0));
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

  const maleCount = participantsCount?.male || recentParticipants.filter((p) => p.gender === 'm').length;
  const femaleCount = participantsCount?.female || recentParticipants.filter((p) => p.gender === 'f').length;

  return (
    <div className="my-3">
      <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
        {avatars.map((p, i) => (
          <div
            key={i}
            title={`${p.name} (${p.gender === 'f' ? 'Female' : 'Male'})`}
            className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-xs shrink-0 ${
              p.gender === 'f'
                ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                : 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
            }`}
          >
            {(p.name || 'H').charAt(0).toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-7 h-7 rounded-full border-2 border-white bg-[#E5E1DB] text-[#5A5551] flex items-center justify-center text-[10px] font-bold shadow-xs shrink-0">
            +{overflow}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] font-medium text-[#8B8680] mt-1.5 uppercase tracking-wider">
        <span>
          M: <span className="font-semibold text-[#1F1F1F]">{maleCount}</span> • F:{' '}
          <span className="font-semibold text-[#1F1F1F]">{femaleCount}</span>
        </span>
        <span className="font-semibold text-[#E08828] normal-case">
          Total: <span className="font-bold">{totalParticipants}</span>
        </span>
      </div>
    </div>
  );
};
