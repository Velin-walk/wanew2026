import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  Footprints,
  Award,
  Phone,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  ChevronRight,
  Check,
  AlertCircle,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Trek, Booking } from '../types';
import { HISTORICAL_TREKS, HistoricalTrekItem } from '../data/historicalTreks';
import { fetchLeaderboardData } from '../services/api';
import { HikerStats } from '../types/leaderboard';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBookings: any[];
  allTreks: Trek[];
  favorites?: string[];
  onToggleFavorite?: (trekId: string) => void;
  onOpenTrek: (trek: Trek) => void;
  initialTab?: 'hikes' | 'bookings' | 'saved' | 'settings';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userBookings,
  allTreks,
  favorites = [],
  onToggleFavorite,
  onOpenTrek,
  initialTab = 'hikes',
}) => {
  const { user, isAdmin, userPhone, signOutUser, showProfileImage, updateUserProfile } = useAuth();
  const [activeProfileTab, setActiveProfileTab] = useState<'hikes' | 'bookings' | 'saved' | 'settings'>(initialTab);

  const [editName, setEditName] = useState(user?.displayName || '');
  const [editPhone, setEditPhone] = useState(() => userPhone || localStorage.getItem('wnw_user_phone') || '');
  const [editWhatsapp, setEditWhatsapp] = useState(() => localStorage.getItem('wnw_user_whatsapp') || '');
  const [editShowImage, setEditShowImage] = useState(showProfileImage);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Table search, filter, and sorting states for Completed Hikes
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'distance' | 'hike_number'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedHistoricalTrek, setSelectedHistoricalTrek] = useState<HistoricalTrekItem | null>(null);

  // Leaderboard data for Google Sheet synchronization
  const [leaderboardHikers, setLeaderboardHikers] = useState<HikerStats[]>([]);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [syncPhoneInput, setSyncPhoneInput] = useState('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Auto-populate phone numbers from confirmed registration bookings & profile
  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      const savedPhone = userPhone || localStorage.getItem('wnw_user_phone') || '';
      const savedWhatsapp = localStorage.getItem('wnw_user_whatsapp') || '';

      let finalPhone = savedPhone;
      let finalWhatsapp = savedWhatsapp;

      // Extract from latest confirmed hike registration booking
      if (userBookings && userBookings.length > 0) {
        const latestWithPhone = userBookings.find(
          (b) => b.phone || b.whatsapp || b.whatsapp_number
        );
        if (latestWithPhone) {
          if (!finalPhone && latestWithPhone.phone) {
            finalPhone = String(latestWithPhone.phone).trim();
            localStorage.setItem('wnw_user_phone', finalPhone);
          }
          if (!finalWhatsapp && (latestWithPhone.whatsapp_number || latestWithPhone.whatsapp)) {
            finalWhatsapp = String(latestWithPhone.whatsapp_number || latestWithPhone.whatsapp).trim();
            localStorage.setItem('wnw_user_whatsapp', finalWhatsapp);
          }
        }
      }

      // Check registration profile cache if still empty
      if (!finalPhone || !finalWhatsapp) {
        try {
          const regCache = localStorage.getItem('wnw_user_registration_profile') || localStorage.getItem('wnw_last_registration_data');
          if (regCache) {
            const parsed = JSON.parse(regCache);
            if (!finalPhone && (parsed.phone || parsed.phoneNumber || parsed.phone_number)) {
              finalPhone = String(parsed.phone || parsed.phoneNumber || parsed.phone_number).trim();
              localStorage.setItem('wnw_user_phone', finalPhone);
            }
            if (!finalWhatsapp && (parsed.whatsapp_number || parsed.whatsapp)) {
              finalWhatsapp = String(parsed.whatsapp_number || parsed.whatsapp).trim();
              localStorage.setItem('wnw_user_whatsapp', finalWhatsapp);
            }
          }
        } catch {}
      }

      setEditPhone(finalPhone);
      setEditWhatsapp(finalWhatsapp);
      setEditShowImage(showProfileImage);
    }
  }, [user, userPhone, showProfileImage, userBookings, isOpen]);

  useEffect(() => {
    if (initialTab) {
      setActiveProfileTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Fetch Google Sheet leaderboard snapshot on modal open
  useEffect(() => {
    if (isOpen) {
      setLoadingSheetData(true);
      fetchLeaderboardData()
        .then((res) => {
          if (res?.hikers && Array.isArray(res.hikers)) {
            setLeaderboardHikers(res.hikers);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch leaderboard snapshot for profile sync:', err);
        })
        .finally(() => {
          setLoadingSheetData(false);
        });
    }
  }, [isOpen]);

  // Lookup map of historical treks by normalized hike number
  const historicalHikesMap = useMemo(() => {
    const map = new Map<string, HistoricalTrekItem>();
    HISTORICAL_TREKS.forEach((h) => {
      if (h.hike_number) {
        map.set(String(h.hike_number).toLowerCase().trim(), h);
      }
    });
    return map;
  }, []);

  // Separate user bookings into active vs completed
  const { activeBookings, completedBookings } = useMemo(() => {
    const active: any[] = [];
    const completed: any[] = [];

    userBookings.forEach((b) => {
      const hikeNum = String(b.hike_number || b.trek_id || '').toLowerCase().trim();
      const isPastCompleted = (b.status || '').toLowerCase() === 'completed' || (hikeNum && historicalHikesMap.has(hikeNum));

      if (isPastCompleted) {
        completed.push(b);
      } else {
        active.push(b);
      }
    });

    return { activeBookings: active, completedBookings: completed };
  }, [userBookings, historicalHikesMap]);

  // Match current user with Google Sheet / Leaderboard stats
  const matchedHikerStats: { stats: HikerStats | null; rank: number; matchSource: string | null } = useMemo(() => {
    if (!leaderboardHikers.length) return { stats: null, rank: 0, matchSource: null };

    const cleanUserPhone = (editPhone || userPhone || '').replace(/[^0-9]/g, '');
    const cleanWhatsApp = (editWhatsapp || '').replace(/[^0-9]/g, '');
    const cleanUserName = (editName || user?.displayName || '').toLowerCase().trim();

    // 1. Try matching by Phone numbers (Calling phone or WhatsApp - highest precision)
    if (cleanUserPhone.length >= 7 || cleanWhatsApp.length >= 7) {
      for (let i = 0; i < leaderboardHikers.length; i++) {
        const h = leaderboardHikers[i];
        const hPhone = (h.phone || h.p || '').replace(/[^0-9]/g, '');
        if (hPhone) {
          if (cleanUserPhone.length >= 7 && (hPhone.endsWith(cleanUserPhone) || cleanUserPhone.endsWith(hPhone))) {
            return { stats: h, rank: i + 1, matchSource: 'Calling Phone' };
          }
          if (cleanWhatsApp.length >= 7 && (hPhone.endsWith(cleanWhatsApp) || cleanWhatsApp.endsWith(hPhone))) {
            return { stats: h, rank: i + 1, matchSource: 'WhatsApp Number' };
          }
        }
      }
    }

    // 2. Try matching by exact full name
    if (cleanUserName.length >= 3) {
      for (let i = 0; i < leaderboardHikers.length; i++) {
        const h = leaderboardHikers[i];
        const hName = (h.n || '').toLowerCase().trim();
        if (hName === cleanUserName) {
          return { stats: h, rank: i + 1, matchSource: 'Hiker Name' };
        }
      }
    }

    // 3. Try matching by first + last name substrings
    if (cleanUserName.length >= 4) {
      for (let i = 0; i < leaderboardHikers.length; i++) {
        const h = leaderboardHikers[i];
        const hName = (h.n || '').toLowerCase().trim();
        if (hName.includes(cleanUserName) || cleanUserName.includes(hName)) {
          return { stats: h, rank: i + 1, matchSource: 'Name Match' };
        }
      }
    }

    return { stats: null, rank: 0, matchSource: null };
  }, [leaderboardHikers, editPhone, editWhatsapp, userPhone, editName, user]);

  // Build the user's personal completed hikes list
  // Combines verified hikes from Google Sheet with app-registered completed bookings
  const userCompletedHikes = useMemo(() => {
    const list: Array<{
      hike_number: string;
      title: string;
      approx_distance: string;
      numeric_distance: number;
      hike_date: string;
      expected_duration: string;
      difficulty: string;
      category: string;
    }> = [];

    const seenKeys = new Set<string>();

    // 1. First include verified hikes from Google Sheet master ledger if matched
    if (matchedHikerStats.stats?.hikes && Array.isArray(matchedHikerStats.stats.hikes)) {
      matchedHikerStats.stats.hikes.forEach((gh) => {
        const hikeNum = String(gh.no || '').trim();
        const numKey = hikeNum.toLowerCase();
        const hist = numKey ? historicalHikesMap.get(numKey) : undefined;

        const title = gh.name || hist?.title || 'Walk Nepal Hike';
        const numDist = typeof gh.dist === 'number' ? gh.dist : (parseFloat(String(gh.dist)) || (hist?.approx_distance ? parseFloat(hist.approx_distance) : 15));
        const approxDist = `${numDist} km`;
        const hikeDate = gh.date || hist?.hike_date || '';
        const category = hist?.category || (numDist > 25 ? 'Trek' : 'Day Hike');
        const duration = hist?.expected_duration || '1 Day';
        const difficulty = hist?.difficulty || 'Moderate';

        const dedupeKey = `${hikeNum || 'H'}_${title}_${hikeDate}`.toLowerCase();
        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          list.push({
            hike_number: hikeNum || '•',
            title,
            approx_distance: approxDist,
            numeric_distance: numDist,
            hike_date: hikeDate,
            expected_duration: duration,
            difficulty,
            category,
          });
        }
      });
    }

    // 2. Merge any app-registered completed bookings
    completedBookings.forEach((b) => {
      const numKey = String(b.hike_number || b.trek_id || '').toLowerCase().trim();
      const hist = numKey ? historicalHikesMap.get(numKey) : undefined;

      const hikeNumber = b.hike_number || hist?.hike_number || 'TBD';
      const title = b.trek_name || hist?.title || b.title || 'Walk Nepal Hike';
      const approxDist = b.approx_distance || hist?.approx_distance || (b.distance ? `${b.distance} km` : '15 km');
      const distMatch = String(approxDist).match(/(\d+(\.\d+)?)/);
      const numericDist = distMatch ? parseFloat(distMatch[1]) : (b.distance ? Number(b.distance) : 15);
      const hikeDate = b.trek_date || hist?.hike_date || b.timestamp || '';
      const category = hist?.category || b.category || 'Day Hike';
      const duration = hist?.expected_duration || (b.trek_days ? `${b.trek_days} Day${Number(b.trek_days) > 1 ? 's' : ''}` : '1 Day');
      const difficulty = hist?.difficulty || b.trek_difficulty || 'Moderate';

      const dedupeKey = `${hikeNumber}_${title}_${hikeDate}`.toLowerCase();
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        list.push({
          hike_number: hikeNumber,
          title,
          approx_distance: approxDist,
          numeric_distance: numericDist,
          hike_date: hikeDate,
          expected_duration: duration,
          difficulty,
          category,
        });
      }
    });

    return list;
  }, [matchedHikerStats.stats?.hikes, completedBookings, historicalHikesMap]);

  // Filtered and Sorted list for the Tabular View
  const filteredCompletedHikes = useMemo(() => {
    let result = [...userCompletedHikes];

    // Search query filter (title, hike number, date)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.hike_number.toLowerCase().includes(q) ||
          h.hike_date.toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'day') {
        result = result.filter((h) => h.category.toLowerCase().includes('day') || h.expected_duration.toLowerCase().includes('sat'));
      } else if (selectedCategory === 'overnight') {
        result = result.filter((h) => h.category.toLowerCase().includes('overnight') || h.expected_duration.toLowerCase().includes('2d'));
      } else if (selectedCategory === 'treks') {
        result = result.filter((h) => h.category.toLowerCase().includes('trek') || h.category.toLowerCase().includes('multi'));
      }
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'distance') {
        cmp = a.numeric_distance - b.numeric_distance;
      } else if (sortField === 'hike_number') {
        const numA = parseInt(a.hike_number, 10) || 0;
        const numB = parseInt(b.hike_number, 10) || 0;
        cmp = numA - numB;
      } else {
        // Date sorting (default)
        const dateA = new Date(a.hike_date).getTime() || 0;
        const dateB = new Date(b.hike_date).getTime() || 0;
        cmp = dateA - dateB;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [userCompletedHikes, searchQuery, selectedCategory, sortField, sortAsc]);

  // Determine lifetime stats (Google Sheet verified or fallback sum)
  const lifetimeDistance = useMemo(() => {
    if (matchedHikerStats.stats?.d) {
      return Number(matchedHikerStats.stats.d);
    }
    let sum = 0;
    completedBookings.forEach((b) => {
      const match = String(b.approx_distance || '').match(/(\d+(\.\d+)?)/);
      sum += match ? parseFloat(match[1]) : 15;
    });
    return sum;
  }, [matchedHikerStats, completedBookings]);

  const formattedDistance = useMemo(() => {
    const val = Number(lifetimeDistance) || 0;
    if (val === 0) return '0';
    return val % 1 === 0 ? val.toLocaleString() : val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }, [lifetimeDistance]);

  const lifetimeEventCount = useMemo(() => {
    if (matchedHikerStats.stats?.c) {
      return Number(matchedHikerStats.stats.c);
    }
    return completedBookings.length;
  }, [matchedHikerStats, completedBookings]);

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
      const cleanPhone = (editPhone || '').trim();
      const cleanWhatsapp = (editWhatsapp || '').trim();

      localStorage.setItem('wnw_user_phone', cleanPhone);
      localStorage.setItem('wnw_user_whatsapp', cleanWhatsapp);

      await updateUserProfile({
        displayName: editName,
        phone: cleanPhone,
        showProfileImage: editShowImage,
      });
      setSaveMsg('Profile and verified phone numbers synced successfully!');
      setTimeout(() => setSaveMsg(null), 3500);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPhoneSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncPhoneInput.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile({
        phone: syncPhoneInput.trim(),
      });
      setEditPhone(syncPhoneInput.trim());
      setSyncSuccessMsg('Phone linked! Google Sheet profile synchronized.');
      setSyncPhoneInput('');
      setTimeout(() => setSyncSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to sync phone:', err);
    } finally {
      setSaving(false);
    }
  };

  const savedTreksList = allTreks.filter((t) => favorites.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-4 sm:p-5 border-b border-[#EFEAE4] relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 flex items-center justify-center text-[#7ABA42] font-black text-lg overflow-hidden shrink-0 shadow-xs">
              {user.photoURL && showProfileImage ? (
                <img src={user.photoURL} alt={user.displayName || 'User Avatar'} className="w-full h-full object-cover" />
              ) : (
                (user.displayName?.[0] || user.email?.[0] || 'H').toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#1F1F1F] tracking-tight">
                  {user.displayName || user.email?.split('@')[0] || 'Hiker'}
                </h3>
                {isAdmin && (
                  <span className="px-2 py-0.5 bg-amber-100 text-[#E08828] border border-amber-200 text-[10px] font-black rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}
                {matchedHikerStats.stats && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> #{matchedHikerStats.rank} Verified
                  </span>
                )}
              </div>
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

        {/* Profile Tabs */}
        <div className="flex border-b border-[#EFEAE4] bg-[#FAF8F5] p-1.5 gap-1 px-3 sm:px-4 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveProfileTab('hikes')}
            className={`flex-1 min-w-[95px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'hikes'
                ? 'bg-white text-[#7ABA42] shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Footprints className="w-3.5 h-3.5 text-[#7ABA42]" />
            <span>My Hikes</span>
            {lifetimeEventCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#7ABA42]/15 text-[#5A922E] rounded-full text-[10px] font-black">
                {lifetimeEventCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveProfileTab('bookings')}
            className={`flex-1 min-w-[105px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'bookings'
                ? 'bg-white text-[#E08828] shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-[#E08828]" />
            <span>My Bookings</span>
            {activeBookings.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#E08828]/15 text-[#E08828] rounded-full text-[10px] font-black">
                {activeBookings.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveProfileTab('saved')}
            className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex-1 min-w-[85px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeProfileTab === 'settings'
                ? 'bg-white text-[#5A5551] shadow-xs ring-1 ring-black/5 font-black'
                : 'text-[#6A645D] hover:text-[#1F1F1F]'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-[#5A5551]" />
            <span>Settings</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4">
          {/* TAB 1: MY HIKES & GOOGLE SHEET LIFETIME STATS & TABULAR ARCHIVE */}
          {activeProfileTab === 'hikes' && (
            <div className="space-y-4">
              {/* Google Sheet Sync Status Banner */}
              {matchedHikerStats.stats ? (
                <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-emerald-950 truncate">
                        Google Sheet Community Ledger Synced
                      </p>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Linked via {matchedHikerStats.matchSource} • #{matchedHikerStats.rank} on Leaderboard
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-[10px] font-black shrink-0 tracking-wide uppercase shadow-2xs">
                    Verified
                  </span>
                </div>
              ) : (
                <div className="p-3.5 bg-[#FAF6F0] border border-[#EFEAE4] rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#E08828]" />
                    <span className="text-xs font-black text-[#1F1F1F]">Auto-Sync Past Hikes &amp; KM</span>
                  </div>
                  <p className="text-[11px] text-[#8B8680] leading-relaxed">
                    Have you hiked with Walk Nepal Walk before? Enter the phone number used during registration to link your Google Sheet record and badges!
                  </p>
                  <form onSubmit={handleQuickPhoneSync} className="flex gap-2 pt-1">
                    <div className="relative flex-1">
                      <Phone className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="tel"
                        value={syncPhoneInput}
                        onChange={(e) => setSyncPhoneInput(e.target.value)}
                        placeholder="e.g. 9841234567"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#7ABA42]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving || !syncPhoneInput.trim()}
                      className="px-4 py-2 bg-[#7ABA42] hover:bg-[#68A235] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Sync Record</span>}
                    </button>
                  </form>
                  {syncSuccessMsg && (
                    <p className="text-[11px] font-bold text-emerald-600 animate-in fade-in flex items-center gap-1">
                      <Check className="w-3 h-3" /> {syncSuccessMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Redesigned Lifetime Stats Card (Fixed Numeric Overflow) */}
              <div className="bg-gradient-to-br from-[#1C201C] via-[#242923] to-[#181B18] rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden border border-emerald-950/40">
                <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-[#7ABA42]/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-3.5 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#7ABA42]" />
                    <span className="text-xs font-black tracking-wider uppercase text-stone-300">
                      Lifetime Mountain Record
                    </span>
                  </div>
                  {lifetimeDistance >= 500 ? (
                    <span className="px-2.5 py-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black rounded-full shadow-2xs">
                      👑 500KM Ultra Legend
                    </span>
                  ) : lifetimeDistance >= 200 ? (
                    <span className="px-2.5 py-1 bg-sky-400/20 border border-sky-400/40 text-sky-300 text-[10px] font-black rounded-full shadow-2xs">
                      💎 200KM Summit Club
                    </span>
                  ) : lifetimeDistance >= 100 ? (
                    <span className="px-2.5 py-1 bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black rounded-full shadow-2xs">
                      💯 100KM Century Club
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-stone-800 border border-stone-700 text-stone-300 text-[10px] font-bold rounded-full">
                      🥾 Active Explorer
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col justify-center">
                    <span className="text-xl sm:text-2xl font-black text-[#8CE34A] block leading-tight truncate">
                      {formattedDistance}
                    </span>
                    <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider mt-0.5">
                      KM Hiked
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col justify-center">
                    <span className="text-xl sm:text-2xl font-black text-amber-400 block leading-tight truncate">
                      {lifetimeEventCount}
                    </span>
                    <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider mt-0.5">
                      Events
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col justify-center">
                    <span className="text-base sm:text-lg font-black text-emerald-300 block leading-tight truncate">
                      {matchedHikerStats.stats?.t30d ? `${Math.round(matchedHikerStats.stats.t30d)} km` : (lifetimeEventCount > 0 ? 'Active' : 'Ready')}
                    </span>
                    <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider mt-0.5">
                      {matchedHikerStats.stats?.t30d ? 'Last 30 Days' : 'Status'}
                    </span>
                  </div>
                </div>
              </div>

              {/* COMPLETED HIKES ARCHIVE - TABULAR FORMAT */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] flex items-center gap-1.5">
                      <Footprints className="w-4 h-4 text-[#7ABA42]" />
                      <span>Completed Hikes Archive</span>
                    </h4>
                    <p className="text-[11px] text-[#8B8680]">
                      Tabular register of all completed treks, dates, and recorded distances
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                    <span>{userCompletedHikes.length} Recorded</span>
                  </div>
                </div>

                {/* Filter and Search Controls Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#FAF8F5] p-2 rounded-xl border border-[#EFEAE4]">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search trek name, hike #, date..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E5E1DB] rounded-lg text-xs font-semibold text-[#1F1F1F] placeholder:text-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-[#8B8680] hover:text-[#1F1F1F] text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'day', label: 'Day' },
                      { id: 'overnight', label: 'Overnight' },
                      { id: 'treks', label: 'Treks' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                          selectedCategory === cat.id
                            ? 'bg-[#1B361D] text-white shadow-xs font-black'
                            : 'bg-white text-[#5A5551] border border-[#E5E1DB] hover:border-[#C8C2B8]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Sort Metric Toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortField === 'date') setSortAsc(!sortAsc);
                        else { setSortField('date'); setSortAsc(false); }
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                        sortField === 'date'
                          ? 'bg-[#FAF6F0] border-[#E08828] text-[#E08828] font-black'
                          : 'bg-white border-[#E5E1DB] text-[#6A645D]'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (sortField === 'distance') setSortAsc(!sortAsc);
                        else { setSortField('distance'); setSortAsc(false); }
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                        sortField === 'distance'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-black'
                          : 'bg-white border-[#E5E1DB] text-[#6A645D]'
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>KM</span>
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {/* THE TABULAR LEDGER OF COMPLETED HIKES */}
                <div className="border border-[#EFEAE4] rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse table-fixed">
                      <thead className="bg-[#FAF8F5] text-[#78716C] uppercase text-[10px] font-black sticky top-0 z-10 border-b border-[#EFEAE4]">
                        <tr>
                          <th className="py-2 px-2.5 sm:px-3.5 w-14 sm:w-18 whitespace-nowrap"># Hike</th>
                          <th className="py-2 px-2.5 sm:px-3.5 whitespace-nowrap">Trek Name</th>
                          <th className="py-2 px-2 sm:px-3 w-22 sm:w-32 whitespace-nowrap">Date</th>
                          <th className="py-2 px-2.5 sm:px-3.5 w-18 sm:w-24 whitespace-nowrap text-right">Distance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F2EC]">
                        {userCompletedHikes.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 px-4 text-center text-[#8B8680]">
                              <Mountain className="w-7 h-7 mx-auto mb-2 text-stone-300" />
                              <p className="font-bold text-xs text-[#5A5551]">No completed hikes recorded for this account yet</p>
                              <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                                {matchedHikerStats.stats ? (
                                  <>
                                    Your verified lifetime total of <strong>{lifetimeEventCount} events ({formattedDistance} KM)</strong> is safely synced from the Google Sheet ledger. As new hikes are attended and marked complete, each specific itinerary will be detailed here!
                                  </>
                                ) : (
                                  'Once you attend a trek and it is completed, your personal trek details, dates, and distances will be archived here.'
                                )}
                              </p>
                            </td>
                          </tr>
                        ) : filteredCompletedHikes.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[#8B8680]">
                              <Mountain className="w-6 h-6 mx-auto mb-2 text-stone-300" />
                              <p className="font-bold text-xs text-[#5A5551]">No completed hikes matched your search query</p>
                              <p className="text-[11px] text-stone-400 mt-0.5">Try changing keywords or clearing the category filter</p>
                            </td>
                          </tr>
                        ) : (
                          filteredCompletedHikes.map((hike, idx) => {
                            return (
                              <tr
                                key={`${hike.hike_number}_${idx}`}
                                className="hover:bg-[#FAF9F6] transition-colors cursor-default group"
                              >
                                {/* Hike Number Column */}
                                <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap font-black">
                                  <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[#7ABA42]/12 text-[#467B1E] border border-[#7ABA42]/20 font-black text-[10px] sm:text-[11px] tracking-tight inline-block">
                                    #{hike.hike_number}
                                  </span>
                                </td>

                                {/* Trek Name Column (Single row with truncate) */}
                                <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap overflow-hidden">
                                  <div
                                    className="font-extrabold text-[#1F1F1F] text-xs sm:text-[13px] truncate group-hover:text-[#1B5E20] transition-colors"
                                    title={hike.title}
                                  >
                                    {hike.title}
                                  </div>
                                </td>

                                {/* Date Column (Single row) */}
                                <td className="py-2 sm:py-2.5 px-2 sm:px-3 whitespace-nowrap text-[#5A5551] font-medium text-[10px] sm:text-[11px]">
                                  <div className="flex items-center gap-1 truncate">
                                    <Calendar className="w-3 h-3 text-[#A8A29E] shrink-0 hidden sm:inline" />
                                    <span className="truncate">{hike.hike_date || 'Archived'}</span>
                                  </div>
                                </td>

                                {/* Distance Column (Single row) */}
                                <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap text-right">
                                  <span className="font-black text-[#1B5E20] text-[11px] sm:text-xs bg-emerald-50 border border-emerald-200/70 px-1.5 sm:px-2 py-0.5 rounded-md inline-block">
                                    {hike.approx_distance}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Summary */}
                  <div className="bg-[#FAF8F5] px-3 py-2 border-t border-[#EFEAE4] flex items-center justify-between text-[11px] text-[#78716C]">
                    <span className="font-semibold">
                      Showing {filteredCompletedHikes.length} of {userCompletedHikes.length} completed records
                    </span>
                    {matchedHikerStats.stats?.c ? (
                      <span className="font-bold text-emerald-700">
                        {matchedHikerStats.stats.c} Total Events in Google Sheet Ledger
                      </span>
                    ) : (
                      <span className="font-bold text-[#1B5E20]">
                        Personal Hike History
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MY BOOKINGS (ACTIVE / UPCOMING UNFINALIZED) */}
          {activeProfileTab === 'bookings' && (
            <div className="space-y-4">
              {/* Account Overview Box */}
              <div className="bg-[#F9F7F5] border border-[#EFEAE4] rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E1DB] flex items-center justify-center text-[#E08828]">
                    <BookmarkCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1F1F1F] block">Active Upcoming Bookings</span>
                    <span className="text-[11px] text-[#8B8680]">
                      {activeBookings.length} upcoming trip{activeBookings.length === 1 ? '' : 's'} on live roster
                    </span>
                  </div>
                </div>
                <span className="text-lg font-black text-[#E08828] bg-white px-3 py-1 rounded-xl border border-[#E5E1DB]">
                  {activeBookings.length}
                </span>
              </div>

              {/* Booked Treks List */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#8B8680] mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
                  <span>Upcoming Roster Reservations</span>
                </h4>

                {activeBookings.length === 0 ? (
                  <div className="p-6 text-center bg-[#F9F7F5] rounded-2xl border border-dashed border-[#E5E1DB] space-y-2">
                    <Compass className="w-8 h-8 text-[#C2BCB4] mx-auto" />
                    <p className="text-xs font-bold text-[#5A5551]">No upcoming trek reservations</p>
                    <p className="text-[11px] text-[#8B8680]">
                      Explore upcoming treks and register to see your bookings and WhatsApp groups here!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBookings.map((b, idx) => {
                      const matchingTrek = allTreks.find((t) => t.id === b.trek_id || t.hike_number === b.hike_number);
                      return (
                        <div
                          key={b.id || idx}
                          className="p-4 bg-white rounded-2xl border border-[#EFEAE4] shadow-2xs hover:border-[#E08828]/40 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-[#E08828] uppercase tracking-wider block">
                                Hike #{b.hike_number || matchingTrek?.hike_number || 'Upcoming'}
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
            </div>
          )}

          {/* TAB 3: SAVED / WISHLIST */}
          {activeProfileTab === 'saved' && (
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#8B8680] mb-3 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Saved Hikes &amp; Wishlist</span>
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
                      className="p-3.5 bg-white rounded-2xl border border-[#EFEAE4] shadow-2xs hover:border-[#E08828]/40 transition-all flex items-center justify-between gap-3 group"
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
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
                          className="px-3 py-1.5 bg-[#1B361D] hover:bg-[#2A4D2D] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SETTINGS & PROFILE EDIT */}
          {activeProfileTab === 'settings' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-[#5A5551] uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#7ABA42] focus:bg-white"
                    placeholder="Your Full Name"
                  />
                </div>

                {/* 2 Phone Numbers Limit Warning Banner */}
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5 shadow-3xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-black text-amber-950 block text-[11px] uppercase tracking-wider">
                      Maximum 2 Phone Numbers Allowed
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Only 2 phone numbers (Calling Phone &amp; WhatsApp Number) are allowed per profile. These auto-populate from your confirmed hike registration forms to sync past records.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#5A5551] uppercase tracking-wider mb-1.5">
                      1. Calling Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#8B8680] absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#7ABA42] focus:bg-white"
                        placeholder="e.g. 9840057822"
                      />
                    </div>
                    <span className="text-[10px] text-[#8B8680] mt-1 block">Auto-populated from registration</span>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#5A5551] uppercase tracking-wider mb-1.5">
                      2. WhatsApp Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="tel"
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#7ABA42] focus:bg-white"
                        placeholder="e.g. 9801234567"
                      />
                    </div>
                    <span className="text-[10px] text-[#8B8680] mt-1 block">Auto-populated from registration</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#5A5551] uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-stone-100 border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#8B8680] cursor-not-allowed"
                  />
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editShowImage}
                      onChange={(e) => setEditShowImage(e.target.checked)}
                      className="w-4 h-4 text-[#7ABA42] border-[#E5E1DB] rounded-sm focus:ring-[#7ABA42]"
                    />
                    <span className="text-xs font-bold text-[#5A5551]">
                      Show Google Profile picture in header &amp; modal
                    </span>
                  </label>
                </div>

                {saveMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {saveMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-[#7ABA42] hover:bg-[#68A235] text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Changes</span>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-[#FAF6F0] border-t border-[#EFEAE4] flex items-center justify-between">
          <span className="text-[11px] text-[#8B8680] font-bold">
            Walk Nepal Walk • Community Account
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
