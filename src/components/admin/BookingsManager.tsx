import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Trash2,
  Check,
  Phone,
  Mail,
  XCircle,
  CheckCircle,
  CheckCircle2,
  X,
  AlertCircle,
  UserX,
  RefreshCw,
  Calendar,
  DollarSign,
  MessageSquare,
  Save,
  CreditCard,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Compass,
  AlertTriangle,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Trek } from '../../types';
import { AdminHikerProfileModal } from './AdminHikerProfileModal';

export interface AdminRegistration {
  id: string;
  trek_id?: string;
  hike_number?: string;
  trek_name?: string;
  trek_date?: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  email: string;
  paxCount?: number;
  emergency_contact?: string;
  profession?: string;
  pickup_point?: string;
  gender?: string;
  age_group?: string;
  is_group?: boolean;
  team_members?: Array<{ full_name: string; gender?: string }>;
  has_medical?: string;
  specify_medical?: string;
  recent_hikes?: string;
  guide_preference?: string;
  transport_preference?: string;
  suggestions?: string;
  person_remarks?: string;
  status?: 'Pending' | 'Confirmed' | 'Waitlisted' | 'Cancelled';
  payment_status?: 'Unpaid' | 'Deposit Paid' | 'Fully Paid' | 'Refunded';
  paid_amount?: number;
  due_amount?: number;
  admin_notes?: string;
  payment_voucher_url?: string;
  payment_voucher_submitted_at?: string;
  created_at?: string;
  user_email?: string;
  email_address?: string;
}

interface BookingsManagerProps {
  registrations: AdminRegistration[];
  treks: Trek[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteRegistration: (id: string) => Promise<void>;
  onUpdateRegistration: (id: string, updates: Partial<AdminRegistration>) => Promise<void>;
  initialTrekFilter?: string;
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  registrations,
  treks,
  loading,
  onRefresh,
  onDeleteRegistration,
  onUpdateRegistration,
  initialTrekFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrekFilter, setSelectedTrekFilter] = useState<string>(initialTrekFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'public' | 'private'>('all');
  const [sortField, setSortField] = useState<'participant' | 'status' | 'payment_status' | 'paid_amount' | 'due_amount' | 'pickup_point' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'participant' | 'status' | 'payment_status' | 'paid_amount' | 'due_amount' | 'pickup_point') => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  React.useEffect(() => {
    if (initialTrekFilter) {
      setSelectedTrekFilter(initialTrekFilter);
      if (initialTrekFilter === 'PRIVATE') {
        setBookingTypeFilter('private');
      } else {
        setBookingTypeFilter('all');
      }
    }
  }, [initialTrekFilter]);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [viewingAdminVoucherUrl, setViewingAdminVoucherUrl] = useState<string | null>(null);
  const [viewingAdminVoucherReg, setViewingAdminVoucherReg] = useState<AdminRegistration | null>(null);
  const [activeProfileHiker, setActiveProfileHiker] = useState<{ name: string; phone?: string; email?: string } | null>(null);

  // Filter for upcoming events + last 2 months hikes in Bookings & Roster
  // Ordered with upcoming events first (closest upcoming first), then recent past events (most recent first)
  const upcomingTreks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    twoMonthsAgo.setHours(0, 0, 0, 0);

    const parseTrekDate = (dateStr?: string): Date | null => {
      if (!dateStr) return null;
      const trimmed = dateStr.trim();

      if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            if (!isNaN(d.getTime())) return d;
          } else {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            if (!isNaN(d.getTime())) return d;
          }
        }
      }

      if ((trimmed.includes('-') || trimmed.includes('.')) && !trimmed.match(/[a-zA-Z]/)) {
        const delimiter = trimmed.includes('-') ? '-' : '.';
        const parts = trimmed.split(delimiter);
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            if (!isNaN(d.getTime())) return d;
          } else if (parts[0].length === 4) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            if (!isNaN(d.getTime())) return d;
          }
        }
      }

      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;

      try {
        const yearMatch = trimmed.match(/\b(20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : '';
        const cleanRange = trimmed.replace(/\(.*?\)/g, '').trim();
        const parts = cleanRange.split(/[–—\-]/);
        if (parts.length > 1 && year) {
          const firstPart = parts[0]
            .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '')
            .trim();
          const rangeDate = new Date(`${firstPart} ${year}`);
          if (!isNaN(rangeDate.getTime())) return rangeDate;
        }
      } catch {}

      return null;
    };

    const getHikeNum = (t: Trek) => {
      const m = String(t.hike_number || t.id || '').match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };

    return treks
      .filter((t) => {
        const dt = parseTrekDate(t.date);
        return !dt || dt.getTime() >= twoMonthsAgo.getTime();
      })
      .sort((a, b) => {
        const da = parseTrekDate(a.date)?.getTime() ?? null;
        const db = parseTrekDate(b.date)?.getTime() ?? null;

        const aIsUpcoming = da !== null && da >= todayMs;
        const bIsUpcoming = db !== null && db >= todayMs;

        // 1. Upcoming events always appear before past/undated events
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;

        // 2. Both are upcoming: nearest upcoming date first
        if (aIsUpcoming && bIsUpcoming) {
          if (da !== db) return da - db;
          return getHikeNum(b) - getHikeNum(a);
        }

        // 3. Recent past events before undated events, ordered most recent first
        if (da !== null && db === null) return -1;
        if (da === null && db !== null) return 1;
        if (da !== null && db !== null && da !== db) {
          return db - da;
        }

        return getHikeNum(b) - getHikeNum(a);
      });
  }, [treks]);

  // Local draft state for inline row edits
  const [rowDrafts, setRowDrafts] = useState<Record<string, Partial<AdminRegistration>>>({});
  const [savingRowIds, setSavingRowIds] = useState<Record<string, boolean>>({});
  const [justSavedRowIds, setJustSavedRowIds] = useState<Record<string, boolean>>({});

  // Delete Confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Safe In-App Confirmation & Notification States
  const [pendingDeleteReg, setPendingDeleteReg] = useState<AdminRegistration | null>(null);
  const [showBulkPurgeModal, setShowBulkPurgeModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Batch deletion states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState(0);

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setShowBulkPurgeModal(true);
  };

  const executeBatchDelete = async () => {
    const total = selectedIds.length;
    if (total === 0) return;

    setShowBulkPurgeModal(false);
    setIsPurging(true);
    setPurgeProgress(0);

    for (let i = 0; i < total; i++) {
      const id = selectedIds[i];
      try {
        await onDeleteRegistration(id);
      } catch (err) {
        console.error(`Failed to delete registration ${id} in batch:`, err);
      }
      setPurgeProgress(i + 1);
    }

    setIsPurging(false);
    setSelectedIds([]);
    onRefresh();
    setToastMessage(`Updated ${total} registration(s) to Cancelled by User.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Private vs Public counts
  const privateCount = registrations.filter(
    (r) => r.hike_number === 'PRIVATE' || r.trek_name?.toLowerCase().includes('private')
  ).length;
  const publicCount = registrations.length - privateCount;

  // Filter logic
  const filteredRegistrations = registrations.filter((reg) => {
    const isPrivate = reg.hike_number === 'PRIVATE' || reg.trek_name?.toLowerCase().includes('private');

    // Filter by category type
    if (bookingTypeFilter === 'public' && isPrivate) return false;
    if (bookingTypeFilter === 'private' && !isPrivate) return false;

    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      reg.full_name?.toLowerCase().includes(q) ||
      reg.email?.toLowerCase().includes(q) ||
      reg.phone?.includes(q) ||
      reg.trek_name?.toLowerCase().includes(q) ||
      reg.hike_number?.toLowerCase().includes(q) ||
      reg.person_remarks?.toLowerCase().includes(q);

    const extractDigits = (val?: string): string => {
      if (!val) return '';
      const s = String(val).trim();
      if (!s || s.toLowerCase() === 'tbd' || s.toLowerCase() === 'private') return '';
      const m = s.match(/^\d{1,4}$/) || s.match(/^hike-(\d{1,4})$/i) || s.match(/^#?(\d{1,4})$/);
      return m ? m[1] || m[0] : '';
    };

    const matchesRegistrationToTrek = (r: AdminRegistration, t?: Trek): boolean => {
      if (!t) return false;
      const normStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const tId = (t.id || '').toLowerCase().trim();
      const tHikeNum = (t.hike_number || '').toLowerCase().trim();
      const tDigits = extractDigits(t.hike_number) || extractDigits(t.id);

      const rTrekId = (r.trek_id || '').toLowerCase().trim();
      const rHikeNum = (r.hike_number || '').toLowerCase().trim();
      const rDigits = extractDigits(r.hike_number) || extractDigits(r.trek_id);

      if (tId && (rTrekId === tId || rHikeNum === tId)) return true;
      if (tHikeNum && tHikeNum !== 'tbd' && (rHikeNum === tHikeNum || rTrekId === tHikeNum)) return true;
      if (tDigits && rDigits) return tDigits === rDigits;

      const tNameNorm = normStr(t.name);
      const rNameNorm = normStr(r.trek_name);
      if (tNameNorm && rNameNorm && tNameNorm === rNameNorm) {
        return true;
      }
      return false;
    };

    const selectedTrekObj =
      selectedTrekFilter !== 'all' && selectedTrekFilter !== 'PRIVATE'
        ? treks.find(
            (t) =>
              t.id === selectedTrekFilter ||
              (t.hike_number && t.hike_number !== 'TBD' && t.hike_number === selectedTrekFilter)
          )
        : undefined;

    const matchesTrek =
      selectedTrekFilter === 'all' ||
      (selectedTrekFilter === 'PRIVATE' && isPrivate) ||
      reg.trek_id === selectedTrekFilter ||
      (reg.hike_number && reg.hike_number !== 'TBD' && reg.hike_number === selectedTrekFilter) ||
      matchesRegistrationToTrek(reg, selectedTrekObj);

    const regStatus = reg.status || 'Confirmed';
    const regStatusLower = regStatus.toLowerCase();
    const filterLower = statusFilter.toLowerCase();
    const matchesStatus =
      statusFilter === 'all' ||
      (filterLower === 'cancelled'
        ? regStatusLower.includes('cancelled')
        : regStatusLower === filterLower);

    return matchesSearch && matchesTrek && matchesStatus;
  });

  // Sort registrations according to active column sort
  const sortedRegistrations = useMemo(() => {
    if (!sortField) return filteredRegistrations;

    return [...filteredRegistrations].sort((a, b) => {
      const draftA = rowDrafts[a.id] || {};
      const draftB = rowDrafts[b.id] || {};

      let valA: any = '';
      let valB: any = '';

      if (sortField === 'participant') {
        valA = (a.full_name || '').toLowerCase();
        valB = (b.full_name || '').toLowerCase();
      } else if (sortField === 'status') {
        valA = String(draftA.status ?? a.status ?? 'Confirmed').toLowerCase();
        valB = String(draftB.status ?? b.status ?? 'Confirmed').toLowerCase();
      } else if (sortField === 'payment_status') {
        valA = String(draftA.payment_status ?? a.payment_status ?? 'Unpaid').toLowerCase();
        valB = String(draftB.payment_status ?? b.payment_status ?? 'Unpaid').toLowerCase();
      } else if (sortField === 'paid_amount') {
        valA = Number(draftA.paid_amount !== undefined ? draftA.paid_amount : (a.paid_amount ?? 0));
        valB = Number(draftB.paid_amount !== undefined ? draftB.paid_amount : (b.paid_amount ?? 0));
        if (isNaN(valA)) valA = 0;
        if (isNaN(valB)) valB = 0;
      } else if (sortField === 'due_amount') {
        valA = Number(draftA.due_amount !== undefined ? draftA.due_amount : (a.due_amount ?? 0));
        valB = Number(draftB.due_amount !== undefined ? draftB.due_amount : (b.due_amount ?? 0));
        if (isNaN(valA)) valA = 0;
        if (isNaN(valB)) valB = 0;
      } else if (sortField === 'pickup_point') {
        valA = String(draftA.pickup_point !== undefined ? draftA.pickup_point : (a.pickup_point ?? '')).toLowerCase();
        valB = String(draftB.pickup_point !== undefined ? draftB.pickup_point : (b.pickup_point ?? '')).toLowerCase();
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const cmp = String(valA).localeCompare(String(valB));
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredRegistrations, sortField, sortOrder, rowDrafts]);

  // Calculate totals
  const totalPax = filteredRegistrations.reduce((acc, r) => {
    const main = 1;
    const team = Array.isArray(r.team_members) ? r.team_members.length : 0;
    return acc + main + team;
  }, 0);

  const confirmedCount = filteredRegistrations.filter((r) => (r.status || 'Confirmed') === 'Confirmed').length;
  
  // Financial totals across filtered registrations
  const totalPaidCash = filteredRegistrations.reduce((acc, r) => {
    const draftPaid = rowDrafts[r.id]?.paid_amount;
    const val = draftPaid !== undefined ? Number(draftPaid) : Number(r.paid_amount || 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalDueBalance = filteredRegistrations.reduce((acc, r) => {
    const draftDue = rowDrafts[r.id]?.due_amount;
    const val = draftDue !== undefined ? Number(draftDue) : Number(r.due_amount || 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const handleCopyWhatsAppNumbers = () => {
    const numbers = filteredRegistrations
      .map((r) => r.whatsapp || r.phone)
      .filter(Boolean)
      .map((num) => num.replace(/[^0-9+]/g, ''));

    const uniqueNumbers = Array.from(new Set(numbers));
    if (uniqueNumbers.length === 0) return;

    navigator.clipboard.writeText(uniqueNumbers.join(', '));
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  const handleRowChange = (id: string, field: keyof AdminRegistration, value: any) => {
    setRowDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (reg: AdminRegistration) => {
    const draft = rowDrafts[reg.id];
    const updates: Partial<AdminRegistration> = {
      status: draft?.status !== undefined ? draft.status : reg.status || 'Confirmed',
      payment_status: draft?.payment_status !== undefined ? draft.payment_status : reg.payment_status || 'Unpaid',
      paid_amount: draft?.paid_amount !== undefined ? Number(draft.paid_amount || 0) : Number(reg.paid_amount || 0),
      due_amount: draft?.due_amount !== undefined ? Number(draft.due_amount || 0) : Number(reg.due_amount || 0),
      admin_notes: draft?.admin_notes !== undefined ? draft.admin_notes : reg.admin_notes || '',
      pickup_point: draft?.pickup_point !== undefined ? draft.pickup_point : reg.pickup_point || '',
    };

    setSavingRowIds((prev) => ({ ...prev, [reg.id]: true }));
    try {
      await onUpdateRegistration(reg.id, updates);
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[reg.id];
        return next;
      });
      setJustSavedRowIds((prev) => ({ ...prev, [reg.id]: true }));
      setTimeout(() => {
        setJustSavedRowIds((prev) => ({ ...prev, [reg.id]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to save row changes:', err);
    } finally {
      setSavingRowIds((prev) => ({ ...prev, [reg.id]: false }));
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteRegistration(id);
    } catch (err) {
      console.error('Failed to delete registration:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold mb-1">
            <span>Total Applications</span>
            <Users className="w-4 h-4 text-[#E08828]" />
          </div>
          <div className="text-2xl font-black text-[#1F1F1F]">{registrations.length}</div>
          <div className="text-[11px] text-[#8B8680] mt-0.5">
            {publicCount} public • <span className="font-bold text-purple-700">{privateCount} private</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
            <span>Total Paid Cash</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950">NPR {totalPaidCash.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Collected from hikers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1">
            <span>Total Due Balance</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-950">NPR {totalDueBalance.toLocaleString()}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Pending collection</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50/40 to-white shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-800 mb-1">
            <span>Private Requests</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950">{privateCount}</div>
          <div className="text-[11px] text-purple-700 mt-0.5">Custom bespoke treks</div>
        </div>
      </div>

      {/* ── TOP EVENT CARDS STRIP (UPCOMING + LAST 2 MONTHS HIKES) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Active &amp; Recent Expeditions (Upcoming + Last 2 Months)
          </h3>
          {selectedTrekFilter !== 'all' && (
            <button
              onClick={() => setSelectedTrekFilter('all')}
              className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="grid grid-rows-2 grid-flow-col auto-cols-[125px] sm:auto-cols-[135px] gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200">
          {/* "All Bookings" Card */}
          <div
            onClick={() => setSelectedTrekFilter('all')}
            className={`p-2 rounded-xl w-[125px] sm:w-[135px] shrink-0 cursor-pointer transition-all border flex flex-col justify-between overflow-hidden ${
              selectedTrekFilter === 'all'
                ? 'border-2 border-amber-600 bg-amber-50/20 shadow-xs ring-2 ring-amber-600/10'
                : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center justify-between text-[9px] font-bold text-stone-400 mb-0.5">
                <span className="truncate">ALL TIME</span>
                <Compass className="w-2.5 h-2.5 text-stone-400 shrink-0" />
              </div>
              <h3 className="text-[11px] font-bold text-[#1F2937] truncate mb-0.5" title="All Public Expeditions">
                All Expeditions
              </h3>
              <div className="flex items-center gap-1 mb-1">
                <span className="px-1 py-0.2 rounded bg-stone-100 text-stone-600 text-[8.5px] font-bold truncate">
                  Main Ledger
                </span>
              </div>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-stone-100 min-w-0">
              <div className="text-xs font-black text-[#1F2937]">
                {
                  registrations.filter((r) => {
                    const isPriv = r.hike_number === 'PRIVATE' || r.trek_name?.toLowerCase().includes('private');
                    if (isPriv) return false;
                    const st = String(rowDrafts[r.id]?.status ?? r.status ?? 'Confirmed').toLowerCase().trim();
                    return !st.includes('cancelled') && st !== 'waitlisted';
                  }).length
                }
              </div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-stone-400 truncate">
                ACTIVE
              </div>
            </div>
          </div>

          {/* Individual Trek Cards */}
          {upcomingTreks.map((t) => {
            const filterKey = t.id || t.hike_number;
            const isSelected = (selectedTrekFilter === filterKey) || (t.hike_number && t.hike_number !== 'TBD' && selectedTrekFilter === t.hike_number);
            const normStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const tDateNorm = normStr(t.date);
            const tNameNorm = normStr(t.name);
            const extractDigits = (val?: string): string => {
              if (!val) return '';
              const s = String(val).trim();
              if (!s || s.toLowerCase() === 'tbd' || s.toLowerCase() === 'private') return '';
              const m = s.match(/^\d{1,4}$/) || s.match(/^hike-(\d{1,4})$/i) || s.match(/^#?(\d{1,4})$/);
              return m ? m[1] || m[0] : '';
            };
            const tDigits = extractDigits(t.hike_number) || extractDigits(t.id);

            const matchedActiveRegs = registrations.filter((r) => {
              const effStatus = String(rowDrafts[r.id]?.status ?? r.status ?? 'Confirmed').toLowerCase().trim();
              if (effStatus.includes('cancelled') || effStatus === 'waitlisted') {
                return false;
              }

              const tId = (t.id || '').toLowerCase().trim();
              const tHikeNum = (t.hike_number || '').toLowerCase().trim();
              const rTrekId = (r.trek_id || '').toLowerCase().trim();
              const rHikeNum = (r.hike_number || '').toLowerCase().trim();
              const rDigits = extractDigits(r.hike_number) || extractDigits(r.trek_id);

              if (tId && (rTrekId === tId || rHikeNum === tId)) return true;
              if (tHikeNum && tHikeNum !== 'tbd' && (rHikeNum === tHikeNum || rTrekId === tHikeNum)) return true;
              if (tDigits && rDigits) return tDigits === rDigits;

              const rNameNorm = normStr(r.trek_name);
              if (tNameNorm && rNameNorm && rNameNorm === tNameNorm) {
                return true;
              }
              return false;
            });

            const tRegsCount = matchedActiveRegs.reduce((sum, r) => sum + (Number(r.paxCount) || 1), 0);

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrekFilter(isSelected ? 'all' : filterKey)}
                className={`p-2 rounded-xl w-[125px] sm:w-[135px] shrink-0 cursor-pointer transition-all border flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'border-2 border-[#16A34A] bg-white shadow-xs ring-2 ring-[#16A34A]/10'
                    : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center justify-between text-[9px] font-bold text-stone-400 mb-0.5">
                    <span className="truncate">{t.date || 'Flexible'}</span>
                    {t.is_cancelled && (
                      <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[7.5px] font-extrabold border border-rose-200 shrink-0 ml-1">
                        CANCELLED
                      </span>
                    )}
                  </div>
                  <h3 className="text-[11px] font-bold text-[#1F2937] truncate mb-0.5" title={t.name}>
                    {t.name}
                  </h3>
                  <div className="flex items-center gap-1 mb-1 overflow-hidden">
                    <span className="px-1 py-0.2 rounded bg-blue-50 text-[#2563EB] text-[8.5px] font-bold border border-blue-100 flex items-center gap-0.5 truncate shrink-0">
                      <Compass className="w-2.5 h-2.5 text-[#2563EB] shrink-0" /> #{t.hike_number || 'N/A'}
                    </span>
                    <span className="px-1 py-0.2 rounded bg-stone-100 text-stone-600 text-[8.5px] font-bold truncate">
                      {t.difficulty || 'Mod'}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-stone-100 min-w-0">
                  <div className="text-xs font-black text-[#1F2937]">{tRegsCount || 0}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-stone-400 truncate">
                    REGISTERED
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Category Tabs, Search, Trek Filter, Status Filter & WhatsApp Action */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-3">
        {/* Category Tabs Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE5] pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#F5EFE8] rounded-xl border border-[#E5E1DB]">
            <button
              type="button"
              onClick={() => {
                setBookingTypeFilter('all');
                if (selectedTrekFilter === 'PRIVATE') setSelectedTrekFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bookingTypeFilter === 'all'
                  ? 'bg-white text-[#1F1F1F] shadow-2xs'
                  : 'text-[#8B8680] hover:text-[#1F1F1F]'
              }`}
            >
              All Bookings ({registrations.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setBookingTypeFilter('public');
                if (selectedTrekFilter === 'PRIVATE') setSelectedTrekFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bookingTypeFilter === 'public'
                  ? 'bg-white text-[#E08828] shadow-2xs'
                  : 'text-[#8B8680] hover:text-[#1F1F1F]'
              }`}
            >
              Public Expeditions ({publicCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setBookingTypeFilter('private');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bookingTypeFilter === 'private'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-purple-800 hover:bg-purple-100/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Private Trek Requests ({privateCount})</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-[#8B8680]">
            Showing <span className="font-extrabold text-[#1F1F1F]">{filteredRegistrations.length}</span> record(s)
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B8680] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by hiker name, phone, destination, remarks..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] placeholder-[#8B8680] focus:bg-white focus:outline-none focus:border-[#E08828]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Trek Selector Filter */}
            <div className="flex items-center gap-1.5 bg-[#F9F7F5] border border-[#E5E1DB] px-3 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-[#8B8680]" />
              <select
                value={selectedTrekFilter}
                onChange={(e) => {
                  setSelectedTrekFilter(e.target.value);
                  if (e.target.value === 'PRIVATE') {
                    setBookingTypeFilter('private');
                  }
                }}
                className="bg-transparent text-xs font-bold text-[#1F1F1F] focus:outline-none cursor-pointer max-w-[170px]"
              >
                <option value="all">All Treks & Inquiries</option>
                <option value="PRIVATE">⭐ Private Requests ({privateCount})</option>
                <optgroup label="Public Treks">
                  {treks.map((t) => (
                    <option key={t.id} value={t.id || t.hike_number}>
                      Hike #{t.hike_number || 'TBD'} - {t.name}{t.date ? ` (${t.date})` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-[#F9F7F5] border border-[#E5E1DB] px-3 py-1.5 rounded-xl">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#1F1F1F] focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="cancelled">Cancelled</option>
                <option value="cancelled by user">Cancelled by User</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-2 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] rounded-xl text-[#5A5551] transition-colors cursor-pointer"
              title="Refresh Roster Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E08828]' : ''}`} />
            </button>

            {/* WhatsApp Roster Broadcast Copy */}
            <button
              onClick={handleCopyWhatsAppNumbers}
              disabled={filteredRegistrations.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {copiedWhatsApp ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              <span>{copiedWhatsApp ? 'Copied WhatsApp List!' : 'Copy WhatsApp Roster'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Registrations List / Table */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#F0EBE5] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#1F1F1F] tracking-tight">Hiker Applications Roster</h3>
            <p className="text-[11px] text-[#8B8680] mt-0.5">
              Showing {filteredRegistrations.length} application(s) • Inline status, payment &amp; notes controls
            </p>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-[#FAF2EB] border-b border-[#EFEAE4] p-3 px-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2 text-xs font-bold text-[#E08828]">
              <AlertCircle className="w-4 h-4 text-[#E08828]" />
              <span>{selectedIds.length} registration(s) selected for batch operations</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 border border-[#E5E1DB] hover:bg-[#EFEAE4] rounded-lg text-xs font-bold text-[#5A5551] transition-all cursor-pointer"
                disabled={isPurging}
              >
                Clear Selection
              </button>
              
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                disabled={isPurging}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? `Purging (${purgeProgress}/${selectedIds.length})...` : 'Purge Selected Entirely'}</span>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-[#E08828]" />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <UserX className="w-10 h-10 text-[#D8D2C9] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#5A5551]">No hiker applications found</p>
            <p className="text-[11px] text-[#8B8680] mt-1">Try resetting your search filters or selecting all treks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#F0EBE5] text-[10px] font-extrabold uppercase text-[#5A5551] tracking-wider">
                  <th className="py-3 px-4 w-[40px] text-center">
                    <input
                      type="checkbox"
                      checked={filteredRegistrations.length > 0 && selectedIds.length === filteredRegistrations.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredRegistrations.map(r => r.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="rounded border-[#E5E1DB] text-[#7ABA42] focus:ring-[#7ABA42] cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('participant')}
                    className="py-3 px-4 min-w-[260px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Participant & Trek"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Participant &amp; Trek</span>
                      {sortField === 'participant' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3 px-3 w-[140px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Reg Status"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Reg Status</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('payment_status')}
                    className="py-3 px-3 w-[140px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Payment Status"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Payment Status</span>
                      {sortField === 'payment_status' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('paid_amount')}
                    className="py-3 px-3 w-[110px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Paid (NPR)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Paid (NPR)</span>
                      {sortField === 'paid_amount' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('due_amount')}
                    className="py-3 px-3 w-[110px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Due (NPR)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Due (NPR)</span>
                      {sortField === 'due_amount' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('pickup_point')}
                    className="py-3 px-3 w-[150px] cursor-pointer hover:bg-[#F2ECE4] transition-colors select-none group"
                    title="Click to sort by Pickup Point"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Pickup Point</span>
                      {sortField === 'pickup_point' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#16A34A] shrink-0 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors opacity-50 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-3 min-w-[200px]">Internal Admin Notes</th>
                  <th className="py-3 px-4 w-[110px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE5]">
                {sortedRegistrations.map((reg) => {
                  const draft = rowDrafts[reg.id] || {};
                  const curStatus = draft.status !== undefined ? draft.status : reg.status || 'Confirmed';
                  const curPayment = draft.payment_status !== undefined ? draft.payment_status : reg.payment_status || 'Unpaid';
                  const curPaidAmount = draft.paid_amount !== undefined ? draft.paid_amount : reg.paid_amount ?? '';
                  const curDueAmount = draft.due_amount !== undefined ? draft.due_amount : reg.due_amount ?? '';
                  const curNotes = draft.admin_notes !== undefined ? draft.admin_notes : reg.admin_notes ?? '';
                  const curPickup = draft.pickup_point !== undefined ? draft.pickup_point : reg.pickup_point ?? '';

                  const isDirty = Object.keys(draft).length > 0;
                  const isSavingThisRow = !!savingRowIds[reg.id];
                  const isRowJustSaved = !!justSavedRowIds[reg.id];
                  const isDeleting = deletingId === reg.id;

                  const isPrivate = reg.hike_number === 'PRIVATE' || reg.trek_name?.toLowerCase().includes('private');
                  const isExpanded = expandedDetailsId === reg.id;

                  return (
                    <React.Fragment key={reg.id}>
                      <tr className={`transition-colors ${isPrivate ? 'bg-purple-50/25 hover:bg-purple-50/50' : 'hover:bg-[#FAF8F5]'}`}>
                        {/* Batch Selection Checkbox */}
                        <td className="py-3 px-4 text-center align-middle w-[40px]">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(reg.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, reg.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== reg.id));
                              }
                            }}
                            className="rounded border-[#E5E1DB] text-[#7ABA42] focus:ring-[#7ABA42] cursor-pointer animate-none"
                          />
                        </td>
                        {/* Participant & Trek Info */}
                        <td className="py-3 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveProfileHiker({
                                    name: reg.full_name,
                                    phone: reg.phone || reg.whatsapp,
                                    email: reg.email || reg.email_address || reg.user_email,
                                  })
                                }
                                className="font-extrabold text-xs text-[#1F1F1F] hover:text-[#E08828] hover:underline cursor-pointer text-left transition-colors"
                                title="Click to view full hiker profile, stats & lifetime records"
                              >
                                {reg.full_name}
                              </button>
                              
                              {/* Distinctive Purple/Blue Private Trek Badge */}
                              {isPrivate && (
                                <span className="inline-flex items-center gap-1 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs">
                                  <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>Private Request</span>
                                </span>
                              )}

                              {reg.gender && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EFEAE4] text-[#5A5551]">
                                  {reg.gender} {reg.age_group ? `(${reg.age_group})` : ''}
                                </span>
                              )}

                              {reg.paxCount && reg.paxCount > 1 && (
                                <span className="font-bold text-purple-800 bg-purple-100/70 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                                  {reg.paxCount} Pax Group
                                </span>
                              )}

                              {Array.isArray(reg.team_members) && reg.team_members.length > 0 && (
                                <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                                  +{reg.team_members.length} companion(s)
                                </span>
                              )}
                            </div>

                            {/* Trek Name & Date */}
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                              {isPrivate ? (
                                <span className="font-extrabold text-purple-900 flex items-center gap-1">
                                  <Compass className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>{reg.trek_name || 'Bespoke Private Trek'}</span>
                                </span>
                              ) : (
                                <span className="font-bold text-[#E08828]">
                                  {reg.hike_number ? `#${reg.hike_number} - ` : ''}
                                  {reg.trek_name || 'Himalayan Trek'}
                                </span>
                              )}
                              {reg.trek_date && (
                                <span className="text-[#8B8680] flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#8B8680]" />
                                  <span>{reg.trek_date}</span>
                                </span>
                              )}
                            </div>

                            {/* View Payment Voucher for Admins */}
                            {reg.payment_voucher_url && (
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingAdminVoucherUrl(reg.payment_voucher_url || null);
                                    setViewingAdminVoucherReg(reg);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer shadow-3xs"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                                  <span>
                                    View Voucher
                                    {reg.payment_voucher_url.split(',').filter(Boolean).length > 1
                                      ? `s (${reg.payment_voucher_url.split(',').filter(Boolean).length})`
                                      : ''}{' '}
                                    📄
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Registration Status */}
                        <td className="py-3 px-3 align-middle">
                          <select
                            value={curStatus}
                            onChange={(e: any) => handleRowChange(reg.id, 'status', e.target.value)}
                            className={`w-full p-2 rounded-xl text-xs font-extrabold border focus:outline-none cursor-pointer ${
                              curStatus === 'Confirmed'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : curStatus === 'Pending'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-rose-50 border-rose-300 text-rose-900'
                            }`}
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Pending">Pending</option>
                            <option value="Waitlisted">Waitlisted</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Cancelled by User">Cancelled by User</option>
                          </select>
                        </td>

                        {/* Payment Status */}
                        <td className="py-3 px-3 align-middle">
                          <select
                            value={curPayment}
                            onChange={(e: any) => handleRowChange(reg.id, 'payment_status', e.target.value)}
                            className={`w-full p-2 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer ${
                              curPayment === 'Fully Paid'
                                ? 'bg-blue-50 border-blue-300 text-blue-900'
                                : curPayment === 'Deposit Paid'
                                ? 'bg-purple-50 border-purple-300 text-purple-900'
                                : 'bg-[#F9F7F5] border-[#E5E1DB] text-[#1F1F1F]'
                            }`}
                          >
                            <option value="Unpaid">Unpaid</option>
                            <option value="Deposit Paid">Deposit Paid</option>
                            <option value="Fully Paid">Fully Paid</option>
                            <option value="Refunded">Refunded</option>
                          </select>
                        </td>

                        {/* Paid Amount */}
                        <td className="py-3 px-3 align-middle">
                          <input
                            type="number"
                            value={curPaidAmount}
                            onChange={(e) =>
                              handleRowChange(
                                reg.id,
                                'paid_amount',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            placeholder="Paid"
                            className="w-full p-2 bg-emerald-50/60 border border-emerald-300 rounded-xl text-xs font-extrabold text-emerald-950 placeholder-emerald-400 focus:bg-white focus:outline-none focus:border-emerald-600"
                          />
                        </td>

                        {/* Due Amount */}
                        <td className="py-3 px-3 align-middle">
                          <input
                            type="number"
                            value={curDueAmount}
                            onChange={(e) =>
                              handleRowChange(
                                reg.id,
                                'due_amount',
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            placeholder="Due"
                            className="w-full p-2 bg-amber-50/60 border border-amber-300 rounded-xl text-xs font-extrabold text-amber-950 placeholder-amber-400 focus:bg-white focus:outline-none focus:border-amber-600"
                          />
                        </td>

                        {/* Pickup Point */}
                        <td className="py-3 px-3 align-middle">
                          <input
                            type="text"
                            value={curPickup}
                            onChange={(e) => handleRowChange(reg.id, 'pickup_point', e.target.value)}
                            placeholder="Pickup Point"
                            className="w-full p-2 bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] placeholder-[#8B8680] focus:bg-white focus:outline-none focus:border-[#E08828]"
                          />
                        </td>

                        {/* Internal Admin Notes */}
                        <td className="py-3 px-3 align-middle">
                          <input
                            type="text"
                            value={curNotes}
                            onChange={(e) => handleRowChange(reg.id, 'admin_notes', e.target.value)}
                            placeholder="Edit admin notes..."
                            className="w-full p-2 bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl text-xs font-medium text-[#1F1F1F] placeholder-[#8B8680] focus:bg-white focus:outline-none focus:border-[#E08828]"
                          />
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveRow(reg)}
                              disabled={isSavingThisRow}
                              className={`px-3 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                                isDirty
                                  ? 'bg-[#E08828] hover:bg-[#D07717] text-white animate-pulse'
                                  : isRowJustSaved
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#F9F7F5] hover:bg-[#EFEAE4] text-[#1F1F1F] border border-[#E5E1DB]'
                              }`}
                              title="Save Row Changes"
                            >
                              {isSavingThisRow ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : isRowJustSaved ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                  <span>Saved</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setPendingDeleteReg(reg)}
                              disabled={isDeleting}
                              className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete Application"
                            >
                              {isDeleting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Specifications and Notes Drawer */}
                      {isExpanded && (
                        <tr className="bg-purple-50/50 border-b border-purple-200">
                          <td colSpan={9} className="p-4">
                            <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-xs space-y-3">
                              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 rounded-lg bg-purple-100 text-purple-800">
                                    <Sparkles className="w-4 h-4" />
                                  </span>
                                  <div>
                                    <h4 className="text-xs font-black text-purple-950">
                                      {isPrivate ? 'Private Trek Custom Specifications' : 'Additional Hiker Information'}
                                    </h4>
                                    <p className="text-[11px] text-purple-700">
                                      Submitted by {reg.full_name} ({reg.phone} • {reg.email})
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDetailsId(null)}
                                  className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>

                              {reg.person_remarks ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-extrabold uppercase text-[#8B8680] tracking-wider">
                                    Captured Request Details &amp; Custom Requirements
                                  </span>
                                  <div className="text-xs text-[#2D2A26] bg-[#FAF8F5] p-3 rounded-lg border border-[#E5E1DB] whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                                    {reg.person_remarks}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-[#8B8680] italic">No extended remarks recorded for this application.</p>
                              )}

                              {/* Direct Follow-up Actions */}
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-100">
                                <a
                                  href={`https://wa.me/${(reg.whatsapp || reg.phone).replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Message on WhatsApp</span>
                                </a>
                                <a
                                  href={`tel:${reg.phone}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] text-[#1F1F1F] rounded-lg text-xs font-bold transition-all"
                                >
                                  <Phone className="w-3.5 h-3.5 text-[#8B8680]" />
                                  <span>Call ({reg.phone})</span>
                                </a>
                                <a
                                  href={`mailto:${reg.email}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] text-[#1F1F1F] rounded-lg text-xs font-bold transition-all"
                                >
                                  <Mail className="w-3.5 h-3.5 text-[#8B8680]" />
                                  <span>Send Email</span>
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#1F1F1F] text-white text-xs font-semibold rounded-2xl shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-stone-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete Single Registration Confirmation Modal */}
      {pendingDeleteReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E5E1DB]">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1F1F1F]">Mark as Cancelled by User?</h3>
            <p className="text-xs text-[#5A5551] mt-2">
              Mark the registration for{' '}
              <strong className="text-[#1F1F1F]">{pendingDeleteReg.full_name}</strong> ({pendingDeleteReg.email}) as{' '}
              <strong className="text-rose-600">Cancelled by User</strong>? The record will be preserved in Cloudflare D1 for future profile history.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDeleteReg(null)}
                className="px-4 py-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F9F7F5] transition-colors"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingDeleteReg.id;
                  setPendingDeleteReg(null);
                  handleDeleteConfirm(id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Mark Cancelled by User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Purge Confirmation Modal */}
      {showBulkPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E5E1DB]">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1F1F1F]">Confirm Bulk Deletion</h3>
            <p className="text-xs text-[#5A5551] mt-2">
              You are about to permanently delete <strong className="text-rose-600">{selectedIds.length}</strong> registrations from both Cloudflare D1 and Firestore.
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> This operation is irreversible.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowBulkPurgeModal(false)}
                className="px-4 py-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F9F7F5] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBatchDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Permanently Delete ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Payment Voucher Inspection Lightbox Modal */}
      {viewingAdminVoucherUrl && (
        <div
          className="fixed inset-0 z-[2200] bg-black/85 p-4 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => {
            setViewingAdminVoucherUrl(null);
            setViewingAdminVoucherReg(null);
          }}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] bg-stone-900 rounded-2xl overflow-hidden flex flex-col p-4 border border-white/10 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs font-bold">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Payment Voucher — {viewingAdminVoucherReg?.full_name || 'Participant Receipt'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingAdminVoucherUrl(null);
                  setViewingAdminVoucherReg(null);
                }}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingAdminVoucherReg && (
              <div className="p-3 bg-stone-800/80 my-2 rounded-xl text-xs space-y-1 text-stone-200">
                <div className="flex justify-between font-bold">
                  <span>Hike: #{viewingAdminVoucherReg.hike_number || '?'} - {viewingAdminVoucherReg.trek_name || 'Trek'}</span>
                  <span className="text-amber-400">Date: {viewingAdminVoucherReg.trek_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-400">
                  <span>Phone: {viewingAdminVoucherReg.phone} ({viewingAdminVoucherReg.email})</span>
                  <span>
                    Submitted:{' '}
                    {viewingAdminVoucherReg.payment_voucher_submitted_at
                      ? new Date(viewingAdminVoucherReg.payment_voucher_submitted_at).toLocaleString()
                      : 'Recently'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto flex flex-col items-center gap-4 p-2 bg-black/40 rounded-xl">
              {viewingAdminVoucherUrl
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
                href={viewingAdminVoucherUrl.split(',')[0]?.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold transition-all"
              >
                Open Full Size ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  setViewingAdminVoucherUrl(null);
                  setViewingAdminVoucherReg(null);
                }}
                className="px-4 py-1.5 bg-[#7ABA42] hover:bg-[#689f38] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Hiker Profile Intelligence Modal */}
      {activeProfileHiker && (
        <AdminHikerProfileModal
          isOpen={Boolean(activeProfileHiker)}
          onClose={() => setActiveProfileHiker(null)}
          hikerName={activeProfileHiker.name}
          hikerPhone={activeProfileHiker.phone}
          hikerEmail={activeProfileHiker.email}
          allRegistrations={registrations}
          treks={treks}
          onViewVoucher={(url, reg) => {
            setViewingAdminVoucherUrl(url);
            setViewingAdminVoucherReg(reg);
          }}
        />
      )}
    </div>
  );
};
