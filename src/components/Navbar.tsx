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
  ChevronRight
} from 'lucide-react';
import { SubPageType } from './InfoPagesModal';
import { isAdminEmail } from '../adminUtils';

interface NavbarProps {
  currentTab: 'treks' | 'bookings' | 'saved' | 'mapminers' | 'admin';
  onTabChange: (tab: any) => void;
  bookingCount: number;
  savedCount: number;
  onOpenInvite?: () => void;
  userEmail: string;
  onOpenContribute?: () => void;
  onOpenInfoPage?: (page: SubPageType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  bookingCount,
  savedCount,
  onOpenInvite,
  userEmail,
  onOpenContribute,
  onOpenInfoPage,
}) => {
  const isMapMiners = currentTab === 'mapminers';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

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
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EFEAE4] w-full"
    >
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Brand / Screen Title */}
        {isMapMiners ? (
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#F9F7F5] border border-[#E5E1DB] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              <img
                src="/mapminers-logo.png"
                alt="Map Miners Logo"
                className="w-full h-full object-contain"
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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#F9F7F5] border border-[#E5E1DB] p-1 flex items-center justify-center shrink-0 group-hover:border-[#7ABA42]/40 transition-colors shadow-xs">
              <img
                src="/logo.png"
                alt="Walk Nepal Walk Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to vector mountain if logo image fails
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.add('bg-[#E08828]/10', 'border-[#E08828]/20');
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
          className="hidden md:flex items-center gap-1 bg-[#F9F7F5] border border-[#EFEAE4] p-1 rounded-2xl"
        >
          <button
            type="button"
            id="nav-tab-treks"
            onClick={() => onTabChange('treks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'treks'
                ? 'bg-white text-[#E08828] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            id="nav-tab-bookings"
            onClick={() => onTabChange('bookings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all relative ${
              currentTab === 'bookings'
                ? 'bg-white text-[#7ABA42] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>My Bookings</span>
            {bookingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#E08828] text-white text-[10px] font-extrabold rounded-full">
                {bookingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="nav-tab-saved"
            onClick={() => onTabChange('saved')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all relative ${
              currentTab === 'saved'
                ? 'bg-white text-rose-600 shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <Heart className={`w-4 h-4 ${currentTab === 'saved' ? 'fill-rose-500' : ''}`} />
            <span>Saved</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-extrabold rounded-full">
                {savedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="nav-tab-mapminers"
            onClick={() => onTabChange('mapminers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentTab === 'mapminers'
                ? 'bg-white text-[#7ABA42] shadow-xs font-bold'
                : 'text-[#5A5551] hover:text-[#1F1F1F]'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/mapminers-logo.png"
                alt="MapMiners"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling;
                  if (sibling) sibling.classList.remove('hidden');
                }}
              />
              <Compass className="w-4 h-4 text-[#7ABA42] hidden" />
            </div>
            <span>MapMiners</span>
          </button>

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              id="nav-tab-resources"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer group ${
                dropdownOpen
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
                className="absolute right-0 mt-2 w-56 bg-white border border-[#EFEAE4] rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-[#F9F7F5] mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8680]">Guides & Support</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('payment')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-[#E08828] group-hover:scale-110 transition-transform" />
                    <span>Payment & Pricing</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('trek_tips')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-[#7ABA42] group-hover:scale-110 transition-transform" />
                    <span>Trek Tips & Gear</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('safety_policy')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#E08828] group-hover:scale-110 transition-transform" />
                    <span>Safety & Refund</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div className="my-1 border-t border-[#F9F7F5]" />

                <button
                  type="button"
                  onClick={() => handleSubPageClick('request_private_trek')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-bold text-[#E08828] hover:bg-[#FAF2EB] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-[#E08828] group-hover:scale-110 transition-transform" />
                    <span>Request Private Trek</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#E08828] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSubPageClick('contact')}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-[#7ABA42] group-hover:scale-110 transition-transform" />
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

          {/* User Avatar with Dropdown */}
          <div className="relative" ref={avatarDropdownRef}>
            <button
              type="button"
              id="header-user-avatar"
              onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7ABA42]/15 text-[#7ABA42] border border-[#7ABA42]/30 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 select-none shadow-xs cursor-pointer active:scale-95 transition-transform"
              title={`Signed in as ${userEmail}`}
            >
              {userEmail ? userEmail[0].toUpperCase() : 'V'}
            </button>

            {avatarDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white border border-[#EFEAE4] rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-[#F9F7F5] mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8680] truncate block">
                    {userEmail}
                  </span>
                </div>

                {isAdminEmail(userEmail) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDropdownOpen(false);
                      onTabChange('admin');
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#1F1F1F] hover:bg-[#F9F7F5] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#E08828] group-hover:scale-110 transition-transform" />
                      <span>Admin Panel</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4] group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
                
                {!isAdminEmail(userEmail) && (
                   <div className="px-3.5 py-2 text-xs text-[#5A5551]">
                     Standard Account
                   </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
