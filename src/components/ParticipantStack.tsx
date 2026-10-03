import React, { useState } from 'react';
import { ParticipantCount } from '../types';
import { ParticipantsModal } from './ParticipantsModal';

interface ParticipantStackProps {
  participantsCount?: ParticipantCount;
  recentParticipants?: Array<{ name: string; gender: 'm' | 'f' }>;
  totalCount?: number;
  trekName?: string;
  hikeNumber?: string;
  trekId?: string;
}

export const ParticipantStack: React.FC<ParticipantStackProps> = ({
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
  totalCount,
  trekName,
  hikeNumber,
  trekId,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const avatars = (recentParticipants || []).slice(0, 8);
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
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsModalOpen(true);
          }
        }}
        className="my-2 py-1 px-1.5 -mx-1.5 rounded-xl hover:bg-[#F9F7F5] border border-transparent hover:border-[#E5E1DB] transition-all cursor-pointer group select-none"
        title="Click to view participant roster"
        aria-label="View registered participants"
      >
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2 overflow-hidden items-center">
            {avatars.map((p, i) => (
              <div
                key={i}
                title={`${p.name} (${p.gender === 'f' ? 'Female' : 'Male'})`}
                className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-xs transition-transform group-hover:scale-105 ${
                  p.gender === 'f'
                    ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                    : 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
                }`}
              >
                {(p.name || 'H').charAt(0).toUpperCase()}
              </div>
            ))}
            {overflow > 0 && (
              <div className="w-7 h-7 rounded-full border-2 border-white bg-[#E5E1DB] text-[#5A5551] flex items-center justify-center text-[10px] font-bold shadow-xs transition-transform group-hover:scale-105">
                +{overflow}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 group-hover:bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Roster</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium text-[#8B8680] mt-1.5 uppercase tracking-wider">
          <span>
            M: <span className="font-semibold text-[#1F1F1F]">{maleCount}</span> • F:{' '}
            <span className="font-semibold text-[#1F1F1F]">{femaleCount}</span>
          </span>
          <span className="font-semibold text-[#E08828] normal-case group-hover:underline">
            Total: <span className="font-bold">{totalParticipants}</span>
          </span>
        </div>
      </div>

      <ParticipantsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        trekName={trekName}
        hikeNumber={hikeNumber}
        trekId={trekId}
        totalCount={totalParticipants}
        participantsCount={participantsCount}
        recentParticipants={recentParticipants}
      />
    </>
  );
};
