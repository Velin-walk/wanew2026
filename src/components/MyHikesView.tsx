import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Mountain,
  CheckCircle2,
  Loader2,
  Footprints,
  Award,
  Phone,
  Sparkles,
  TrendingUp,
  Check,
  Search,
  ArrowUpDown,
  Crown,
  Gem,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HISTORICAL_TREKS, HistoricalTrekItem } from '../data/historicalTreks';
import { fetchLeaderboardData } from '../services/api';
import { HikerStats } from '../types/leaderboard';

export interface MyHikesViewProps {
  userBookings?: any[];
  userPhone?: string;
  userName?: string;
  userEmail?: string;
}

export const MyHikesView: React.FC<MyHikesViewProps> = ({
  userBookings = [],
  userPhone: propPhone,
  userName: propName,
  userEmail: propEmail,
}) => {
  const { user, userPhone: authPhone, updateUserProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'distance' | 'hike_number'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Leaderboard data for Google Sheet synchronization
  const [leaderboardHikers, setLeaderboardHikers] = useState<HikerStats[]>([]);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [syncPhoneInput, setSyncPhoneInput] = useState('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Effective contact details
  const effectivePhone =
    propPhone ||
    authPhone ||
    userBookings.find((b) => b.phone)?.phone ||
    userBookings.find((b) => b.whatsapp)?.whatsapp ||
    localStorage.getItem('wnw_user_phone') ||
    '';

  const effectiveWhatsapp =
    userBookings.find((b) => b.whatsapp_number || b.whatsapp)?.whatsapp_number ||
    localStorage.getItem('wnw_user_whatsapp') ||
    '';

  const effectiveName = propName || user?.displayName || userBookings.find((b) => b.full_name)?.full_name || '';
  const effectiveEmail = propEmail || user?.email || userBookings.find((b) => b.email || b.user_email)?.email || '';

  // Fetch Google Sheet leaderboard snapshot on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingSheetData(true);
    fetchLeaderboardData()
      .then((res) => {
        if (isMounted && res?.hikers && Array.isArray(res.hikers)) {
          setLeaderboardHikers(res.hikers);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch leaderboard snapshot for My Hikes view:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSheetData(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
  const { completedBookings } = useMemo(() => {
    const completed: any[] = [];

    userBookings.forEach((b) => {
      const hikeNum = String(b.hike_number || b.trek_id || '').toLowerCase().trim();
      const statusLower = (b.status || '').toLowerCase();
      if (statusLower === 'cancelled by user') return;

      const isCancelledStatus = statusLower.includes('cancelled');
      const isPastCompleted =
        !isCancelledStatus &&
        (statusLower === 'completed' || (hikeNum && historicalHikesMap.has(hikeNum)));

      if (isPastCompleted) {
        completed.push(b);
      }
    });

    return { completedBookings: completed };
  }, [userBookings, historicalHikesMap]);

  // Match current user with Google Sheet / Leaderboard stats (Exact Public Profile Logic)
  const matchedHikerStats: { stats: HikerStats | null; rank: number; matchSource: string | null } = useMemo(() => {
    if (!leaderboardHikers.length) return { stats: null, rank: 0, matchSource: null };

    const cleanUserPhone = effectivePhone.replace(/[^0-9]/g, '');
    const cleanWhatsApp = effectiveWhatsapp.replace(/[^0-9]/g, '');
    const cleanUserEmail = effectiveEmail.toLowerCase().trim();

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

    // 2. Try matching by verified email
    if (cleanUserEmail.length >= 4) {
      for (let i = 0; i < leaderboardHikers.length; i++) {
        const h = leaderboardHikers[i];
        const hEmail = (h.e || '').toLowerCase().trim();
        if (hEmail && hEmail === cleanUserEmail) {
          return { stats: h, rank: i + 1, matchSource: 'Email Address' };
        }
      }
    }

    return { stats: null, rank: 0, matchSource: null };
  }, [leaderboardHikers, effectivePhone, effectiveWhatsapp, effectiveEmail]);

  // Build the user's personal completed hikes list (Exact Public Profile Logic)
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
  }, [matchedHikerStats, completedBookings, historicalHikesMap]);

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

  const handleQuickPhoneSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncPhoneInput.trim()) return;
    setSaving(true);
    try {
      const cleanPhone = syncPhoneInput.trim();
      localStorage.setItem('wnw_user_phone', cleanPhone);
      if (updateUserProfile) {
        await updateUserProfile({ phone: cleanPhone });
      }
      setSyncSuccessMsg('Phone linked! Reloading community ledger...');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
    } catch (e) {
      console.warn('Could not link phone:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Google Sheet Sync Status Banner */}
      {matchedHikerStats.stats ? (
        <div className="p-2.5 bg-gradient-to-r from-orange-50 via-amber-50/70 to-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E08828] to-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-orange-950 truncate">
                Community Ledger Synced
              </p>
              <p className="text-[11px] text-orange-800 font-medium truncate">
                Linked via {matchedHikerStats.matchSource} • #{matchedHikerStats.rank} on Leaderboard
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#E08828] text-white rounded-md text-[10px] font-black shrink-0 tracking-wide uppercase shadow-2xs">
            Verified
          </span>
        </div>
      ) : (
        <div className="p-3 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E08828]" />
            <span className="text-xs font-black text-[#1F1F1F]">Auto-Sync Past Hikes &amp; KM</span>
          </div>
          <p className="text-[11px] text-[#7C5338] leading-snug">
            Have you hiked with Walk Nepal Walk before? Enter the phone number used during registration to link your community record and badges!
          </p>
          <form onSubmit={handleQuickPhoneSync} className="flex flex-wrap sm:flex-nowrap gap-2 pt-0.5">
            <div className="relative flex-1 min-w-[180px]">
              <Phone className="w-3.5 h-3.5 text-[#E08828] absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="tel"
                value={syncPhoneInput}
                onChange={(e) => setSyncPhoneInput(e.target.value)}
                placeholder="e.g. 9841234567"
                className="w-full pl-8 pr-3 py-1 bg-white border border-orange-200 rounded-lg text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#E08828]"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !syncPhoneInput.trim()}
              className="px-3 py-1 bg-gradient-to-r from-[#E08828] to-[#EA580C] hover:from-[#CC741A] hover:to-[#D64B07] disabled:opacity-50 text-white font-black text-xs rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95 inline-flex items-center justify-center gap-1 shrink-0"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Sync Record</span>}
            </button>
          </form>
          {syncSuccessMsg && (
            <p className="text-[11px] font-bold text-[#C85E12] animate-in fade-in flex items-center gap-1">
              <Check className="w-3 h-3" /> {syncSuccessMsg}
            </p>
          )}
        </div>
      )}

      {/* Lifetime Stats Card */}
      <div className="bg-gradient-to-br from-[#2B170A] via-[#3B200E] to-[#231207] rounded-2xl p-3.5 sm:p-4 text-white shadow-md relative overflow-hidden border border-orange-900/50">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-[#E08828]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2.5 border-b border-white/10 pb-2 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Award className="w-4 h-4 text-[#FB923C] shrink-0" />
            <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-orange-100/90 truncate">
              Lifetime Mountain Record
            </span>
          </div>
          {lifetimeDistance >= 500 ? (
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black rounded-full shadow-2xs flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-300 shrink-0" />
              <span>500KM Ultra Legend</span>
            </span>
          ) : lifetimeDistance >= 200 ? (
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-orange-400/20 border border-orange-400/40 text-orange-200 text-[10px] font-black rounded-full shadow-2xs flex items-center gap-1">
              <Gem className="w-3 h-3 text-orange-300 shrink-0" />
              <span>200KM Summit Club</span>
            </span>
          ) : lifetimeDistance >= 100 ? (
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-orange-500/20 border border-orange-400/40 text-orange-200 text-[10px] font-black rounded-full shadow-2xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-300 shrink-0" />
              <span>100KM Century Club</span>
            </span>
          ) : (
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-orange-950/70 border border-orange-700/60 text-orange-200 text-[10px] font-bold rounded-full flex items-center gap-1">
              <Compass className="w-3 h-3 text-[#FB923C] shrink-0" />
              <span>Active Explorer</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-white/5 rounded-xl border border-orange-200/15 backdrop-blur-xs flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-black text-[#FB923C] block leading-tight truncate">
              {formattedDistance}
            </span>
            <span className="text-[10px] text-orange-200/75 font-black uppercase tracking-wider mt-0.5">
              KM Hiked
            </span>
          </div>

          <div className="p-2.5 bg-white/5 rounded-xl border border-orange-200/15 backdrop-blur-xs flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-black text-amber-300 block leading-tight truncate">
              {lifetimeEventCount}
            </span>
            <span className="text-[10px] text-orange-200/75 font-black uppercase tracking-wider mt-0.5">
              Events
            </span>
          </div>

          <div className="p-2.5 bg-white/5 rounded-xl border border-orange-200/15 backdrop-blur-xs flex flex-col justify-center">
            <span className="text-sm sm:text-base font-black text-orange-200 block leading-tight truncate">
              {matchedHikerStats.stats?.t30d ? `${Math.round(matchedHikerStats.stats.t30d)} km` : (lifetimeEventCount > 0 ? 'Active' : 'Ready')}
            </span>
            <span className="text-[10px] text-orange-200/75 font-black uppercase tracking-wider mt-0.5">
              {matchedHikerStats.stats?.t30d ? 'Last 30 Days' : 'Status'}
            </span>
          </div>
        </div>
      </div>

      {/* Completed Hikes Archive - Tabular Format */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-[#E08828]" />
              <span>Completed Hikes Archive</span>
            </h4>
            <p className="text-[11px] text-[#7C5338]/80">
              Tabular register of all completed treks, dates, and recorded distances
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#C85E12] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            <span>{userCompletedHikes.length} Recorded</span>
          </div>
        </div>

        {/* Filter and Search Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-orange-50/50 p-2 rounded-xl border border-orange-200/70">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#E08828] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trek name, hike #, date..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-orange-200/80 rounded-lg text-xs font-semibold text-[#1F1F1F] placeholder:text-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#E08828]"
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
                    ? 'bg-gradient-to-r from-[#E08828] to-[#EA580C] text-white shadow-xs font-black'
                    : 'bg-white text-[#7C5338] border border-orange-200/80 hover:border-orange-300'
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
                  ? 'bg-orange-50 border-[#E08828] text-[#C85E12] font-black'
                  : 'bg-white border-orange-200/80 text-[#7C5338]'
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
                  ? 'bg-orange-50 border-[#E08828] text-[#C85E12] font-black'
                  : 'bg-white border-orange-200/80 text-[#7C5338]'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>KM</span>
              <ArrowUpDown className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Tabular Ledger of Completed Hikes */}
        <div className="border border-orange-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto max-h-[460px] md:max-h-none scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-orange-50/75 text-[#7C5338] uppercase text-[10px] font-black sticky top-0 z-10 border-b border-orange-200/70">
                <tr>
                  <th className="py-2 px-2.5 sm:px-3.5 w-14 sm:w-18 whitespace-nowrap"># Hike</th>
                  <th className="py-2 px-2.5 sm:px-3.5 whitespace-nowrap">Trek Name</th>
                  <th className="py-2 px-2 sm:px-3 w-22 sm:w-32 whitespace-nowrap">Date</th>
                  <th className="py-2 px-2.5 sm:px-3.5 w-18 sm:w-24 whitespace-nowrap text-right">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100/70">
                {userCompletedHikes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center text-[#8B8680]">
                      <Mountain className="w-7 h-7 mx-auto mb-2 text-orange-300" />
                      <p className="font-bold text-xs text-[#5A5551]">No completed hikes recorded for this account yet</p>
                      <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                        {matchedHikerStats.stats ? (
                          <>
                            Your verified lifetime total of <strong>{lifetimeEventCount} events ({formattedDistance} KM)</strong> is safely synced from the community ledger. As new hikes are attended and marked complete, each specific itinerary will be detailed here!
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
                      <Mountain className="w-6 h-6 mx-auto mb-2 text-orange-300" />
                      <p className="font-bold text-xs text-[#5A5551]">No completed hikes matched your search query</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">Try changing keywords or clearing the category filter</p>
                    </td>
                  </tr>
                ) : (
                  filteredCompletedHikes.map((hike, idx) => (
                    <tr
                      key={`${hike.hike_number}_${idx}`}
                      className="hover:bg-orange-50/40 transition-colors cursor-default group"
                    >
                      {/* Hike Number Column */}
                      <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap font-black">
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-orange-50 text-[#C85E12] border border-orange-200 font-black text-[10px] sm:text-[11px] tracking-tight inline-block">
                          #{hike.hike_number}
                        </span>
                      </td>

                      {/* Trek Name Column */}
                      <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap overflow-hidden">
                        <div
                          className="font-extrabold text-[#1F1F1F] text-xs sm:text-[13px] truncate group-hover:text-[#C85E12] transition-colors"
                          title={hike.title}
                        >
                          {hike.title}
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="py-2 sm:py-2.5 px-2 sm:px-3 whitespace-nowrap text-[#5A5551] font-medium text-[10px] sm:text-[11px]">
                        <div className="flex items-center gap-1 truncate">
                          <Calendar className="w-3 h-3 text-[#E08828] shrink-0 hidden sm:inline" />
                          <span className="truncate">{hike.hike_date || 'Archived'}</span>
                        </div>
                      </td>

                      {/* Distance Column */}
                      <td className="py-2 sm:py-2.5 px-2.5 sm:px-3.5 whitespace-nowrap text-right">
                        <span className="font-black text-[#C85E12] text-[11px] sm:text-xs bg-orange-50 border border-orange-200/80 px-1.5 sm:px-2 py-0.5 rounded-md inline-block">
                          {hike.approx_distance}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="bg-orange-50/60 px-3 py-2 border-t border-orange-200/70 flex items-center justify-between text-[11px] text-[#7C5338]">
            <span className="font-semibold">
              Showing {filteredCompletedHikes.length} of {userCompletedHikes.length} completed records
            </span>
            {matchedHikerStats.stats?.c ? (
              <span className="font-bold text-[#C85E12]">
                {matchedHikerStats.stats.c} Total Events in Community Ledger
              </span>
            ) : (
              <span className="font-bold text-[#C85E12]">
                Personal Hike History
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
