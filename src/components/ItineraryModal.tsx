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
  Sparkles,
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
  ChevronLeft,
} from 'lucide-react';
import { Trek } from '../types';
import { TrekItineraryData } from '../data/defaultItineraryTemplate';
import { MiniPrayerFlags } from './NepaliPrayerFlags';

interface ItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trek: Trek | null;
  type?: 'itinerary' | 'faq';
  onRegister?: (trek: Trek) => void;
}

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  isOpen,
  onClose,
  trek,
  type = 'itinerary',
  onRegister,
}) => {
  const [activeTab, setActiveTab] = useState<'experience' | 'logistics'>('experience');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Reset states when a new trek opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('experience');
      // Expand Day 1 by default
      setExpandedDays({ 'day-1': true });
    }
  }, [isOpen, trek?.id]);

  const switchTab = (tab: 'experience' | 'logistics') => {
    setActiveTab(tab);
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!isOpen || !trek) return null;

  const isFaq = type === 'faq';

  // Determine if database has custom itinerary JSON data
  const hasDbCustomData = trek.data && typeof trek.data === 'object' && (trek.data as any).title;
  const dbData: TrekItineraryData | null = hasDbCustomData ? (trek.data as any) : null;

  // Toggle Day Expand
  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayId]: !prev[dayId],
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] w-full max-w-4xl h-[92vh] sm:h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E1DB]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#E5E1DB] bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E08828]/10 text-[#E08828] flex items-center justify-center shrink-0">
              {isFaq ? <HelpCircle className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#1F1F1F] truncate">
                {trek.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-[#8B8680] font-semibold mt-0.5">
                <span>{isFaq ? 'FAQ & Guidelines' : 'Interactive Trail Companion'}</span>
                {trek.hike_number && (
                  <span className="bg-[#EFEAE4] text-[#5A5551] px-1.5 py-0.2 rounded text-[10px] font-bold">
                    Hike #{trek.hike_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#EFEAE4] transition-all cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cancellation Alert Banner */}
        {trek.is_cancelled && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2.5 flex items-start sm:items-center gap-2.5 text-rose-800 text-xs shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Notice: This hike has been cancelled by the organizer.</span>{' '}
              <span className="text-[11px] text-rose-700">
                {trek.cancellation_reason ? trek.cancellation_reason : 'Registrations are currently closed.'}
              </span>
            </div>
          </div>
        )}

        {/* Immersive Dual-Tab Segmented Controller */}
        {!isFaq && (
          <div className="bg-[#FAF8F5] border-b border-[#E5E1DB] px-3 sm:px-6 py-2.5 shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center p-1 bg-[#EAE4DC] rounded-2xl w-full sm:w-auto shadow-inner border border-[#DDD6CC]/60">
              <button
                type="button"
                id="itinerary-tab-experience"
                onClick={() => switchTab('experience')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                  activeTab === 'experience'
                    ? 'bg-white text-[#E08828] shadow-sm font-black border border-black/5'
                    : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/50 font-bold'
                }`}
              >
                <Compass className={`w-4 h-4 shrink-0 transition-transform ${activeTab === 'experience' ? 'text-[#E08828] scale-110' : 'text-[#8B8680]'}`} />
                <span className="whitespace-nowrap">Hike Experience</span>
                {activeTab === 'experience' && (
                  <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#E08828]" />
                )}
              </button>

              <button
                type="button"
                id="itinerary-tab-logistics"
                onClick={() => switchTab('logistics')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                  activeTab === 'logistics'
                    ? 'bg-[#E08828] text-white shadow-md font-black ring-2 ring-[#E08828]/20'
                    : 'text-[#6A645D] hover:text-[#1F1F1F] hover:bg-white/50 font-bold'
                }`}
              >
                <ClipboardList className={`w-4 h-4 shrink-0 transition-transform ${activeTab === 'logistics' ? 'text-white scale-110' : 'text-[#8B8680]'}`} />
                <span className="whitespace-nowrap">Logistics & Booking</span>
              </button>
            </div>

            {/* Quick Next/Prev helper on desktop */}
            <button
              type="button"
              onClick={() => switchTab(activeTab === 'experience' ? 'logistics' : 'experience')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#E08828] hover:text-white bg-[#E08828]/10 hover:bg-[#E08828] rounded-xl border border-[#E08828]/30 transition-all cursor-pointer shadow-3xs active:scale-95"
            >
              <span>{activeTab === 'experience' ? 'Jump to Pricing & Logistics' : 'Back to Hike Route'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Cover image header */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-neutral-900 shadow-xs shrink-0 flex items-center justify-center">
            <img
              src={dbData?.coverImageUrl || trek.featured_image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80'}
              alt={trek.name}
              className="w-full h-auto max-h-[75vh] object-contain block"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

            {/* Auspicious miniature prayer flag garland draped over cover */}
            <div className="absolute -top-1 left-3 sm:left-6 w-32 xs:w-36 sm:w-44 z-20 pointer-events-none drop-shadow-md">
              <MiniPrayerFlags variant="draped" count={6} />
            </div>
          </div>

          {/* Render Itinerary Experience Tab */}
          {activeTab === 'experience' && !isFaq ? (
            <div className="space-y-6">
              
              {/* Basic Flat Info */}
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {trek.hike_number && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-[#E08828]/10 text-[#E08828] border border-[#E08828]/20">
                      Hike #{trek.hike_number}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#7ABA42]/10 text-[#5B8F2D] border border-[#7ABA42]/20 font-semibold">
                    {dbData?.category || trek.type_of_trail || 'General Hikes'}
                  </span>
                  {(dbData?.hikeDate || trek.date) && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-[#5A5551] font-semibold">
                      <Calendar className="w-3 h-3 inline mr-1 text-[#8B8680]" />
                      {dbData?.hikeDate || trek.date}
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-black text-[#1F1F1F] tracking-tight">
                  {dbData?.title || trek.name}
                </h3>
              </div>

              {/* Hike Metrics Grid */}
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs">
                <h3 className="text-xs sm:text-sm font-black text-[#1F1F1F] mb-4 flex items-center gap-2">
                  <Mountain className="w-4 h-4 text-[#7ABA42]" />
                  <span>Hike Overview & Metrics</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#E08828]" /> Meeting
                    </span>
                    <p className="text-xs font-extrabold text-[#1F1F1F] mt-1">{dbData?.overview?.meetingTime || '07:00 AM'}</p>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E08828]" /> Meeting Point
                    </span>
                    <p className="text-xs font-extrabold text-[#1F1F1F] mt-1 truncate" title={dbData?.overview?.meetingPoint || trek.start_location}>{dbData?.overview?.meetingPoint || trek.start_location || 'Kathmandu'}</p>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#7ABA42]" /> Duration
                    </span>
                    <p className="text-xs font-extrabold text-[#1F1F1F] mt-1">{dbData?.overview?.expectedDuration || trek.days || '1 Day'}</p>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <Mountain className="w-3.5 h-3.5 text-[#7ABA42]" /> Difficulty
                    </span>
                    <div className="mt-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${
                        (dbData?.overview?.difficulty || trek.difficulty || '').toLowerCase().trim() === 'easy'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : (dbData?.overview?.difficulty || trek.difficulty || '').toLowerCase().trim() === 'moderate'
                          ? 'bg-amber-400 text-amber-950 border-amber-500'
                          : (dbData?.overview?.difficulty || trek.difficulty || '').toLowerCase().trim() === 'hard' || (dbData?.overview?.difficulty || trek.difficulty || '').toLowerCase().trim() === 'difficult'
                          ? 'bg-orange-600 text-white border-orange-700'
                          : (dbData?.overview?.difficulty || trek.difficulty || '').toLowerCase().trim() === 'extreme'
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      }`}>
                        {dbData?.overview?.difficulty || trek.difficulty || 'Moderate'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-[#E08828]" /> Elevation
                    </span>
                    <p className="text-xs font-extrabold text-[#1F1F1F] mt-1">{dbData?.overview?.elevationGross || trek.elevation || 'TBD'}</p>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                    <span className="text-[10px] text-[#8B8680] font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Ending Point
                    </span>
                    <p className="text-xs font-extrabold text-[#1F1F1F] mt-1 truncate" title={dbData?.overview?.endingPoint}>{dbData?.overview?.endingPoint || 'Kathmandu'}</p>
                  </div>

                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Lead Guide
                    </span>
                    <p className="text-xs font-extrabold text-amber-950 mt-1 truncate">{dbData?.teamLeader || trek.leader || 'Guide'}</p>
                  </div>

                  <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-blue-800 font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-600" /> Max Capacity
                    </span>
                    <p className="text-xs font-extrabold text-blue-950 mt-1">{dbData?.maxCapacity || trek.capacity || 25} Trekkers</p>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Accordion / Visual Trail Map Timeline */}
              <div className="space-y-3.5">
                <h3 className="text-xs sm:text-sm font-black text-[#1F1F1F] flex items-center gap-2 px-1">
                  <Compass className="w-4 h-4 text-[#E08828]" />
                  <span>Adventure Schedule & Trail Map</span>
                </h3>

                {dbData && dbData.itineraryDays && dbData.itineraryDays.length > 0 ? (
                  dbData.itineraryDays.map((day) => {
                    const isExpanded = !!expandedDays[day.id];
                    return (
                      <div
                        key={day.id}
                        className="bg-white border border-[#E5E1DB] rounded-2xl overflow-hidden shadow-xs transition-all duration-200"
                      >
                        {/* Day Card Header Bar */}
                        <button
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className="w-full flex items-center justify-between p-4 bg-[#FAF8F5] hover:bg-[#F4EFEA] transition-all cursor-pointer text-left select-none"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-[#E08828] text-white flex items-center justify-center text-xs font-black">
                              D{day.dayNumber}
                            </span>
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-[#1F1F1F]">
                                Day {day.dayNumber}: {day.title}
                              </h4>
                              <p className="text-[10px] text-[#8B8680] font-semibold mt-0.5">
                                Expand to explore this day's route checkpoints
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#8B8680]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8B8680]" />
                          )}
                        </button>

                        {/* Visual Trail Map (Accordion Body) */}
                        {isExpanded && (
                          <div className="p-5 sm:p-6 bg-white space-y-6 relative border-t border-[#E5E1DB]">
                            {/* Thin vertical trail track */}
                            <div className="absolute left-[27px] sm:left-[35px] top-6 bottom-6 w-0.5 bg-[#E5E1DB]" />

                            {day.items.map((item, idx) => (
                              <div key={item.id || idx} className="flex gap-4 sm:gap-6 relative z-10">
                                {/* Left Time Indicator */}
                                <div className="text-[10px] font-black text-[#E08828] bg-white border border-[#E08828]/20 px-2.5 py-1 rounded-lg shrink-0 h-fit text-center shadow-3xs min-w-[65px] sm:min-w-[75px]">
                                  {item.time}
                                </div>

                                {/* Center Trail Station Bubble with Dynamic Icon */}
                                <div className="w-6 h-6 rounded-full bg-white border-2 border-[#E08828] text-[#E08828] flex items-center justify-center shrink-0 shadow-3xs">
                                  {getTimelineIcon(item.activity)}
                                </div>

                                {/* Right Checkpoint Activity description */}
                                <div className="bg-[#FAF8F5] border border-[#E5E1DB] p-3 rounded-xl flex-1 text-xs font-semibold text-[#3D3A37] leading-relaxed shadow-3xs">
                                  {item.activity}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : trek.itinerary ? (
                  /* Standard route pathway flat breakdown fallback */
                  <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B8680] block mb-3.5">
                      Checkpoints Pathway Sequence
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {trek.itinerary.split('->').map((stop, i, arr) => (
                        <React.Fragment key={i}>
                          <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E5E1DB] px-3 py-2 rounded-xl text-xs font-black text-[#1F1F1F] shadow-3xs">
                            <span className="w-4 h-4 rounded-full bg-[#E08828]/15 text-[#E08828] flex items-center justify-center text-[10px] font-black shrink-0">
                              {i + 1}
                            </span>
                            <span>{stop.trim()}</span>
                          </div>
                          {i < arr.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-[#8B8680] shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-8 border border-[#E5E1DB] text-center shadow-xs">
                    <Compass className="w-8 h-8 text-[#8B8680]/30 mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#1F1F1F]">No active timeline milestones added</p>
                  </div>
                )}
              </div>

              {/* Seamless Continue to Logistics & Booking Section */}
              <div className="p-5 sm:p-6 bg-gradient-to-br from-[#FFF9F2] to-[#F5ECE0] rounded-2xl border-2 border-[#E08828]/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E08828] animate-ping" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#E08828]">Next Step</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-[#1F1F1F]">
                    Ready to check Pricing, What's Included & Logistics?
                  </h4>
                  <p className="text-xs text-[#6A645D] font-medium leading-relaxed">
                    View package costs, vehicle pickup points, gear checklists, and official reservation steps.
                  </p>
                </div>

                <button
                  type="button"
                  id="itinerary-scroll-to-logistics-btn"
                  onClick={() => switchTab('logistics')}
                  className="w-full sm:w-auto px-5 py-3 bg-[#E08828] hover:bg-[#D07717] active:scale-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 group"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>View Logistics & Booking</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

            </div>
          ) : activeTab === 'logistics' && !isFaq ? (
            /* Logistics Tab View */
            <div className="space-y-6">
              
              {/* Pricing Matrix */}
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B8680] block mb-3">
                  Available Package Pricing
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {dbData?.priceTiers && dbData.priceTiers.length > 0 ? (
                    dbData.priceTiers.map((tier, idx) => (
                      <div
                        key={tier.id || idx}
                        className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5E1DB] flex flex-col justify-between shadow-3xs"
                      >
                        <span className="text-[11px] font-black text-[#5A5551]">{tier.label}</span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span className="text-base font-black text-[#1F1F1F]">
                            {dbData.currency} {Number(tier.price).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-[#8B8680] font-semibold">/ person</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5E1DB] flex flex-col justify-between shadow-3xs">
                      <span className="text-[11px] font-black text-[#5A5551]">Package Price</span>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="text-base font-black text-[#1F1F1F]">
                          {trek.price || 'Contact Coordinators'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {dbData?.pricingNotes && (
                  <p className="mt-3 text-[11px] text-[#8B8680] italic flex items-center gap-1.5">
                    <span>ℹ️</span>
                    <span>{dbData.pricingNotes}</span>
                  </p>
                )}
              </div>

              {/* Inclusions vs Exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cost Inclusions */}
                <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Cost Includes</span>
                  </h3>
                  <ul className="space-y-2">
                    {dbData?.costIncludes && dbData.costIncludes.length > 0 ? (
                      dbData.costIncludes.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>Round-trip transportation from Kathmandu</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>Wilderness First Aid Support & Coordinates</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Cost Exclusions */}
                <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs">
                  <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span>Cost Excludes</span>
                  </h3>
                  <ul className="space-y-2">
                    {dbData?.costExcludes && dbData.costExcludes.length > 0 ? (
                      dbData.costExcludes.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                          <span>Personal trekking insurance</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                          <span>Personal beverages, bar bills, and snacks</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              {/* Optional Add-Ons */}
              {dbData?.addOns && dbData.addOns.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs">
                  <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-[#E08828]" />
                    <span>Optional Add-Ons & Customizations</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    {dbData.addOns.map((addon, idx) => (
                      <div key={addon.id || idx} className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1F1F1F]">{addon.name}</span>
                        <span className="text-xs font-black text-[#E08828]">
                          {dbData.currency} {Number(addon.price).toLocaleString()} <span className="text-[9px] font-normal text-[#8B8680]">{addon.unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {dbData.addOnsNotice && (
                    <p className="text-[10px] text-[#8B8680] italic">
                      {dbData.addOnsNotice}
                    </p>
                  )}
                </div>
              )}

              {/* Booking Steps Policy */}
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs space-y-5">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-[#1F1F1F] mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#7ABA42]" />
                    <span>How to Secure Your Booking</span>
                  </h3>

                  <ol className="space-y-2.5">
                    {(dbData?.bookingProcessSteps || [
                      'Review itinerary, route parameters, and included packages.',
                      'Complete the secure sign-up registration form on our platform.',
                      'Deposit/transfer booking fees and secure your roster placement.',
                      'Forward screenshot of payment deposit ticket directly to coordinator WhatsApp.'
                    ]).map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3A37] font-semibold">
                        <span className="w-4 h-4 rounded-full bg-[#7ABA42]/15 text-[#5B8F2D] flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {(dbData?.bookingNotes && dbData.bookingNotes.length > 0) && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Important Booking Notes:</span>
                    {dbData.bookingNotes.map((note, idx) => (
                      <p key={idx} className="text-xs text-amber-900/90 leading-relaxed font-semibold">
                        • {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Guidelines & Safety */}
              <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-xs space-y-4">
                {dbData?.participationGuidelines && (
                  <div>
                    <h4 className="text-xs font-black text-[#1F1F1F] mb-1.5">
                      Participation & Age Guidelines
                    </h4>
                    <p className="text-xs text-[#5A5551] leading-relaxed font-semibold">
                      {dbData.participationGuidelines}
                    </p>
                  </div>
                )}

                {dbData?.safetyRules && dbData.safetyRules.length > 0 && (
                  <div className="pt-4 border-t border-[#F0EBE5]">
                    <h4 className="text-xs font-black text-[#1F1F1F] mb-3">
                      Safety & Trail Ethics
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {dbData.safetyRules.map((rule) => (
                        <div key={rule.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB]">
                          <span className="text-xs font-bold text-[#1F1F1F] block mb-0.5">{rule.title}</span>
                          <p className="text-[11px] text-[#6A6560] leading-relaxed font-semibold">{rule.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Return to Hike Experience Navigation Helper */}
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#E5E1DB] shadow-xs">
                <button
                  type="button"
                  onClick={() => switchTab('experience')}
                  className="flex items-center gap-2 text-xs font-black text-[#5A5551] hover:text-[#1F1F1F] px-3 py-2 rounded-xl hover:bg-[#F4EFEA] transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#E08828]" />
                  <span>Back to Hike Timeline & Overview</span>
                </button>
                {onRegister && (
                  <button
                    type="button"
                    disabled={trek.is_cancelled}
                    onClick={() => onRegister(trek)}
                    className={`px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                      trek.is_cancelled
                        ? 'bg-rose-400 cursor-not-allowed opacity-80'
                        : 'bg-[#7ABA42] hover:bg-[#6AA437] cursor-pointer active:scale-95'
                    }`}
                  >
                    <span>{trek.is_cancelled ? 'Hike Cancelled' : 'Proceed to Registration'}</span>
                    {!trek.is_cancelled && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

            </div>
          ) : (
            /* FAQ Mode Fallback */
            <div className="bg-white rounded-2xl p-6 border border-[#E5E1DB] shadow-xs space-y-4">
              <h3 className="text-sm font-black text-[#1F1F1F] flex items-center gap-1.5">
                <HelpCircle className="w-5 h-5 text-[#E08828]" />
                <span>Frequently Asked Questions & Participation Guide</span>
              </h3>
              <p className="text-xs text-[#5A5551] leading-relaxed font-semibold">
                To prepare for our Walk Nepal Walk adventures, here is standard hiking etiquette and registration rules:
              </p>
              
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl">
                  <span className="text-xs font-bold text-[#1F1F1F] block">What is the booking security policy?</span>
                  <p className="text-[11px] text-[#6A6560] mt-1 leading-relaxed">
                    Advance deposit ensures reservation. Deposits are fully utilized for logistics reservations and are non-transferable past the roster confirmation date.
                  </p>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl">
                  <span className="text-xs font-bold text-[#1F1F1F] block">Are there medical support resources on trail?</span>
                  <p className="text-[11px] text-[#6A6560] mt-1 leading-relaxed">
                    Yes, every official hike is led by a first-aid-trained coordinator carrying basic medical support kits.
                  </p>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl">
                  <span className="text-xs font-bold text-[#1F1F1F] block">What is the "Leave No Trace" protocol?</span>
                  <p className="text-[11px] text-[#6A6560] mt-1 leading-relaxed">
                    Hikers are required to carry back all generated waste. Tampering with trail agricultural resources or local structures is strictly forbidden.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Helpline Support Box - Visible across all tabs */}
          <div className="p-4 bg-[#7ABA42]/10 border border-[#7ABA42]/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div>
              <span className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#5B8F2D]" />
                Need help or custom coordination?
              </span>
              <p className="text-[10px] text-[#5A5551] mt-0.5 font-medium">
                Direct WhatsApp assistance: {dbData?.helpContacts?.join('  •  ') || '+977-9803568612'}
              </p>
            </div>
            <a
              href={`https://wa.me/9779803568612?text=${encodeURIComponent(`Hi Walk Nepal Walk, I have a question regarding Hike #${dbData?.hikeNumber || trek.hike_number || ''} (${dbData?.title || trek.name})`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center px-4 py-2 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 animate-pulse"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Coordination</span>
            </a>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="p-3 bg-white border-t border-[#E5E1DB] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Walk Nepal Walk Booking System</span>
            <span className="sm:hidden">WNW Live</span>
          </div>

          {onRegister && trek && (
            <button
              type="button"
              id="itinerary-modal-register-btn"
              disabled={trek.is_cancelled}
              onClick={() => onRegister(trek)}
              className={`px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                trek.is_cancelled
                  ? 'bg-rose-400 cursor-not-allowed opacity-80'
                  : 'bg-[#7ABA42] hover:bg-[#6AA437] cursor-pointer active:scale-95'
              }`}
            >
              <span>{trek.is_cancelled ? 'Hike Cancelled' : 'Book / Register Now'}</span>
              {!trek.is_cancelled && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
