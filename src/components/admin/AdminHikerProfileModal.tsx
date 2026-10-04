import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Trophy,
  Award,
  Calendar,
  DollarSign,
  Compass,
  CheckCircle,
  AlertCircle,
  Clock,
  HeartPulse,
  Users,
  MapPin,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { AdminRegistration } from './BookingsManager';
import { Trek } from '../../types';
import { HikerStats } from '../../types/leaderboard';
import { apiFetch } from '../../services/api';

interface AdminHikerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  hikerName: string;
  hikerPhone?: string;
  hikerEmail?: string;
  allRegistrations: AdminRegistration[];
  treks?: Trek[];
  onViewVoucher?: (voucherUrl: string, reg: AdminRegistration) => void;
}

export const AdminHikerProfileModal: React.FC<AdminHikerProfileModalProps> = ({
  isOpen,
  onClose,
  hikerName,
  hikerPhone,
  hikerEmail,
  allRegistrations,
  treks = [],
  onViewVoucher,
}) => {
  const [leaderboardData, setLeaderboardData] = useState<HikerStats[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'medical' | 'leaderboard'>('history');

  // Normalize phone for comparison
  const normalizePhone = (num?: string) => {
    if (!num) return '';
    const digits = num.replace(/\D/g, '');
    return digits.slice(-10);
  };

  const normTargetPhone = normalizePhone(hikerPhone);
  const normTargetEmail = (hikerEmail || '').toLowerCase().trim();
  const normTargetName = (hikerName || '').toLowerCase().trim();

  // Lazy fetch leaderboard data once if opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingLeaderboard(true);
    apiFetch('leaderboard')
      .then((res: any) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.hikers)) {
          setLeaderboardData(res.hikers);
        } else if (Array.isArray(res)) {
          setLeaderboardData(res);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch leaderboard data for admin hiker profile:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingLeaderboard(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Match all registrations across the platform
  const hikerRegistrations = useMemo(() => {
    if (!normTargetName && !normTargetPhone && !normTargetEmail) return [];

    return allRegistrations.filter((reg) => {
      const regPhone = normalizePhone(reg.phone || reg.whatsapp || (reg as any).whatsapp_number);
      const regEmail = (reg.email || reg.email_address || reg.user_email || '').toLowerCase().trim();
      const regName = (reg.full_name || '').toLowerCase().trim();

      if (normTargetPhone && regPhone && normTargetPhone === regPhone) return true;
      if (normTargetEmail && regEmail && normTargetEmail === regEmail) return true;
      if (normTargetName && regName && normTargetName === regName) return true;

      // Check team members
      if (Array.isArray(reg.team_members)) {
        return reg.team_members.some((m) => (m.full_name || '').toLowerCase().trim() === normTargetName);
      }

      return false;
    }).sort((a, b) => {
      const da = new Date(a.created_at || a.trek_date || 0).getTime();
      const db = new Date(b.created_at || b.trek_date || 0).getTime();
      return db - da;
    });
  }, [allRegistrations, normTargetName, normTargetPhone, normTargetEmail]);

  // Match leaderboard stats
  const leaderboardMatch = useMemo(() => {
    if (!leaderboardData.length) return null;

    let matchedHiker: HikerStats | null = null;
    let rank = 0;

    for (let i = 0; i < leaderboardData.length; i++) {
      const h = leaderboardData[i];
      const hPhone = normalizePhone(h.phone || h.p);
      const hName = (h.n || '').toLowerCase().trim();
      const hEmail = (h.e || '').toLowerCase().trim();

      if (normTargetPhone && hPhone && normTargetPhone === hPhone) {
        matchedHiker = h;
        rank = i + 1;
        break;
      }
      if (normTargetEmail && hEmail && normTargetEmail === hEmail) {
        matchedHiker = h;
        rank = i + 1;
        break;
      }
      if (normTargetName && hName && normTargetName === hName) {
        matchedHiker = h;
        rank = i + 1;
        break;
      }
    }

    return matchedHiker ? { stats: matchedHiker, rank } : null;
  }, [leaderboardData, normTargetName, normTargetPhone, normTargetEmail]);

  // Extract contact details
  const primaryPhone = hikerPhone || hikerRegistrations.find((r) => r.phone)?.phone || hikerRegistrations.find((r) => r.whatsapp)?.whatsapp || '';
  const primaryEmail = hikerEmail || hikerRegistrations.find((r) => r.email || r.email_address || r.user_email)?.email || '';
  const emergencyContact = hikerRegistrations.find((r) => r.emergency_contact)?.emergency_contact || '';
  const medicalDetails = hikerRegistrations.filter((r) => r.has_medical === 'Yes' || r.specify_medical);

  // Extract Gender and Age Range
  const primaryGender = hikerRegistrations.find((r) => r.gender)?.gender || '';
  const primaryAgeGroup = hikerRegistrations.find((r) => r.age_group)?.age_group || '';
  const genderAgeLabel = primaryGender && primaryAgeGroup
    ? `${primaryGender} (${primaryAgeGroup})`
    : primaryGender
    ? primaryGender
    : primaryAgeGroup
    ? `Age ${primaryAgeGroup}`
    : '';

  // Compute financial & attendance summary
  const totalBookings = hikerRegistrations.length;
  const confirmedBookings = hikerRegistrations.filter((r) => (r.status || 'Confirmed') === 'Confirmed').length;
  const cancelledBookings = hikerRegistrations.filter((r) => (r.status || '').toLowerCase().includes('cancelled')).length;
  const totalPaid = hikerRegistrations.reduce((acc, r) => acc + (Number(r.paid_amount) || 0), 0);
  const totalDue = hikerRegistrations.reduce((acc, r) => acc + (Number(r.due_amount) || 0), 0);

  const reliabilityRate = totalBookings > 0
    ? Math.round((confirmedBookings / totalBookings) * 100)
    : 100;

  // Hiker tier badge
  const totalHikesCount = (leaderboardMatch?.stats?.c || 0) + confirmedBookings;
  const totalDistanceKm = leaderboardMatch?.stats?.d || 0;

  const getHikerTier = (count: number) => {
    if (count >= 20) return { label: 'Himalayan Summit Legend', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    if (count >= 10) return { label: 'Alpine Master', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (count >= 5) return { label: 'Mountain Explorer', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (count >= 2) return { label: 'Trail Enthusiast', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    return { label: 'Trail Pioneer', color: 'bg-stone-100 text-stone-700 border-stone-300' };
  };

  const tier = getHikerTier(totalHikesCount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#FAF8F5] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-[#E5E1DB] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-white border-b border-[#F0EBE5] p-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF9F2] border border-[#FFE7CC] flex items-center justify-center text-[#E08828] text-xl font-black shadow-2xs shrink-0">
              {hikerName ? hikerName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-[#1F1F1F] tracking-tight truncate">
                  {hikerName}
                </h2>
                {genderAgeLabel && (
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#EFEAE4] text-[#4A4541] border border-[#D5D0C9] whitespace-nowrap shadow-3xs">
                    {genderAgeLabel}
                  </span>
                )}
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${tier.color}`}>
                  {tier.label}
                </span>
                {leaderboardMatch && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-[#E08828] border border-amber-200 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500 fill-amber-100" />
                    <span>Rank #{leaderboardMatch.rank}</span>
                  </span>
                )}
              </div>

              {/* Direct Quick Contact Links */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A5551]">
                {primaryPhone && (
                  <a
                    href={`tel:${primaryPhone}`}
                    className="flex items-center gap-1 hover:text-[#E08828] font-semibold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#8B8680]" />
                    <span>{primaryPhone}</span>
                  </a>
                )}

                {primaryPhone && (
                  <a
                    href={`https://wa.me/${primaryPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {primaryEmail && (
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="flex items-center gap-1 hover:text-[#E08828] font-semibold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#8B8680]" />
                    <span>{primaryEmail}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8B8680] hover:text-[#1F1F1F] hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="bg-white border-b border-[#F0EBE5] px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Hikes Joined</div>
            <div className="text-base font-black text-[#1F1F1F] mt-0.5">{totalBookings}</div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Confirmed</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">{confirmedBookings}</div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Total Paid</div>
            <div className="text-base font-black text-[#1F1F1F] mt-0.5">NPR {totalPaid.toLocaleString()}</div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Balance Due</div>
            <div className={`text-base font-black mt-0.5 ${totalDue > 0 ? 'text-amber-700 font-black' : 'text-stone-500'}`}>
              NPR {totalDue.toLocaleString()}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Reliability</div>
            <div className="text-base font-black text-[#E08828] mt-0.5">{reliabilityRate}%</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white px-5 pt-3 border-b border-[#F0EBE5] flex items-center gap-4">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            Registrations Ledger ({hikerRegistrations.length})
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            Leaderboard Records {leaderboardMatch ? `(${leaderboardMatch.stats.c || 0} events)` : ''}
          </button>

          <button
            onClick={() => setActiveTab('medical')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'medical'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            <span>Safety &amp; Notes</span>
            {medicalDetails.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'history' && (
            <div className="space-y-3">
              {hikerRegistrations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">No active bookings found for this hiker</p>
                </div>
              ) : (
                hikerRegistrations.map((reg, idx) => {
                  const isPrivate = reg.hike_number === 'PRIVATE' || reg.trek_name?.toLowerCase().includes('private');
                  const isCancelled = (reg.status || '').toLowerCase().includes('cancelled');

                  return (
                    <div
                      key={reg.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCancelled
                          ? 'bg-rose-50/25 border-rose-200'
                          : isPrivate
                          ? 'bg-purple-50/30 border-purple-200'
                          : 'bg-white border-[#E5E1DB]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#E08828]/10 text-[#E08828] border border-[#E08828]/20">
                              Hike #{reg.hike_number || 'TBD'}
                            </span>
                            <span className="text-xs font-black text-[#1F1F1F]">
                              {reg.trek_name || 'Himalayan Trek'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8B8680] flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-[#8B8680]" />
                            <span>{reg.trek_date || reg.created_at?.slice(0, 10) || 'Scheduled Date'}</span>
                            {reg.pickup_point && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-[#5A5551]">
                                  <MapPin className="w-3 h-3 text-stone-400" />
                                  <span>Pickup: {reg.pickup_point}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : reg.status === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}>
                            {reg.status || 'Confirmed'}
                          </span>

                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            reg.payment_status === 'Fully Paid'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : reg.payment_status === 'Deposit Paid'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-stone-100 text-stone-700 border-stone-200'
                          }`}>
                            {reg.payment_status || 'Unpaid'}
                          </span>
                        </div>
                      </div>

                      {/* Payment & Group Info */}
                      <div className="pt-2 border-t border-[#F0EBE5] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A5551]">
                        <div className="flex items-center gap-3">
                          <span>Paid: <strong className="text-[#1F1F1F]">NPR {Number(reg.paid_amount || 0).toLocaleString()}</strong></span>
                          <span>Due: <strong className={`${Number(reg.due_amount || 0) > 0 ? 'text-amber-700 font-bold' : 'text-stone-500'}`}>NPR {Number(reg.due_amount || 0).toLocaleString()}</strong></span>
                          {reg.paxCount && reg.paxCount > 1 && (
                            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                              {reg.paxCount} Pax Group
                            </span>
                          )}
                        </div>

                        {reg.payment_voucher_url && onViewVoucher && (
                          <button
                            type="button"
                            onClick={() => onViewVoucher(reg.payment_voucher_url!, reg)}
                            className="text-[11px] font-bold text-[#E08828] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>View Voucher</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {reg.person_remarks && (
                        <div className="mt-2 text-[11px] bg-purple-50/50 p-2 rounded-xl border border-purple-200 text-purple-950">
                          <strong className="text-purple-900">Specifications &amp; Hiker Notes:</strong> {reg.person_remarks}
                        </div>
                      )}

                      {reg.admin_notes && (
                        <div className="mt-2 text-[11px] bg-[#FAF8F5] p-2 rounded-xl border border-[#F0EBE5] text-[#5A5551]">
                          <strong className="text-[#1F1F1F]">Admin Note:</strong> {reg.admin_notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              {loadingLeaderboard ? (
                <div className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-[#E08828] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-xs text-[#8B8680]">Loading leaderboard profile...</p>
                </div>
              ) : leaderboardMatch ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#8B8680]">Lifetime Distance Walked</div>
                      <div className="text-2xl font-black text-[#1F1F1F] mt-0.5">
                        {leaderboardMatch.stats.d || 0} km
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#8B8680]">Leaderboard Rank</div>
                      <div className="text-2xl font-black text-[#E08828] mt-0.5">
                        #{leaderboardMatch.rank}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(leaderboardMatch.stats.hikes) && leaderboardMatch.stats.hikes.length > 0 && (
                    <div className="bg-white rounded-2xl border border-[#E5E1DB] overflow-hidden">
                      <div className="p-3 bg-[#FAF8F5] border-b border-[#F0EBE5] text-xs font-black text-[#1F1F1F]">
                        Recorded Completed Events ({leaderboardMatch.stats.hikes.length})
                      </div>
                      <div className="divide-y divide-[#F0EBE5] max-h-60 overflow-y-auto">
                        {leaderboardMatch.stats.hikes.map((ev, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between text-xs">
                            <div className="font-semibold text-[#1F1F1F]">
                              Hike #{ev.no || '—'}: {ev.name || 'Hike Event'}
                            </div>
                            <div className="text-[#8B8680] font-bold">
                              {ev.dist ? `${ev.dist} km` : ''} {ev.date ? `• ${ev.date}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Trophy className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">No external leaderboard entry linked yet</p>
                  <p className="text-[11px] text-[#8B8680] mt-1">
                    Stats are computed from current confirmed bookings roster.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'medical' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Emergency Contacts</span>
                </h4>

                <div className="text-xs text-[#5A5551]">
                  {emergencyContact ? (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#8B8680]" />
                      <strong className="text-[#1F1F1F]">Emergency:</strong>
                      <a href={`tel:${emergencyContact}`} className="text-[#E08828] font-bold hover:underline">
                        {emergencyContact}
                      </a>
                    </div>
                  ) : (
                    <p className="text-stone-400 italic">No specific emergency contact provided on signup.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Medical History &amp; Specific Conditions</span>
                </h4>

                {medicalDetails.length > 0 ? (
                  <div className="space-y-2">
                    {medicalDetails.map((m, idx) => (
                      <div key={idx} className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 text-xs text-rose-950">
                        <div className="font-bold text-rose-900 mb-0.5">
                          Reported on Hike #{m.hike_number || 'TBD'} ({m.trek_name || 'Trek'}):
                        </div>
                        <p>{m.specify_medical || 'Medical condition flagged on registration form.'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    No medical conditions or physical restrictions reported by this hiker.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-[#F0EBE5] p-4 px-5 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#8B8680]">
            Walk Nepal Walk Hiker Intelligence • {hikerRegistrations.length} record(s) indexed
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
