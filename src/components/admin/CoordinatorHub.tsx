import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Phone,
  MessageSquare,
  AlertTriangle,
  MapPin,
  CheckCircle,
  Users,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Compass,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  Eye
} from 'lucide-react';
import { Trek } from '../../types';
import { AdminRegistration } from './BookingsManager';
import { HISTORICAL_TREKS } from '../../data/historicalTreks';

interface CoordinatorHubProps {
  treks: Trek[];
  registrations: AdminRegistration[];
  loading: boolean;
  onRefresh: () => void;
}

type FilterType = 'all' | 'paid' | 'pending' | 'due';
type SortCol =
  | 'sn'
  | 'name'
  | 'phone'
  | 'pickup'
  | 'paid'
  | 'due'
  | 'gender'
  | 'age'
  | 'suggestions'
  | 'updates'
  | 'medical'
  | 'totalHikes';

const extractHikeNumber = (val?: string): string => {
  if (!val) return '';
  const match = String(val).match(/\d+/);
  return match ? match[0] : '';
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
    n === 'overnight bus hikes' ||
    n === 'trek' ||
    n === 'hike' ||
    n === 'himalayan trek / event'
  );
};

export const getHikeNumberFromAny = (obj: any): string => {
  if (!obj) return '';
  if (typeof obj === 'string' || typeof obj === 'number') {
    const m = String(obj).match(/\b\d{1,4}\b/) || String(obj).match(/\d+/);
    return m ? m[0] : '';
  }
  const fields = [
    obj.hike_number,
    obj.hikeNumber,
    obj.trek_id,
    obj.hike_id,
    obj.id,
    obj.trek_name,
    obj.trekName,
    obj.hike_name,
    obj.list_name,
    obj.person_remarks,
    obj.suggestions,
  ];
  for (const f of fields) {
    if (f) {
      const m = String(f).match(/\b\d{1,4}\b/) || String(f).match(/\d+/);
      if (m && parseInt(m[0], 10) > 0) return m[0];
    }
  }
  return '';
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
  return fallbackName && !isGenericTitle(fallbackName) ? fallbackName : 'Hike Event';
};

const doesRegistrationMatchTrek = (r: AdminRegistration, trek: Trek): boolean => {
  if (!r || !trek) return false;

  const regHikeNum = getHikeNumberFromAny(r);
  const trekHikeNum = getHikeNumberFromAny(trek);

  // 1. Strict numeric hike number comparison if both have numbers
  if (trekHikeNum && regHikeNum) {
    return trekHikeNum === regHikeNum;
  }

  // 2. Strict ID comparison
  const queryId = (trek.id || trek.hike_number || '').toLowerCase().trim();
  const regTrekId = (r.trek_id || r.hike_number || '').toLowerCase().trim();
  if (queryId && regTrekId && (queryId === regTrekId || queryId.includes(regTrekId) || regTrekId.includes(queryId))) {
    return true;
  }

  // 3. Name comparison only if neither is generic
  const trekTitle = (trek.name || '').toLowerCase().trim();
  const regTrekName = (r.trek_name || '').toLowerCase().trim();

  if (trekTitle && regTrekName && !isGenericTitle(trekTitle) && !isGenericTitle(regTrekName)) {
    if (regTrekName === trekTitle || regTrekName.includes(trekTitle) || trekTitle.includes(regTrekName)) {
      return true;
    }
  }

  return false;
};

export const CoordinatorHub: React.FC<CoordinatorHubProps> = ({
  treks,
  registrations,
  loading,
  onRefresh,
}) => {
  // 1. Merge library treks + synthesize virtual trek events from registrations if not yet in library
  const allAvailableTreks = useMemo(() => {
    const existingHikeNums = new Set<string>();
    const existingIds = new Set<string>();

    treks.forEach((t) => {
      if (t.id) existingIds.add(t.id.toLowerCase());
      const hNum = getHikeNumberFromAny(t);
      if (hNum) existingHikeNums.add(hNum);
    });

    const virtualTreks: Trek[] = [];
    const seenHikeKeys = new Set<string>();

    // Group registrations by hike number or ID
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

    // Also enrich any existing library treks with real historical names if their title is generic
    const enrichedTreksList = treks.map((t) => {
      const hNum = getHikeNumberFromAny(t);
      if (hNum && isGenericTitle(t.name)) {
        const namedReg = registrations.find(
          (r) => getHikeNumberFromAny(r) === hNum && r.trek_name && !isGenericTitle(r.trek_name)
        );
        const realName = getTrekNameForHike(hNum, namedReg?.trek_name);
        return { ...t, name: realName };
      }
      return t;
    });

    return [...enrichedTreksList, ...virtualTreks];
  }, [treks, registrations]);

  // 2. Filter for upcoming events, events in last 2 months, OR any event that has active registrations
  const upcomingTreks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    twoMonthsAgo.setHours(0, 0, 0, 0);

    const parseTrekDate = (dateStr?: string): Date | null => {
      if (!dateStr) return null;
      const trimmed = dateStr.trim();
      if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    };

    return allAvailableTreks
      .filter((t) => {
        // Always include if this trek has bookings in registrations
        const hasRegistrations = registrations.some(
          (r) => doesRegistrationMatchTrek(r, t)
        );
        if (hasRegistrations) return true;

        const dt = parseTrekDate(t.date);
        return !dt || dt.getTime() >= twoMonthsAgo.getTime();
      })
      .sort((a, b) => {
        // Prioritize events with active registered hikers
        const regsA = registrations.filter(
          (r) => doesRegistrationMatchTrek(r, a)
        ).length;
        const regsB = registrations.filter(
          (r) => doesRegistrationMatchTrek(r, b)
        ).length;

        if (regsA > 0 && regsB === 0) return -1;
        if (regsB > 0 && regsA === 0) return 1;

        // Otherwise sort by numeric hike number descending if available
        const numA = parseInt(getHikeNumberFromAny(a) || '0', 10);
        const numB = parseInt(getHikeNumberFromAny(b) || '0', 10);
        if (numA && numB && numA !== numB) return numB - numA;

        const da = parseTrekDate(a.date)?.getTime() || 0;
        const db = parseTrekDate(b.date)?.getTime() || 0;
        return db - da; // newest / nearest first
      });
  }, [allAvailableTreks, registrations]);

  const [selectedTrekId, setSelectedTrekId] = useState<string>('');

  // 3. Auto-select first trek with bookings or first available event
  React.useEffect(() => {
    if (upcomingTreks.length > 0) {
      const isCurrentValid = upcomingTreks.some(
        (t) =>
          t.id === selectedTrekId ||
          (t.hike_number && t.hike_number === selectedTrekId) ||
          getHikeNumberFromAny(t) === getHikeNumberFromAny(selectedTrekId)
      );

      if (!selectedTrekId || !isCurrentValid) {
        const trekWithBookings = upcomingTreks.find((t) =>
          registrations.some((r) => doesRegistrationMatchTrek(r, t))
        );
        const chosen = trekWithBookings || upcomingTreks[0];
        setSelectedTrekId(chosen.id || chosen.hike_number || '');
      }
    }
  }, [upcomingTreks, selectedTrekId, registrations]);

  const [tableFilter, setTableFilter] = useState<FilterType>('all');
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewingVoucherUrl, setViewingVoucherUrl] = useState<string | null>(null);
  const [viewingVoucherReg, setViewingVoucherReg] = useState<AdminRegistration | null>(null);
  const pageSize = 50;

  // Selected Active Trek
  const currentTrek = useMemo(() => {
    if (upcomingTreks.length === 0) return null;
    return (
      upcomingTreks.find(
        (t) =>
          t.id === selectedTrekId ||
          t.hike_number === selectedTrekId ||
          (selectedTrekId &&
            getHikeNumberFromAny(t) === getHikeNumberFromAny(selectedTrekId))
      ) ||
      upcomingTreks[0] ||
      null
    );
  }, [upcomingTreks, selectedTrekId]);

  // Registrations matching active trek
  const trekRegistrations = useMemo(() => {
    if (!currentTrek) return [];
    return registrations.filter((r) => doesRegistrationMatchTrek(r, currentTrek));
  }, [currentTrek, registrations]);

  // Lifetime Hike Count Map
  const hikerPastHikesMap = useMemo(() => {
    const map = new Map<string, number>();
    registrations.forEach((r) => {
      const ph = (r.phone || r.whatsapp || '').trim();
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
    const ph = phone.trim();
    const nameKey = `name:${name.toLowerCase().trim()}`;
    if (ph && hikerPastHikesMap.has(ph)) {
      return hikerPastHikesMap.get(ph) || 1;
    }
    if (nameKey && hikerPastHikesMap.has(nameKey)) {
      return hikerPastHikesMap.get(nameKey) || 1;
    }
    return 1;
  };

  // Metrics Calculations
  const totalRegistered = trekRegistrations.reduce((acc, r) => acc + (r.paxCount || 1), 0);
  const paidCount = trekRegistrations.filter(
    (r) => r.payment_status?.toLowerCase() === 'fully paid' || (r.paid_amount || 0) > 0
  ).length;
  const totalRevenue = trekRegistrations.reduce((acc, r) => acc + (r.paid_amount || 0), 0);
  const dueCount = trekRegistrations.filter((r) => r.due_amount > 0).length;

  const returningCount = trekRegistrations.filter(
    (r) => getHikerPastCount(r.phone || '', r.full_name) > 1
  ).length;
  const firstTimersCount = trekRegistrations.length - returningCount;

  // Demographic Calculations
  const genderBreakdown = useMemo(() => {
    let female = 0;
    let male = 0;
    let other = 0;
    trekRegistrations.forEach((r) => {
      const g = (r.gender || '').toLowerCase().trim();
      if (g.includes('female') || g === 'f') female++;
      else if (g.includes('male') || g === 'm') male++;
      else other++;
    });
    const total = trekRegistrations.length || 1;
    return {
      female,
      male,
      other,
      femalePct: Math.round((female / total) * 100),
      malePct: Math.round((male / total) * 100),
    };
  }, [trekRegistrations]);

  const ageBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    trekRegistrations.forEach((r) => {
      const a = (r.age_group || 'Unspecified').trim();
      groups[a] = (groups[a] || 0) + 1;
    });
    const total = trekRegistrations.length || 1;
    return Object.entries(groups).map(([group, count]) => ({
      group,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [trekRegistrations]);

  // Table Filtering & Sorting
  const filteredAndSortedRegistrations = useMemo(() => {
    let result = [...trekRegistrations];

    // Apply Filter Chips
    if (tableFilter === 'paid') {
      result = result.filter(
        (r) => r.payment_status?.toLowerCase() === 'fully paid' || r.paid_amount > 0
      );
    } else if (tableFilter === 'pending') {
      result = result.filter(
        (r) => r.payment_status?.toLowerCase() !== 'fully paid' && r.paid_amount === 0
      );
    } else if (tableFilter === 'due') {
      result = result.filter((r) => r.due_amount > 0);
    }

    // Apply Sorting
    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortCol) {
        case 'name':
          valA = a.full_name.toLowerCase();
          valB = b.full_name.toLowerCase();
          break;
        case 'phone':
          valA = a.phone;
          valB = b.phone;
          break;
        case 'pickup':
          valA = (a.pickup_point || '').toLowerCase();
          valB = (b.pickup_point || '').toLowerCase();
          break;
        case 'paid':
          valA = a.paid_amount;
          valB = b.paid_amount;
          break;
        case 'due':
          valA = a.due_amount;
          valB = b.due_amount;
          break;
        case 'gender':
          valA = (a.gender || '').toLowerCase();
          valB = (b.gender || '').toLowerCase();
          break;
        case 'age':
          valA = (a.age_group || '').toLowerCase();
          valB = (b.age_group || '').toLowerCase();
          break;
        case 'updates':
          valA = (a.admin_notes || '').toLowerCase();
          valB = (b.admin_notes || '').toLowerCase();
          break;
        case 'totalHikes':
          valA = getHikerPastCount(a.phone || '', a.full_name);
          valB = getHikerPastCount(b.phone || '', b.full_name);
          break;
        default:
          valA = a.full_name.toLowerCase();
          valB = b.full_name.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [trekRegistrations, tableFilter, sortCol, sortAsc]);

  const totalRows = filteredAndSortedRegistrations.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRegistrations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRegistrations.slice(start, start + pageSize);
  }, [filteredAndSortedRegistrations, currentPage]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Export CSV Excel
  const handleExportExcel = () => {
    if (!currentTrek) return;
    const headers = [
      'S.N.',
      'Full Name',
      'Phone',
      'Pickup Point',
      'Paid (NPR)',
      'Due (NPR)',
      'Gender',
      'Age Group',
      'Suggestions',
      'Updates',
      'Medical Notes',
      'Total Hikes'
    ];

    const rows = trekRegistrations.map((r, i) => [
      i + 1,
      `"${r.full_name.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.pickup_point || '—'}"`,
      r.paid_amount || 0,
      r.due_amount || 0,
      `"${r.gender || '—'}"`,
      `"${r.age_group || '—'}"`,
      `"${(r.suggestions || '').replace(/"/g, '""')}"`,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      `"${(r.has_medical || '').replace(/"/g, '""')}"`,
      getHikerPastCount(r.phone || '', r.full_name)
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentTrek.name}_Coordinator_Manifest.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintManifest = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-5 font-sans text-stone-800 print:m-0 print:p-0">
      {/* ── HEADER TITLE BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F2937] tracking-tight">
            Upcoming <span className="text-[#16A34A]">Events</span>
          </h1>
          <p className="text-xs font-semibold text-[#8B8680] mt-0.5">
            Click an event to view its registered hikers
          </p>
        </div>

        {/* Top Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrintManifest}
            title="Print roster or Save as PDF"
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* ── TOP EVENT CARDS STRIP ── */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200 print:hidden">
        {upcomingTreks.map((t) => {
          const isSelected =
            currentTrek?.id === t.id ||
            (t.hike_number && currentTrek?.hike_number === t.hike_number) ||
            getHikeNumberFromAny(currentTrek) === getHikeNumberFromAny(t);
          const tRegsCount = registrations.filter(
            (r) => doesRegistrationMatchTrek(r, t)
          ).length;

          return (
            <div
              key={t.id}
              onClick={() => setSelectedTrekId(t.id || t.hike_number || '')}
              className={`p-4 rounded-2xl min-w-[210px] max-w-[230px] shrink-0 cursor-pointer transition-all border ${
                isSelected
                  ? 'border-2 border-[#16A34A] bg-white shadow-md ring-2 ring-[#16A34A]/10'
                  : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
                <span>{t.date || '18 Sept 2026'} • {t.days}D</span>
                {t.is_cancelled && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-extrabold border border-rose-200">
                    CANCELLED
                  </span>
                )}
              </div>
              <h3 className="text-sm font-extrabold text-[#1F2937] truncate mb-2">
                {t.name}
              </h3>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] text-[10px] font-bold border border-blue-100 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-[#2563EB]" /> Trek
                </span>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                  {t.difficulty || 'Moderate'}
                </span>
              </div>
              <div className="text-xl font-black text-[#1F2937]">{tRegsCount || 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                REGISTERED
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CANCELLATION NOTICE BANNER (IF EVENT CANCELLED) ── */}
      {currentTrek?.is_cancelled && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-rose-900">
                  EVENT CANCELLED IN EVENT EXECUTION
                </h3>
                <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-black rounded-md">
                  HALT DEPLOYMENT
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-0.5 font-medium">
                {currentTrek.cancellation_reason
                  ? `Reason: ${currentTrek.cancellation_reason}`
                  : 'This event has been marked as cancelled by the organizer. Do not dispatch field guides or buses.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 whitespace-nowrap">
            {trekRegistrations.length} Registrations on File
          </span>
        </div>
      )}

      {/* ── KPI STAT CARDS (4 CARDS WITH TOP ACCENT BARS) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Registered */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#16A34A]" />
          <div className="text-3xl font-black text-[#1F2937] mb-0.5">{totalRegistered}</div>
          <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">
            REGISTERED
          </div>
          <div className="text-xs font-semibold text-stone-600 mt-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-stone-500" /> Trek • {currentTrek?.days || 4}D 3N
          </div>
        </div>

        {/* Card 2: Paid */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-stone-300" />
          <div className="text-3xl font-black text-[#1F2937] mb-0.5">{paidCount}</div>
          <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">
            PAID
          </div>
          <div className="text-xs font-semibold text-stone-600 mt-1">
            {totalRegistered > 0 ? Math.round((paidCount / totalRegistered) * 100) : 0}% conversion
          </div>
        </div>

        {/* Card 3: Revenue Collected */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#2563EB]" />
          <div className="text-3xl font-black text-[#1F2937] mb-0.5">
            Rs {totalRevenue.toLocaleString()}
          </div>
          <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">
            REVENUE COLLECTED
          </div>
          <div className="text-xs font-semibold text-stone-600 mt-1">
            {dueCount} with outstanding dues
          </div>
        </div>

        {/* Card 4: Returning */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#2563EB]" />
          <div className="text-3xl font-black text-[#1F2937] mb-0.5">{returningCount}</div>
          <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">
            RETURNING
          </div>
          <div className="text-xs font-semibold text-stone-600 mt-1">
            {firstTimersCount} first-timers
          </div>
        </div>
      </div>

      {/* ── 3 DEMOGRAPHIC PROGRESS BAR CARDS (IN 1 ROW) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: New vs Returning */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#1F2937]">New vs Returning</h3>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-[#2563EB]">
                <span className="w-2 h-2 rounded-xs bg-[#2563EB]" /> New
              </span>
              <span className="flex items-center gap-1 text-[#16A34A]">
                <span className="w-2 h-2 rounded-xs bg-[#16A34A]" /> Returning
              </span>
            </div>
          </div>

          <div className="h-8 w-full bg-stone-100 rounded-lg overflow-hidden flex text-white text-[11px] font-extrabold">
            <div
              style={{ width: `${totalRegistered > 0 ? (firstTimersCount / totalRegistered) * 100 : 50}%` }}
              className="bg-[#2563EB] h-full flex items-center justify-center"
            >
              {firstTimersCount} new
            </div>
            <div
              style={{ width: `${totalRegistered > 0 ? (returningCount / totalRegistered) * 100 : 50}%` }}
              className="bg-[#16A34A] h-full flex items-center justify-center"
            >
              {returningCount} ret.
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400">
            <span>{firstTimersCount} new hikers ({totalRegistered > 0 ? Math.round((firstTimersCount / totalRegistered) * 100) : 50}%)</span>
            <span>{returningCount} returning ({totalRegistered > 0 ? Math.round((returningCount / totalRegistered) * 100) : 50}%)</span>
          </div>
        </div>

        {/* Card 2: Gender Breakdown */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#1F2937]">Gender Breakdown</h3>
          </div>

          <div className="h-8 w-full bg-stone-100 rounded-lg overflow-hidden flex text-white text-[11px] font-extrabold">
            <div
              style={{ width: `${genderBreakdown.femalePct}%` }}
              className="bg-[#E11D48] h-full flex items-center justify-center"
            >
              {genderBreakdown.female}
            </div>
            <div
              style={{ width: `${genderBreakdown.malePct}%` }}
              className="bg-[#2563EB] h-full flex items-center justify-center"
            >
              {genderBreakdown.male}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#E11D48]" /> Female {genderBreakdown.female} ({genderBreakdown.femalePct}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" /> Male {genderBreakdown.male} ({genderBreakdown.malePct}%)
            </span>
          </div>
        </div>

        {/* Card 3: Age Group Breakdown */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#1F2937]">Age Group Breakdown</h3>
          </div>

          <div className="h-8 w-full bg-stone-100 rounded-lg overflow-hidden flex text-white text-[11px] font-extrabold">
            {ageBreakdown.map((item, idx) => {
              const bgColors = ['bg-[#DC2626]', 'bg-[#EA580C]', 'bg-[#D97706]', 'bg-[#2563EB]'];
              return (
                <div
                  key={item.group}
                  style={{ width: `${item.pct}%` }}
                  className={`${bgColors[idx % bgColors.length]} h-full flex items-center justify-center`}
                >
                  {item.count}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-600 flex-wrap">
            {ageBreakdown.map((item, idx) => {
              const bgColors = ['bg-[#DC2626]', 'bg-[#EA580C]', 'bg-[#D97706]', 'bg-[#2563EB]'];
              return (
                <span key={item.group} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-xs ${bgColors[idx % bgColors.length]}`} /> {item.group} {item.count} ({item.pct}%)
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HIKER ROSTER TABLE WRAP ── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-[#1F2937]">
            {currentTrek?.name || 'Pachpokhari'} ({currentTrek?.date || '18 Sep 2026'}) — {trekRegistrations.length} hikers
          </h2>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTableFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                tableFilter === 'all'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('paid')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'paid'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('pending')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'pending'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('due')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'due'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Has Due
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-stone-200 text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">
                <th className="py-3 px-3 text-center w-[40px]">S.N.</th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  NAME {sortCol === 'name' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  PHONE {sortCol === 'phone' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('pickup')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  PICKUP {sortCol === 'pickup' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('paid')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  PAID {sortCol === 'paid' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('due')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  DUE {sortCol === 'due' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('gender')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  GENDER {sortCol === 'gender' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('age')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  AGE GROUP {sortCol === 'age' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th className="py-3 px-3 select-none">SUGGESTIONS ⇅</th>
                <th
                  onClick={() => handleSort('updates')}
                  className="py-3 px-3 cursor-pointer hover:text-stone-700 select-none"
                >
                  UPDATES {sortCol === 'updates' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th className="py-3 px-3 select-none">MEDICAL ⇅</th>
                <th
                  onClick={() => handleSort('totalHikes')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-stone-700 select-none"
                >
                  TOTAL HIKES {sortCol === 'totalHikes' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {paginatedRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-stone-400 font-semibold">
                    No registered hikers found matching criteria
                  </td>
                </tr>
              ) : (
                paginatedRegistrations.map((r, index) => {
                  const isFemale =
                    (r.gender || '').toLowerCase().includes('female') ||
                    (r.gender || '').toLowerCase() === 'f';

                  const pastHikes = getHikerPastCount(r.phone || '', r.full_name);

                  const sn = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isFemale ? 'bg-pink-50/50 hover:bg-pink-100/50' : 'hover:bg-stone-50/80'
                      }`}
                    >
                      {/* S.N. */}
                      <td className="py-3 px-3 text-center font-extrabold text-stone-700">
                        {sn}
                      </td>

                      {/* NAME */}
                      <td className="py-3 px-3 font-extrabold text-[#1F2937]">
                        {r.full_name}
                      </td>

                      {/* PHONE */}
                      <td className="py-3 px-3 font-medium text-stone-600">
                        {r.phone || '—'}
                      </td>

                      {/* PICKUP */}
                      <td className="py-3 px-3 font-medium text-stone-500">
                        {r.pickup_point || '—'}
                      </td>

                      {/* PAID */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          {r.paid_amount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                              Rs {r.paid_amount}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-black">
                              -
                            </span>
                          )}
                          {r.payment_voucher_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingVoucherUrl(r.payment_voucher_url || null);
                                setViewingVoucherReg(r);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer shadow-3xs"
                            >
                              <FileText className="w-3 h-3 text-amber-700" />
                              <span>
                                Voucher
                                {r.payment_voucher_url.split(',').filter(Boolean).length > 1
                                  ? `s (${r.payment_voucher_url.split(',').filter(Boolean).length})`
                                  : ''}{' '}
                                📄
                              </span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* DUE */}
                      <td className="py-3 px-3">
                        {r.due_amount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-extrabold">
                            Rs {r.due_amount}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* GENDER */}
                      <td className="py-3 px-3 font-semibold text-stone-700">
                        {r.gender || '—'}
                      </td>

                      {/* AGE GROUP */}
                      <td className="py-3 px-3 font-semibold text-stone-700">
                        {r.age_group || '—'}
                      </td>

                      {/* SUGGESTIONS */}
                      <td className="py-3 px-3 text-stone-500 max-w-[150px] truncate" title={r.suggestions}>
                        {r.suggestions || '—'}
                      </td>

                      {/* UPDATES */}
                      <td className="py-3 px-3 text-stone-500 max-w-[150px] truncate" title={r.admin_notes}>
                        {r.admin_notes || '—'}
                      </td>

                      {/* MEDICAL */}
                      <td className="py-3 px-3 font-semibold">
                        {r.has_medical && r.has_medical.toLowerCase() !== 'no' && r.has_medical.toLowerCase() !== 'none' ? (
                          <span className="text-rose-600 font-extrabold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{r.has_medical}</span>
                          </span>
                        ) : (
                          <span className="text-stone-400 font-medium">None</span>
                        )}
                      </td>

                      {/* TOTAL HIKES */}
                      <td className="py-3 px-3 text-center font-extrabold text-stone-700">
                        {pastHikes}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-4 bg-[#F8FAFC] border-t border-stone-200 flex items-center justify-between text-xs font-semibold text-stone-500">
          <div>
            Showing {totalRows > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                type="button"
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  currentPage === i + 1
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Admin/Coordinator Viewing Payment Voucher */}
      {viewingVoucherUrl && (
        <div
          className="fixed inset-0 z-[2200] bg-black/90 p-4 flex flex-col items-center justify-center animate-in fade-in"
          onClick={() => {
            setViewingVoucherUrl(null);
            setViewingVoucherReg(null);
          }}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] bg-stone-900 rounded-2xl overflow-hidden flex flex-col p-4 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white font-bold text-sm">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Payment Voucher — {viewingVoucherReg?.full_name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewingVoucherUrl(null);
                  setViewingVoucherReg(null);
                }}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingVoucherReg && (
              <div className="p-3 bg-stone-800/80 my-2 rounded-xl text-xs space-y-1 text-stone-200">
                <div className="flex justify-between font-bold">
                  <span>Hike: #{viewingVoucherReg.hike_number || '?'} - {viewingVoucherReg.trek_name || 'Trek'}</span>
                  <span className="text-amber-400">Date: {viewingVoucherReg.trek_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-400">
                  <span>Phone: {viewingVoucherReg.phone} ({viewingVoucherReg.email})</span>
                  <span>
                    Submitted:{' '}
                    {viewingVoucherReg.payment_voucher_submitted_at
                      ? new Date(viewingVoucherReg.payment_voucher_submitted_at).toLocaleString()
                      : 'Recently'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto flex flex-col items-center gap-4 p-2 bg-black/40 rounded-xl">
              {viewingVoucherUrl
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean)
                .map((url, idx, arr) => (
                  <div key={idx} className="w-full flex flex-col items-center gap-1.5">
                    {arr.length > 1 && (
                      <div className="flex items-center justify-between w-full px-2 text-[11px] font-bold text-amber-400">
                        <span>Receipt #{idx + 1}</span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-stone-300 hover:text-white underline"
                        >
                          Open Full Size ↗
                        </a>
                      </div>
                    )}
                    <img
                      src={url}
                      alt={`Payment Voucher Receipt ${idx + 1}`}
                      className="max-w-full max-h-[55vh] object-contain rounded-lg"
                    />
                  </div>
                ))}
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 text-xs">
              <a
                href={viewingVoucherUrl.split(',')[0]?.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold transition-all"
              >
                Open Full Size ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  setViewingVoucherUrl(null);
                  setViewingVoucherReg(null);
                }}
                className="px-4 py-1.5 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
