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
  guideName?: string;
}

export const ParticipantStack: React.FC<ParticipantStackProps> = ({
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
  totalCount,
  trekName,
  hikeNumber,
  trekId,
  guideName,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const avatars = (recentParticipants || []).slice(0, 8);
  const hasExactRoster = recentParticipants && recentParticipants.length > 0;

  const hasGenderStats =
    Boolean(participantsCount) &&
    (typeof participantsCount.male === 'number' || typeof participantsCount.female === 'number') &&
    ((participantsCount.male || 0) + (participantsCount.female || 0) > 0 || (participantsCount.total || 0) > 0);

  const resolvedTotalFromGender =
    hasGenderStats && typeof participantsCount?.total === 'number' && participantsCount.total > 0
      ? participantsCount.total
      : (hasGenderStats ? (participantsCount?.male || 0) + (participantsCount?.female || 0) : 0);

  const totalParticipants =
    totalCount !== undefined && totalCount > 0
      ? totalCount
      : (resolvedTotalFromGender > 0
        ? resolvedTotalFromGender
        : (hasExactRoster ? recentParticipants.length : 0));
  const overflow = Math.max(0, totalParticipants - avatars.length);

  if (totalParticipants === 0 && avatars.length === 0) {
    return (
      <div className="my-2 rounded-xl border border-dashed border-[#E5E1DB] bg-[#FAF8F5]/60 px-2.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-5 h-5 rounded-full border border-white bg-[#EDE8E1] flex items-center justify-center text-[9px] text-[#9E978E]"
              >
                ?
              </span>
            ))}
          </div>
          <span className="text-[11px] text-[#5A5551]">
            Roster open <span className="text-[#8B8680] text-[10px]">(no hikers yet)</span>
          </span>
        </div>
        <span className="text-[10px] font-semibold text-[#E08828] hover:underline">
          Be first to join →
        </span>
      </div>
    );
  }

  const maleCount = hasGenderStats
    ? (participantsCount.male || 0)
    : (hasExactRoster
      ? recentParticipants.filter((p) => p.gender === 'm').length
      : 0);

  const femaleCount = hasGenderStats
    ? (participantsCount.female || 0)
    : (hasExactRoster
      ? recentParticipants.filter((p) => p.gender === 'f').length
      : 0);

  const genderSum = maleCount + femaleCount;
  const malePct = genderSum > 0 ? (maleCount / genderSum) * 100 : 50;

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
        className="my-2 p-2 rounded-xl border border-[#F0EBE5] bg-[#FAF8F5]/60 hover:bg-[#FAF8F5] transition-colors cursor-pointer group select-none"
        title="Click to view participant roster"
        aria-label="View registered participants"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5 items-center">
              {avatars.map((p, i) => (
                <div
                  key={i}
                  title={`${p.name} (${p.gender === 'f' ? 'Female' : 'Male'})`}
                  style={{ zIndex: avatars.length - i }}
                  className={`relative w-6 h-6 rounded-full border border-white flex items-center justify-center text-[9px] font-semibold text-white ${
                    p.gender === 'f' ? 'bg-[#F472B6]' : 'bg-[#60A5FA]'
                  }`}
                >
                  {(p.name || 'H').charAt(0).toUpperCase()}
                </div>
              ))}
              {overflow > 0 && (
                <div className="relative w-6 h-6 rounded-full border border-white bg-[#EDE8E1] text-[#6E675E] flex items-center justify-center text-[9px] font-semibold">
                  +{overflow}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-1 shrink-0 text-xs text-[#5A5551]">
            <span className="font-bold text-[#1F1F1F] tabular-nums">
              {totalParticipants}
            </span>
            <span className="text-[10px] text-[#8B8680]">joined</span>
          </div>
        </div>

        {/* Clean, Simple Gender Percentage Bar */}
        {genderSum > 0 && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-[#FCE7F3] overflow-hidden flex">
            <div
              className="h-full bg-[#93C5FD] transition-all duration-300"
              style={{ width: `${malePct}%` }}
            />
            <div
              className="h-full bg-[#F472B6] transition-all duration-300"
              style={{ width: `${100 - malePct}%` }}
            />
          </div>
        )}

        {/* Clean, Simple Gender Indicator */}
        <div className="mt-1 flex items-center justify-between text-[10px] text-[#5A5551]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
              <span>{maleCount} Male</span>
            </span>
            <span className="text-[#D8D2C9]">·</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F472B6]" />
              <span>{femaleCount} Female</span>
            </span>
          </div>
          <span className="text-[10px] text-[#7ABA42] font-medium group-hover:underline flex items-center gap-0.5">
            View roster →
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
        guideName={guideName}
      />
    </>
  );
};