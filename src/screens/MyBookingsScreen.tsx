import React, { useState, useMemo } from 'react';
import { Booking } from '../types';
import { HISTORICAL_TREKS } from '../data/historicalTreks';
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
} from 'lucide-react';

interface MyBookingsScreenProps {
  bookings: Booking[];
  loading: boolean;
  onCancelBooking: (bookingId: number | string) => Promise<void>;
  onExploreTreks: () => void;
  onShare: (booking: Booking) => void;
  onLeaveFeedback?: (booking: Booking) => void;
  onViewItinerary?: (booking: Booking) => void;
  onViewMyHikes?: () => void;
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
}) => {
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | string | null>(null);

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

  // Filter out bookings that have already been finalized / completed in Google Sheet
  const { activeBookings, completedCount } = useMemo(() => {
    let completed = 0;
    const active: Booking[] = [];

    bookings.forEach((b) => {
      const hikeNum = String(b.hike_number || b.trek_id || '').toLowerCase().trim();
      const isPastCompleted = (b.status || '').toLowerCase() === 'completed' || (hikeNum && completedHikeNumbers.has(hikeNum));

      if (isPastCompleted) {
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
    if (!dateStr) return 'TBA';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
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
      <div className="flex flex-col items-center justify-center py-20 text-[#8B8680]">
        <div className="w-8 h-8 border-3 border-[#E08828] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium uppercase tracking-wider">Loading your registrations...</p>
      </div>
    );
  }

  if (activeBookings.length === 0) {
    return (
      <div className="space-y-4 max-w-md mx-auto my-4">
        {completedCount > 0 && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 text-left space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{completedCount} Hike{completedCount > 1 ? 's' : ''} Completed &amp; Reconciled</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Your completed hikes have been verified and archived to your permanent record in the community Google Sheet! Check your lifetime stats, KM badges, and completed hike history.
            </p>
            {onViewMyHikes && (
              <button
                type="button"
                onClick={onViewMyHikes}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>View My Hikes &amp; Stats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#F0EBE5] p-8 text-center shadow-xs">
          <div className="w-14 h-14 bg-[#F9F7F5] rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-[#E5E1DB]">
            <Compass className="w-7 h-7 text-[#E08828]" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">No Active Upcoming Bookings</h3>
          <p className="text-xs text-[#8B8680] mt-1.5 leading-relaxed">
            You don't have any pending or upcoming trek reservations. Browse upcoming hikes and claim your spot on the live roster!
          </p>
          <button
            type="button"
            onClick={onExploreTreks}
            className="mt-5 w-full min-h-[44px] px-6 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-[0.99] cursor-pointer"
          >
            Explore Available Treks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {completedCount > 0 && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>{completedCount} completed hike{completedCount > 1 ? 's' : ''}</strong> moved to your lifetime record in <strong>My Hikes</strong>.
            </span>
          </div>
          {onViewMyHikes && (
            <button
              type="button"
              onClick={onViewMyHikes}
              className="shrink-0 px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
            >
              View My Hikes →
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1F1F1F]">My Active Bookings</h2>
          <p className="text-[11px] text-[#8B8680]">
            Confirmed upcoming Himalayan rosters and team details
          </p>
        </div>
        <span className="px-2.5 py-1 bg-white border border-[#E5E1DB] rounded-full text-xs font-bold text-[#5A5551] shadow-xs">
          {activeBookings.length} Active {activeBookings.length === 1 ? 'Trip' : 'Trips'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {activeBookings.map((booking) => {
          const isExpanded = expandedId === booking.id;
          const isConfirmingCancel = confirmCancelId === booking.id;
          const totalPeople = Number(booking.pax) > 0 ? Number(booking.pax) : 1 + (booking.team_members?.length || 0);

          return (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-[#EFEAE4] shadow-xs overflow-hidden transition-all duration-200"
            >
              {/* Card Header (Tap to toggle) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedId(isExpanded ? null : booking.id)}
                className="p-3.5 sm:p-4 flex flex-col gap-2.5 cursor-pointer hover:bg-[#F9F7F5]/60 select-none active:bg-[#F3F1ED]"
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
                    <span className="text-[11px] text-[#8B8680] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#E08828]" />
                      {formatDate(booking.trek_date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {booking.is_cancelled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Cancelled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7ABA42] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Confirmed
                      </span>
                    )}
                    <div className="text-[#8B8680] p-1">
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
                      <User className="w-3.5 h-3.5 text-[#8B8680]" />
                      Lead: <strong className="text-[#1F1F1F]">{booking.full_name}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-[#8B8680]" />
                      Party: <strong className="text-[#1F1F1F]">{totalPeople}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-[#F9F7F5] border-t border-[#F0EBE5] space-y-3 text-xs animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-[#E5E1DB]">
                    <div>
                      <span className="text-[9px] font-bold text-[#8B8680] uppercase tracking-wider block">
                        Contact Phone
                      </span>
                      <span className="font-semibold text-[#1F1F1F] flex items-center gap-1 mt-0.5 truncate">
                        <Phone className="w-3 h-3 text-[#E08828]" />
                        {booking.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[#8B8680] uppercase tracking-wider block">
                        Gender & Age
                      </span>
                      <span className="font-semibold text-[#1F1F1F] mt-0.5 block truncate">
                        {formatGender(booking.gender)} • Age {booking.age_group}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-bold text-[#8B8680] uppercase tracking-wider block">
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
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#5A5551] mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-[#7ABA42]" />
                        Companions in this booking ({booking.team_members.length})
                      </h4>
                      <div className="space-y-1.5">
                        {booking.team_members.map((tm, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-white rounded-xl border border-[#E5E1DB] flex justify-between items-center text-xs"
                          >
                            <span className="font-semibold text-[#1F1F1F]">{tm.full_name}</span>
                            <span className="text-[10px] text-[#8B8680]">
                              {formatGender(tm.gender)} • {tm.age_group || 'Age not specified'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Links from Cloudflare D1 (WhatsApp, Itinerary) */}
                  <div className="p-3 bg-white rounded-xl border border-[#E5E1DB] space-y-2">
                    <span className="text-[9px] font-bold text-[#8B8680] uppercase tracking-wider block">
                      Trek Coordination & Itinerary
                    </span>
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {onViewItinerary && (
                          <button
                            type="button"
                            onClick={() => onViewItinerary(booking)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#E08828] bg-[#E08828]/10 hover:bg-[#E08828]/20 border border-[#E08828]/20 rounded-lg transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Route Itinerary</span>
                          </button>
                        )}
                      </div>

                        {booking.whatsapp_link && (
                          <a
                            href={booking.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-lg transition-all shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Join WhatsApp Group</span>
                          </a>
                        )}
                      </div>
                    </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-[#F0EBE5]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onShare(booking)}
                        className="min-h-[40px] px-3 bg-white border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#5A5551] hover:bg-[#F3F1ED] active:scale-[0.99] flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#E08828]" />
                        <span>Share Booking</span>
                      </button>

                      {onLeaveFeedback && (
                        <button
                          type="button"
                          onClick={() => onLeaveFeedback(booking)}
                          className="min-h-[40px] px-3 bg-[#7ABA42]/10 hover:bg-[#7ABA42]/20 border border-[#7ABA42]/30 rounded-xl text-xs font-bold text-[#4c8c4a] hover:text-[#2e7d32] active:scale-[0.99] flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>Rate &amp; Review</span>
                        </button>
                      )}
                    </div>

                    {isConfirmingCancel ? (
                      <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-200 justify-between">
                        <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Cancel registration?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(null)}
                            className="min-h-[36px] px-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={cancelingId === booking.id}
                            onClick={() => handleCancelClick(booking.id)}
                            className="min-h-[36px] px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                          >
                            {cancelingId === booking.id ? 'Canceling...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmCancelId(booking.id)}
                        className="min-h-[44px] px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
