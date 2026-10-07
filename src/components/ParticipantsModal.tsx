import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Sparkles, UserCheck } from 'lucide-react';
import { ParticipantCount } from '../types';
import { apiFetch } from '../services/api';

export interface ParticipantItem {
  name: string;
  gender: 'm' | 'f';
}

interface ParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trekName?: string;
  hikeNumber?: string;
  trekId?: string;
  totalCount?: number;
  participantsCount?: ParticipantCount;
  recentParticipants?: ParticipantItem[];
}

/**
 * Formats a name to First Name and Last Name Initial.
 * E.g., "Biraj Thing" -> "Biraj T."
 *       "Salina Tamang" -> "Salina T."
 *       "Musafir" -> "Musafir"
 *       "Sunil Kumar Shrestha" -> "Sunil S."
 */
export function formatNameWithLastInitial(rawName: string): string {
  if (!rawName) return 'Hiker';
  const clean = rawName.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] || 'Hiker';
  }
  const firstName = parts[0];
  const lastPart = parts[parts.length - 1];
  const cleanLast = lastPart.replace(/[^a-zA-Z]/g, '');
  if (!cleanLast) return firstName;
  return `${firstName} ${cleanLast.charAt(0).toUpperCase()}.`;
}

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  isOpen,
  onClose,
  trekName = 'Trek',
  hikeNumber,
  trekId,
  totalCount,
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
}) => {
  const [roster, setRoster] = useState<ParticipantItem[]>(recentParticipants);
  const [loading, setLoading] = useState(false);

  // Sync initial list when recentParticipants changes
  useEffect(() => {
    if (recentParticipants && recentParticipants.length > 0) {
      setRoster(recentParticipants);
    }
  }, [recentParticipants]);

  // Fetch full roster from server if modal is open and hike/trek ID exists
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchFullRoster = async () => {
      const idToQuery = hikeNumber || trekId;
      if (!idToQuery) return;

      try {
        setLoading(true);
        const res = await apiFetch(`/treks/${encodeURIComponent(idToQuery)}`);
        if (res.ok && isMounted) {
          const json = await res.json();
          const serverRoster = json.roster || json.data?.roster;
          if (Array.isArray(serverRoster) && serverRoster.length > 0) {
            const mapped: ParticipantItem[] = serverRoster
              .filter((r: any) => {
                const st = String(r.status || r.registration_status || r.roster_registration_status || 'Confirmed').toLowerCase().trim();
                return st !== 'cancelled' && st !== 'waitlisted' && st !== 'cancelled by user' && !st.includes('cancelled');
              })
              .map((r: any) => ({
                name: r.full_name || r.name || 'Hiker',
                gender: (String(r.gender || '').toLowerCase().startsWith('f') ? 'f' : 'm') as 'm' | 'f',
              }));
            if (mapped.length > 0) {
              setRoster(mapped);
            }
          }
        }
      } catch (err) {
        // Fallback gracefully to recentParticipants already set
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFullRoster();

    return () => {
      isMounted = false;
    };
  }, [isOpen, hikeNumber, trekId]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalParticipants =
    roster.length > 0
      ? roster.length
      : (totalCount !== undefined && totalCount > 0
        ? totalCount
        : (participantsCount?.total || 0));

  const maleCount =
    roster.length > 0
      ? roster.filter((p) => p.gender === 'm').length
      : (participantsCount?.male || 0);
  const femaleCount =
    roster.length > 0
      ? roster.filter((p) => p.gender === 'f').length
      : (participantsCount?.female || 0);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="participants-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#E5E1DB] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F0EBE5] flex items-start justify-between gap-3 bg-[#FAF8F5]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {hikeNumber && (
                <span className="text-[10px] font-bold text-[#5A5551] bg-[#F4EFEA] px-2 py-0.5 rounded-md border border-[#E5E1DB]">
                  Hike #{hikeNumber}
                </span>
              )}
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Roster
              </span>
            </div>
            <h3
              id="participants-modal-title"
              className="text-base sm:text-lg font-bold text-[#1F1F1F] leading-snug truncate"
              title={trekName}
            >
              {trekName}
            </h3>
            <p className="text-xs text-[#8B8680] mt-0.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Registered Participants Roster</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#EFEAE4] transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="px-4 py-2.5 bg-[#F5F2ED] border-b border-[#E8E3DC] flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1F1F1F] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#7ABA42]" />
            <span>
              Total: <strong className="text-[#E08828]">{totalParticipants}</strong> Hikers
            </span>
          </span>
          <div className="text-[11px] font-medium text-[#5A5551] flex items-center gap-2">
            <span className="px-2 py-0.5 bg-sky-50 text-sky-800 rounded-md border border-sky-200/60 font-semibold">
              M: {maleCount}
            </span>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-200/60 font-semibold">
              F: {femaleCount}
            </span>
          </div>
        </div>

        {/* Content - Multi-Column Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-[140px] max-h-[58vh]">
          {roster.length === 0 ? (
            <div className="py-8 text-center text-[#8B8680]">
              <Sparkles className="w-8 h-8 text-[#E08828] mx-auto mb-2 opacity-70" />
              <p className="text-xs font-semibold text-[#1F1F1F]">No public participant names yet</p>
              <p className="text-[11px] mt-1 text-[#8B8680]">Be among the first to register for this hike!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
              {roster.map((p, idx) => {
                const formatted = formatNameWithLastInitial(p.name);
                const firstInitial = (p.name || 'H').trim().charAt(0).toUpperCase();
                const isFemale = p.gender === 'f';

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[#F9F7F5] border border-[#EFEAE4] hover:border-[#E08828]/40 hover:bg-white transition-all shadow-3xs min-w-0"
                  >
                    {/* Initial Circle Badge */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs ${
                        isFemale
                          ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                          : 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
                      }`}
                      title={isFemale ? 'Female' : 'Male'}
                    >
                      {firstInitial}
                    </div>

                    {/* Participant Name with Last Name Initial */}
                    <span
                      className="text-xs font-semibold text-[#1F1F1F] truncate"
                      title={formatted}
                    >
                      {formatted}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {loading && roster.length > 0 && (
            <div className="text-center py-2 text-[10px] text-[#8B8680] animate-pulse">
              Syncing latest roster...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[#F0EBE5] bg-[#FAF8F5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-3.5 sm:px-5 py-2 bg-[#1F1F1F] hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            Close Roster
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
