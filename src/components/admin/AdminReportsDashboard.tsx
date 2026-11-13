import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Award,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  MapPin,
  Sparkles,
  Download,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Compass,
  Star,
  Bus,
  BedDouble,
  UserCheck,
  Database,
  Search,
  RotateCcw,
  ArrowRight,
  Clock,
  Percent,
  X,
  Phone,
  Mail,
  UserX,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Trek } from '../../types';
import { AdminRegistration, doesRegistrationMatchTrek } from './BookingsManager';
import { HISTORICAL_TREKS } from '../../data/historicalTreks';
import { fetchLeaderboardData } from '../../services/api';

interface AdminReportsDashboardProps {
  treks: Trek[];
  registrations: AdminRegistration[];
  feedback?: any[];
  leaderboard?: any;
  onSelectTrekRoster?: (hikeNum: string) => void;
}

export interface EventReportItem {
  hikeNumber: string;
  hikeNameAndDate: string;
  title: string;
  date: string;
  category: string;
  revenue: number;
  dueAmount?: number;
  returningCount: number;
  returningPct: number;
  newCount: number;
  newPct: number;
  genders: {
    male: { count: number; pct: number };
    female: { count: number; pct: number };
    nb: { count: number; pct: number };
  };
  ageGroups: {
    under20: { count: number; pct: number };
    age20to30: { count: number; pct: number };
    age31to40: { count: number; pct: number };
    age40to50: { count: number; pct: number };
    over50: { count: number; pct: number };
  };
  registrationsCount: number;
  cancellationsCount: number;
  leadGuide: string;
  averageReview: string;
  commission: number;
  monthKey: string;
  timestamp: number | null;
  details?: {
    activeRegs: AdminRegistration[];
    cancelledRegs: AdminRegistration[];
    returningRegs: Array<{ reg: AdminRegistration; pastCount: number }>;
    newRegs: AdminRegistration[];
    genderRegs: {
      male: AdminRegistration[];
      female: AdminRegistration[];
      nb: AdminRegistration[];
    };
    ageGroupRegs: {
      under20: AdminRegistration[];
      age20to30: AdminRegistration[];
      age31to40: AdminRegistration[];
      age40to50: AdminRegistration[];
      over50: AdminRegistration[];
    };
    reviews: any[];
    monthlyTotalRevenue: number;
    commissionRate: number;
  };
}

export const AdminReportsDashboard: React.FC<AdminReportsDashboardProps> = ({
  treks,
  registrations,
  feedback = [],
  leaderboard,
  onSelectTrekRoster
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [eventSearchTerm, setEventSearchTerm] = useState<string>('');
  const [filterMonths, setFilterMonths] = useState<number | 'all' | 'upcoming'>(1); // Default: 1 month (30 days)
  const [perEventSort, setPerEventSort] = useState<{
    key:
      | 'default'
      | 'hikeNumber'
      | 'date'
      | 'revenue'
      | 'returning'
      | 'new'
      | 'gender_m'
      | 'gender_f'
      | 'gender_nb'
      | 'age_under20'
      | 'age_20to30'
      | 'age_31to40'
      | 'age_40to50'
      | 'age_over50'
      | 'registrations'
      | 'cancellations'
      | 'leadGuide'
      | 'review'
      | 'commission';
    dir: 'asc' | 'desc';
  }>({ key: 'default', dir: 'desc' });
  const [detailModal, setDetailModal] = useState<{
    item: EventReportItem;
    type:
      | 'revenue'
      | 'returning'
      | 'new'
      | 'gender_male'
      | 'gender_female'
      | 'gender_nb'
      | 'age_under20'
      | 'age_20to30'
      | 'age_31to40'
      | 'age_40to50'
      | 'age_over50'
      | 'registrations'
      | 'cancellations'
      | 'reviews'
      | 'commission';
  } | null>(null);

  React.useEffect(() => {
    if (!detailModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailModal]);

  const [leaderboardHikers, setLeaderboardHikers] = useState<any[]>(() => {
    if (leaderboard && Array.isArray(leaderboard.hikers)) return leaderboard.hikers;
    return [];
  });

  // Load Leaderboard data for lifetime hikes and phone matching (same as CoordinatorHub)
  React.useEffect(() => {
    if (leaderboard && Array.isArray(leaderboard.hikers) && leaderboard.hikers.length > 0) {
      setLeaderboardHikers(leaderboard.hikers);
      return;
    }
    let isMounted = true;
    const loadLeaderboard = async () => {
      try {
        const res = await fetchLeaderboardData(false);
        if (isMounted && res && Array.isArray(res.hikers)) {
          setLeaderboardHikers(res.hikers);
        }
      } catch (err) {
        console.warn('[AdminReports] Could not load leaderboard data:', err);
      }
    };
    loadLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [leaderboard]);

  // Safe string helpers to prevent runtime TypeErrors on non-string or undefined properties
  const safeLower = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.toLowerCase();
    return String(val).toLowerCase();
  };

  const safeTrimLower = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim().toLowerCase();
    return String(val).trim().toLowerCase();
  };

  const normStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const parseDayMonth = (d?: string): { day: number; month: string } | null => {
    if (!d) return null;
    const str = String(d).toLowerCase().trim();
    const m1 = str.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3,9})/);
    if (m1) return { day: parseInt(m1[1], 10), month: m1[2].slice(0, 3) };
    const m2 = str.match(/([a-z]{3,9})\s+(\d{1,2})/);
    if (m2) return { day: parseInt(m2[2], 10), month: m2[1].slice(0, 3) };
    const mIso = str.match(/\d{4}-(\d{2})-(\d{2})/);
    if (mIso) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mIdx = parseInt(mIso[1], 10) - 1;
      return { day: parseInt(mIso[2], 10), month: monthNames[mIdx] || '' };
    }
    return null;
  };

  const datesMatch = (d1?: string, d2?: string): boolean => {
    if (!d1 || !d2) return false;
    const p1 = parseDayMonth(d1);
    const p2 = parseDayMonth(d2);
    if (p1 && p2) {
      return p1.day === p2.day && p1.month === p2.month;
    }
    const s1 = normStr(d1);
    const s2 = normStr(d2);
    return s1 === s2 || (s1.length > 5 && s2.length > 5 && (s1.includes(s2) || s2.includes(s1)));
  };

  const getHikeNumberFromAny = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string' || typeof obj === 'number') {
      const m = String(obj).match(/\d+/);
      return m ? m[0] : '';
    }
    const fields = [
      obj.hike_number,
      obj.hikeNumber,
      obj.trek_id,
      obj.hike_id,
      obj.id,
    ];
    for (const f of fields) {
      if (f !== undefined && f !== null) {
        const m = String(f).match(/\d+/);
        if (m && parseInt(m[0], 10) > 0) return m[0];
      }
    }
    return '';
  };

  const isGenericTitle = (name?: string): boolean => {
    if (!name) return true;
    const n = name.toLowerCase().trim();
    return (
      !n ||
      n === 'himalayan trek' ||
      n === 'hike event' ||
      n === 'untitled hike' ||
      n === 'day hike' ||
      n === 'overnight bus hike' ||
      n === 'overnight bus hikes' ||
      n === 'multi day treks' ||
      n === 'trek' ||
      n === 'hike' ||
      n === 'himalayan trek / event' ||
      /^hike\s*#?\d*$/i.test(n)
    );
  };

  const getTrekNameForHike = (hikeNum: string, fallbackName?: string): string => {
    if (fallbackName && !isGenericTitle(fallbackName)) {
      return fallbackName;
    }
    if (hikeNum) {
      const cleanNum = getHikeNumberFromAny(hikeNum);
      const hist = HISTORICAL_TREKS.find(
        (h) => getHikeNumberFromAny(h.hike_number) === cleanNum
      );
      if (hist && hist.title) {
        return hist.title;
      }
      return `Hike #${hikeNum}`;
    }
    return fallbackName || 'Hike Event';
  };

  // Helper: parse numerical price from string or number
  const parsePrice = (priceVal?: string | number): number => {
    if (typeof priceVal === 'number') return priceVal;
    if (!priceVal) return 0;
    const num = parseInt(String(priceVal).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };

  // Helper: parse numerical distance in KM from text string like "12.4 km"
  const parseDistanceKm = (distStr?: string): number => {
    if (!distStr) return 0;
    const match = String(distStr).match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Helper: parse date to timestamp ms
  const parseEventTimestamp = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (
      s.toLowerCase().includes('upcoming') ||
      s.toLowerCase().includes('tba') ||
      s.toLowerCase().includes('tbd') ||
      s.toLowerCase().includes('past')
    ) {
      return null;
    }

    // Clean string by removing day names like "Saturday ", "Sun, ", "(Sat) ", etc.
    const clean = s
      .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|\(.*?\))[,.\s]+/i, '')
      .trim();

    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d.getTime();

    // Match patterns like "18 Jan 2025" or "08 Aug 2026" or "12 Sep 2026"
    const m = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (m) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = monthNames.findIndex((mn) => mn.toLowerCase() === m[2].substring(0, 3).toLowerCase());
      if (mIdx !== -1) {
        return new Date(parseInt(m[3], 10), mIdx, parseInt(m[1], 10)).getTime();
      }
    }

    // Match ISO dates like "2026-09-12"
    const isoMatch = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10)).getTime();
    }

    return null;
  };

  // Helper: derive month key for monthly sales commission grouping (e.g. "2026-08")
  const getMonthKey = (dateStr?: string): string => {
    if (!dateStr) return '2026-08';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let month = '08';
    let year = '2026';

    const dStr = String(dateStr).toLowerCase();
    monthNames.forEach((m, i) => {
      if (dStr.includes(m.toLowerCase())) {
        month = (i + 1).toString().padStart(2, '0');
      }
    });

    const yrMatch = String(dateStr).match(/\b(20\d\d)\b/);
    if (yrMatch) year = yrMatch[1];

    return `${year}-${month}`;
  };

  // Lifetime Leaderboard Phone & Name Map (same as CoordinatorHub)
  const leaderboardPhoneMap = useMemo(() => {
    const phoneMap = new Map<string, number>();
    const nameMap = new Map<string, number>();

    leaderboardHikers.forEach((h: any) => {
      const rawPhone = (h.phone || h.p || '').replace(/[^0-9]/g, '');
      const count = Number(h.c || (Array.isArray(h.hikes) ? h.hikes.length : 0)) || 0;
      if (count <= 0) return;

      if (rawPhone.length >= 7) {
        phoneMap.set(rawPhone, Math.max(phoneMap.get(rawPhone) || 0, count));
        if (rawPhone.length > 10) {
          const last10 = rawPhone.slice(-10);
          phoneMap.set(last10, Math.max(phoneMap.get(last10) || 0, count));
        }
      }

      const cleanName = (h.n || '').toLowerCase().trim();
      if (cleanName.length >= 3) {
        nameMap.set(cleanName, Math.max(nameMap.get(cleanName) || 0, count));
      }
    });

    return { phoneMap, nameMap };
  }, [leaderboardHikers]);

  // Lifetime Hike Count Map from local registrations (excluding duplicate applications)
  const hikerPastHikesMap = useMemo(() => {
    const map = new Map<string, number>();
    registrations.forEach((r) => {
      const st = safeTrimLower(r.status || (r as any).registration_status);
      if (st.includes('duplicate') || st.includes('double')) return;
      const ph = (r.phone || r.whatsapp || (r as any).whatsapp_number || '').trim();
      const nameKey = (r.full_name || '').toLowerCase().trim();
      if (ph) {
        map.set(ph, (map.get(ph) || 0) + 1);
      }
      if (nameKey) {
        map.set(`name:${nameKey}`, (map.get(`name:${nameKey}`) || 0) + 1);
      }
    });
    return map;
  }, [registrations]);

  const getHikerPastCount = (phone: string, name: string): number => {
    const cleanPh = phone.replace(/[^0-9]/g, '');
    const last10 = cleanPh.length >= 10 ? cleanPh.slice(-10) : cleanPh;
    const cleanName = (name || '').toLowerCase().trim();

    // 1. Primary: Match by phone number in Leaderboard (lifetime master data)
    if (cleanPh.length >= 7) {
      if (leaderboardPhoneMap.phoneMap.has(cleanPh)) {
        return leaderboardPhoneMap.phoneMap.get(cleanPh)!;
      }
      if (last10.length >= 7 && leaderboardPhoneMap.phoneMap.has(last10)) {
        return leaderboardPhoneMap.phoneMap.get(last10)!;
      }
      for (const [key, count] of leaderboardPhoneMap.phoneMap.entries()) {
        if (cleanPh.endsWith(key) || key.endsWith(cleanPh) || (last10.length >= 8 && key.endsWith(last10))) {
          return count;
        }
      }
    }

    // 2. Secondary: Match by exact name in Leaderboard
    if (cleanName && leaderboardPhoneMap.nameMap.has(cleanName)) {
      return leaderboardPhoneMap.nameMap.get(cleanName)!;
    }

    // 3. Fallback: Local registrations count
    const ph = phone.trim();
    const nameKey = `name:${cleanName}`;
    if (ph && hikerPastHikesMap.has(ph)) {
      return hikerPastHikesMap.get(ph) || 1;
    }
    if (nameKey && hikerPastHikesMap.has(nameKey)) {
      return hikerPastHikesMap.get(nameKey) || 1;
    }
    return 1;
  };

  // 100% Real Analytics Aggregation from live datasets
  const metrics = useMemo(() => {
    // A. Filter treks by year & category
    const filteredHistoricalTreks = (leaderboard?.growthCurve || []).filter((h: any) => {
      if (selectedYear === 'all') return true;
      return String(h.date || '').includes(selectedYear);
    }).filter((h: any) => {
      if (selectedCategory === 'all') return true;
      const cat = safeLower(h.category);
      return cat.includes(safeLower(selectedCategory));
    });

    // B. Filter live itineraries
    const filteredTreks = treks.filter((t) => {
      if (selectedCategory === 'all') return true;
      return safeLower(t.category).includes(safeLower(selectedCategory));
    });

    // C. Live registrations analysis
    const totalRegistrations = registrations.length;
    const confirmedRegs = registrations.filter((r) => {
      const st = safeTrimLower(r.status);
      const paySt = safeTrimLower(r.payment_status);
      return st === 'confirmed' || st === 'verified' || paySt === 'deposit paid' || paySt === 'fully paid';
    });
    const pendingRegs = registrations.filter((r) => {
      const st = safeTrimLower(r.status);
      const paySt = safeTrimLower(r.payment_status);
      return st === 'pending' || paySt === 'unpaid';
    });
    const cancelledRegs = registrations.filter((r) => {
      const st = safeTrimLower(r.status);
      return st.includes('cancel') || st === 'rejected';
    });

    // Calculate real live revenue collected
    let liveCollectedRevenueNPR = 0;
    let liveProjectedRevenueNPR = 0;

    registrations.forEach((r) => {
      const matchedTrek = treks.find(
        (t) => String(t.hike_number || t.id) === String(r.trek_id || r.hike_number) || t.title === r.trek_name
      );
      const ticketPrice = parsePrice(r.paid_amount) || parsePrice(matchedTrek?.price) || 1500;
      liveProjectedRevenueNPR += parsePrice(matchedTrek?.price) || ticketPrice;

      const st = safeTrimLower(r.status);
      const paySt = safeTrimLower(r.payment_status);
      if (st === 'confirmed' || st === 'verified' || paySt === 'deposit paid' || paySt === 'fully paid') {
        liveCollectedRevenueNPR += ticketPrice;
      }
    });

    // D. Category Breakdown from real HISTORICAL_TREKS + active treks
    const categoryCounts: Record<string, { count: number; totalKm: number }> = {};
    [...filteredHistoricalTreks, ...filteredTreks].forEach((item) => {
      const rawCat = 'category' in item ? item.category : 'Day Hike';
      let cat = rawCat || 'Day Hike';
      const catLower = safeLower(cat);
      if (catLower.includes('overnight') || catLower.includes('bus')) {
        cat = 'Overnight Bus Hikes';
      } else if (catLower.includes('multi') || catLower.includes('trek')) {
        cat = 'Multi Day Treks';
      } else if (catLower.includes('subs') || catLower.includes('subscription')) {
        cat = 'Subscription Hikes';
      } else {
        cat = 'Day Hikes';
      }

      const dist = parseDistanceKm(('approx_distance' in item ? item.approx_distance : '') || '');

      if (!categoryCounts[cat]) {
        categoryCounts[cat] = { count: 0, totalKm: 0 };
      }
      categoryCounts[cat].count += 1;
      categoryCounts[cat].totalKm += dist;
    });

    // E. Monthly Events Distribution from HISTORICAL_TREKS
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyStats = monthNames.map((m) => ({ month: m, events: 0, distanceKm: 0 }));

    filteredHistoricalTreks.forEach((h: any) => {
      const dateStr = String(h.date || h.hike_date || '');
      monthNames.forEach((m, idx) => {
        if (dateStr.includes(m)) {
          monthlyStats[idx].events += 1;
          monthlyStats[idx].distanceKm += parseDistanceKm(h.approx_distance || h.distance);
        }
      });
    });

    // F. Authentic Community Reviews Aggregation
    const totalReviews = feedback.length;
    let sumOverallRating = 0;
    let sumTeamRating = 0;
    let highRatingCount = 0; // 4 or 5 stars

    feedback.forEach((rev) => {
      const overall = Number(rev.overall_rating || rev.rating || 5);
      const team = Number(rev.team_rating || rev.teamRating || 5);
      sumOverallRating += overall;
      sumTeamRating += team;
      if (overall >= 4) highRatingCount += 1;
    });

    const avgOverallRating = totalReviews > 0 ? (sumOverallRating / totalReviews).toFixed(2) : '0.00';
    const avgTeamRating = totalReviews > 0 ? (sumTeamRating / totalReviews).toFixed(2) : '0.00';
    const npsScorePct = totalReviews > 0 ? Math.round((highRatingCount / totalReviews) * 100) : 0;

    // G. Guide / Leader Analysis from Historical Growth Data
    const guideMap: Record<string, { hikesCount: number; totalKm: number }> = {};
    (leaderboard?.growthCurve || []).forEach((h: any) => {
      const leader = String(h.team_leader || h.leader || '');
      if (!leader) return;

      const names = leader
        .replace(/&|Team|\+|\/|Subs|Sat/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const dist = parseDistanceKm(h.approx_distance || h.distance);

      names.forEach((name) => {
        const cleanName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        if (!guideMap[cleanName]) {
          guideMap[cleanName] = { hikesCount: 0, totalKm: 0 };
        }
        guideMap[cleanName].hikesCount += 1;
        guideMap[cleanName].totalKm += dist;
      });
    });

    const topGuidesList = Object.entries(guideMap)
      .map(([name, data]) => ({
        name,
        hikes: data.hikesCount,
        totalKm: Math.round(data.totalKm)
      }))
      .sort((a, b) => b.hikes - a.hikes)
      .slice(0, 6);

    // H. Gender Breakdown from live registrations
    const genderCounts = { male: 0, female: 0, other: 0, total: 0 };
    registrations.forEach((r) => {
      const g = safeTrimLower(r.gender);
      genderCounts.total += 1;
      if (g.includes('female') || g.includes('woman') || g === 'f') {
        genderCounts.female += 1;
      } else if (g.includes('male') || g.includes('man') || g === 'm') {
        genderCounts.male += 1;
      } else {
        genderCounts.other += 1;
      }
    });

    // Medical conditions count from live roster safely guarded against boolean or non-string values
    const medicalAlertsCount = registrations.filter((r) => {
      const hasMed = safeTrimLower(r.has_medical);
      const spec = safeTrimLower(r.specify_medical);
      const cond = safeTrimLower(r.medical_condition);
      return (
        hasMed === 'yes' ||
        hasMed === 'true' ||
        String(r.has_medical) === 'true' ||
        (spec.length > 0 && spec !== 'none' && spec !== 'false' && spec !== 'no') ||
        (cond.length > 0 && cond !== 'none' && cond !== 'false' && cond !== 'no')
      );
    }).length;

    // Total distance covered across all historical treks from growth curve
    const totalHistoricalKm = (leaderboard?.growthCurve || []).reduce(
      (acc: number, h: any) => acc + parseDistanceKm(h.approx_distance || h.distance),
      0
    );

    // I. COMPREHENSIVE PER EVENT REPORT GENERATION (EXACT SAME AUTHORITATIVE SOURCE AS BOOKING ROSTER & COORDINATOR HUB)
    // 1. Synthesize all available trek events from library treks and registrations
    const existingHikeNums = new Set<string>();
    const existingIds = new Set<string>();

    treks.forEach((t) => {
      if (t.id) existingIds.add(t.id.toLowerCase());
      const hNum = getHikeNumberFromAny(t);
      if (hNum) existingHikeNums.add(hNum);
    });

    const virtualTreks: Trek[] = [];
    const seenHikeKeys = new Set<string>();

    registrations.forEach((r) => {
      const hNum = getHikeNumberFromAny(r);
      const rawId = (r.trek_id || r.hike_number || '').trim();
      const trekKey = hNum || rawId || (r.trek_name || '').trim();

      if (!trekKey || seenHikeKeys.has(trekKey)) return;

      const isCovered =
        (hNum && existingHikeNums.has(hNum)) ||
        (rawId && existingIds.has(rawId.toLowerCase()));

      if (!isCovered) {
        seenHikeKeys.add(trekKey);

        const allMatchingRegs = registrations.filter(
          (other) => getHikeNumberFromAny(other) === hNum
        );
        const namedReg = allMatchingRegs.find((other) => other.trek_name && !isGenericTitle(other.trek_name));
        const datedReg = allMatchingRegs.find((other) => other.trek_date && other.trek_date.trim().length > 0);

        const trekName = getTrekNameForHike(hNum, namedReg?.trek_name || r.trek_name);
        const trekDate = datedReg?.trek_date || r.trek_date || '';

        virtualTreks.push({
          id: rawId || (hNum ? `hike-${hNum}` : `v-${Math.random().toString(36).substring(2, 7)}`),
          hike_number: hNum || rawId || '',
          name: trekName,
          title: trekName,
          date: trekDate,
          days: '1',
          difficulty: 'moderate',
          leader: 'Walk Nepal Walk Guide',
          capacity: 30,
          participants: 0,
          price: 'NPR 1,500',
          featured_image: '',
          status: 'published',
        });
      }
    });

    // Enrich existing treks if title is generic
    const enrichedTreksList = treks.map((t) => {
      const hNum = getHikeNumberFromAny(t);
      const currentTitle = t.title || t.name;
      if (hNum && isGenericTitle(currentTitle)) {
        const namedReg = registrations.find(
          (r) => getHikeNumberFromAny(r) === hNum && r.trek_name && !isGenericTitle(r.trek_name)
        );
        const realName = getTrekNameForHike(hNum, namedReg?.trek_name);
        return { ...t, name: realName, title: realName };
      }
      return t;
    });

    // Deduplicate to guarantee strictly ONE ROW per event
    const uniqueEventsMap = new Map<string, Trek>();
    [...enrichedTreksList, ...virtualTreks].forEach((t) => {
      const hNum = getHikeNumberFromAny(t);
      const key = hNum ? `hike-${hNum}` : (t.id ? `id-${t.id.toLowerCase()}` : `name-${normStr(t.title || t.name)}-${normStr(t.date)}`);
      if (!uniqueEventsMap.has(key)) {
        uniqueEventsMap.set(key, t);
      }
    });

    const eventListRaw = Array.from(uniqueEventsMap.values());

    // 2. Compute exact active registrations, revenue, cancellations, demographics for each event
    const eventComputedData = eventListRaw.map((t) => {
      const tHikeNum = getHikeNumberFromAny(t) || 'TBD';
      const trekTitle = t.title || t.name || t.data?.title || t.data?.name || '';
      const trekDate = t.date || t.hike_date || (t.data && (t.data.hikeDate || t.data.date)) || 'Upcoming';

      // Use exact matching function from BookingsManager / CoordinatorHub
      const activeRegs = registrations.filter((r) => doesRegistrationMatchTrek(r, t));

      // Specific cancellations for this event
      const cancelledRegs = registrations.filter((r) => {
        const st = safeTrimLower(r.status || (r as any).registration_status);
        if (!st.includes('cancel') && st !== 'rejected') return false;

        const rHike = getHikeNumberFromAny(r);
        if (tHikeNum !== 'TBD' && rHike) return tHikeNum === rHike;
        if (t.id && (r.trek_id === t.id || r.hike_number === t.id)) return true;

        const tName = normStr(t.title || t.name);
        const rName = normStr(r.trek_name);
        if (tName && rName && tName === rName) {
          const rDate = r.trek_date || (r as any).date;
          return datesMatch(trekDate, rDate);
        }
        return false;
      });

      // Calculate revenue collected (matching CoordinatorHub exactly: sum of paid_amount)
      const eventRev = activeRegs.reduce((acc, r) => acc + (Number(r.paid_amount) || 0), 0);
      const eventDue = activeRegs.reduce((acc, r) => acc + (Number(r.due_amount) || 0), 0);

      // Demographic calculations: Gender sub-columns (M, F, NB)
      let female = 0;
      let male = 0;
      let nb = 0;
      const maleRegs: AdminRegistration[] = [];
      const femaleRegs: AdminRegistration[] = [];
      const nbRegs: AdminRegistration[] = [];
      activeRegs.forEach((r) => {
        const g = safeTrimLower(r.gender);
        if (g.includes('female') || g === 'f' || g.includes('woman')) {
          female++;
          femaleRegs.push(r);
        } else if (g.includes('male') || g === 'm' || g.includes('man')) {
          male++;
          maleRegs.push(r);
        } else {
          nb++;
          nbRegs.push(r);
        }
      });

      const totalPax = activeRegs.length;
      const fPct = totalPax > 0 ? Math.round((female / totalPax) * 100) : 0;
      const mPct = totalPax > 0 ? Math.round((male / totalPax) * 100) : 0;
      const nbPct = totalPax > 0 ? Math.round((nb / totalPax) * 100) : 0;

      const genders = {
        male: { count: male, pct: mPct },
        female: { count: female, pct: fPct },
        nb: { count: nb, pct: nbPct },
      };

      const genderBreakdown = totalPax > 0
        ? `F: ${female} (${fPct}%), M: ${male} (${mPct}%)`
        : 'N/A';

      // Age group 5 sub-columns: <20, 20-30, 31-40, 40-50, >50
      let countUnder20 = 0;
      let count20to30 = 0;
      let count31to40 = 0;
      let count40to50 = 0;
      let countOver50 = 0;
      const under20Regs: AdminRegistration[] = [];
      const age20to30Regs: AdminRegistration[] = [];
      const age31to40Regs: AdminRegistration[] = [];
      const age40to50Regs: AdminRegistration[] = [];
      const over50Regs: AdminRegistration[] = [];

      activeRegs.forEach((r) => {
        const raw = safeLower(r.age_group);
        if (
          raw.includes('under') ||
          raw.includes('below') ||
          raw === '<20' ||
          raw.includes('< 20') ||
          raw.includes('child') ||
          raw.includes('teen')
        ) {
          countUnder20++;
          under20Regs.push(r);
        } else if (raw.includes('20') && (raw.includes('30') || raw.includes('25') || raw.includes('29'))) {
          count20to30++;
          age20to30Regs.push(r);
        } else if (raw.includes('31') || raw.includes('35') || raw === '31-40') {
          count31to40++;
          age31to40Regs.push(r);
        } else if (raw.includes('41') || raw.includes('40-50') || raw.includes('41-50') || (raw.includes('40') && raw.includes('50'))) {
          count40to50++;
          age40to50Regs.push(r);
        } else if (
          raw.includes('50') ||
          raw.includes('over') ||
          raw.includes('above') ||
          raw.includes('>') ||
          raw.includes('senior')
        ) {
          countOver50++;
          over50Regs.push(r);
        } else if (raw.includes('40')) {
          count40to50++;
          age40to50Regs.push(r);
        } else {
          count20to30++;
          age20to30Regs.push(r);
        }
      });

      const pctUnder20 = totalPax > 0 ? Math.round((countUnder20 / totalPax) * 100) : 0;
      const pct20to30 = totalPax > 0 ? Math.round((count20to30 / totalPax) * 100) : 0;
      const pct31to40 = totalPax > 0 ? Math.round((count31to40 / totalPax) * 100) : 0;
      const pct40to50 = totalPax > 0 ? Math.round((count40to50 / totalPax) * 100) : 0;
      const pctOver50 = totalPax > 0 ? Math.round((countOver50 / totalPax) * 100) : 0;

      const ageGroups = {
        under20: { count: countUnder20, pct: pctUnder20 },
        age20to30: { count: count20to30, pct: pct20to30 },
        age31to40: { count: count31to40, pct: pct31to40 },
        age40to50: { count: count40to50, pct: pct40to50 },
        over50: { count: countOver50, pct: pctOver50 },
      };

      // Age group breakdown string (dynamic from actual registrations)
      const formatAgeSymbol = (label: string): string => {
        let g = label.trim();
        g = g.replace(/^(under|below)\s*(\d+)/i, '<$2');
        g = g.replace(/^(over|above)\s*(\d+)/i, '>$2');
        g = g.replace(/(\d+)\s*[-–—]\s*(\d+)/, '$1-$2');
        return g;
      };

      const ageGroupsMap: Record<string, number> = {};
      activeRegs.forEach((r) => {
        const rawA = (r.age_group || 'Unspecified').trim();
        const a = formatAgeSymbol(rawA);
        ageGroupsMap[a] = (ageGroupsMap[a] || 0) + 1;
      });
      const ageGroupEntries = Object.entries(ageGroupsMap).sort((a, b) => b[1] - a[1]);
      const ageGroupBreakdown = totalPax > 0
        ? ageGroupEntries
            .map(([grp, cnt]) => `${grp}: ${cnt} (${Math.round((cnt / totalPax) * 100)}%)`)
            .join(', ')
        : 'N/A';

      // Returning vs New (using master leaderboard phone & name lookup)
      const returningRegs: Array<{ reg: AdminRegistration; pastCount: number }> = [];
      const newRegs: AdminRegistration[] = [];
      activeRegs.forEach((r) => {
        const pastCount = getHikerPastCount(
          r.phone || r.whatsapp || (r as any).whatsapp_number || '',
          r.full_name
        );
        if (pastCount > 1) {
          returningRegs.push({ reg: r, pastCount });
        } else {
          newRegs.push(r);
        }
      });
      const returningCount = returningRegs.length;
      const newCount = Math.max(0, totalPax - returningCount);
      const returningPct = totalPax > 0 ? Math.round((returningCount / totalPax) * 100) : 0;
      const newPct = totalPax > 0 ? Math.round((newCount / totalPax) * 100) : 0;

      // Lead guide resolution
      let leadGuide = t.leader || t.team_leader || t.data?.teamLeader;
      if (!leadGuide || isGenericTitle(leadGuide) || leadGuide.toLowerCase().includes('walk nepal')) {
        const leadReg = activeRegs.find((r) => {
          const upd = safeLower((r as any).updates || (r as any).notes || (r as any).role || (r as any).suggestions);
          return upd.includes('leader') || upd.includes('guide');
        });
        if (leadReg && leadReg.full_name) {
          leadGuide = leadReg.full_name;
        }
      }
      if (!leadGuide || isGenericTitle(leadGuide)) {
        const matchedGrowth = (leaderboard?.growthCurve || []).find((h: any) => {
          const gNum = getHikeNumberFromAny(h.event_no || h.hike_number);
          return tHikeNum && gNum === tHikeNum;
        });
        if (matchedGrowth?.team_leader) {
          leadGuide = matchedGrowth.team_leader;
        }
      }
      if (!leadGuide) leadGuide = 'Walk Nepal Walk Guide';

      // Average Review Rating
      const matchedRev = feedback.filter((rev) => {
        const revHike = getHikeNumberFromAny(rev.hike_number || rev.hike_id || rev.trek_id);
        if (tHikeNum && revHike && tHikeNum === revHike) return true;
        const revTrek = safeLower(rev.trek_name);
        const tTitleLower = safeLower(trekTitle);
        return revTrek.length > 3 && tTitleLower.length > 3 && (revTrek.includes(tTitleLower) || tTitleLower.includes(revTrek));
      });
      let avgRevStr = 'N/A';
      if (matchedRev.length > 0) {
        const avg = matchedRev.reduce((a, b) => a + (Number(b.overall_rating || b.rating) || 5), 0) / matchedRev.length;
        avgRevStr = `${avg.toFixed(1)} ★`;
      } else if ((t as any).rating) {
        avgRevStr = `${Number((t as any).rating).toFixed(1)} ★`;
      }

      const displayTitle = trekTitle && !isGenericTitle(trekTitle)
        ? trekTitle
        : (tHikeNum && tHikeNum !== 'TBD' ? `Hike #${tHikeNum}` : 'Hike Event');

      const finalDate = trekDate && trekDate !== 'Upcoming' ? trekDate : (activeRegs[0]?.trek_date || 'Upcoming');
      const mKey = getMonthKey(finalDate);

      return {
        hikeNumber: tHikeNum,
        title: displayTitle,
        date: finalDate,
        category: t.category || (t.data && t.data.category) || 'Day Hike',
        revenue: eventRev,
        dueAmount: eventDue,
        returningCount,
        returningPct,
        newCount,
        newPct,
        genderBreakdown,
        genders,
        ageGroupBreakdown,
        ageGroups,
        registrationsCount: totalPax,
        cancellationsCount: cancelledRegs.length,
        leadGuide,
        averageReview: avgRevStr,
        monthKey: mKey,
        timestamp: parseEventTimestamp(finalDate),
        activeRegs,
        cancelledRegs,
        returningRegs,
        newRegs,
        genderRegs: {
          male: maleRegs,
          female: femaleRegs,
          nb: nbRegs,
        },
        ageGroupRegs: {
          under20: under20Regs,
          age20to30: age20to30Regs,
          age31to40: age31to40Regs,
          age40to50: age40to50Regs,
          over50: over50Regs,
        },
        matchedRev,
      };
    });

    // 3. Compute monthly sales totals for commission tier calculation
    const monthlySalesMap: Record<string, number> = {};
    eventComputedData.forEach((ev) => {
      monthlySalesMap[ev.monthKey] = (monthlySalesMap[ev.monthKey] || 0) + ev.revenue;
    });

    // 4. Construct final event report items with tiered commission
    const eventReportList: EventReportItem[] = eventComputedData.map((ev) => {
      const monthlyTotal = monthlySalesMap[ev.monthKey] || 0;
      const commissionRate = monthlyTotal > 600000 ? 0.02 : 0.01;
      const commission = Math.round(ev.revenue * commissionRate);

      return {
        hikeNumber: ev.hikeNumber,
        hikeNameAndDate: `${ev.title} (${ev.date})`,
        title: ev.title,
        date: ev.date,
        category: ev.category,
        revenue: ev.revenue,
        dueAmount: ev.dueAmount,
        returningCount: ev.returningCount,
        returningPct: ev.returningPct,
        newCount: ev.newCount,
        newPct: ev.newPct,
        genderBreakdown: ev.genderBreakdown,
        genders: ev.genders,
        ageGroupBreakdown: ev.ageGroupBreakdown,
        ageGroups: ev.ageGroups,
        registrationsCount: ev.registrationsCount,
        cancellationsCount: ev.cancellationsCount,
        leadGuide: ev.leadGuide,
        averageReview: ev.averageReview,
        commission,
        monthKey: ev.monthKey,
        timestamp: ev.timestamp,
        details: {
          activeRegs: ev.activeRegs,
          cancelledRegs: ev.cancelledRegs,
          returningRegs: ev.returningRegs,
          newRegs: ev.newRegs,
          genderRegs: ev.genderRegs,
          ageGroupRegs: ev.ageGroupRegs,
          reviews: ev.matchedRev,
          monthlyTotalRevenue: monthlyTotal,
          commissionRate,
        },
      };
    });

    // Sort events: upcoming first, then past events by timestamp descending (newest first)
    eventReportList.sort((a, b) => {
      const isAUpcoming = !a.timestamp || safeLower(a.date).includes('upcoming');
      const isBUpcoming = !b.timestamp || safeLower(b.date).includes('upcoming');
      if (isAUpcoming && !isBUpcoming) return -1;
      if (!isAUpcoming && isBUpcoming) return 1;
      if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
      return 0;
    });

    return {
      totalHistoricalTreks: (leaderboard?.growthCurve || []).length,
      filteredHistoricalTreksCount: filteredHistoricalTreks.length,
      activeItinerariesCount: treks.length,
      totalRegistrations,
      confirmedCount: confirmedRegs.length,
      pendingCount: pendingRegs.length,
      cancelledCount: cancelledRegs.length,
      liveCollectedRevenueNPR,
      liveProjectedRevenueNPR,
      categoryCounts,
      monthlyStats,
      totalReviews,
      avgOverallRating,
      avgTeamRating,
      npsScorePct,
      topGuidesList,
      genderCounts,
      medicalAlertsCount,
      totalHistoricalKm: Math.round(totalHistoricalKm),
      perEventList: eventReportList
    };
  }, [
    registrations,
    treks,
    selectedYear,
    selectedCategory,
    leaderboardHikers,
    leaderboardPhoneMap,
    hikerPastHikesMap,
    feedback,
    leaderboard
  ]);

  const maxMonthlyEvents = Math.max(...metrics.monthlyStats.map((m) => m.events), 1);

  // Timeframe & Search Filtered Per Event Report List
  const filteredEventList = useMemo(() => {
    const now = Date.now();

    // Determine latest past event timestamp to handle relative timeframes accurately
    const pastTimestamps = metrics.perEventList
      .map((e) => e.timestamp)
      .filter((ts): ts is number => ts !== null && ts <= now);
    const maxPastTs = pastTimestamps.length > 0 ? Math.max(...pastTimestamps) : now;

    // If the latest recorded past event is older than 30 days compared to today's clock,
    // anchor the past month windows from maxPastTs (+1 day buffer) so 1 Month, 2 Months, etc.
    // cleanly show events from that relative timeframe.
    const anchorTs = (now - maxPastTs > 30 * 24 * 60 * 60 * 1000)
      ? maxPastTs + 24 * 60 * 60 * 1000
      : now;

    return metrics.perEventList.filter((ev) => {
      // 1. Text Search Filter
      if (eventSearchTerm.trim()) {
        const term = eventSearchTerm.toLowerCase().trim();
        const match =
          safeLower(ev.title).includes(term) ||
          safeLower(ev.hikeNumber).includes(term) ||
          safeLower(ev.category).includes(term) ||
          safeLower(ev.date).includes(term) ||
          safeLower(ev.leadGuide).includes(term);
        if (!match) return false;
      }

      // Check if event is upcoming
      const isUpcoming =
        !ev.timestamp ||
        safeLower(ev.date).includes('upcoming') ||
        safeLower(ev.date).includes('tba') ||
        safeLower(ev.date).includes('tbd') ||
        (ev.timestamp !== null && ev.timestamp > now);

      // 2. Timeframe Filter
      if (filterMonths === 'all') {
        return true;
      }

      if (filterMonths === 'upcoming') {
        return isUpcoming;
      }

      // For month filters (1, 2, 3, 4, 6, 12): show past events only
      if (isUpcoming) {
        return false;
      }

      if (ev.timestamp !== null) {
        const windowMs = Number(filterMonths) * 30 * 24 * 60 * 60 * 1000;
        const diff = anchorTs - ev.timestamp;
        return diff >= 0 && diff <= windowMs;
      }

      return false;
    });
  }, [metrics.perEventList, eventSearchTerm, filterMonths]);

  type PerEventSortKey = typeof perEventSort.key;

  const handleSortToggle = (key: PerEventSortKey, defaultDir: 'asc' | 'desc' = 'desc') => {
    setPerEventSort((prev) => {
      if (prev.key !== key) return { key, dir: defaultDir };
      if (prev.dir === defaultDir) {
        return { key, dir: defaultDir === 'desc' ? 'asc' : 'desc' };
      }
      return { key: 'default', dir: 'desc' };
    });
  };

  const renderSortIcon = (key: PerEventSortKey) => {
    if (perEventSort.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-35 group-hover:opacity-90 shrink-0 transition-opacity" />;
    }
    return perEventSort.dir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#FF6600] shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#FF6600] shrink-0" />
    );
  };

  const sortedEventList = useMemo(() => {
    if (perEventSort.key === 'default') return filteredEventList;

    const dirMult = perEventSort.dir === 'asc' ? 1 : -1;
    const parseHikeSortNum = (val: string): number | null => {
      const m = String(val || '').match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    };
    const parseReviewNum = (val: string): number | null => {
      const m = String(val || '').match(/[\d.]+/);
      return m ? parseFloat(m[0]) : null;
    };

    return [...filteredEventList].sort((a, b) => {
      switch (perEventSort.key) {
        case 'hikeNumber': {
          const na = parseHikeSortNum(a.hikeNumber);
          const nb = parseHikeSortNum(b.hikeNumber);
          if (na === null && nb === null) return 0;
          if (na === null) return 1;
          if (nb === null) return -1;
          return (na - nb) * dirMult;
        }
        case 'date': {
          const ta = a.timestamp ?? null;
          const tb = b.timestamp ?? null;
          if (ta === null && tb === null) return a.title.localeCompare(b.title) * dirMult;
          if (ta === null) return 1;
          if (tb === null) return -1;
          if (ta !== tb) return (ta - tb) * dirMult;
          return a.title.localeCompare(b.title) * dirMult;
        }
        case 'revenue':
          return (a.revenue - b.revenue) * dirMult;
        case 'returning':
          return (a.returningCount - b.returningCount) * dirMult;
        case 'new':
          return (a.newCount - b.newCount) * dirMult;
        case 'gender_m':
          return (a.genders.male.count - b.genders.male.count) * dirMult;
        case 'gender_f':
          return (a.genders.female.count - b.genders.female.count) * dirMult;
        case 'gender_nb':
          return (a.genders.nb.count - b.genders.nb.count) * dirMult;
        case 'age_under20':
          return (a.ageGroups.under20.count - b.ageGroups.under20.count) * dirMult;
        case 'age_20to30':
          return (a.ageGroups.age20to30.count - b.ageGroups.age20to30.count) * dirMult;
        case 'age_31to40':
          return (a.ageGroups.age31to40.count - b.ageGroups.age31to40.count) * dirMult;
        case 'age_40to50':
          return (a.ageGroups.age40to50.count - b.ageGroups.age40to50.count) * dirMult;
        case 'age_over50':
          return (a.ageGroups.over50.count - b.ageGroups.over50.count) * dirMult;
        case 'registrations':
          return (a.registrationsCount - b.registrationsCount) * dirMult;
        case 'cancellations':
          return (a.cancellationsCount - b.cancellationsCount) * dirMult;
        case 'leadGuide':
          return a.leadGuide.localeCompare(b.leadGuide) * dirMult;
        case 'review': {
          const ra = parseReviewNum(a.averageReview);
          const rb = parseReviewNum(b.averageReview);
          if (ra === null && rb === null) return 0;
          if (ra === null) return 1;
          if (rb === null) return -1;
          return (ra - rb) * dirMult;
        }
        case 'commission':
          return (a.commission - b.commission) * dirMult;
        default:
          return 0;
      }
    });
  }, [filteredEventList, perEventSort]);

  return (
    <div className="w-full space-y-6 select-none animate-in fade-in duration-200">
      {/* Executive Control Header */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#FF6600]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#1F1F1F] tracking-tight">
              Real System Analytics &amp; Intelligence
            </h1>
          </div>
          <p className="text-xs text-[#8B8680] mt-1">
            Aggregated directly from {metrics.totalHistoricalTreks} historical events, {metrics.totalRegistrations} live bookings &amp; {metrics.totalReviews} authentic hiker reviews
          </p>
        </div>

        {/* Filters & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl text-xs font-bold text-[#1F1F1F] focus:outline-none focus:border-[#FF6600] cursor-pointer"
          >
            <option value="all">All Hike Categories</option>
            <option value="day">Day Hikes</option>
            <option value="overnight">Overnight Bus Hikes</option>
            <option value="multi">Multi Day Treks</option>
            <option value="subs">Subscription Hikes</option>
          </select>

          {/* Year Filter */}
          <div className="flex items-center bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl p-1">
            {['all', '2025', '2026'].map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === year
                    ? 'bg-[#FF6600] text-white shadow-xs'
                    : 'text-[#5A5551] hover:text-[#D85500]'
                }`}
              >
                {year === 'all' ? 'All Time' : year}
              </button>
            ))}
          </div>

          {/* Quick Export Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Top Level Real Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Live Revenue Collected */}
        <div className="bg-white rounded-2xl border border-[#E5E1DB] p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase text-[#8B8680] tracking-wider">Verified Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1F1F1F]">
            NPR {metrics.liveCollectedRevenueNPR.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{metrics.confirmedCount} Verified Roster Payments</span>
          </div>
        </div>

        {/* KPI 2: Total Events Catalogued */}
        <div className="bg-white rounded-2xl border border-[#E5E1DB] p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase text-[#8B8680] tracking-wider">Events Catalogued</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1F1F1F]">{metrics.totalHistoricalTreks}</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-indigo-600">
            <span>{metrics.totalHistoricalKm.toLocaleString()} Total Trail KM</span>
          </div>
        </div>

        {/* KPI 3: Verified Review Count */}
        <div className="bg-white rounded-2xl border border-[#E5E1DB] p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase text-[#8B8680] tracking-wider">Verified Reviews</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1F1F1F]">{metrics.totalReviews}</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-amber-600">
            <span>Avg {metrics.avgOverallRating} / 5.0 Rating</span>
          </div>
        </div>

        {/* KPI 4: Net Satisfaction Score */}
        <div className="bg-white rounded-2xl border border-[#E5E1DB] p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase text-[#8B8680] tracking-wider">Satisfaction Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#1F1F1F]">{metrics.npsScorePct}%</div>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-600">
            <span>4 &amp; 5 Star Positive Feedback</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Monthly Historical Event Frequency & Category Split */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Monthly Event Distribution from Historical Records */}
          <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#1F1F1F]">Monthly Hike Frequency &amp; Trail Seasonality</h3>
                <p className="text-xs text-[#8B8680]">Actual events count per month across historical database</p>
              </div>
              <div className="text-xs font-bold text-[#8B8680] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#EFEAE4]">
                {metrics.filteredHistoricalTreksCount} Events Measured
              </div>
            </div>

            {/* SVG Bar Chart Representation */}
            <div className="pt-4 pb-2">
              <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2 px-1 border-b border-[#F0EBE5]">
                {metrics.monthlyStats.map((item, idx) => {
                  const heightPct = item.events > 0 ? Math.round((item.events / maxMonthlyEvents) * 100) : 4;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                      {/* Tooltip on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono pointer-events-none mb-1 whitespace-nowrap z-10 shadow-lg">
                        {item.events} hikes | {Math.round(item.distanceKm)} km
                      </div>

                      {/* Bar */}
                      <div className="w-full max-w-[28px] bg-amber-100 rounded-t-md relative flex items-end overflow-hidden" style={{ height: `${heightPct}%` }}>
                        <div
                          className="w-full bg-[#FF6600] rounded-t-md transition-all group-hover:bg-[#D85500]"
                          style={{ height: '100%' }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#8B8680]">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2 & 3: Category Distribution & Live Roster Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Real Category Split */}
            <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1F1F1F]">Real Category Distribution</h3>
                <PieIcon className="w-4 h-4 text-[#8B8680]" />
              </div>
              <div className="space-y-3">
                {Object.entries(metrics.categoryCounts).map(([cat, data], i) => {
                  const colors = ['bg-[#FF6600]', 'bg-indigo-600', 'bg-emerald-600', 'bg-purple-600'];
                  const total = metrics.filteredHistoricalTreksCount + metrics.activeItinerariesCount;
                  const pct = total > 0 ? Math.round((data.count / total) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-[#1F1F1F]">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                          {cat}
                        </span>
                        <span>{data.count} events ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-[#F0EBE5] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Roster Status Breakdown */}
            <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1F1F1F]">Live Cloudflare Roster Status</h3>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-900">Verified &amp; Confirmed</span>
                  </div>
                  <span className="text-xs font-black text-emerald-700">{metrics.confirmedCount} Hikers</span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900">Pending Verification</span>
                  </div>
                  <span className="text-xs font-black text-amber-700">{metrics.pendingCount} Hikers</span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-900">Cancelled / Rejected</span>
                  </div>
                  <span className="text-xs font-black text-rose-700">{metrics.cancelledCount} Hikers</span>
                </div>

                {metrics.medicalAlertsCount > 0 && (
                  <div className="p-2 rounded-xl bg-rose-100/60 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{metrics.medicalAlertsCount} hikers flagged with pre-existing medical notices</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Top Staff Leaderboard & Real Reviews Sentiment */}
        <div className="space-y-6">
          {/* Card 4: Top Guide Leaders */}
          <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#1F1F1F]">Historical Guide Assignments</h3>
                <p className="text-[11px] text-[#8B8680]">Actual team leaders logged in database</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="space-y-2.5">
              {metrics.topGuidesList.map((guide, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4]">
                  <div>
                    <span className="text-xs font-bold text-[#1F1F1F] block">{guide.name}</span>
                    <span className="text-[10px] text-[#8B8680]">{guide.hikes} Hikes Logged • ~{guide.totalKm} km</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{metrics.avgTeamRating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 5: Gender Ratio & Roster Metrics */}
          <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-[#1F1F1F]">Roster Gender Balance</h3>
            
            {metrics.genderCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center h-3 rounded-full overflow-hidden bg-[#F0EBE5]">
                  <div
                    className="bg-indigo-600 h-full"
                    style={{ width: `${Math.round((metrics.genderCounts.male / metrics.genderCounts.total) * 100)}%` }}
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{ width: `${Math.round((metrics.genderCounts.female / metrics.genderCounts.total) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#1F1F1F]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    Male ({Math.round((metrics.genderCounts.male / metrics.genderCounts.total) * 100)}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Female ({Math.round((metrics.genderCounts.female / metrics.genderCounts.total) * 100)}%)
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#8B8680] p-3 rounded-xl bg-[#FAF8F5] text-center font-medium">
                No gender data specified in current roster submissions
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL WIDTH CARD: PER EVENT REPORT TABLE (ONLY ONE ROW PER EVENT) */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FF6600]" />
              <h2 className="text-lg font-black text-[#1F1F1F] tracking-tight">Per Event Report</h2>
              <span className="text-[10px] text-[#8B8680] bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#EFEAE4] font-bold uppercase tracking-wider">
                Showing {filteredEventList.length} Events ({filterMonths === 'all' ? 'All Time' : filterMonths === 'upcoming' ? 'Upcoming' : `Last ${filterMonths} Mo`})
              </span>
            </div>
            <p className="text-xs text-[#8B8680] mt-0.5">
              Comprehensive single-row stats per event (Revenue, Returning vs New, Demographics, Registrations, Cancellations, Lead Guide, Reviews &amp; Monthly Tiered Commission)
            </p>
          </div>

          {/* Timeframe Month Filter Buttons + Search Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Filter Buttons */}
            <div className="flex items-center bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl p-1 overflow-x-auto">
              {[
                { label: 'Upcoming', val: 'upcoming' },
                { label: '1 Month', val: 1 },
                { label: '2 Months', val: 2 },
                { label: '3 Months', val: 3 },
                { label: '4 Months', val: 4 },
                { label: '6 Months', val: 6 },
                { label: '12 Months', val: 12 },
                { label: 'All Time', val: 'all' }
              ].map((btn) => (
                <button
                  key={String(btn.val)}
                  type="button"
                  onClick={() => setFilterMonths(btn.val as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterMonths === btn.val
                      ? 'bg-[#FF6600] text-white shadow-xs'
                      : 'text-[#5A5551] hover:text-[#D85500]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={eventSearchTerm}
                onChange={(e) => setEventSearchTerm(e.target.value)}
                placeholder="Search event title or hike #..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl text-xs font-bold text-[#1F1F1F] placeholder-[#8B8680] focus:outline-none focus:border-[#FF6600]"
              />
              {eventSearchTerm && (
                <button
                  type="button"
                  onClick={() => setEventSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B8680] hover:text-[#1F1F1F]"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Per Event Report Table (One Row Per Event, All 12 Requested Columns) */}
        <div className="overflow-x-auto border border-[#EFEAE4] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#EFEAE4] text-[10.5px] font-black uppercase text-[#8B8680] tracking-wider whitespace-nowrap">
                <th rowSpan={2} className="py-2.5 px-3 align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('hikeNumber', 'desc')}
                    className="group inline-flex items-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Hike Number"
                  >
                    <span>Hike Number</span>
                    {renderSortIcon('hikeNumber')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('date', 'desc')}
                    className="group inline-flex items-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Event Date"
                  >
                    <span>Hike Name &amp; Date</span>
                    {renderSortIcon('date')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('revenue', 'desc')}
                    className="group inline-flex items-center justify-end gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors ml-auto"
                    title="Sort by Revenue"
                  >
                    <span>Revenue</span>
                    {renderSortIcon('revenue')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('returning', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Returning Hikers"
                  >
                    <span>Returning</span>
                    {renderSortIcon('returning')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('new', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by New Hikers"
                  >
                    <span>New</span>
                    {renderSortIcon('new')}
                  </button>
                </th>
                <th
                  colSpan={3}
                  className="py-1.5 px-2 text-center border-b border-[#EFEAE4] border-l border-r-2 border-l-[#E5E1DB] border-r-[#E5E1DB] bg-pink-50/40 text-pink-900/80"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <svg className="w-3 h-3 text-pink-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="5.5" cy="5.5" r="2.75" />
                      <path d="M1.5 13.5c0-2.1 1.8-3.5 4-3.5s4 1.4 4 3.5" />
                      <circle cx="11.2" cy="6" r="2.2" />
                      <path d="M10.5 10.2c2.1.2 4 1.4 4 3.3" />
                    </svg>
                    <span>Gender</span>
                  </span>
                </th>
                <th
                  colSpan={5}
                  className="py-1.5 px-2 text-center border-b border-[#EFEAE4] border-r border-r-[#E5E1DB] bg-amber-50/50 text-amber-900/80"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <svg className="w-3 h-3 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 4.8V8l2.2 1.4" />
                    </svg>
                    <span>Age Group</span>
                  </span>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('registrations', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Registrations"
                  >
                    <span>Registrations</span>
                    {renderSortIcon('registrations')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('cancellations', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Cancellations"
                  >
                    <span>Cancellations</span>
                    {renderSortIcon('cancellations')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('leadGuide', 'asc')}
                    className="group inline-flex items-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Lead Guide"
                  >
                    <span>Lead Guide</span>
                    {renderSortIcon('leadGuide')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('review', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors"
                    title="Sort by Average Review"
                  >
                    <span>Average Review</span>
                    {renderSortIcon('review')}
                  </button>
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('commission', 'desc')}
                    className="group inline-flex items-center justify-end gap-1 hover:text-[#1F1F1F] cursor-pointer transition-colors ml-auto"
                    title="Sort by Commission"
                  >
                    <span>Commission</span>
                    {renderSortIcon('commission')}
                  </button>
                </th>
              </tr>
              <tr className="bg-[#FAF8F5] border-b border-[#EFEAE4] text-[10px] font-bold text-[#8B8680] tracking-wider whitespace-nowrap">
                <th className="py-1.5 px-2 text-center border-l border-l-[#E5E1DB] border-r border-[#EFEAE4]/60 bg-sky-50/35 text-sky-700">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('gender_m', 'desc')}
                    className="group inline-flex items-center justify-center gap-0.5 hover:text-sky-900 cursor-pointer"
                    title="Sort by Male count"
                  >
                    <span>M</span>
                    {renderSortIcon('gender_m')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-[#EFEAE4]/60 bg-pink-50/45 text-pink-600">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('gender_f', 'desc')}
                    className="group inline-flex items-center justify-center gap-0.5 hover:text-pink-800 cursor-pointer"
                    title="Sort by Female count"
                  >
                    <span>F</span>
                    {renderSortIcon('gender_f')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r-2 border-r-[#E5E1DB] bg-violet-50/35 text-violet-700">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('gender_nb', 'desc')}
                    className="group inline-flex items-center justify-center gap-0.5 hover:text-violet-900 cursor-pointer"
                    title="Sort by NB / Unspecified count"
                  >
                    <span>NB</span>
                    {renderSortIcon('gender_nb')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-[#EFEAE4]/60 bg-amber-50/25 text-amber-900/75">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('age_under20', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer"
                    title="Sort by Age <20"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-600/80 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <circle cx="6" cy="3.5" r="2" />
                      <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                    </svg>
                    <span>&lt;20</span>
                    {renderSortIcon('age_under20')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-[#EFEAE4]/60 bg-amber-50/25 text-amber-900/75">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('age_20to30', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer"
                    title="Sort by Age 20-30"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-600/80 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <circle cx="6" cy="3.5" r="2" />
                      <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                    </svg>
                    <span>20-30</span>
                    {renderSortIcon('age_20to30')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-[#EFEAE4]/60 bg-amber-50/25 text-amber-900/75">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('age_31to40', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer"
                    title="Sort by Age 31-40"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-600/80 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <circle cx="6" cy="3.5" r="2" />
                      <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                    </svg>
                    <span>31-40</span>
                    {renderSortIcon('age_31to40')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-[#EFEAE4]/60 bg-amber-50/25 text-amber-900/75">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('age_40to50', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer"
                    title="Sort by Age 40-50"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-600/80 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <circle cx="6" cy="3.5" r="2" />
                      <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                    </svg>
                    <span>40-50</span>
                    {renderSortIcon('age_40to50')}
                  </button>
                </th>
                <th className="py-1.5 px-2 text-center border-r border-r-[#E5E1DB] bg-amber-50/25 text-amber-900/75">
                  <button
                    type="button"
                    onClick={() => handleSortToggle('age_over50', 'desc')}
                    className="group inline-flex items-center justify-center gap-1 hover:text-[#1F1F1F] cursor-pointer"
                    title="Sort by Age >50"
                  >
                    <svg className="w-2.5 h-2.5 text-amber-600/80 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <circle cx="6" cy="3.5" r="2" />
                      <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                    </svg>
                    <span>&gt;50</span>
                    {renderSortIcon('age_over50')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE4] text-xs">
              {sortedEventList.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-[#8B8680]">
                    No matching events found for the selected timeframe / search filter.
                  </td>
                </tr>
              ) : (
                sortedEventList.map((item) => (
                  <tr key={item.hikeNumber} className="hover:bg-[#FAF8F5] transition-colors">
                    {/* 1. Hike Number */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-[10px] font-extrabold inline-block">
                        #{item.hikeNumber}
                      </span>
                    </td>

                    {/* 2. Hike Name and Date */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {item.title &&
                        !/^hike\s*#?\d*$/i.test(item.title.trim()) &&
                        item.title.trim().toLowerCase() !== `hike #${item.hikeNumber}`.toLowerCase() &&
                        item.title.trim().toLowerCase() !== 'hike event' &&
                        item.title.trim().toLowerCase() !== 'untitled hike' ? (
                          <>
                            <span className="font-bold text-[#1F1F1F] block truncate max-w-[200px]" title={item.title}>
                              {item.title}
                            </span>
                            <span className="text-[10px] text-[#8B8680] font-semibold block">{item.date}</span>
                          </>
                        ) : (
                          <span className="font-bold text-[#1F1F1F] block">{item.date}</span>
                        )}
                      </div>
                    </td>

                    {/* 3. Revenue */}
                    <td className="py-3 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'revenue' })}
                        className="text-right hover:underline decoration-emerald-500/60 underline-offset-2 cursor-pointer transition-opacity hover:opacity-80"
                        title="View revenue & payment breakdown"
                      >
                        <div>NPR {item.revenue.toLocaleString()}</div>
                        {item.dueAmount && item.dueAmount > 0 ? (
                          <div className="text-[10px] text-amber-600 font-semibold">
                            Due: NPR {item.dueAmount.toLocaleString()}
                          </div>
                        ) : null}
                      </button>
                    </td>

                    {/* 4. Returning */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'returning' })}
                        className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 cursor-pointer transition-colors"
                        title="View returning hikers"
                      >
                        {item.returningCount} ({item.returningPct}%)
                      </button>
                    </td>

                    {/* 5. New */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'new' })}
                        className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 cursor-pointer transition-colors"
                        title="View new hikers"
                      >
                        {item.newCount} ({item.newPct}%)
                      </button>
                    </td>

                    {/* 6. Gender Sub-columns (M, F, NB) */}
                    <td className="py-3 px-2 text-center whitespace-nowrap border-l border-l-[#E5E1DB] border-r border-[#EFEAE4]/40 bg-sky-50/15">
                      {item.genders && item.genders.male.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'gender_male' })}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-50/90 hover:bg-sky-100 border border-sky-200/80 text-sky-700 font-bold cursor-pointer transition-colors"
                          title="View male hikers"
                        >
                          <span>{item.genders.male.count}</span>
                          <span className="text-[10px] text-sky-600/80 font-normal">
                            ({item.genders.male.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-[#EFEAE4]/40 bg-pink-50/20">
                      {item.genders && item.genders.female.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'gender_female' })}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-600 font-bold cursor-pointer transition-colors"
                          title="View female hikers"
                        >
                          <span className="text-pink-600 font-extrabold">{item.genders.female.count}</span>
                          <span className="text-[10px] text-pink-500/80 font-normal">
                            ({item.genders.female.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r-2 border-r-[#E5E1DB] bg-violet-50/15">
                      {item.genders && item.genders.nb.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'gender_nb' })}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-50/90 hover:bg-violet-100 border border-violet-200/80 text-violet-700 font-bold cursor-pointer transition-colors"
                          title="View non-binary / other hikers"
                        >
                          <span>{item.genders.nb.count}</span>
                          <span className="text-[10px] text-violet-600/80 font-normal">
                            ({item.genders.nb.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>

                    {/* 7. Age Group Sub-columns (<20, 20-30, 31-40, 40-50, >50) */}
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-[#EFEAE4]/40 bg-amber-50/10">
                      {item.ageGroups && item.ageGroups.under20.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'age_under20' })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF8F5] hover:bg-amber-50 border border-[#E5E1DB] text-[#1F1F1F] font-bold cursor-pointer transition-colors"
                          title="View hikers under 20"
                        >
                          <svg className="w-2.5 h-2.5 text-amber-600/85 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="3.5" r="2" />
                            <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                          </svg>
                          <span>{item.ageGroups.under20.count}</span>
                          <span className="text-[10px] text-[#8B8680] font-normal">
                            ({item.ageGroups.under20.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-[#EFEAE4]/40 bg-amber-50/10">
                      {item.ageGroups && item.ageGroups.age20to30.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'age_20to30' })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF8F5] hover:bg-amber-50 border border-[#E5E1DB] text-[#1F1F1F] font-bold cursor-pointer transition-colors"
                          title="View hikers aged 20-30"
                        >
                          <svg className="w-2.5 h-2.5 text-amber-600/85 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="3.5" r="2" />
                            <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                          </svg>
                          <span>{item.ageGroups.age20to30.count}</span>
                          <span className="text-[10px] text-[#8B8680] font-normal">
                            ({item.ageGroups.age20to30.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-[#EFEAE4]/40 bg-amber-50/10">
                      {item.ageGroups && item.ageGroups.age31to40.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'age_31to40' })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF8F5] hover:bg-amber-50 border border-[#E5E1DB] text-[#1F1F1F] font-bold cursor-pointer transition-colors"
                          title="View hikers aged 31-40"
                        >
                          <svg className="w-2.5 h-2.5 text-amber-600/85 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="3.5" r="2" />
                            <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                          </svg>
                          <span>{item.ageGroups.age31to40.count}</span>
                          <span className="text-[10px] text-[#8B8680] font-normal">
                            ({item.ageGroups.age31to40.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-[#EFEAE4]/40 bg-amber-50/10">
                      {item.ageGroups && item.ageGroups.age40to50.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'age_40to50' })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF8F5] hover:bg-amber-50 border border-[#E5E1DB] text-[#1F1F1F] font-bold cursor-pointer transition-colors"
                          title="View hikers aged 40-50"
                        >
                          <svg className="w-2.5 h-2.5 text-amber-600/85 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="3.5" r="2" />
                            <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                          </svg>
                          <span>{item.ageGroups.age40to50.count}</span>
                          <span className="text-[10px] text-[#8B8680] font-normal">
                            ({item.ageGroups.age40to50.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center whitespace-nowrap border-r border-r-[#E5E1DB] bg-amber-50/10">
                      {item.ageGroups && item.ageGroups.over50.count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'age_over50' })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FAF8F5] hover:bg-amber-50 border border-[#E5E1DB] text-[#1F1F1F] font-bold cursor-pointer transition-colors"
                          title="View hikers over 50"
                        >
                          <svg className="w-2.5 h-2.5 text-amber-600/85 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <circle cx="6" cy="3.5" r="2" />
                            <path d="M2.2 10.5c0-1.9 1.7-3.2 3.8-3.2s3.8 1.3 3.8 3.2H2.2z" />
                          </svg>
                          <span>{item.ageGroups.over50.count}</span>
                          <span className="text-[10px] text-[#8B8680] font-normal">
                            ({item.ageGroups.over50.pct}%)
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#BDB8B0] font-normal">—</span>
                      )}
                    </td>

                    {/* 8. Number of Registrations */}
                    <td className="py-3 px-3 text-center font-black">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'registrations' })}
                        className="px-2.5 py-0.5 rounded-md bg-yellow-100/90 hover:bg-yellow-200 border border-yellow-300 text-yellow-700 font-black cursor-pointer transition-colors"
                        title="View all registered hikers"
                      >
                        {item.registrationsCount}
                      </button>
                    </td>

                    {/* 9. Number of Cancellations */}
                    <td className="py-3 px-3 text-center font-bold text-rose-600">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'cancellations' })}
                        className="px-2 py-0.5 rounded-md bg-rose-50/70 hover:bg-rose-100 border border-rose-200/80 cursor-pointer transition-colors"
                        title="View cancelled & cancelled by user hikers"
                      >
                        {item.cancellationsCount}
                      </button>
                    </td>

                    {/* 10. Lead Guide */}
                    <td className="py-3 px-3 font-bold text-[#1F1F1F] whitespace-nowrap">
                      {item.leadGuide}
                    </td>

                    {/* 11. Average Review */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.details && item.details.reviews.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetailModal({ item, type: 'reviews' })}
                          className="inline-flex items-center gap-1 font-black text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 cursor-pointer transition-colors"
                          title="View event reviews"
                        >
                          {item.averageReview}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {item.averageReview}
                        </span>
                      )}
                    </td>

                    {/* 12. Commission */}
                    <td className="py-3 px-3 text-right font-black text-[#FF6600] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailModal({ item, type: 'commission' })}
                        className="hover:underline decoration-[#FF6600]/60 underline-offset-2 cursor-pointer transition-opacity hover:opacity-80"
                        title="View commission calculation details"
                      >
                        NPR {item.commission.toLocaleString()}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per Event Figure Detail Popup Modal */}
      {detailModal && (() => {
        const { item, type } = detailModal;
        const details = item.details;
        const activeRegs = details?.activeRegs || [];
        const cancelledRegs = details?.cancelledRegs || [];

        const cancelledByUserList = cancelledRegs.filter((r) => {
          const st = safeTrimLower(r.status || (r as any).registration_status);
          return st.includes('user');
        });
        const cancelledOtherList = cancelledRegs.filter((r) => {
          const st = safeTrimLower(r.status || (r as any).registration_status);
          return !st.includes('user');
        });

        const getTitle = () => {
          switch (type) {
            case 'revenue': return 'Revenue & Payment Breakdown';
            case 'returning': return `Returning Hikers (${item.returningCount})`;
            case 'new': return `New Hikers (${item.newCount})`;
            case 'gender_male': return `Male Hikers (${item.genders.male.count})`;
            case 'gender_female': return `Female Hikers (${item.genders.female.count})`;
            case 'gender_nb': return `Non-Binary / Unspecified Hikers (${item.genders.nb.count})`;
            case 'age_under20': return `Age Group <20 (${item.ageGroups.under20.count})`;
            case 'age_20to30': return `Age Group 20-30 (${item.ageGroups.age20to30.count})`;
            case 'age_31to40': return `Age Group 31-40 (${item.ageGroups.age31to40.count})`;
            case 'age_40to50': return `Age Group 40-50 (${item.ageGroups.age40to50.count})`;
            case 'age_over50': return `Age Group >50 (${item.ageGroups.over50.count})`;
            case 'registrations': return `Registered Hikers (${item.registrationsCount})`;
            case 'cancellations': return `Cancellations Breakdown (${item.cancellationsCount})`;
            case 'reviews': return `Hiker Reviews (${details?.reviews.length || 0})`;
            case 'commission': return 'Monthly Tiered Commission Breakdown';
          }
        };

        const renderHikerList = (list: AdminRegistration[], emptyMsg: string, badgeFn?: (r: AdminRegistration) => React.ReactNode) => {
          if (list.length === 0) {
            return (
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] text-xs text-[#8B8680] text-center font-medium">
                {emptyMsg}
              </div>
            );
          }
          return (
            <div className="divide-y divide-[#EFEAE4] border border-[#EFEAE4] rounded-xl overflow-hidden bg-white">
              {list.map((r, idx) => {
                const phone = r.phone || r.whatsapp || (r as any).whatsapp_number || '';
                const statusLabel = r.status || (r as any).registration_status || 'Confirmed';
                return (
                  <div key={r.id || idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF8F5]/70">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#1F1F1F]">{r.full_name || 'Unnamed Hiker'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#EFEAE4] text-[#5A5551]">
                          {statusLabel}
                        </span>
                        {badgeFn && badgeFn(r)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8B8680]">
                        {phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {phone}
                          </span>
                        )}
                        {(r.email || r.user_email || r.email_address) && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                            <Mail className="w-3 h-3 shrink-0" />
                            {r.email || r.user_email || r.email_address}
                          </span>
                        )}
                        {r.gender && <span>{r.gender}</span>}
                        {r.age_group && <span>{r.age_group}</span>}
                      </div>
                      {(r.admin_notes || r.person_remarks) && (
                        <div className="text-[11px] text-[#5A5551] bg-amber-50/70 border border-amber-200/60 rounded-lg px-2 py-1 mt-1 inline-flex items-start gap-1">
                          <FileText className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                          <span>{r.admin_notes || r.person_remarks}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-[11px]">
                      {r.payment_status && (
                        <span className="font-bold text-[#5A5551] block">{r.payment_status}</span>
                      )}
                      {(Number(r.paid_amount) > 0 || Number(r.due_amount) > 0) && (
                        <span className="text-[10px] text-[#8B8680] font-semibold">
                          Paid: NPR {Number(r.paid_amount || 0).toLocaleString()}
                          {Number(r.due_amount) > 0 ? ` • Due: NPR ${Number(r.due_amount).toLocaleString()}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-text"
            onClick={() => setDetailModal(null)}
          >
            <div
              className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-[#EFEAE4] bg-[#FAF8F5] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono text-[10px] font-extrabold">
                      #{item.hikeNumber}
                    </span>
                    <h3 className="text-base font-black text-[#1F1F1F]">{getTitle()}</h3>
                  </div>
                  <p className="text-xs text-[#8B8680] mt-0.5 font-medium">
                    {item.title} • {item.date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="p-1.5 rounded-xl text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#EFEAE4]/60 transition-colors cursor-pointer"
                  aria-label="Close popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                {type === 'cancellations' && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4]">
                        <span className="text-[10px] font-black uppercase text-[#8B8680] block">Total Cancelled</span>
                        <span className="text-lg font-black text-[#1F1F1F]">{cancelledRegs.length}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-amber-700 block">Cancelled by User</span>
                        <span className="text-lg font-black text-amber-800">{cancelledByUserList.length}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="text-[10px] font-black uppercase text-rose-700 block">Cancelled / Rejected</span>
                        <span className="text-lg font-black text-rose-800">{cancelledOtherList.length}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5" />
                        Cancelled by User ({cancelledByUserList.length})
                      </h4>
                      {renderHikerList(
                        cancelledByUserList,
                        'No hikers cancelled by themselves for this event.'
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Cancelled / Rejected ({cancelledOtherList.length})
                      </h4>
                      {renderHikerList(
                        cancelledOtherList,
                        'No admin-cancelled or rejected bookings for this event.'
                      )}
                    </div>
                  </>
                )}

                {type === 'revenue' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] font-black uppercase text-emerald-700 block">Collected Revenue</span>
                        <span className="text-lg font-black text-emerald-800">NPR {item.revenue.toLocaleString()}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-amber-700 block">Outstanding Due</span>
                        <span className="text-lg font-black text-amber-800">NPR {(item.dueAmount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    {renderHikerList(activeRegs, 'No active payment records for this event.')}
                  </>
                )}

                {type === 'returning' && renderHikerList(
                  (details?.returningRegs || []).map((x) => x.reg),
                  'No returning hikers found for this event.',
                  (r) => {
                    const found = (details?.returningRegs || []).find((x) => x.reg === r);
                    return found ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {found.pastCount} Lifetime Hikes
                      </span>
                    ) : null;
                  }
                )}

                {type === 'new' && renderHikerList(
                  details?.newRegs || [],
                  'No first-time hikers found for this event.'
                )}

                {type === 'gender_male' && renderHikerList(details?.genderRegs.male || [], 'No male hikers found.')}
                {type === 'gender_female' && renderHikerList(details?.genderRegs.female || [], 'No female hikers found.')}
                {type === 'gender_nb' && renderHikerList(details?.genderRegs.nb || [], 'No non-binary / unspecified hikers found.')}

                {type === 'age_under20' && renderHikerList(details?.ageGroupRegs.under20 || [], 'No hikers under 20 found.')}
                {type === 'age_20to30' && renderHikerList(details?.ageGroupRegs.age20to30 || [], 'No hikers aged 20-30 found.')}
                {type === 'age_31to40' && renderHikerList(details?.ageGroupRegs.age31to40 || [], 'No hikers aged 31-40 found.')}
                {type === 'age_40to50' && renderHikerList(details?.ageGroupRegs.age40to50 || [], 'No hikers aged 40-50 found.')}
                {type === 'age_over50' && renderHikerList(details?.ageGroupRegs.over50 || [], 'No hikers over 50 found.')}

                {type === 'registrations' && renderHikerList(activeRegs, 'No active registrations found for this event.')}

                {type === 'reviews' && (
                  <div className="space-y-3">
                    {(details?.reviews || []).length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] text-xs text-[#8B8680] text-center font-medium">
                        No reviews submitted for this event.
                      </div>
                    ) : (
                      (details?.reviews || []).map((rev: any, idx: number) => (
                        <div key={rev.id || idx} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#1F1F1F]">{rev.full_name || 'Verified Hiker'}</span>
                            <div className="flex items-center gap-2 text-[11px] font-black text-amber-700">
                              <span>Overall: {rev.overall_rating || rev.rating || 5} ★</span>
                              {rev.team_rating && <span className="text-[#8B8680]">• Team: {rev.team_rating} ★</span>}
                            </div>
                          </div>
                          {(rev.overall_feedback || rev.feedback || rev.comment) && (
                            <p className="text-xs text-[#5A5551] leading-relaxed">
                              {rev.overall_feedback || rev.feedback || rev.comment}
                            </p>
                          )}
                          {rev.team_feedback && (
                            <p className="text-[11px] text-[#8B8680]">
                              <span className="font-bold">Team note:</span> {rev.team_feedback}
                            </p>
                          )}
                          {rev.submitted_at && (
                            <div className="text-[10px] text-[#8B8680]">{rev.submitted_at}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {type === 'commission' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4]">
                        <span className="text-[10px] font-black uppercase text-[#8B8680] block">Event Revenue</span>
                        <span className="text-base font-black text-[#1F1F1F]">NPR {item.revenue.toLocaleString()}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4]">
                        <span className="text-[10px] font-black uppercase text-[#8B8680] block">Month ({item.monthKey}) Total</span>
                        <span className="text-base font-black text-[#1F1F1F]">
                          NPR {(details?.monthlyTotalRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-amber-700 block">Applied Tier Rate</span>
                        <span className="text-base font-black text-amber-800">
                          {((details?.commissionRate || 0.01) * 100).toFixed(0)}%
                          <span className="text-[11px] font-semibold ml-1">
                            ({(details?.monthlyTotalRevenue || 0) > 600000 ? '> NPR 600k tier' : '≤ NPR 600k tier'})
                          </span>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/30">
                        <span className="text-[10px] font-black uppercase text-[#FF6600] block">Calculated Commission</span>
                        <span className="text-base font-black text-[#FF6600]">NPR {item.commission.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
