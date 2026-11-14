import React, { useState, useMemo, useEffect } from 'react';
import { Booking } from '../types';
import { HISTORICAL_TREKS } from '../data/historicalTreks';
import { PaymentAndPricingSection } from '../components/InfoPagesModal';
import { MyHikesView } from '../components/MyHikesView';
import { markNotificationAsRead } from '../services/notificationService';
import {
  Calendar,
  Phone,
  User,
  Users,
  Clock,
  Trash2,
  Share2,
  ChevronDown,
  ChevronUp,
  Compass,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  MessageCircle,
  Star,
  Award,
  Footprints,
  ArrowRight,
  CreditCard,
  UploadCloud,
  Eye,
  X,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MyBookingsScreenProps {
  bookings: Booking[];
  loading: boolean;
  onCancelBooking: (bookingId: number | string) => Promise<void>;
  onExploreTreks: () => void;
  onShare: (booking: Booking) => void;
  onLeaveFeedback?: (booking: Booking) => void;
  onViewItinerary?: (booking: Booking) => void;
  onViewMyHikes?: () => void;
  onOpenPaymentPage?: () => void;
  onUploadVoucher?: (booking: Booking) => void;
}

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
  bookings,
  loading,
  onCancelBooking,
  onExploreTreks,
  onShare,
  onLeaveFeedback,
  onViewItinerary,
  onViewMyHikes,
  onOpenPaymentPage,
  onUploadVoucher,
}) => {
  const { user, openAuthModal } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'hikes'>('active');
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | string | null>(null);
  const [viewingVoucherUrl, setViewingVoucherUrl] = useState<string | null>(null);

  // Automatically mark bookings notification as read once user views this screen
  useEffect(() => {
    markNotificationAsRead('bookings');
  }, []);

  // Set of completed hike numbers from historical sheet database
  const completedHikeNumbers = useMemo(() => {
    const set = new Set<string>();
    HISTORICAL_TREKS.forEach((h) => {
      if (h.hike_number) {
        set.add(String(h.hike_number).toLowerCase().trim());
      }
    });
    return set;
  }, []);

function parseBookingDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed.toUpperCase() === 'TBA' || trimmed.toUpperCase() === 'TBD') {
    return null;
  }

  // 1. Slash format: DD/MM/YYYY or YYYY/MM/DD
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      } else {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  // 2. Dash/Dot format: DD-MM-YYYY or DD.MM.YYYY
  if ((trimmed.includes('-') || trimmed.includes('.')) && !trimmed.match(/[a-zA-Z]/)) {
    const delimiter = trimmed.includes('-') ? '-' : '.';
    const parts = trimmed.split(delimiter);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      } else if (parts[0].length === 4) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  // 3. Direct JS Date constructor
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) return direct;

  // 4. Handle date ranges like "14 Oct - 18 Oct 2026" or "Wed 14 Oct – Sun 18 Oct 2026"
  const rangeMatch = trimmed.match(/(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/);
  if (rangeMatch) {
    const d = new Date(rangeMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

  // Filter out bookings that have already been finalized / completed in Google Sheet
  const { activeBookings, completedCount } = useMemo(() => {
    let completed = 0;
    const active: Booking[] = [];
    const todayStartMs = new Date().setHours(0, 0, 0, 0);

    bookings.forEach((b) => {
      const hikeNum = String(b.hike_number || b.trek_id || '').toLowerCase().trim();
      const statusLower = (b.status || '').toLowerCase();
      if (statusLower === 'cancelled by user') {
        return;
      }

      const isCancelled = Boolean(b.is_cancelled) || statusLower.includes('cancelled');
      const dt = parseBookingDate(b.trek_date);
      const isPast =
        (dt !== null && dt.getTime() < todayStartMs) ||
        (hikeNum !== '' && completedHikeNumbers.has(hikeNum));

      if (isCancelled) {
        if (isPast) {
          // Past cancelled treks disappear from My Bookings
          return;
        } else {
          // Future cancelled treks appear so users see the cancellation alert
          active.push(b);
        }
      } else if (isPast || statusLower === 'completed') {
        completed++;
      } else {
        active.push(b);
      }
    });

    return { activeBookings: active, completedCount: completed };
  }, [bookings, completedHikeNumbers]);

  const formatGender = (g?: string) => {
    if (!g) return 'Not specified';
    if (g === 'm') return 'Male';
    if (g === 'f') return 'Female';
    return g;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr.trim().toUpperCase() === 'TBA' || dateStr.trim().toUpperCase() === 'TBD') {
      return 'TBA';
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      }
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  const getDifficultyColor = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'difficult':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  const handleCancelClick = async (id: number | string) => {
    setCancelingId(id);
    try {
      await onCancelBooking(id);
      setConfirmCancelId(null);
    } finally {
      setCancelingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 max-w-4xl w-full mx-auto my-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-orange-200/70 p-4 space-y-3 animate-pulse">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
              <div className="space-y-2 flex-1 w-full">
                <div className="bg-orange-100 h-3.5 w-24 rounded" />
                <div className="bg-orange-100 h-5 w-3/4 rounded" />
                <div className="bg-orange-50 h-3.5 w-1/3 rounded" />
              </div>
              <div className="bg-orange-100 h-7 w-24 rounded-lg shrink-0" />
            </div>
            <div className="bg-orange-50 h-8 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl w-full mx-auto">
      {/* 2-Tab Segmented Control: Active Bookings (Left) vs My Hikes & Stats (Right) */}
      <div className="flex items-center p-1 bg-orange-50/90 rounded-xl border border-orange-200/80 w-full sm:w-fit mx-auto shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('active')}
          className={`flex-1 sm:flex-initial py-1 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'active'
              ? 'bg-gradient-to-r from-[#E08828] to-[#EA580C] text-white shadow-xs font-black'
              : 'text-[#7C5338] hover:text-[#1F1F1F] hover:bg-orange-100/60'
          }`}
        >
          <Compass className={`w-3.5 h-3.5 ${activeSubTab === 'active' ? 'text-white' : 'text-[#E08828]'}`} />
          <span>Active Bookings</span>
          {activeBookings.length > 0 && (
            <span
              className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                activeSubTab === 'active'
                  ? 'bg-white/25 text-white'
                  : 'bg-[#E08828] text-white'
              }`}
            >
              {activeBookings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('hikes')}
          className={`flex-1 sm:flex-initial py-1 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'hikes'
              ? 'bg-gradient-to-r from-[#E08828] to-[#EA580C] text-white shadow-xs font-black'
              : 'text-[#7C5338] hover:text-[#1F1F1F] hover:bg-orange-100/60'
          }`}
        >
          <Footprints className={`w-3.5 h-3.5 ${activeSubTab === 'hikes' ? 'text-white' : 'text-[#E08828]'}`} />
          <span>My Hikes &amp; Stats</span>
          {completedCount > 0 && (
            <span
              className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                activeSubTab === 'hikes'
                  ? 'bg-white/25 text-white'
                  : 'bg-[#E08828] text-white'
              }`}
            >
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Sync Across Devices Notice for Unauthenticated Users */}
      {!user && (
        <div className="p-2.5 sm:px-3.5 sm:py-2.5 bg-gradient-to-r from-orange-50 via-[#FFF5EA] to-amber-50 border border-orange-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-700 shrink-0 shadow-2xs">
              <LogIn className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-orange-950 font-medium leading-snug">
              Sign in to view booking/profile across multiple devices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('Sign in to view booking/profile across multiple devices.')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      )}

      {activeSubTab === 'hikes' ? (
        <MyHikesView userBookings={bookings} />
      ) : activeBookings.length === 0 ? (
        <div className="space-y-3 w-full mx-auto">
          {completedCount > 0 && (
            <div className="p-3 sm:px-4 bg-gradient-to-r from-orange-50 via-amber-50/80 to-orange-50 rounded-xl border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-orange-900 font-extrabold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                  <span>{completedCount} Hike{completedCount > 1 ? 's' : ''} Completed &amp; Reconciled</span>
                </div>
                <p className="text-[11px] text-orange-800/90 leading-snug">
                  Verified and archived in your permanent community ledger. View your lifetime stats and KM badges.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('hikes')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-1.5 px-3.5 bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] text-white text-xs font-bold rounded-lg transition-all shadow-2xs cursor-pointer active:scale-[0.99] shrink-0"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>View My Hikes &amp; Stats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="bg-gradient-to-b from-white to-orange-50/35 rounded-2xl border border-orange-200/80 p-5 sm:p-6 text-center shadow-xs">
            <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-2.5 border border-orange-200 shadow-2xs">
              <Compass className="w-5 h-5 text-[#E08828]" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">No Active Upcoming Bookings</h3>
            <p className="text-xs text-[#6A645D] mt-1 leading-relaxed max-w-md mx-auto">
              You don't have any pending or upcoming trek reservations. Browse upcoming hikes and claim your spot on the live roster!
            </p>
            <button
              type="button"
              onClick={onExploreTreks}
              className="mt-3.5 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Available Treks</span>
            </button>
          </div>

          {/* Attached Payment & Pricing Extension */}
          <div className="bg-white rounded-2xl border border-orange-200/80 p-3.5 sm:p-4 shadow-xs">
            <PaymentAndPricingSection
              compact
              onOpenVoucherUpload={
                onUploadVoucher && bookings[0] ? () => onUploadVoucher(bookings[0]) : undefined
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 w-full">
          {completedCount > 0 && (
            <div className="p-2.5 sm:px-3.5 bg-orange-50/90 border border-orange-200/90 rounded-xl flex items-center justify-between gap-2.5 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-orange-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                <span>
                  <strong>{completedCount} completed hike{completedCount > 1 ? 's' : ''}</strong> moved to your lifetime record in <strong>My Hikes</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('hikes')}
                className="shrink-0 px-2.5 py-1 bg-white hover:bg-orange-100 border border-orange-300 text-orange-800 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                View My Hikes →
              </button>
            </div>
          )}

      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F] truncate flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#E08828] to-[#EA580C] shrink-0" />
            <span className="truncate">My Active Bookings</span>
          </h2>
          <p className="text-[11px] text-[#7C5338]/80 truncate pl-3.5">
            Confirmed upcoming Himalayan rosters and team details
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2.5 py-0.5 bg-orange-50 border border-orange-200 rounded-full text-[11px] font-bold text-[#C85E12] shadow-2xs">
          {activeBookings.length} Active {activeBookings.length === 1 ? 'Trip' : 'Trips'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {activeBookings.map((booking) => {
          const isExpanded = expandedId === booking.id;
          const isConfirmingCancel = confirmCancelId === booking.id;
          const totalPeople = Number(booking.pax) > 0 ? Number(booking.pax) : 1 + (booking.team_members?.length || 0);

          return (
            <div
              key={booking.id}
              className="relative bg-white rounded-2xl border border-orange-200/80 hover:border-orange-300 shadow-xs overflow-hidden transition-all duration-200"
            >
              {/* Subtle Orange Top Accent Bar */}
              <div className="h-1 w-full bg-gradient-to-r from-[#E08828] via-[#EA580C] to-amber-400" />

              {/* Card Header (Tap to toggle) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedId(isExpanded ? null : booking.id)}
                className="p-3 flex flex-col gap-2 cursor-pointer hover:bg-orange-50/35 select-none active:bg-orange-50/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${getDifficultyColor(
                        booking.trek_difficulty
                      )}`}
                    >
                      {booking.trek_difficulty || 'Standard'}
                    </span>
                    <span className="text-[11px] text-[#7C5338] font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#E08828]" />
                      {formatDate(booking.trek_date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {booking.is_cancelled || (booking.status || '').toLowerCase().includes('cancelled') ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />{' '}
                        {(booking.status || '').toLowerCase().includes('cancelled')
                          ? booking.status
                          : 'Cancelled'}
                      </span>
                    ) : (booking.status || '').toLowerCase() === 'pending' || (booking.status || '').toLowerCase() === 'waitlisted' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" /> {booking.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                        <CheckCircle2 className="w-3 h-3 text-[#E08828]" /> {booking.status || 'Confirmed'}
                      </span>
                    )}
                    <div className="text-[#E08828] p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {booking.is_cancelled && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Event Cancelled by Organizer</span>
                      <span className="text-[11px] text-rose-700">
                        {booking.cancellation_reason || 'This trek has been cancelled. Please contact organizer for details or refunds.'}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-base font-bold text-[#1F1F1F] leading-snug">
                    {booking.trek_name || 'Himalayan Expedition'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-[#5A5551] mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-[#E08828]" />
                      Lead: <strong className="text-[#1F1F1F]">{booking.full_name}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-[#E08828]" />
                      Party: <strong className="text-[#1F1F1F]">{totalPeople}</strong>
                    </span>
                  </div>
                </div>

                {/* Live Admin Roster Status Bar: REG STATUS, PAYMENT STATUS, PAID (NPR), DUE (NPR), PICKUP POINT */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-2 mt-0.5 border-t border-orange-100 text-left">
                  <div className="bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-200/60">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Reg Status
                    </span>
                    <span
                      className={`text-[11px] font-extrabold mt-0.5 block truncate ${
                        (booking.status || '').toLowerCase().includes('cancelled')
                          ? 'text-rose-700'
                          : (booking.status || '').toLowerCase() === 'pending' ||
                            (booking.status || '').toLowerCase() === 'waitlisted'
                          ? 'text-amber-700'
                          : 'text-orange-700'
                      }`}
                    >
                      {booking.status || 'Confirmed'}
                    </span>
                  </div>

                  <div className="bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-200/60">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Payment Status
                    </span>
                    <span
                      className={`text-[11px] font-extrabold mt-0.5 block truncate ${
                        (booking.payment_status || '').toLowerCase().includes('paid') &&
                        !(booking.payment_status || '').toLowerCase().includes('unpaid')
                          ? 'text-orange-700'
                          : (booking.payment_status || '').toLowerCase().includes('partial') ||
                            (booking.payment_status || '').toLowerCase().includes('voucher')
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {booking.payment_status || 'Unpaid'}
                    </span>
                  </div>

                  <div className="bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-200/60">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Paid (NPR)
                    </span>
                    <span className="text-[11px] font-extrabold text-orange-700 mt-0.5 block truncate">
                      NPR {Number(booking.paid_amount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-200/60">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Due (NPR)
                    </span>
                    <span
                      className={`text-[11px] font-extrabold mt-0.5 block truncate ${
                        Number(booking.due_amount || 0) > 0 ? 'text-rose-700' : 'text-[#1F1F1F]'
                      }`}
                    >
                      NPR {Number(booking.due_amount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-200/60">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Pickup Point
                    </span>
                    <span className="text-[11px] font-extrabold text-[#1F1F1F] mt-0.5 block truncate">
                      {booking.pickup_point || 'TBA'}
                    </span>
                  </div>
                </div>

                {/* Default Quick Actions: Pay, Forward Voucher, Rate & Review (Compact) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-2 mt-0.5 border-t border-orange-100 flex items-center gap-1.5 flex-wrap"
                >
                  {onOpenPaymentPage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPaymentPage();
                      }}
                      className="h-7 px-2.5 bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] text-white font-bold rounded-lg text-[11px] whitespace-nowrap active:scale-[0.98] inline-flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0"
                    >
                      <CreditCard className="w-3 h-3 shrink-0" />
                      <span>Pay</span>
                    </button>
                  )}

                  {onUploadVoucher && (
                    <div className="inline-flex items-center rounded-lg overflow-hidden shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUploadVoucher(booking);
                        }}
                        className="h-7 px-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] whitespace-nowrap active:scale-[0.98] inline-flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <UploadCloud className="w-3 h-3 shrink-0" />
                        <span>Forward Voucher</span>
                      </button>

                      {booking.payment_voucher_url && (
                        <button
                          type="button"
                          title="View uploaded payment voucher"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingVoucherUrl(booking.payment_voucher_url || null);
                          }}
                          className="h-7 px-2 bg-orange-800 hover:bg-orange-900 border-l border-white/20 text-amber-200 hover:text-white inline-flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  )}

                  {onLeaveFeedback && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLeaveFeedback(booking);
                      }}
                      className="h-7 px-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-[11px] font-bold text-orange-800 hover:text-orange-900 whitespace-nowrap active:scale-[0.98] inline-flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
                    >
                      <Star className="w-3 h-3 text-[#E08828] fill-[#E08828] shrink-0" />
                      <span>Rate &amp; Review</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-3 bg-orange-50/35 border-t border-orange-100 space-y-2.5 text-xs animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-white rounded-xl border border-orange-200/70">
                    <div>
                      <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                        Contact Phone
                      </span>
                      <span className="font-semibold text-[#1F1F1F] flex items-center gap-1 mt-0.5 truncate">
                        <Phone className="w-3 h-3 text-[#E08828]" />
                        {booking.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                        Gender & Age
                      </span>
                      <span className="font-semibold text-[#1F1F1F] mt-0.5 block truncate">
                        {formatGender(booking.gender)} • Age {booking.age_group}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                        Registered At
                      </span>
                      <span className="font-semibold text-[#1F1F1F] mt-0.5 block">
                        {formatDate(booking.joined_at)}
                      </span>
                    </div>
                  </div>

                  {/* Companions / Team Members */}
                  {booking.team_members && booking.team_members.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#7C5338] mb-1 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#E08828]" />
                        Companions in this booking ({booking.team_members.length})
                      </h4>
                      <div className="space-y-1">
                        {booking.team_members.map((tm, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1.5 bg-white rounded-lg border border-orange-200/70 flex justify-between items-center text-xs"
                          >
                            <span className="font-semibold text-[#1F1F1F]">{tm.full_name}</span>
                            <span className="text-[10px] text-[#8C6245]">
                              {formatGender(tm.gender)} • {tm.age_group || 'Age not specified'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Links from Cloudflare D1 (WhatsApp, Itinerary) */}
                  <div className="p-2.5 bg-white rounded-xl border border-orange-200/70 space-y-1.5">
                    <span className="text-[9px] font-bold text-[#8C6245] uppercase tracking-wider block">
                      Trek Coordination & Itinerary
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onViewItinerary && (
                          <button
                            type="button"
                            onClick={() => onViewItinerary(booking)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-[#C85E12] bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-all cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Route Itinerary</span>
                          </button>
                        )}
                      </div>

                      {booking.whatsapp_link && (
                        <a
                          href={booking.whatsapp_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-bold text-white bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] rounded-lg transition-all shadow-2xs"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Join WhatsApp Group</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Secondary Actions (Share & Cancel) */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-orange-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onShare(booking)}
                        className="h-7 px-2.5 bg-white border border-orange-200 rounded-lg text-[11px] font-semibold text-[#7C5338] hover:bg-orange-50 active:scale-[0.98] inline-flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Share2 className="w-3 h-3 text-[#E08828]" />
                        <span>Share Booking</span>
                      </button>
                    </div>

                    {(booking.status || '').toLowerCase().includes('cancelled') ? (
                      <span className="h-7 px-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{booking.status || 'Cancelled by User'}</span>
                      </span>
                    ) : isConfirmingCancel ? (
                      <div className="flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 justify-between">
                        <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Cancel registration?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(null)}
                            className="h-6 px-2 bg-white border border-neutral-300 rounded-md text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={cancelingId === booking.id}
                            onClick={() => handleCancelClick(booking.id)}
                            className="h-6 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            {cancelingId === booking.id ? 'Canceling...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(booking.id)}
                        className="h-7 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancel Booking</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Attached Payment & Pricing Extension */}
      <div className="bg-white rounded-2xl border border-orange-200/80 p-3.5 sm:p-4 shadow-xs">
        <PaymentAndPricingSection
          compact
          onOpenVoucherUpload={
            onUploadVoucher && activeBookings[0] ? () => onUploadVoucher(activeBookings[0]) : undefined
          }
        />
      </div>
        </div>
      )}

      {/* Lightbox Modal for User Viewing Uploaded Voucher */}
      {viewingVoucherUrl && (
        <div
          className="fixed inset-0 z-[2200] bg-black/85 p-4 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setViewingVoucherUrl(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] bg-stone-900 rounded-2xl overflow-hidden flex flex-col p-3 border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-white text-xs font-bold">
              <span>My Uploaded Payment Voucher Receipt</span>
              <button
                type="button"
                onClick={() => setViewingVoucherUrl(null)}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex flex-col items-center gap-4 p-2">
              {viewingVoucherUrl
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean)
                .map((url, idx, arr) => (
                  <div key={idx} className="w-full flex flex-col items-center gap-1.5">
                    {arr.length > 1 && (
                      <span className="text-[11px] font-bold text-amber-400">
                        Receipt #{idx + 1}
                      </span>
                    )}
                    <img
                      src={url}
                      alt={`Uploaded Payment Receipt ${idx + 1}`}
                      className="max-w-full max-h-[65vh] object-contain rounded-lg"
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
