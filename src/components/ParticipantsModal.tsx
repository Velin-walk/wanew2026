import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Sparkles, UserCheck, EyeOff, ArrowRight, LogIn } from 'lucide-react';
import { ParticipantCount } from '../types';
import { apiFetch } from '../services/api';
import { isHikerAnonymous, useAnonymity } from '../utils/anonymity';
import { useAuth } from '../context/AuthContext';

export interface ParticipantItem {
  name: string;
  gender: 'm' | 'f';
  pax?: number;
  isGuide?: boolean;
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
  guideName?: string;
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
  if (isHikerAnonymous({ name: clean })) return 'Anonymous Hiker';
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

const enrichWithGuide = (items: ParticipantItem[], guide?: string): ParticipantItem[] => {
  const list = [...items];
  if (guide && guide.trim()) {
    const cleanGuide = guide.replace(/\s*\((?:lead\s+)?(?:guide|leader)\)/i, '').trim();
    if (!cleanGuide) return list;
    const existingIndex = list.findIndex(p => {
      const pClean = p.name.replace(/\s*\((?:lead\s+)?(?:guide|leader)\)/i, '').trim().toLowerCase();
      return pClean === cleanGuide.toLowerCase() || p.isGuide;
    });
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], name: cleanGuide, isGuide: true };
    } else {
      list.unshift({ name: cleanGuide, gender: 'm', isGuide: true });
    }
  }
  return list;
};

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  isOpen,
  onClose,
  trekName = 'Trek',
  hikeNumber,
  trekId,
  totalCount,
  participantsCount = { total: 0, male: 0, female: 0 },
  recentParticipants = [],
  guideName,
}) => {
  const { user, openAuthModal } = useAuth();
  useAnonymity();
  const [roster, setRoster] = useState<ParticipantItem[]>(() => enrichWithGuide(recentParticipants, guideName));
  const [loading, setLoading] = useState(false);

  // Sync initial list when recentParticipants or guideName changes
  useEffect(() => {
    setRoster(enrichWithGuide(recentParticipants || [], guideName));
  }, [recentParticipants, guideName]);

  // Fetch full roster from server if modal is open and hike/trek ID exists
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchFullRoster = async () => {
      const idToQuery = hikeNumber || trekId;
      if (!idToQuery) return;

      try {
        setLoading(true);
        const res = await apiFetch(`/treks/${encodeURIComponent(idToQuery)}`, { forceFresh: true });
        if (res.ok && isMounted) {
          const json = await res.json();
          const serverRoster = json.roster || json.data?.roster;
          if (Array.isArray(serverRoster) && serverRoster.length > 0) {
            const mapped: ParticipantItem[] = serverRoster
              .filter((r: any) => {
                const st = String(r.status || r.registration_status || r.roster_registration_status || 'Confirmed').toLowerCase().trim();
                return st === 'confirmed';
              })
              .map((r: any) => ({
                name: r.full_name || r.name || 'Hiker',
                gender: (String(r.gender || '').toLowerCase().startsWith('f') ? 'f' : 'm') as 'm' | 'f',
              }));
            if (mapped.length > 0 || (guideName && guideName.trim())) {
              setRoster(enrichWithGuide(mapped, guideName));
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

  const handleOpenSettings = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('wnw-open-profile', { detail: { tab: 'settings' } }));
  };

  const totalParticipants =
    roster.length > 0
      ? roster.reduce((sum, p: any) => sum + Number(p.pax || 1), 0)
      : (totalCount !== undefined && totalCount > 0
        ? totalCount
        : (participantsCount?.total || 0));

  const maleCount =
    roster.length > 0
      ? roster.filter((p: any) => p.gender === 'm').reduce((sum, p: any) => sum + Number(p.pax || 1), 0)
      : (participantsCount?.male || 0);
  const femaleCount =
    roster.length > 0
      ? roster.filter((p: any) => p.gender === 'f').reduce((sum, p: any) => sum + Number(p.pax || 1), 0)
      : (participantsCount?.female || 0);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="participants-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#F0F3F8] rounded-3xl border border-white/90 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.30),0_10px_25px_-5px_rgba(15,23,42,0.15),inset_0_1px_1px_rgba(255,255,255,1)] max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {hikeNumber && (
                <span className="text-[10px] font-bold text-[#55637D] bg-[#F0F3F8] px-2.5 py-1 rounded-xl shadow-[2px_2px_5px_#d1d8e3,-2px_-2px_5px_#ffffff] border border-white/80">
                  Hike #{hikeNumber}
                </span>
              )}
              <span className="text-[10px] font-bold text-emerald-700 bg-[#F0F3F8] px-2.5 py-1 rounded-xl shadow-[2px_2px_5px_#d1d8e3,-2px_-2px_5px_#ffffff] border border-white/80 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span>Live Roster</span>
              </span>
            </div>

            <h3
              id="participants-modal-title"
              className="text-lg sm:text-2xl font-black text-[#1E293B] tracking-tight leading-snug truncate"
              title={trekName}
            >
              {trekName}
            </h3>

            <p className="text-xs font-semibold text-[#64748B] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Registered Participants Roster</span>
            </p>
          </div>

          {/* Premium Neumorphic Circular/Squircle Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-[#F0F3F8] text-[#64748B] hover:text-[#1E293B] shadow-[3px_3px_7px_#d1d8e3,-3px_-3px_7px_#ffffff] hover:shadow-[inset_2px_2px_4px_#d1d8e3,inset_-2px_-2px_4px_#ffffff] active:scale-95 transition-all flex items-center justify-center cursor-pointer shrink-0 border border-white/80"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Summary Bar - Sunken Concave Track */}
        <div className="mx-4 sm:mx-6 mb-3 p-2.5 sm:p-3 rounded-2xl bg-[#E8EDF4] shadow-[inset_2px_2px_5px_#d1d8e3,inset_-2px_-2px_5px_#ffffff] border border-white/50 flex items-center justify-between text-xs">
          <span className="font-bold text-[#1E293B] flex items-center gap-2">
            <span className="w-6 h-6 rounded-xl bg-[#F0F3F8] shadow-[1px_1px_3px_#d1d8e3,-1px_-1px_3px_#ffffff] flex items-center justify-center text-[#7ABA42]">
              <UserCheck className="w-3.5 h-3.5" />
            </span>
            <span>
              Total: <strong className="text-[#E08828] font-black">{totalParticipants}</strong> Hikers
            </span>
          </span>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#F0F3F8] text-sky-800 rounded-xl shadow-[2px_2px_5px_#d1d8e3,-2px_-2px_5px_#ffffff] border border-sky-200/50 text-[11px] font-bold">
              M: {maleCount}
            </span>
            <span className="px-2.5 py-1 bg-[#F0F3F8] text-rose-700 rounded-xl shadow-[2px_2px_5px_#d1d8e3,-2px_-2px_5px_#ffffff] border border-rose-200/50 text-[11px] font-bold">
              F: {femaleCount}
            </span>
          </div>
        </div>

        {/* Anonymous Mode Privacy Notice - Tactile Card with Vibrant Gradient Button */}
        <div className="mx-4 sm:mx-6 mb-3 p-3 sm:p-3.5 rounded-2xl bg-[#F0F3F8] shadow-[3px_3px_8px_#d1d8e3,-3px_-3px_8px_#ffffff] border border-white/80">
          {!user ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 shadow-[inset_1px_1px_2px_#ffffff,1px_1px_3px_#d1d8e3] text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200/50">
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] sm:text-xs text-[#334155] leading-snug">
                  <strong className="text-[#1E293B]">Prefer privacy?</strong> Enable Anonymous Mode to appear as <span className="font-bold text-indigo-700">"Anonymous Hiker"</span>.
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-[#64748B] font-medium leading-snug">
                  Please sign in with the email used during registration to manage your privacy.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      openAuthModal(
                        'Please sign in to turn on Anonymous mode. Use the Gmail you used for registration.',
                        () => {
                          onClose();
                          window.dispatchEvent(new CustomEvent('wnw-open-profile', { detail: { tab: 'settings' } }));
                        }
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:scale-95 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 shadow-[inset_1px_1px_2px_#ffffff,1px_1px_3px_#d1d8e3] text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/50">
                  <EyeOff className="w-4 h-4" />
                </div>
                <p className="text-[11px] sm:text-xs text-[#334155] leading-snug min-w-0">
                  <strong className="text-[#1E293B]">Prefer privacy?</strong> Enable Anonymous Mode to appear as <span className="font-bold text-indigo-700">"Anonymous Hiker"</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenSettings}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <span>Open Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content - Tactile Hiker Tiles Grid */}
        <div className="px-3 sm:px-6 py-2 overflow-y-auto flex-1 min-h-[140px] max-h-[52vh]">
          {roster.length === 0 ? (
            <div className="py-10 text-center text-[#64748B]">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F3F8] shadow-[3px_3px_8px_#d1d8e3,-3px_-3px_8px_#ffffff] flex items-center justify-center text-[#E08828] mx-auto mb-3 border border-white/80">
                <Sparkles className="w-6 h-6 opacity-80" />
              </div>
              <p className="text-sm font-bold text-[#1E293B]">No public participant names yet</p>
              <p className="text-xs mt-1 text-[#64748B]">Be among the first to register for this hike!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {roster.map((p, idx) => {
                const isGuide = Boolean(
                  p.isGuide ||
                  (guideName && p.name.toLowerCase().includes(guideName.toLowerCase().trim())) ||
                  /\((?:lead\s+)?(?:guide|leader)\)/i.test(p.name)
                );
                const rawCleanName = p.name.replace(/\s*\((?:lead\s+)?(?:guide|leader)\)/i, '').trim();
                const formatted = isGuide ? rawCleanName : formatNameWithLastInitial(p.name);
                const firstInitial = (rawCleanName || 'H').charAt(0).toUpperCase();
                const isFemale = p.gender === 'f';

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 min-w-0 border ${
                      isGuide
                        ? 'bg-[#F9F7EE] shadow-[3px_3px_8px_#d1d8e3,-3px_-3px_8px_#ffffff] border-amber-300/80 hover:-translate-y-0.5'
                        : 'bg-[#F0F3F8] shadow-[3px_3px_8px_#d1d8e3,-3px_-3px_8px_#ffffff] border-white/80 hover:-translate-y-0.5 hover:shadow-[2px_2px_5px_#d1d8e3,-2px_-2px_5px_#ffffff]'
                    }`}
                  >
                    {/* Initial Circle Bead - Soft 3D extruded circle */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black shrink-0 border border-white/90 ${
                        isGuide
                          ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-[#B45309] shadow-[2px_2px_4px_#d1d8e3,-2px_-2px_4px_#ffffff] ring-1 ring-amber-300'
                          : isFemale
                          ? 'bg-gradient-to-br from-rose-100 to-rose-200 text-rose-700 shadow-[2px_2px_4px_#d1d8e3,-2px_-2px_4px_#ffffff]'
                          : 'bg-gradient-to-br from-sky-100 to-sky-200 text-sky-800 shadow-[2px_2px_4px_#d1d8e3,-2px_-2px_4px_#ffffff]'
                      }`}
                      title={isGuide ? 'Leader' : isFemale ? 'Female' : 'Male'}
                    >
                      {firstInitial}
                    </div>

                    {/* Participant Name & Leader Chip */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span
                        className="text-[11px] sm:text-xs font-bold text-[#1E293B] truncate"
                        title={formatted}
                      >
                        {formatted}
                      </span>
                      {isGuide && (
                        <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide text-[#B45309] bg-amber-100/90 px-1 py-0.5 rounded shadow-[1px_1px_2px_#d1d8e3,-1px_-1px_2px_#ffffff] border border-amber-300/80 shrink-0 leading-none">
                          Leader
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading && roster.length > 0 && (
            <div className="text-center py-2 text-xs font-semibold text-[#64748B] animate-pulse">
              Syncing latest roster...
            </div>
          )}
        </div>

        {/* Footer - Tactile Charcoal Button */}
        <div className="p-4 sm:p-5 pt-3 sm:pt-4 border-t border-slate-200/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-b from-[#2B3545] to-[#18212F] hover:from-[#1E2736] hover:to-[#101722] text-white text-xs font-bold rounded-2xl shadow-[3px_3px_8px_#d1d8e3,-3px_-3px_8px_#ffffff,0_4px_12px_rgba(15,23,42,0.25)] active:scale-95 transition-all cursor-pointer border border-white/10"
          >
            Close Roster
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
