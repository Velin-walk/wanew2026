import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Download,
  RefreshCw,
  Filter,
  Eye,
  Copy,
  Check,
  Lock,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '../../services/api';

interface CloudflareRegistrationsTableProps {
  registrations: any[];
  loading?: boolean;
  onRefresh?: () => void;
}

interface ColumnDef {
  key: string;
  label: string;
  type: 'INTEGER' | 'TEXT' | 'DATETIME';
  isPrimary?: boolean;
  width?: string;
}

const D1_COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'id', type: 'INTEGER', isPrimary: true, width: 'w-16' },
  { key: 'hike_number', label: 'hike_number', type: 'TEXT', width: 'w-28' },
  { key: 'trek_name', label: 'trek_name', type: 'TEXT', width: 'w-48' },
  { key: 'full_name', label: 'full_name', type: 'TEXT', width: 'w-44' },
  { key: 'pax', label: 'pax', type: 'INTEGER', width: 'w-16' },
  { key: 'phone', label: 'phone / whatsapp', type: 'TEXT', width: 'w-36' },
  { key: 'emergency_backup_contact', label: 'emergency_backup_contact', type: 'TEXT', width: 'w-44' },
  { key: 'email_address', label: 'email_address', type: 'TEXT', width: 'w-48' },
  { key: 'profession', label: 'profession', type: 'TEXT', width: 'w-32' },
  { key: 'part_of_group', label: 'part_of_group', type: 'TEXT', width: 'w-28' },
  { key: 'list_name', label: 'list_name (role / team)', type: 'TEXT', width: 'w-52' },
  { key: 'age_group', label: 'age_group', type: 'TEXT', width: 'w-24' },
  { key: 'gender', label: 'gender', type: 'TEXT', width: 'w-24' },
  { key: 'guide_mode', label: 'guide_mode', type: 'TEXT', width: 'w-28' },
  { key: 'transport_mode', label: 'transport_mode', type: 'TEXT', width: 'w-32' },
  { key: 'due', label: 'due', type: 'TEXT', width: 'w-24' },
  { key: 'paid', label: 'paid', type: 'TEXT', width: 'w-24' },
  { key: 'roster_payment_status', label: 'payment_status', type: 'TEXT', width: 'w-28' },
  { key: 'payment_voucher_url', label: 'payment_voucher_url', type: 'TEXT', width: 'w-48' },
  { key: 'registration_status', label: 'status', type: 'TEXT', width: 'w-28' },
  { key: 'pickup_point', label: 'pickup_point', type: 'TEXT', width: 'w-36' },
  { key: 'fitness', label: 'fitness', type: 'TEXT', width: 'w-28' },
  { key: 'medical_condition', label: 'medical_condition', type: 'TEXT', width: 'w-36' },
  { key: 'recent_hikes', label: 'recent_hikes', type: 'TEXT', width: 'w-40' },
  { key: 'agreement', label: 'agreement', type: 'TEXT', width: 'w-24' },
  { key: 'suggestions', label: 'suggestions', type: 'TEXT', width: 'w-48' },
  { key: 'timestamp', label: 'timestamp', type: 'DATETIME', width: 'w-44' },
];

export const CloudflareRegistrationsTable: React.FC<CloudflareRegistrationsTableProps> = ({
  registrations,
  loading = false,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hikeFilter, setHikeFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSyncingProfiles, setIsSyncingProfiles] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; success: boolean } | null>(null);

  const handleForwardToProfiles = async () => {
    setIsSyncingProfiles(true);
    setSyncFeedback(null);
    try {
      const res = await apiFetch('admin/migrate-profiles', {
        method: 'POST',
        body: JSON.stringify({ backfillFromTables: true }),
      });
      if (res.ok) {
        const data = await res.json();
        // Also trigger leaderboard recompute
        await apiFetch('admin/recompute-leaderboard', { method: 'POST' }).catch(() => {});
        setSyncFeedback({
          text: `Forwarded ${data.migratedCount || 0} hikers into Hiker Profiles & refreshed Leaderboard!`,
          success: true,
        });
        if (onRefresh) onRefresh();
      } else {
        setSyncFeedback({
          text: 'Profile forward request returned an error. Please try again.',
          success: false,
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        text: 'Error forwarding to profiles: ' + (err.message || 'Connection error'),
        success: false,
      });
    } finally {
      setIsSyncingProfiles(false);
      setTimeout(() => setSyncFeedback(null), 8000);
    }
  };

  // Distinct hike list for filter dropdown
  const uniqueHikes = useMemo(() => {
    const map = new Map<string, string>();
    registrations.forEach((r) => {
      const hikeNum = r.hike_number || r.trek_id || '';
      const trekName = r.trek_name || r.list_name || '';
      if (hikeNum && !map.has(hikeNum)) {
        map.set(hikeNum, trekName ? `#${hikeNum} - ${trekName}` : `#${hikeNum}`);
      }
    });
    return Array.from(map.entries());
  }, [registrations]);

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    let result = [...registrations];

    // Filter by hike
    if (hikeFilter !== 'ALL') {
      result = result.filter(
        (r) => String(r.hike_number || r.trek_id || '') === hikeFilter
      );
    }

    // Search query across all properties
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        return Object.values(r).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle aliases
      if (sortKey === 'phone') {
        aVal = a.phone || a.whatsapp_number || a.whatsapp || '';
        bVal = b.phone || b.whatsapp_number || b.whatsapp || '';
      } else if (sortKey === 'timestamp') {
        aVal = a.timestamp || a.created_at || '';
        bVal = b.timestamp || b.created_at || '';
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [registrations, hikeFilter, searchQuery, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Helper to extract display value for a column from a record
  const getCellValue = (r: any, colKey: string) => {
    switch (colKey) {
      case 'id':
        return r.id;
      case 'hike_number':
        return r.hike_number || r.trek_id || '';
      case 'trek_name':
        return r.trek_name || '';
      case 'full_name':
        return r.full_name || r.name || '';
      case 'pax':
        return r.pax ?? r.paxCount ?? 1;
      case 'phone':
        return r.whatsapp_number || r.whatsapp || r.phone || '';
      case 'emergency_backup_contact':
        return r.emergency_backup_contact || r.emergency_contact || '';
      case 'email_address':
        return r.email_address || r.email || '';
      case 'profession':
        return r.profession || '';
      case 'part_of_group':
        return r.part_of_group || '';
      case 'list_name':
        return r.list_name || r.person_remarks || '';
      case 'age_group':
        return r.age_group || '';
      case 'gender':
        return r.gender || '';
      case 'guide_mode':
        return r.guide_mode || r.guide_preference || '';
      case 'transport_mode':
        return r.transport_mode || r.transport_preference || '';
      case 'due':
        return r.due || (r.due_amount ? `NPR ${r.due_amount}` : '');
      case 'paid':
        return r.paid || (r.paid_amount ? `NPR ${r.paid_amount}` : '');
      case 'roster_payment_status':
        return r.roster_payment_status || r.payment_status || 'Unpaid';
      case 'registration_status':
        return r.registration_status || r.status || 'Confirmed';
      case 'pickup_point':
        return r.roster_pickup_point || r.pickup_point || '';
      case 'fitness':
        return r.fitness || '';
      case 'medical_condition':
        return r.medical_condition || (r.has_medical === 'Yes' ? r.specify_medical || 'Yes' : '');
      case 'recent_hikes':
        return r.recent_hikes || '';
      case 'agreement':
        return r.agreement || 'Yes';
      case 'suggestions':
        return r.suggestions || '';
      case 'timestamp':
        return r.timestamp || r.created_at || '';
      default:
        return r[colKey] ?? '';
    }
  };

  const handleCopyCell = (text: string, cellId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedCell(cellId);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = D1_COLUMNS.map((col) => col.key);
    const csvRows = [headers.join(',')];

    for (const record of filteredRecords) {
      const values = headers.map((header) => {
        const val = getCellValue(record, header);
        const escaped = String(val ?? '').replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `cloudflare_d1_registrations_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full animate-in fade-in duration-200">
      {/* Cloudflare D1 Console Header Bar */}
      <div className="bg-[#1D1B19] text-white p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F38020]/20 border border-[#F38020]/40 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-[#F38020]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-[#F38020] font-bold">
                Applications
              </span>
              <span className="text-stone-500">•</span>
              <span className="font-mono text-xs text-stone-300 font-semibold bg-stone-800 px-2 py-0.5 rounded">
                Cloudflare D1: registrations
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Read-Only View</span>
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Direct live reflection of the SQL table stored in Cloudflare D1. All edit/delete access is restricted.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="text-right px-3 py-1 bg-stone-800/80 rounded-xl border border-stone-700/60 text-xs">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">Total Rows</span>
            <span className="font-mono font-bold text-white text-sm">{registrations.length}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh D1 Table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#F38020]' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleForwardToProfiles}
            disabled={isSyncingProfiles || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Forward registrations & roster data into Hiker Profiles & Leaderboard"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSyncingProfiles ? 'animate-spin' : ''}`} />
            <span>{isSyncingProfiles ? 'Syncing Profiles...' : 'Sync to Hiker Profiles'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F38020] hover:bg-[#E07218] active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Export CSV of D1 Registrations"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
            syncFeedback.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control / Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E5E1DB] shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search across all table columns..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:border-[#F38020] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Hike / Trek Filter */}
          {uniqueHikes.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              <select
                value={hikeFilter}
                onChange={(e) => {
                  setHikeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-[#F38020] cursor-pointer"
              >
                <option value="ALL">All Treks ({uniqueHikes.length})</option>
                {uniqueHikes.map(([hikeNum, label]) => (
                  <option key={hikeNum} value={hikeNum}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-stone-500 font-medium">
          <span>
            Showing <strong className="text-stone-800">{filteredRecords.length}</strong> matching rows
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-[#FAF8F5] border border-[#E5E1DB] rounded-lg text-xs font-semibold text-stone-700 cursor-pointer"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={500}>All</option>
          </select>
        </div>
      </div>

      {/* Main Tabular View: Cloudflare D1 Console Styled Grid */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xs overflow-hidden flex flex-col">
        {/* Table Container with Horizontal and Vertical Scrolling */}
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse select-text">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-20 bg-[#F5F2ED] text-stone-700 border-b border-[#E0DBD3] shadow-2xs">
              <tr>
                {/* Row Index Column */}
                <th className="py-2.5 px-3 text-[11px] font-mono font-bold text-stone-500 border-r border-[#E5E1DB] bg-[#ECE7E0] sticky left-0 z-30 w-12 text-center">
                  #
                </th>

                {/* Inspect Action Column */}
                <th className="py-2.5 px-2 text-[11px] font-mono font-bold text-stone-500 border-r border-[#E5E1DB] bg-[#ECE7E0] sticky left-12 z-30 w-10 text-center">
                  View
                </th>

                {/* D1 Columns */}
                {D1_COLUMNS.map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`py-2.5 px-3 text-[11px] font-mono font-semibold tracking-tight border-r border-[#E5E1DB] whitespace-nowrap cursor-pointer hover:bg-[#EAE4DC] transition-colors ${
                        col.isPrimary ? 'text-amber-700 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-stone-400 px-1 py-0.2 bg-stone-200/80 rounded">
                          {col.type}
                        </span>
                        {isSorted && (
                          <span className="text-stone-800 font-bold">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#EFEAE4] text-xs font-mono text-stone-800">
              {loading && paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={D1_COLUMNS.length + 2} className="py-12 text-center text-stone-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#F38020]" />
                    <span>Loading rows from Cloudflare D1 database...</span>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={D1_COLUMNS.length + 2} className="py-12 text-center text-stone-400 font-sans">
                    <TableIcon className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-600">No records found in Cloudflare D1 table</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {searchQuery || hikeFilter !== 'ALL'
                        ? 'Try clearing your filters or search terms.'
                        : 'New registrations made via the public booking form will appear here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record, index) => {
                  const globalRowNumber = (currentPage - 1) * pageSize + index + 1;
                  const recordId = String(record.id || index);

                  return (
                    <tr
                      key={recordId}
                      className="hover:bg-[#FAF6F0] transition-colors group"
                    >
                      {/* Row Index */}
                      <td className="py-2 px-3 text-[10px] text-stone-400 font-mono text-center border-r border-[#EFEAE4] bg-[#FBF9F6] sticky left-0 z-10 group-hover:bg-[#F3EFE9]">
                        {globalRowNumber}
                      </td>

                      {/* View / Inspect Row Trigger */}
                      <td className="py-2 px-2 text-center border-r border-[#EFEAE4] bg-[#FBF9F6] sticky left-12 z-10 group-hover:bg-[#F3EFE9]">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          title="Inspect raw D1 record"
                          className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Columns */}
                      {D1_COLUMNS.map((col) => {
                        const rawVal = getCellValue(record, col.key);
                        const cellId = `${recordId}-${col.key}`;
                        const isCopied = copiedCell === cellId;
                        const isNull = rawVal === null || rawVal === undefined || rawVal === '';

                        return (
                          <td
                            key={col.key}
                            onClick={() => handleCopyCell(rawVal, cellId)}
                            title="Click to copy value"
                            className={`py-2 px-3 border-r border-[#EFEAE4] whitespace-nowrap truncate max-w-[260px] cursor-pointer hover:bg-amber-50/70 transition-colors ${
                              col.isPrimary ? 'font-bold text-amber-800' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 group/cell">
                              <span className="truncate">
                                {isNull ? (
                                  <span className="text-stone-300 italic font-sans text-[11px]">
                                    null
                                  </span>
                                ) : (
                                  String(rawVal)
                                )}
                              </span>
                              {!isNull && (
                                <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-stone-400 hover:text-stone-700 shrink-0 ml-1">
                                  {isCopied ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Read-Only Notice Footer */}
        <div className="p-3 bg-[#FAF8F5] border-t border-[#E5E1DB] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-stone-500">
            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="text-[11px]">
              <strong>Read-Only Mode:</strong> Click any cell to copy value. No modification privileges granted in this view.
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-[#E5E1DB] bg-white text-stone-600 hover:bg-[#F3EFEA] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono text-stone-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-[#E5E1DB] bg-white text-stone-600 hover:bg-[#F3EFEA] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Read-Only Record Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-stone-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#1D1B19] text-white flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[#F38020]" />
                <span className="font-mono text-xs font-bold text-stone-200">
                  D1 Row Inspector • Record #{selectedRecord.id || ''}
                </span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                  Read Only
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: Key-Value Table */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="border border-[#E5E1DB] rounded-xl overflow-hidden divide-y divide-[#EFEAE4] text-xs font-mono">
                {D1_COLUMNS.map((col) => {
                  const val = getCellValue(selectedRecord, col.key);
                  const isNull = val === null || val === undefined || val === '';

                  return (
                    <div
                      key={col.key}
                      className="grid grid-cols-12 py-2 px-3 hover:bg-[#FAF8F5] transition-colors items-start"
                    >
                      <div className="col-span-4 font-semibold text-stone-600 flex items-center gap-1.5">
                        <span className="truncate">{col.label}</span>
                        <span className="text-[9px] text-stone-400 font-sans uppercase">
                          {col.type}
                        </span>
                      </div>
                      <div className="col-span-8 text-stone-900 break-all select-text font-sans flex items-start justify-between gap-2">
                        <span>
                          {isNull ? (
                            <span className="text-stone-300 italic font-mono text-xs">
                              null
                            </span>
                          ) : (
                            String(val)
                          )}
                        </span>
                        {!isNull && (
                          <button
                            type="button"
                            onClick={() => handleCopyCell(val, `modal-${col.key}`)}
                            title="Copy value"
                            className="text-stone-400 hover:text-stone-700 p-1 shrink-0 cursor-pointer"
                          >
                            {copiedCell === `modal-${col.key}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Raw JSON viewer */}
              <div>
                <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider block mb-1">
                  Raw JSON Payload
                </span>
                <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-stone-800">
                  {JSON.stringify(selectedRecord, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#FAF8F5] border-t border-[#E5E1DB] flex items-center justify-between">
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Protected D1 record (no admin editing allowed)</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
