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
  AlertTriangle
} from 'lucide-react';
import { Trek } from '../../types';

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
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  registrations,
  treks,
  loading,
  onRefresh,
  onDeleteRegistration,
  onUpdateRegistration,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrekFilter, setSelectedTrekFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'public' | 'private'>('all');
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Filter for upcoming events + last 2 months hikes in Bookings & Roster
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

    return treks.filter((t) => {
      const dt = parseTrekDate(t.date);
      return !dt || dt.getTime() >= twoMonthsAgo.getTime();
    }).sort((a, b) => {
      const da = parseTrekDate(a.date)?.getTime() || 0;
      const db = parseTrekDate(b.date)?.getTime() || 0;
      return da - db; // nearest first
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
    setToastMessage(`Successfully purged ${total} registrations from both Cloudflare D1 and Firestore.`);
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

    const matchesTrek =
      selectedTrekFilter === 'all' ||
      (selectedTrekFilter === 'PRIVATE' && isPrivate) ||
      reg.trek_id === selectedTrekFilter ||
      reg.hike_number === selectedTrekFilter ||
      reg.trek_name?.toLowerCase().includes(selectedTrekFilter.toLowerCase());

    const regStatus = reg.status || 'Confirmed';
    const matchesStatus = statusFilter === 'all' || regStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesTrek && matchesStatus;
  });

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
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200">
          {/* "All Bookings" Card */}
          <div
            onClick={() => setSelectedTrekFilter('all')}
            className={`p-4 rounded-2xl min-w-[210px] max-w-[230px] shrink-0 cursor-pointer transition-all border ${
              selectedTrekFilter === 'all'
                ? 'border-2 border-amber-600 bg-amber-50/10 shadow-md ring-2 ring-amber-600/10'
                : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
              <span>ALL TIME</span>
              <Compass className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <h3 className="text-sm font-extrabold text-[#1F2937] truncate mb-2">
              All Public Expeditions
            </h3>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                Main Ledger
              </span>
            </div>
            <div className="text-xl font-black text-[#1F2937]">{registrations.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              TOTAL BOOKINGS
            </div>
          </div>

          {/* Individual Trek Cards */}
          {upcomingTreks.map((t) => {
            const isSelected = (selectedTrekFilter === t.id) || (selectedTrekFilter === t.hike_number);
            const tRegsCount = registrations.filter((r) => {
              const regTrekId = (r.trek_id || r.hike_number || '').toLowerCase();
              const queryId = (t.hike_number || t.id).toLowerCase();
              return regTrekId && queryId && (regTrekId.includes(queryId) || queryId.includes(regTrekId));
            }).length;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrekFilter(isSelected ? 'all' : (t.hike_number || t.id))}
                className={`p-4 rounded-2xl min-w-[210px] max-w-[230px] shrink-0 cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-2 border-[#16A34A] bg-white shadow-md ring-2 ring-[#16A34A]/10'
                    : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
                  <span>{t.date || 'Flexible'} • {t.days}D</span>
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
                    <Compass className="w-3 h-3 text-[#2563EB]" /> Hike #{t.hike_number || 'N/A'}
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
                    <option key={t.id} value={t.hike_number || t.id}>
                      Hike #{t.hike_number} - {t.name}
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
                <option value="cancelled">Cancelled</option>
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
                  <th className="py-3 px-4 min-w-[260px]">Participant &amp; Trek</th>
                  <th className="py-3 px-3 w-[140px]">Reg Status</th>
                  <th className="py-3 px-3 w-[140px]">Payment Status</th>
                  <th className="py-3 px-3 w-[110px]">Paid (NPR)</th>
                  <th className="py-3 px-3 w-[110px]">Due (NPR)</th>
                  <th className="py-3 px-3 w-[150px]">Pickup Point</th>
                  <th className="py-3 px-3 min-w-[200px]">Internal Admin Notes</th>
                  <th className="py-3 px-4 w-[110px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE5]">
                {filteredRegistrations.map((reg) => {
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
                              <span className="font-extrabold text-xs text-[#1F1F1F]">{reg.full_name}</span>
                              
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

                            {/* Contact Info */}
                            <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-[#8B8680]">
                              <a href={`tel:${reg.phone}`} className="flex items-center gap-0.5 hover:text-[#E08828]">
                                <Phone className="w-3 h-3 text-[#8B8680]" />
                                <span>{reg.phone}</span>
                              </a>

                              <a href={`mailto:${reg.email}`} className="flex items-center gap-0.5 hover:text-[#E08828]">
                                <Mail className="w-3 h-3 text-[#8B8680]" />
                                <span className="truncate max-w-[140px]">{reg.email}</span>
                              </a>
                            </div>

                            {/* Toggle Details for Private Inquiries or Custom Remarks */}
                            {(isPrivate || reg.person_remarks) && (
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedDetailsId(isExpanded ? null : reg.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer border ${
                                    isExpanded
                                      ? 'bg-purple-700 text-white border-purple-700'
                                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                  }`}
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{isExpanded ? 'Hide Specifications' : 'View Specifications & Notes'}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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
            <h3 className="text-base font-bold text-[#1F1F1F]">Delete Registration?</h3>
            <p className="text-xs text-[#5A5551] mt-2">
              Are you sure you want to delete the registration for{' '}
              <strong className="text-[#1F1F1F]">{pendingDeleteReg.full_name}</strong> ({pendingDeleteReg.email})?
              This will remove the record from both Cloudflare D1 and Firestore.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setPendingDeleteReg(null)}
                className="px-4 py-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F9F7F5] transition-colors"
              >
                Cancel
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
                Delete Record
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
    </div>
  );
};
