import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  LogOut,
  ShieldCheck,
  BookmarkCheck,
  Calendar,
  MapPin,
  ExternalLink,
  Compass,
  Heart,
  Mountain,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  CheckCircle2,
  Edit3,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Trek } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBookings: any[];
  allTreks: Trek[];
  favorites?: string[];
  onToggleFavorite?: (trekId: string) => void;
  onOpenTrek: (trek: Trek) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userBookings,
  allTreks,
  favorites = [],
  onToggleFavorite,
  onOpenTrek,
}) => {
  const { user, isAdmin, signOutUser, showProfileImage, updateUserProfile } = useAuth();
  const [activeProfileTab, setActiveProfileTab] = useState<'bookings' | 'saved' | 'settings'>('bookings');

  const [editName, setEditName] = useState(user?.displayName || '');
  const [editShowImage, setEditShowImage] = useState(showProfileImage);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditShowImage(showProfileImage);
    }
  }, [user, showProfileImage, isOpen]);

  if (!isOpen || !user) return null;

  const handleSignOut = async () => {
    await signOutUser();
    onClose();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateUserProfile({
        displayName: editName,
        showProfileImage: editShowImage,
      });
      setSaveMsg('Profile updated successfully!');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const savedTreksList = allTreks.filter((t) => favorites.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-6 border-b border-[#EFEAE4] relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-bold text-lg overflow-hidden shrink-0 shadow-xs">
              {user.photoURL && showProfileImage ? (
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
            className="p-2 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#F9F7F5] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Tabs: Bookings vs Saved vs Edit Profile */}
        <div className="flex border-b border-[#EFEAE4] bg-[#FAF8F5] p-1.5 gap-1.5 px-4 sm:px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveProfileTab('bookings')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'bookings'
                ? 'bg-white text-[#E08828] shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-[#E08828]" />
            <span>My Bookings ({userBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProfileTab('saved')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'saved'
                ? 'bg-white text-rose-600 shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeProfileTab === 'saved' ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
            <span>Saved ({savedTreksList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProfileTab('settings')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'settings'
                ? 'bg-white text-[#7ABA42] shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-[#7ABA42]" />
            <span>Edit Profile</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeProfileTab === 'settings' ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {saveMsg && (
                <div className="p-3 bg-[#7ABA42]/10 border border-[#7ABA42]/30 rounded-2xl flex items-center gap-2 text-xs text-[#5F9632] font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-[#7ABA42] shrink-0" />
                  <span>{saveMsg}</span>
                </div>
              )}

              {/* Display Name Field */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#5A5551] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#E08828]" />
                  <span>Full Display Name</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-sm font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#E08828]/30 focus:border-[#E08828] transition-all"
                    required
                  />
                  <Edit3 className="w-4 h-4 text-[#8B8680] absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#8B8680]">
                  This is the name displayed across Walk Nepal Walk when you register for hikes or upload gallery photos.
                </p>
              </div>

              {/* Profile Image Visibility Toggle */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E5E1DB] rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E1DB] flex items-center justify-center text-[#7ABA42]">
                      {editShowImage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-stone-400" />}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-[#1F1F1F]">Show Profile Picture</h5>
                      <p className="text-[11px] text-[#8B8680]">
                        {editShowImage ? 'Your Google avatar photo is visible' : 'Your avatar photo is hidden'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => setEditShowImage(!editShowImage)}
                    className={`relative w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                      editShowImage ? 'bg-[#7ABA42]' : 'bg-stone-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        editShowImage ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Avatar Preview Box */}
                <div className="pt-2 border-t border-[#E5E1DB]/60 flex items-center justify-between text-xs">
                  <span className="text-[#8B8680] font-medium">Preview how you appear:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-bold text-xs overflow-hidden">
                      {user.photoURL && editShowImage ? (
                        <img src={user.photoURL} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        ((editName || user.email || 'H')[0]).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold text-[#1F1F1F] text-xs">
                      {editName || user.email?.split('@')[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-[#E08828] hover:bg-[#D07818] text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Profile Settings</span>
                  </>
                )}
              </button>
            </form>
          ) : activeProfileTab === 'bookings' ? (
            <>
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
                                className="text-[11px] font-bold text-[#E08828] hover:underline cursor-pointer"
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
            </>
          ) : (
            <>
              {/* Saved Treks Section in Profile */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8B8680] mb-3 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>Saved Hikes & Wishlist</span>
                </h4>

                {savedTreksList.length === 0 ? (
                  <div className="p-8 text-center bg-[#F9F7F5] rounded-2xl border border-dashed border-[#E5E1DB] space-y-2">
                    <Heart className="w-8 h-8 text-rose-300 mx-auto" />
                    <p className="text-xs font-bold text-[#5A5551]">No saved hikes yet</p>
                    <p className="text-[11px] text-[#8B8680]">
                      Click the heart icon on any trek card on the home feed to save and access them quickly here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedTreksList.map((trek) => (
                      <div
                        key={trek.id}
                        className="p-3.5 bg-white rounded-2xl border border-[#EFEAE4] shadow-xs hover:border-[#E08828]/40 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0 relative border border-[#E5E1DB]">
                            {trek.featured_image ? (
                              <img src={trek.featured_image} alt={trek.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-stone-200">
                                <Mountain className="w-5 h-5 text-stone-400" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-[#E08828] uppercase tracking-wider block">
                              Hike #{trek.hike_number || 'Upcoming'}
                            </span>
                            <h5 className="font-bold text-xs sm:text-sm text-[#1F1F1F] truncate group-hover:text-[#E08828] transition-colors">
                              {trek.name}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-[#8B8680] mt-0.5">
                              <span>{trek.days || '1'} Day{Number(trek.days) > 1 ? 's' : ''}</span>
                              {trek.price && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-[#1B5E20]">NPR {typeof trek.price === 'number' ? trek.price.toLocaleString() : trek.price}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(trek.id)}
                              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Remove from saved"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenTrek(trek);
                            }}
                            className="px-3 py-1.5 bg-[#E08828] hover:bg-[#D07818] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAF6F0] border-t border-[#EFEAE4] flex items-center justify-between">
          <span className="text-[11px] text-[#8B8680]">Walk Nepal Walk • Community Account</span>
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
