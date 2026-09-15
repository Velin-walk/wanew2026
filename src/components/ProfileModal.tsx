import React from 'react';
import { X, User, LogOut, ShieldCheck, BookmarkCheck, Calendar, MapPin, ExternalLink, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Trek } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBookings: any[];
  allTreks: Trek[];
  onOpenTrek: (trek: Trek) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userBookings,
  allTreks,
  onOpenTrek,
}) => {
  const { user, isAdmin, signOutUser } = useAuth();

  if (!isOpen || !user) return null;

  const handleSignOut = async () => {
    await signOutUser();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-6 border-b border-[#EFEAE4] relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-bold text-lg overflow-hidden shrink-0 shadow-xs">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User Avatar'} className="w-full h-full object-cover" />
              ) : (
                (user.displayName?.[0] || user.email?.[0] || 'H').toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#1F1F1F] tracking-tight">
                  {user.displayName || user.email?.split('@')[0] || 'Hiker'}
                </h3>
                {isAdmin && (
                  <span className="px-2 py-0.5 bg-amber-100 text-[#E08828] border border-amber-200 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8B8680] truncate max-w-[220px]">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Account Overview Box */}
          <div className="bg-[#F9F7F5] border border-[#EFEAE4] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E1DB] flex items-center justify-center text-[#E08828]">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F1F1F] block">Registered Treks</span>
                <span className="text-[11px] text-[#8B8680]">
                  {userBookings.length} active booking{userBookings.length === 1 ? '' : 's'} linked to your account
                </span>
              </div>
            </div>
            <span className="text-lg font-black text-[#E08828] bg-white px-3 py-1 rounded-xl border border-[#E5E1DB]">
              {userBookings.length}
            </span>
          </div>

          {/* Booked Treks List */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8B8680] mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
              <span>My Booking History</span>
            </h4>

            {userBookings.length === 0 ? (
              <div className="p-6 text-center bg-[#F9F7F5] rounded-2xl border border-dashed border-[#E5E1DB]">
                <Compass className="w-8 h-8 text-[#C2BCB4] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#5A5551]">No active trek bookings yet</p>
                <p className="text-[11px] text-[#8B8680] mt-1">Explore upcoming treks and register to see your bookings here!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userBookings.map((b, idx) => {
                  const matchingTrek = allTreks.find((t) => t.id === b.trek_id || t.hike_number === b.hike_number);
                  return (
                    <div
                      key={b.id || idx}
                      className="p-4 bg-white rounded-2xl border border-[#EFEAE4] shadow-xs hover:border-[#E08828]/40 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-[#E08828] uppercase tracking-wider block">
                            Hike #{b.hike_number || matchingTrek?.hike_number || 'TBD'}
                          </span>
                          <h5 className="font-bold text-sm text-[#1F1F1F] leading-tight mt-0.5">
                            {b.trek_name || matchingTrek?.name || 'Walk Nepal Hike'}
                          </h5>
                        </div>
                        <span className="px-2 py-0.5 bg-[#7ABA42]/10 text-[#7ABA42] border border-[#7ABA42]/20 text-[10px] font-bold rounded-full">
                          Confirmed
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5A5551] pt-1 border-t border-[#F9F7F5]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-[#8B8680]" />
                          {b.full_name || b.name} ({b.pax || 1} pax)
                        </span>
                        {b.pickup_point && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#8B8680]" />
                            {b.pickup_point}
                          </span>
                        )}
                      </div>

                      {matchingTrek && (
                        <div className="flex items-center justify-between pt-2">
                          {matchingTrek.whatsapp_link ? (
                            <a
                              href={matchingTrek.whatsapp_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold text-[#7ABA42] hover:underline flex items-center gap-1"
                            >
                              Join Hike WhatsApp Group <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span />}

                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenTrek(matchingTrek);
                            }}
                            className="text-[11px] font-bold text-[#E08828] hover:underline"
                          >
                            View Itinerary →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAF6F0] border-t border-[#EFEAE4] flex items-center justify-between">
          <span className="text-[11px] text-[#8B8680]">Synced via Firebase Auth</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
