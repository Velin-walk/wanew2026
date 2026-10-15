import React, { useState, useRef, useEffect } from 'react';
import {
  Mountain,
  Share2,
  Compass,
  BookmarkCheck,
  Heart,
  Home,
  CreditCard,
  ShieldCheck,
  Users,
  Mail,
  ChevronRight,
  Camera,
  Trophy,
  Star
} from 'lucide-react';
import { SubPageType } from './InfoPagesModal';
import { isAdminEmail } from '../adminUtils';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import { NavigationNotifications } from '../services/notificationService';

interface NavbarProps {
  currentTab: 'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'leaderboard' | 'admin';
  activeInfoPage?: SubPageType | null;
  onTabChange: (tab: any, targetId?: string) => void;
  bookingCount: number;
  savedCount: number;
  onOpenInvite?: () => void;
  userEmail?: string;
  onOpenContribute?: () => void;
  onOpenInfoPage?: (page: SubPageType) => void;
  onOpenProfile?: () => void;
  notifications?: NavigationNotifications;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  activeInfoPage,
  onTabChange,
  bookingCount,
  savedCount,
  onOpenInvite,
  onOpenContribute,
  onOpenInfoPage,
  onOpenProfile,
  notifications,
}) => {
  const { user, userEmail, isAdmin, showProfileImage, openAuthModal, signOutUser } = useAuth();
  const isMapMiners = currentTab === 'mapminers';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tab: 'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'leaderboard' | 'admin', targetId?: string) => {
    if (tab === 'mapminers' && !user) {
      openAuthModal('Sign in to access Map Miners community trail intelligence and GPX uploads', () => onTabChange('mapminers', targetId));
      return;
    }
    if (tab === 'admin' && (!user || !isAdmin)) {
      openAuthModal('Sign in with Admin email (walknepalwalk@gmail.com) to access the Admin Panel', () => onTabChange('admin'));
      return;
    }
    onTabChange(tab, targetId);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target as Node)) {
        setAvatarDropdownOpen(false);
      }
    };
    if (dropdownOpen || avatarDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, avatarDropdownOpen]);

  const handleSubPageClick = (page: SubPageType) => {
    setDropdownOpen(false);
    if (onOpenInfoPage) {
      onOpenInfoPage(page);
    }
  };

  return (
    <header
      id="top-header"
      className="sticky top-0 z-[1010] bg-white/95 backdrop-blur-md border-b border-[#EFEAE4] w-full"
    >
      <div className="w-full px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand / Screen Title */}
        {isMapMiners ? (
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-transparent border border-[#E5E1DB] flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              <img
                src="/mapminers-logo.png"
                alt="Map Miners Logo"
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => {
                  // Fallback to compass icon if custom image is not yet placed
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.add('bg-[#7ABA42]/10', 'border-[#7ABA42]/20');
                  }
                }}
              />
              <Compass className="w-5 h-5 text-[#7ABA42] hidden only:block" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-[#1F1F1F] leading-tight">
                Map Miners
              </h1>
              <p className="text-[10px] text-[#8B8680] leading-none mt-0.5">
                Trails contributed by community
              </p>
            </div>
          </div>
        ) : (
          <div
            id="app-brand-button"
            role="button"
            tabIndex={0}
            onClick={() => onTabChange('treks')}
            onKeyDown={(e) => e.key === 'Enter' && onTabChange('treks')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            aria-label="Walk Nepal Walk - Go to Treks"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-transparent flex items-center justify-center shrink-0 overflow-hidden transition-transform group-hover:scale-105">
              <img
                src="/logo.png"
                alt="Walk Nepal Walk Logo"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  // Fallback to vector mountain if logo image fails
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.add('bg-[#E08828]/10', 'border', 'border-[#E08828]/20');
                  }
                }}
              />
              <Mountain className="w-5 h-5 text-[#E08828] hidden only:block" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-[#1F1F1F] group-hover:text-[#E08828] transition-colors leading-tight">
                Walk Nepal Walk
              </h1>
              <p className="text-[10px] text-[#8B8680] leading-none mt-0.5">
                Fitness, Fun & Friendship with Treks & Hikes
              </p>
            </div>
          </div>
        )}

        {/* Desktop Navigation Center */}
        <nav
          aria-label="Desktop Navigation"
          className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-[#F9F7F5] border border-[#EFEAE4] p-1 rounded-2xl"
        >
          <button
            type="button"
            id="nav-tab-treks"
            onClick={() => handleTabClick('treks')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              currentTab === 'treks' && !activeInfoPage
                ? 'bg-white text-[#E08828] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Home</span>
            {notifications?.treks?.hasUnread && (
              <span className="w-2 h-2 rounded-full bg-[#E08828] animate-pulse ring-2 ring-white shrink-0 ml-0.5" title="New trek event update" />
            )}
          </button>

          <button
            type="button"
            id="nav-tab-bookings"
            onClick={() => handleTabClick('bookings')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              currentTab === 'bookings' && !activeInfoPage
                ? 'bg-white text-[#7ABA42] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <BookmarkCheck className="w-4 h-4 shrink-0" />
            <span>My Bookings</span>
            {bookingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#E08828] text-white text-[10px] font-extrabold rounded-full">
                {bookingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="nav-tab-leaderboard"
            onClick={() => handleTabClick('leaderboard')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              currentTab === 'leaderboard' && !activeInfoPage
                ? 'bg-white text-amber-600 shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Trophy className={`w-4 h-4 shrink-0 ${currentTab === 'leaderboard' && !activeInfoPage ? 'text-amber-500 fill-amber-100' : 'text-[#8B8680]'}`} />
            <span>Leaderboard</span>
            {notifications?.leaderboard?.hasUnread && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-white shrink-0 ml-0.5" title="Leaderboard rankings update" />
            )}
          </button>

          <button
            type="button"
            id="nav-tab-mapminers"
            onClick={() => handleTabClick('mapminers', notifications?.mapminers?.targetId)}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              currentTab === 'mapminers' && !activeInfoPage
                ? 'bg-white text-[#7ABA42] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/mapminers-logo.png"
                alt="MapMiners"
                className="w-full h-full object-cover rounded-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling;
                  if (sibling) sibling.classList.remove('hidden');
                }}
              />
              <Compass className="w-4 h-4 text-[#7ABA42] hidden" />
            </div>
            <span>MapMiners</span>
            {notifications?.mapminers?.hasUnread && (
              <span className="w-2 h-2 rounded-full bg-[#7ABA42] animate-pulse ring-2 ring-white shrink-0 ml-0.5" title="New map contribution" />
            )}
          </button>

          <button
            type="button"
            id="nav-tab-gallery"
            onClick={() => handleTabClick('gallery', notifications?.gallery?.targetId)}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              currentTab === 'gallery' && !activeInfoPage
                ? 'bg-white text-[#7ABA42] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Camera className="w-4 h-4 text-[#7ABA42] shrink-0" />
            <span>Gallery</span>
            {notifications?.gallery?.hasUnread && (
              <span className="w-2 h-2 rounded-full bg-[#7ABA42] animate-pulse ring-2 ring-white shrink-0 ml-0.5" title="New photos uploaded" />
            )}
          </button>

          {(isAdmin || isAdminEmail(userEmail)) && (
            <button
              type="button"
              id="nav-tab-admin"
              onClick={() => handleTabClick('admin')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'admin' && !activeInfoPage
                  ? 'bg-white text-[#E08828] shadow-xs font-bold'
                  : 'text-[#5A5551] hover:text-[#1F1F1F]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#E08828] shrink-0" />
              <span>Admin Panel</span>
            </button>
          )}

          <button
            type="button"
            id="nav-tab-reviews"
            onClick={() => handleSubPageClick('reviews')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeInfoPage === 'reviews'
                ? 'bg-white text-amber-600 shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            <span>Reviews</span>
          </button>

          <button
            type="button"
            id="nav-tab-pricing"
            onClick={() => handleSubPageClick('payment')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeInfoPage === 'payment'
                ? 'bg-white text-[#E08828] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#E08828] shrink-0" />
            <span>Payment</span>
          </button>

          <div ref={dropdownRef} className="relative shrink-0">
            <button
              type="button"
              id="nav-tab-resources"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap cursor-pointer group ${
                dropdownOpen ||
                activeInfoPage === 'trek_tips' ||
                activeInfoPage === 'safety_policy' ||
                activeInfoPage === 'request_private_trek' ||
                activeInfoPage === 'contact'
                  ? 'bg-white text-[#E08828] shadow-xs font-bold'
                  : 'text-[#5A5551] hover:text-[#1F1F1F]'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-0.5 w-3.5 h-3.5 shrink-0">
                <span className={`w-3.5 h-[2px] rounded-full transition-colors ${dropdownOpen ? 'bg-[#E08828]' : 'bg-[#1F1F1F] group-hover:bg-[#E08828]'}`} />
                <span className="w-3.5 h-[2px] rounded-full bg-[#7ABA42]" />
                <span className={`w-3.5 h-[2px] rounded-full transition-colors ${dropdownOpen ? 'bg-[#E08828]' : 'bg-[#1F1F1F] group-hover:bg-[#E08828]'}`} />
              </div>
              <span>Resources</span>
            </button>

            {dropdownOpen && (
              <div
                id="navbar-resources-dropdown"
                className="absolute right-0 mt-2 w-60 bg-white border border-[#EFEAE4] rounded-2xl shadow-xl py-2 z-[1020] animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3.5 py-1.5 border-b border-[#F9F7F5] mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8680]">Guides &amp; Support</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('trek_tips')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-[#7ABA42] shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="leading-tight">Trek Tips &amp; Gear</div>
                      <div className="text-[10px] font-normal text-[#8B8680]">Packing &amp; Prep Guide</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('safety_policy')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#E08828] shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Safety &amp; Refund</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div className="my-1 border-t border-[#F9F7F5]" />

                <button
                  type="button"
                  onClick={() => handleSubPageClick('request_private_trek')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-bold text-[#E08828] hover:bg-[#FAF2EB] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-[#E08828] shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Request Private Trek</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#E08828] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('contact')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-[#7ABA42] shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Contact Support</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* In Map Miners view: Show Contribute Map button alongside profile */}
          {isMapMiners ? (
            <button
              type="button"
              id="header-contribute-map-btn"
              onClick={onOpenContribute}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7ABA42] hover:bg-[#6CA838] active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              aria-label="Contribute Map"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Contribute Map</span>
            </button>
          ) : onOpenInvite ? (
            <button
              type="button"
              id="header-invite-btn"
              onClick={onOpenInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F9F7F5] hover:bg-[#F3F1ED] active:scale-95 border border-[#E5E1DB] text-[#5A5551] rounded-xl transition-all shadow-xs"
              aria-label="Invite or enter code"
            >
              <Share2 className="w-3.5 h-3.5 text-[#E08828]" />
              <span className="text-xs font-semibold">Share Trek</span>
            </button>
          ) : null}

          {/* User Avatar & Profile Modal Trigger */}
          {user ? (
            <div className="relative" ref={avatarDropdownRef}>
              <button
                type="button"
                id="header-user-avatar"
                onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7ABA42]/15 text-[#7ABA42] border border-[#7ABA42]/30 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 select-none shadow-xs cursor-pointer active:scale-95 transition-transform overflow-hidden"
                title={`Signed in as ${userEmail}`}
              >
                {user.photoURL && showProfileImage ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.displayName?.[0] || userEmail?.[0] || 'H').toUpperCase()
                )}
              </button>

              {avatarDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-[#EFEAE4] rounded-2xl shadow-xl py-2 z-[1020] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 border-b border-[#F9F7F5] mb-1">
                    <span className="text-xs font-bold text-[#1F1F1F] truncate block">
                      {user.displayName || 'Hiker Account'}
                    </span>
                    <span className="text-[10px] text-[#8B8680] truncate block">
                      {userEmail}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDropdownOpen(false);
                      onOpenProfile?.();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserIcon className="w-4 h-4 text-[#7ABA42] group-hover:scale-110 transition-transform" />
                      <span>My Profile & Bookings</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDropdownOpen(false);
                      onTabChange('saved');
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500/30 group-hover:scale-110 transition-transform" />
                      <span>Saved Hikes ({savedCount})</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {(isAdmin || isAdminEmail(userEmail)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarDropdownOpen(false);
                        onTabChange('admin');
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-[#E08828] group-hover:scale-110 transition-transform" />
                        <span>Admin Panel</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}

                  <div className="my-1 border-t border-[#F9F7F5]" />

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDropdownOpen(false);
                      signOutUser();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              id="header-sign-in-btn"
              onClick={() => openAuthModal('Sign in to view your Hiker Profile and synced booking history')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#E08828] hover:bg-[#D07717] active:scale-95 text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export const DesktopResourcesBar: React.FC<{
  activeInfoPage?: SubPageType | null;
  onOpenInfoPage?: (page: SubPageType) => void;
}> = ({ activeInfoPage, onOpenInfoPage }) => {
  const items: Array<{
    id: SubPageType;
    label: string;
    sub: string;
    icon: React.ReactNode;
    accentBg: string;
    activeClass: string;
  }> = [
    {
      id: 'reviews',
      label: 'Hiker Reviews',
      sub: '4.9★ Community Stories',
      icon: <Star className="w-4 h-4 text-amber-500 fill-amber-500" />,
      accentBg: 'bg-amber-50 border-amber-200/70',
      activeClass: 'ring-2 ring-amber-400 bg-amber-50/90 border-amber-300',
    },
    {
      id: 'payment',
      label: 'Payment & Pricing',
      sub: 'QR & Voucher Upload',
      icon: <CreditCard className="w-4 h-4 text-[#E08828]" />,
      accentBg: 'bg-orange-50 border-orange-200/70',
      activeClass: 'ring-2 ring-[#E08828] bg-orange-50/90 border-[#E08828]',
    },
    {
      id: 'trek_tips',
      label: 'Trek Tips & Gear',
      sub: 'Packing & Prep Guide',
      icon: <Compass className="w-4 h-4 text-[#7ABA42]" />,
      accentBg: 'bg-emerald-50 border-emerald-200/70',
      activeClass: 'ring-2 ring-[#7ABA42] bg-emerald-50/90 border-[#7ABA42]',
    },
    {
      id: 'safety_policy',
      label: 'Safety & Refund',
      sub: 'Trail Rules & Policy',
      icon: <ShieldCheck className="w-4 h-4 text-[#E08828]" />,
      accentBg: 'bg-orange-50 border-orange-200/70',
      activeClass: 'ring-2 ring-[#E08828] bg-orange-50/90 border-[#E08828]',
    },
    {
      id: 'request_private_trek',
      label: 'Request Private Trek',
      sub: 'Custom Group Dates',
      icon: <Users className="w-4 h-4 text-white" />,
      accentBg: 'bg-[#E08828] border-[#E08828]',
      activeClass: 'ring-2 ring-[#1F1F1F] bg-[#FFF4E8] border-[#E08828]',
    },
    {
      id: 'contact',
      label: 'Contact Support',
      sub: 'Coordinators & WhatsApp',
      icon: <Mail className="w-4 h-4 text-[#7ABA42]" />,
      accentBg: 'bg-emerald-50 border-emerald-200/70',
      activeClass: 'ring-2 ring-[#7ABA42] bg-emerald-50/90 border-[#7ABA42]',
    },
  ];

  return (
    <section
      aria-label="Quick Resources & Guides"
      className="hidden lg:block w-full"
    >
      <div className="grid grid-cols-6 gap-2.5">
        {items.map((item) => {
          const isActive = activeInfoPage === item.id;
          const isHighlight = item.id === 'request_private_trek';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenInfoPage?.(item.id)}
              className={`group flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-98 ${
                isActive
                  ? item.activeClass
                  : isHighlight
                  ? 'bg-gradient-to-br from-[#FFF7EE] to-[#FFECD6] border-[#F5CBA7] hover:border-[#E08828]'
                  : 'bg-white border-[#E5E1DB] hover:border-[#C8C2B8]'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.accentBg}`}
              >
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-[#1F1F1F] truncate leading-tight">
                  {item.label}
                </div>
                <div className="text-[10px] font-medium text-[#8B8680] truncate mt-0.5 leading-none">
                  {item.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
