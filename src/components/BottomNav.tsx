import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  BookmarkCheck,
  Heart,
  Share2,
  Home,
  CreditCard,
  ShieldCheck,
  Users,
  Mail,
  ChevronRight,
  Camera
} from 'lucide-react';
import { SubPageType } from './InfoPagesModal';
import { useAuth } from '../context/AuthContext';
import { User, LogOut } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'admin';
  onTabChange: (tab: any) => void;
  userEmail?: string;
  bookingCount: number;
  savedCount: number;
  onOpenInfoPage?: (page: SubPageType) => void;
  onOpenProfile?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  bookingCount,
  savedCount,
  onOpenInfoPage,
  onOpenProfile,
}) => {
  const { user, isAdmin, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleMobileTabClick = (tab: 'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'admin') => {
    if (tab === 'mapminers' && !user) {
      openAuthModal('Sign in to access Map Miners community trail intelligence and GPX uploads', () => onTabChange('mapminers'));
      return;
    }
    if (tab === 'admin' && (!user || !isAdmin)) {
      openAuthModal('Sign in with Admin email (walknepalwalk@gmail.com) to access the Admin Panel', () => onTabChange('admin'));
      return;
    }
    onTabChange(tab);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSubPageClick = (page: SubPageType) => {
    setDropdownOpen(false);
    if (onOpenInfoPage) {
      onOpenInfoPage(page);
    }
  };
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#EFEAE4] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] select-none"
    >
      <div className="w-full max-w-3xl mx-auto px-2 py-1.5 flex items-center justify-around">
        {/* Treks Home Tab */}
        <button
          type="button"
          id="tab-treks"
          onClick={() => handleMobileTabClick('treks')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            currentTab === 'treks'
              ? 'text-[#E08828] font-bold'
              : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              currentTab === 'treks' ? 'bg-[#E08828]/10 scale-105' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Home</span>
        </button>

        {/* My Bookings Tab */}
        <button
          type="button"
          id="tab-bookings"
          onClick={() => handleMobileTabClick('bookings')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            currentTab === 'bookings'
              ? 'text-[#7ABA42] font-bold'
              : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg relative transition-transform ${
              currentTab === 'bookings' ? 'bg-[#7ABA42]/10 scale-105' : ''
            }`}
          >
            <BookmarkCheck className="w-5 h-5" />
            {bookingCount > 0 && (
              <span className="absolute -top-1 -right-1.5 px-1 min-w-[16px] h-4 bg-[#E08828] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {bookingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Bookings</span>
        </button>

        {/* Saved / Favorites Tab */}
        <button
          type="button"
          id="tab-saved"
          onClick={() => handleMobileTabClick('saved')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            currentTab === 'saved'
              ? 'text-rose-600 font-bold'
              : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg relative transition-transform ${
              currentTab === 'saved' ? 'bg-rose-50 scale-105' : ''
            }`}
          >
            <Heart className={`w-5 h-5 ${currentTab === 'saved' ? 'fill-rose-500 text-rose-500' : ''}`} />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1.5 px-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {savedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Saved</span>
        </button>

        {/* MapMiners Tab */}
        <button
          type="button"
          id="tab-mapminers"
          onClick={() => handleMobileTabClick('mapminers')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            currentTab === 'mapminers'
              ? 'text-[#7ABA42] font-bold'
              : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform flex items-center justify-center ${
              currentTab === 'mapminers' ? 'bg-[#7ABA42]/10 scale-105' : ''
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center overflow-hidden">
              <img
                src="/mapminers-logo.png"
                alt="MapMiners"
                className="w-full h-full object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling;
                  if (sibling) sibling.classList.remove('hidden');
                }}
              />
              <Compass className="w-5 h-5 text-[#7ABA42] hidden" />
            </div>
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">MapMiners</span>
        </button>

        {/* Gallery Tab */}
        <button
          type="button"
          id="tab-gallery"
          onClick={() => handleMobileTabClick('gallery')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
            currentTab === 'gallery'
              ? 'text-[#7ABA42] font-bold'
              : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform flex items-center justify-center ${
              currentTab === 'gallery' ? 'bg-[#7ABA42]/10 scale-105' : ''
            }`}
          >
            <Camera className="w-5 h-5 text-[#7ABA42]" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Gallery</span>
        </button>

        {/* Resources & Support Tab */}
        <div ref={dropdownRef} className="flex-1 flex flex-col items-center justify-center relative">
          <button
            type="button"
            id="tab-resources"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`w-full flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative ${
              dropdownOpen
                ? 'text-[#E08828] font-bold'
                : 'text-[#8B8680] hover:text-[#1F1F1F] font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg flex items-center justify-center ${dropdownOpen ? 'bg-[#E08828]/10 scale-105' : ''}`}>
              <div className="flex flex-col items-center justify-center gap-[3px] w-5 h-5 shrink-0">
                <span className={`w-4 h-[2px] rounded-full transition-colors ${dropdownOpen ? 'bg-[#E08828]' : 'bg-[#5A5551]'}`} />
                <span className="w-4 h-[2px] rounded-full bg-[#7ABA42]" />
                <span className={`w-4 h-[2px] rounded-full transition-colors ${dropdownOpen ? 'bg-[#E08828]' : 'bg-[#5A5551]'}`} />
              </div>
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Resources</span>
          </button>

          {dropdownOpen && (
            <div
              id="mobile-resources-dropdown"
              className="absolute bottom-16 right-2 w-52 bg-white border border-[#EFEAE4] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200"
            >
              <div className="px-3 py-1.5 border-b border-[#F9F7F5] mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B8680]">Guides & Support</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onTabChange('saved');
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#1F1F1F] active:bg-[#F9F7F5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500/30" />
                  <span>Saved Hikes ({savedCount})</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4]" />
              </button>

              <button
                type="button"
                onClick={() => handleSubPageClick('payment')}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#1F1F1F] active:bg-[#F9F7F5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#E08828]" />
                  <span>Payment & Pricing</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4]" />
              </button>

              <button
                type="button"
                onClick={() => handleSubPageClick('trek_tips')}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#1F1F1F] active:bg-[#F9F7F5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#7ABA42]" />
                  <span>Trek Tips & Gear</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4]" />
              </button>

              <button
                type="button"
                onClick={() => handleSubPageClick('safety_policy')}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#1F1F1F] active:bg-[#F9F7F5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#E08828]" />
                  <span>Safety & Refund</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4]" />
              </button>

              <div className="my-1 border-t border-[#F9F7F5]" />

              <button
                type="button"
                onClick={() => handleSubPageClick('request_private_trek')}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#E08828] active:bg-[#FAF2EB] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E08828]" />
                  <span>Request Private Trek</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#E08828]" />
              </button>

              <button
                type="button"
                onClick={() => handleSubPageClick('contact')}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#1F1F1F] active:bg-[#F9F7F5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#7ABA42]" />
                  <span>Contact Support</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#C2BCB4]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
