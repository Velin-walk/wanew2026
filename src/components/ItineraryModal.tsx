import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Compass,
  Calendar,
  Clock,
  MapPin,
  Mountain,
  CheckCircle,
  XCircle,
  PlusCircle,
  ShieldCheck,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  HelpCircle,
  Coffee,
  Utensils,
  Sun,
  Moon,
  Flame,
  Milestone,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  Share2,
  Check,
  UserCheck,
  Info,
  Footprints,
  Sparkles,
  Award,
} from 'lucide-react';
import { Trek } from '../types';
import { TrekItineraryData, TrekFaqItem } from '../data/defaultItineraryTemplate';
import { MiniPrayerFlags } from './NepaliPrayerFlags';
import { useCitizenPricing } from '../hooks/useCitizenPricing';
import { useAuth } from '../context/AuthContext';
import { isAdminEmail } from '../adminUtils';

interface ItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trek: Trek | null;
  type?: 'itinerary' | 'faq';
  showFaq?: boolean;
  onRegister?: (trek: Trek) => void;
}

// Helper to calculate and format day dates like "28 Oct" from trek start date
const formatDayDate = (baseDateStr: string | undefined, dayIndex: number): string | null => {
  if (!baseDateStr) return null;
  let parsedDate: Date | null = null;

  const trimmed = baseDateStr.trim();
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        parsedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        parsedDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  } else {
    let ts = Date.parse(trimmed);
    if (!isNaN(ts)) {
      parsedDate = new Date(ts);
    } else {
      ts = Date.parse(`${trimmed} ${new Date().getFullYear()}`);
      if (!isNaN(ts)) {
        parsedDate = new Date(ts);
      }
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) return null;

  const target = new Date(parsedDate);
  target.setDate(target.getDate() + dayIndex);

  const day = target.getDate();
  const month = target.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month}`;
};

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  isOpen,
  onClose,
  trek,
  type = 'itinerary',
  showFaq = false,
  onRegister,
}) => {
  const { user, userEmail, isAdmin } = useAuth();
  const activeUserEmail = userEmail || user?.email || '';
  const userIsAdmin = Boolean(isAdmin || isAdminEmail(activeUserEmail));

  // Determine if direct shared FAQ link was used (?view=faq or ?faq=... or #faq)
  const isFaqLinkAccessed = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const viewParam = searchParams.get('view');
      const faqParam = searchParams.get('faq');
      return viewParam === 'faq' || faqParam !== null || window.location.hash === '#faq';
    } catch {
      return false;
    }
  })();

  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [isDayExpanded, setIsDayExpanded] = useState<boolean>(true);
  const [expandedFaqs, setExpandedFaqs] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { isNepaliCitizen, formatPrice } = useCitizenPricing();

  // Reset states when a new trek opens
  useEffect(() => {
    if (isOpen) {
      const firstDayId = (trek?.data as any)?.itineraryDays?.[0]?.id || 'day-1';
      setSelectedDayId(firstDayId);
      setIsDayExpanded(true);
      setActiveSection('overview');

      // If opened specifically as FAQ, auto-scroll to FAQ section
      if (type === 'faq' || isFaqLinkAccessed) {
        setTimeout(() => {
          scrollToSection('section-faq');
        }, 150);
      }
    }
  }, [isOpen, trek?.id, type]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Track active section during scroll
  useEffect(() => {
    const scrollContainer = contentScrollRef.current;
    if (!scrollContainer) return;

    const sectionIds = [
      'section-overview',
      'section-schedule',
      'section-pricing',
      'section-inclusions',
      'section-booking',
      'section-safety',
      'section-faq',
    ];

    const handleScroll = () => {
      const containerTop = scrollContainer.scrollTop;
      const offsetMargin = 140;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const elTop = el.offsetTop - scrollContainer.offsetTop;
          if (containerTop + offsetMargin >= elTop) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    const scrollContainer = contentScrollRef.current;
    if (el && scrollContainer) {
      const targetTop = el.offsetTop - scrollContainer.offsetTop - 12;
      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    }
  };

  const handleShareTrek = async () => {
    if (!trek) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?hike=${trek.hike_number || trek.id}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      } catch {
        // Fallback
      }
    }
  };

  if (!isOpen || !trek) return null;

  // Determine if database has custom itinerary JSON data
  const hasDbCustomData = trek.data && typeof trek.data === 'object' && (trek.data as any).title;
  const dbData: TrekItineraryData | null = hasDbCustomData ? (trek.data as any) : null;
  const customFaqs: TrekFaqItem[] = (
    (dbData?.faqs && dbData.faqs.length > 0)
      ? dbData.faqs
      : (trek.faqs && trek.faqs.length > 0)
      ? trek.faqs
      : (Array.isArray((trek.data as any)?.faqs) ? (trek.data as any).faqs : [])
  ) as TrekFaqItem[];

  // Resolve currently active day (defaults to Day 1 / first day)
  const activeDay = (dbData?.itineraryDays && dbData.itineraryDays.length > 0)
    ? (dbData.itineraryDays.find((d) => d.id === selectedDayId) || dbData.itineraryDays[0])
    : null;

  // Toggle FAQ Expand
  const toggleFaq = (faqId: string) => {
    setExpandedFaqs((prev) => ({
      ...prev,
      [faqId]: !prev[faqId],
    }));
  };

  // Keyword-based icon selector for timeline stops
  const getTimelineIcon = (activity: string) => {
    const act = activity.toLowerCase();
    if (act.includes('breakfast') || act.includes('tea') || act.includes('coffee')) {
      return <Coffee className="w-3.5 h-3.5 text-[#E08828]" />;
    }
    if (
      act.includes('lunch') ||
      act.includes('dinner') ||
      act.includes('food') ||
      act.includes('veg') ||
      act.includes('chicken') ||
      act.includes('eat') ||
      act.includes('meal')
    ) {
      return <Utensils className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (act.includes('sunrise') || act.includes('morning') || act.includes('sun')) {
      return <Sun className="w-3.5 h-3.5 text-amber-500 animate-pulse" />;
    }
    if (act.includes('sunset') || act.includes('night') || act.includes('sleep') || act.includes('rest')) {
      return <Moon className="w-3.5 h-3.5 text-indigo-900" />;
    }
    if (act.includes('campfire') || act.includes('fire') || act.includes('music')) {
      return <Flame className="w-3.5 h-3.5 text-orange-600" />;
    }
    if (
      act.includes('depart') ||
      act.includes('start') ||
      act.includes('board') ||
      act.includes('leave') ||
      act.includes('drive') ||
      act.includes('vehicle') ||
      act.includes('bus') ||
      act.includes('scorpio') ||
      act.includes('jeep')
    ) {
      return <Milestone className="w-3.5 h-3.5 text-blue-600" />;
    }
    return <Mountain className="w-3.5 h-3.5 text-[#7ABA42]" />;
  };

  const getDifficultyBadge = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()?.trim()) {
      case 'easy':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: 'Easy / Novice Friendly',
        };
      case 'moderate':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200',
          label: 'Moderate / Active Walkers',
        };
      case 'hard':
      case 'difficult':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-200',
          label: 'Challenging / Experienced',
        };
      case 'extreme':
        return {
          bg: 'bg-red-50 text-red-900 border-red-200',
          label: 'Extreme / Mountaineering',
        };
      default:
        return {
          bg: 'bg-neutral-100 text-neutral-800 border-neutral-200',
          label: difficulty || 'General Trail',
        };
    }
  };

  const diffBadge = getDifficultyBadge(dbData?.overview?.difficulty || trek.difficulty);
  const formattedPrice = formatPrice(trek.price);
  const execStatus = trek.data?.execution_status;
  const isCancelled = Boolean(trek.is_cancelled || trek.data?.is_cancelled || execStatus === 'Cancelled');
  const isCompleted = execStatus === 'Completed';
  const isClosedByAdmin = execStatus === 'Registration Closed';
  const currentParticipants = Number(trek.participants_by_gender?.total ?? trek.participants ?? 0);
  const isFull = Boolean(trek.capacity && currentParticipants >= trek.capacity);
  const isClosed = Boolean(isClosedByAdmin || isCompleted);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 md:top-14 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF8F5] w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[92vh] md:h-full max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E1DB]"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#E5E1DB] bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E08828]/10 text-[#E08828] flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-[#1F1F1F] truncate tracking-tight">
                  {dbData?.title || trek.name}
                </h2>
                {trek.hike_number && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#E08828]/15 text-[#E08828] border border-[#E08828]/25 shrink-0">
                    Hike #{trek.hike_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#6A645D] font-medium mt-0.5">
                <span>{dbData?.category || trek.type_of_trail || 'Himalayan Adventure'}</span>
                <span aria-hidden="true">·</span>
                <span>Complete Route & Logistics Prospectus</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareTrek}
              className="p-2 rounded-xl text-[#6A645D] hover:text-[#1F1F1F] hover:bg-[#EFEAE4] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Share itinerary link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline text-emerald-600 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6A645D] hover:text-[#1F1F1F] hover:bg-[#EFEAE4] transition-all cursor-pointer"
              aria-label="Close itinerary modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-3 flex items-start sm:items-center gap-3 text-rose-900 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Departure Notice: This scheduled hike has been cancelled by the organizers.</span>{' '}
              <span className="text-rose-700">
                {trek.cancellation_reason || 'Registrations and departures are currently suspended for this event.'}
              </span>
            </div>
          </div>
        )}

        {/* Unified Anchor Navigation Bar (Scroll Spy & Quick Jump) */}
        <div className="bg-[#FAF8F5] border-b border-[#E5E1DB] px-3 sm:px-6 py-2.5 shrink-0 overflow-x-auto scrollbar-none flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => scrollToSection('section-overview')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-overview'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-schedule')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-schedule'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            Trail Schedule
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-pricing')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-pricing'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            Pricing & Packages
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-inclusions')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-inclusions'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            Included & Excluded
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-booking')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-booking'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            How to Book
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-safety')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSection === 'section-safety'
                ? 'bg-[#1F1F1F] text-white shadow-xs'
                : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/80'
            }`}
          >
            Safety Guidelines
          </button>
          {customFaqs && customFaqs.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('section-faq')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeSection === 'section-faq'
                  ? 'bg-[#E08828] text-white shadow-xs'
                  : 'text-[#E08828] hover:bg-[#E08828]/10'
              }`}
            >
              FAQs
            </button>
          )}
        </div>

        {/* Scrollable Merged Prospectus Content */}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7">
          
          {/* Cover Hero Banner */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-sm border border-[#E5E1DB] group">
            <div className="relative aspect-video max-h-[380px] w-full overflow-hidden bg-neutral-900">
              <img
                src={dbData?.coverImageUrl || trek.featured_image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'}
                alt={trek.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

              {/* Auspicious miniature prayer flag garland draped over cover */}
              <div className="absolute top-0 left-3 sm:left-6 w-36 sm:w-48 z-20 pointer-events-none drop-shadow-md">
                <MiniPrayerFlags variant="draped" count={6} />
              </div>

              {/* Title & Badge Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 text-white space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {trek.hike_number && (
                    <span className="font-mono tabular-nums font-black text-amber-300 bg-amber-400/20 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-amber-300/30">
                      Hike #{trek.hike_number}
                    </span>
                  )}
                  <span className="text-white/90 font-medium">
                    {dbData?.category || trek.type_of_trail || 'Weekend Expedition'}
                  </span>
                  {(dbData?.hikeDate || trek.date) && (
                    <>
                      <span className="text-white/40" aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 font-semibold text-white/95">
                        <Calendar className="w-3.5 h-3.5 text-amber-300" />
                        {dbData?.hikeDate || trek.date}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-sm text-balance">
                  {dbData?.title || trek.name}
                </h1>

                {((trek as any).destination || dbData?.overview?.endingPoint) && (
                  <p className="text-xs sm:text-sm text-white/80 flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#E08828]" />
                    <span>Destination: {(trek as any).destination || dbData?.overview?.endingPoint}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 1: OVERVIEW & KEY STATS */}
          <section id="section-overview" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-[#E08828]" />
                <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                  Hike Overview & Metrics
                </h3>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${diffBadge.bg}`}>
                {diffBadge.label}
              </span>
            </div>

            {/* 8-Card Responsive Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#E08828]" /> Meeting Time
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1 tabular-nums">
                  {dbData?.overview?.meetingTime || '07:00 AM Sharp'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E08828]" /> Meeting Point
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1 truncate" title={dbData?.overview?.meetingPoint || trek.start_location}>
                  {dbData?.overview?.meetingPoint || trek.start_location || 'Kathmandu'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#7ABA42]" /> Total Duration
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1">
                  {dbData?.overview?.expectedDuration || trek.days || '1 Day (approx 6 hrs)'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-[#7ABA42]" /> Trail Grade
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1">
                  {dbData?.overview?.difficulty || trek.difficulty || 'Moderate'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#E08828]" /> Distance & Elevation
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1">
                  {[
                    dbData?.overview?.approxDistance || trek.distance,
                    dbData?.overview?.elevationRange || trek.elevation || dbData?.overview?.elevationGross,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Approx 12-14 km'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Ending Location
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1 truncate" title={dbData?.overview?.endingPoint}>
                  {dbData?.overview?.endingPoint || 'Kathmandu Drop-off'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#E08828]" /> Lead Coordinator
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1 truncate">
                  {dbData?.teamLeader || trek.leader || 'Certified WNW Guide'}
                </p>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                <span className="text-[10px] text-[#6A645D] font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Maximum Roster
                </span>
                <p className="text-xs font-black text-[#1F1F1F] mt-1 tabular-nums">
                  {dbData?.maxCapacity || trek.capacity || 25} Hikers
                </p>
              </div>
            </div>

            {/* Quick narrative overview if available */}
            {Boolean((trek as any).description) && (
              <p className="text-xs text-[#5A5551] leading-relaxed font-normal pt-1">
                {(trek as any).description}
              </p>
            )}
          </section>

          {/* SECTION 2: ADVENTURE SCHEDULE & TRAIL MAP */}
          <section id="section-schedule" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#E08828]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                    Trail Schedule & Milestones
                  </h3>
                  <p className="text-[11px] text-[#6A645D] font-medium">
                    Timed checkpoints, trail ascents, and scheduled food stops
                  </p>
                </div>
              </div>

              {dbData?.itineraryDays && dbData.itineraryDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDayExpanded(!isDayExpanded)}
                  className="text-[11px] font-bold text-[#E08828] hover:text-[#C86B1A] px-2.5 py-1 rounded-lg hover:bg-[#FAF8F5] transition-colors cursor-pointer shrink-0"
                >
                  {isDayExpanded ? 'Collapse Day Detail' : 'Expand Day Detail'}
                </button>
              )}
            </div>

            {dbData && dbData.itineraryDays && dbData.itineraryDays.length > 0 ? (
              <div className="space-y-3.5 pt-1">
                {/* Connected Horizontal Days Timeline */}
                <div className="flex items-center overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
                  {dbData.itineraryDays.map((day, idx) => {
                    const isSelected = (activeDay?.id === day.id);
                    const dayDate = formatDayDate(dbData?.hikeDate || trek.date, idx);
                    const label = dayDate ? `D${day.dayNumber}: ${dayDate}` : `D${day.dayNumber}`;

                    return (
                      <React.Fragment key={day.id}>
                        <button
                          type="button"
                          id={`schedule-day-btn-${day.dayNumber}`}
                          onClick={() => {
                            if (selectedDayId === day.id) {
                              setIsDayExpanded(!isDayExpanded);
                            } else {
                              setSelectedDayId(day.id);
                              setIsDayExpanded(true);
                            }
                          }}
                          className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black font-mono tabular-nums tracking-tight transition-all cursor-pointer shrink-0 select-none shadow-2xs border ${
                            isSelected
                              ? 'bg-[#E08828] text-white border-[#E08828] ring-1.5 ring-[#E08828]/30'
                              : 'bg-[#FFF8F0] text-[#E08828] border-[#E08828]/35 hover:bg-[#FFEEDD] hover:border-[#E08828]/60'
                          }`}
                          title={`Day ${day.dayNumber}: ${day.title}`}
                        >
                          {label}
                        </button>

                        {/* Connector line between days */}
                        {idx < dbData.itineraryDays.length - 1 && (
                          <div className="w-2 sm:w-3.5 h-[1.5px] sm:h-0.5 bg-[#E08828]/40 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Selected Day Full Day Itinerary - Expanded Vertically */}
                {activeDay && (
                  <div className="bg-[#FAF8F5] border border-[#E5E1DB] rounded-2xl overflow-hidden transition-all duration-200">
                    {/* Active Day Header Bar */}
                    <button
                      type="button"
                      onClick={() => setIsDayExpanded(!isDayExpanded)}
                      className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-[#FAF8F5] hover:bg-[#F2ECE5] transition-all cursor-pointer text-left select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-[#E08828] text-white flex items-center justify-center text-xs font-black shadow-2xs shrink-0">
                          D{activeDay.dayNumber}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-[#1F1F1F] truncate">
                            Day {activeDay.dayNumber}: {activeDay.title}
                          </h4>
                          <p className="text-[11px] text-[#6A645D] font-medium">
                            {activeDay.items?.length || 0} Scheduled Checkpoints · Tap to {isDayExpanded ? 'collapse' : 'expand'}
                          </p>
                        </div>
                      </div>
                      <div className="text-[#6A645D] shrink-0">
                        {isDayExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Visual Trail Map (Vertical Timeline) */}
                    {isDayExpanded && (
                      <div className="p-4 sm:p-6 bg-white space-y-4 relative border-t border-[#E5E1DB]">
                        {/* Continuous vertical trail track */}
                        <div className="absolute left-[31px] sm:left-[39px] top-6 bottom-6 w-0.5 bg-[#E5E1DB]" />

                        {activeDay.items.map((item, idx) => (
                          <div key={item.id || idx} className="flex gap-3 sm:gap-4 relative z-10">
                            {/* Left Time Indicator */}
                            <div className="text-[10px] font-mono tabular-nums font-bold text-[#E08828] bg-[#FFF8F0] border border-[#E08828]/25 px-2 py-1 rounded-md shrink-0 h-fit text-center min-w-[64px] sm:min-w-[70px]">
                              {item.time}
                            </div>

                            {/* Center Trail Station Bubble with Dynamic Icon */}
                            <div className="w-6 h-6 rounded-full bg-white border-2 border-[#E08828] text-[#E08828] flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                              {getTimelineIcon(item.activity)}
                            </div>

                            {/* Right Checkpoint Activity Description */}
                            <div className="bg-[#FAF8F5] border border-[#E5E1DB] p-3 rounded-xl flex-1 text-xs font-medium text-[#2E2B28] leading-relaxed shadow-3xs">
                              {item.activity}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : trek.itinerary ? (
              /* Flat pathway sequence fallback */
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold text-[#6A645D] block">
                  Route Trail Waypoints:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {trek.itinerary.split('->').map((stop, i, arr) => (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E5E1DB] px-3 py-2 rounded-xl text-xs font-bold text-[#1F1F1F]">
                        <span className="w-4 h-4 rounded-full bg-[#E08828]/15 text-[#E08828] flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                          {i + 1}
                        </span>
                        <span>{stop.trim()}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#8B8680] shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#FAF8F5] rounded-xl text-center text-xs text-[#6A645D]">
                Detailed waypoint schedule will be announced during briefing.
              </div>
            )}
          </section>

          {/* SECTION 3: PACKAGE PRICING & LOGISTICS */}
          <section id="section-pricing" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E08828]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                    Package Pricing & Logistics
                  </h3>
                  <p className="text-[11px] text-[#6A645D] font-medium">
                    All-inclusive guided package with certified leaders & transport
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                Transparent Rates
              </span>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {dbData?.priceTiers && dbData.priceTiers.length > 0 ? (
                dbData.priceTiers.map((tier, idx) => (
                  <div
                    key={tier.id || idx}
                    className="p-4 rounded-xl bg-[#FAF8F5] border-2 border-[#E5E1DB] hover:border-[#E08828]/50 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#6A645D] uppercase tracking-wide block">
                        {tier.label}
                      </span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#1F1F1F] font-mono tabular-nums">
                          {dbData.currency || 'NPR'} {Number(tier.price).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#6A645D] font-medium">/ hiker</span>
                      </div>
                    </div>
                    <span className="mt-3 text-[10px] text-[#7ABA42] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#7ABA42]" /> Includes all guided logistics
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-[#FAF8F5] border-2 border-[#E5E1DB] flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#6A645D] uppercase tracking-wide block">
                      Standard Package
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#1F1F1F] font-mono tabular-nums">
                        {trek.price || 'Contact Coordinators'}
                      </span>
                    </div>
                  </div>
                  <span className="mt-3 text-[10px] text-[#7ABA42] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-[#7ABA42]" /> Includes transport & guide
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Notes & Citizen Notice */}
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E1DB] text-xs text-[#5A5551] space-y-1.5 font-medium">
              {dbData?.pricingNotes ? (
                <p className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#E08828] shrink-0 mt-0.5" />
                  <span>{dbData.pricingNotes}</span>
                </p>
              ) : (
                <p className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#E08828] shrink-0 mt-0.5" />
                  <span>
                    Prices cover chartered transport, lead guide fees, first-aid support, and community logistics.
                  </span>
                </p>
              )}
              {!isNepaliCitizen && (
                <p className="text-[11px] text-blue-800 bg-blue-50/60 p-2 rounded-lg border border-blue-200">
                  International travelers: National park permits and TIMS card requirements may apply. Contact WhatsApp coordinator for currency conversion assistance.
                </p>
              )}
            </div>
          </section>

          {/* SECTION 4: INCLUSIONS & EXCLUSIONS */}
          <section id="section-inclusions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cost Inclusions */}
              <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wide">
                    What is Included
                  </h4>
                </div>
                <ul className="space-y-2.5">
                  {dbData?.costIncludes && dbData.costIncludes.length > 0 ? (
                    dbData.costIncludes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Chartered round-trip transportation from Kathmandu</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Experienced, wilderness first-aid-certified coordinator</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Group medical kit & emergency trail communications</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Cost Exclusions */}
              <div className="bg-white rounded-2xl p-5 border border-rose-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <h4 className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-wide">
                    What is Excluded
                  </h4>
                </div>
                <ul className="space-y-2.5">
                  {dbData?.costExcludes && dbData.costExcludes.length > 0 ? (
                    dbData.costExcludes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                        <span>Personal trekking gear (boots, daypack, poles)</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                        <span>Personal beverages, bottled mineral water & snacks</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-xs text-[#2E2B28] leading-relaxed font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                        <span>Personal evacuation and medical insurance</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

            </div>

            {/* Optional Add-Ons if present */}
            {dbData?.addOns && dbData.addOns.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[#E08828]" />
                  <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider">
                    Optional Add-Ons & Gear Rentals
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dbData.addOns.map((addon, idx) => (
                    <div key={addon.id || idx} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F1F1F]">{addon.name}</span>
                      <span className="text-xs font-black text-[#E08828] font-mono tabular-nums">
                        {isNepaliCitizen ? (
                          <>
                            {dbData.currency} {Number(addon.price).toLocaleString()} <span className="text-[10px] text-[#6A645D] font-normal">{addon.unit}</span>
                          </>
                        ) : (
                          'Inquire on WhatsApp'
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {dbData.addOnsNotice && (
                  <p className="text-[11px] text-[#6A645D] italic">
                    {dbData.addOnsNotice}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* SECTION 5: HOW TO BOOK & SECURE ROSTER */}
          <section id="section-booking" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#7ABA42]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                    How to Secure Your Booking
                  </h3>
                  <p className="text-[11px] text-[#6A645D] font-medium">
                    Simple 4-step reservation and seat confirmation process
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(dbData?.bookingProcessSteps || [
                'Review route elevation, distance, and gear requirements.',
                'Click "Register / Book Now" and submit your hiker details.',
                'Complete booking advance deposit using eSewa, Khalti, or Bank QR.',
                'Forward payment receipt screenshot directly to our coordinator WhatsApp.',
              ]).map((step, idx) => (
                <div key={idx} className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#E08828]/15 text-[#E08828] flex items-center justify-center text-xs font-black shrink-0 font-mono">
                    0{idx + 1}
                  </span>
                  <p className="text-xs text-[#2E2B28] font-semibold leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {dbData?.bookingNotes && dbData.bookingNotes.length > 0 && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5 text-xs text-amber-950">
                <span className="font-bold text-[11px] uppercase tracking-wider text-amber-900 block">
                  Important Booking Notes:
                </span>
                {dbData.bookingNotes.map((note, idx) => (
                  <p key={idx} className="leading-relaxed font-medium">
                    • {note}
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 6: GUIDELINES & SAFETY */}
          <section id="section-safety" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E08828]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                    Participation & Trail Ethics
                  </h3>
                  <p className="text-[11px] text-[#6A645D] font-medium">
                    Safety protocols, Leave No Trace conduct, and trail ethics
                  </p>
                </div>
              </div>
            </div>

            {dbData?.participationGuidelines && (
              <div className="text-xs text-[#5A5551] leading-relaxed font-medium">
                {dbData.participationGuidelines}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(dbData?.safetyRules && dbData.safetyRules.length > 0
                ? dbData.safetyRules
                : [
                    {
                      id: 'r1',
                      title: 'Leave No Trace (LNT)',
                      description: 'Pack out all wrappers, plastics, and non-biodegradable waste. Leave only footprints.',
                    },
                    {
                      id: 'r2',
                      title: 'Hydration & Pacing',
                      description: 'Carry at least 1.5L of water and electrolyte salts. Stay with your designated buddy.',
                    },
                    {
                      id: 'r3',
                      title: 'Proper Footwear',
                      description: 'Wear trekking shoes with aggressive lug grip. Avoid smooth sneakers or flat sandals.',
                    },
                    {
                      id: 'r4',
                      title: 'Guide Instructions',
                      description: 'Always follow route adjustments and pacing directions from the lead coordinator.',
                    },
                  ]
              ).map((rule) => (
                <div key={rule.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                  <span className="text-xs font-bold text-[#1F1F1F] block mb-1">
                    {rule.title}
                  </span>
                  <p className="text-[11px] text-[#6A645D] leading-relaxed font-medium">
                    {rule.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 7: FREQUENTLY ASKED QUESTIONS */}
          {customFaqs && customFaqs.length > 0 && (
            <section id="section-faq" className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E1DB] shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#E08828]" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                      Frequently Asked Questions
                    </h3>
                    <p className="text-[11px] text-[#6A645D] font-medium">
                      Common inquiries regarding route difficulty, vehicle pickups, and gear
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {customFaqs.map((faq, idx) => {
                  const faqKey = faq.id || `faq-${idx}`;
                  const isExpanded = expandedFaqs[faqKey] !== false;
                  return (
                    <div
                      key={faqKey}
                      className="bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(faqKey)}
                        className="w-full text-left p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-[#F2ECE5] transition-colors"
                      >
                        <span className="text-xs font-bold text-[#1F1F1F] flex items-start gap-2.5 leading-snug">
                          <span className="w-4 h-4 rounded-full bg-[#E08828]/15 text-[#E08828] flex items-center justify-center text-[10px] font-black shrink-0 font-mono mt-0.5">
                            Q
                          </span>
                          <span>{faq.question}</span>
                        </span>
                        <span className="text-[#6A645D] mt-0.5 shrink-0">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3.5 pt-1 text-xs text-[#5A5551] leading-relaxed border-t border-[#EAE4DC] pl-9 font-medium whitespace-pre-line">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick WhatsApp Support Box */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#FAF8F5] to-[#F5ECE0] border border-[#E5E1DB] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#7ABA42]" />
                Have questions before booking?
              </span>
              <p className="text-[11px] text-[#6A645D] font-medium">
                Talk directly to Walk Nepal Walk trail coordinators: {dbData?.helpContacts?.join(' · ') || '+977-9803568612'}
              </p>
            </div>
            <a
              href={`https://wa.me/9779803568612?text=${encodeURIComponent(`Hi Walk Nepal Walk, I would like to inquire about Hike #${dbData?.hikeNumber || trek.hike_number || ''} (${dbData?.title || trek.name})`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Coordinator</span>
            </a>
          </div>

        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E5E1DB] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-[#6A645D] font-bold">Package:</span>
              <span className="text-sm sm:text-base font-black text-[#1F1F1F] font-mono tabular-nums">
                {formattedPrice.display || String(trek.price || 'Inquire')}
              </span>
            </div>
            <div className="text-[10px] text-[#8B8680] font-semibold truncate">
              {dbData?.hikeDate || trek.date || 'Scheduled Departure'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRegister && (
              <button
                type="button"
                id="itinerary-modal-register-btn"
                disabled={isCancelled || isClosed}
                onClick={() => onRegister(trek)}
                className={`min-h-[42px] px-5 py-2 text-white text-xs sm:text-sm font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 shrink-0 ${
                  isCancelled
                    ? 'bg-rose-500 cursor-not-allowed opacity-90'
                    : isClosed
                    ? 'bg-[#8B8680] cursor-not-allowed opacity-80'
                    : isFull
                    ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
                    : 'bg-[#FC4C02] hover:bg-[#E03E00] cursor-pointer ring-2 ring-[#FC4C02]/25 shadow-orange-500/20'
                }`}
              >
                <span>
                  {isCancelled
                    ? 'Hike Cancelled'
                    : isClosed
                    ? 'Registration Closed'
                    : isFull
                    ? 'Join Waitlist'
                    : 'Register / Book Now'}
                </span>
                {!isCancelled && !isClosed && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

