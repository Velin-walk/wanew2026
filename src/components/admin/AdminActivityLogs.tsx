import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import {
  Clock,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Database,
  Calendar,
  Layers,
  Sparkles,
  Map,
  X,
  CreditCard
} from 'lucide-react';

interface ActivityLog {
  id: number;
  admin_email: string;
  action_type: string;
  description: string;
  metadata_json: string;
  created_at: string;
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'SYNC_ALL_PROFILES', label: 'Bulk Profile Sync' },
  { value: 'UPSERT_TREK', label: 'Trek Upsert' },
  { value: 'UPDATE_BOOKING', label: 'Roster / Booking Change' },
  { value: 'DELETE_TREK', label: 'Delete Trek' },
  { value: 'UPDATE_TREK_STATUS', label: 'Trek Status Update' },
  { value: 'UPDATE_EVENT_EXECUTION', label: 'Event Execution Edit' },
  { value: 'CLONE_TREK', label: 'Clone Trek' },
  { value: 'DELETE_REGISTRATION', label: 'Delete Registration' }
];

export function AdminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [selectedAction, setSelectedAction] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let queryPath = `admin/logs?limit=${limit}&offset=${offset}`;
      if (selectedAction) {
        queryPath += `&action=${encodeURIComponent(selectedAction)}`;
      }
      if (searchEmail.trim()) {
        queryPath += `&email=${encodeURIComponent(searchEmail.trim())}`;
      }

      const res = await apiFetch(queryPath, { forceFresh: true });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        const rawLogs: ActivityLog[] = data.data || [];
        const sortedLogs = [...rawLogs].sort((a, b) => {
          const timeA = new Date(a.created_at ? a.created_at.replace(' ', 'T') : 0).getTime();
          const timeB = new Date(b.created_at ? b.created_at.replace(' ', 'T') : 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        setLogs(sortedLogs);
        setTotal(data.total || 0);
      } else {
        throw new Error(data.error || 'Failed to retrieve logs');
      }
    } catch (err: any) {
      console.error('Error loading activity logs:', err);
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  const clearFilters = () => {
    setSelectedAction('');
    setSearchEmail('');
    setOffset(0);
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'SYNC_ALL_PROFILES':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'UPSERT_TREK':
      case 'CLONE_TREK':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'UPDATE_BOOKING':
        return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
      case 'DELETE_TREK':
      case 'DELETE_REGISTRATION':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'UPDATE_TREK_STATUS':
      case 'UPDATE_EVENT_EXECUTION':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      default:
        return 'bg-stone-50 text-stone-800 border border-stone-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'SYNC_ALL_PROFILES':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'UPSERT_TREK':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'CLONE_TREK':
        return <Sparkles className="w-4 h-4 text-sky-600" />;
      case 'UPDATE_BOOKING':
        return <CreditCard className="w-4 h-4 text-indigo-600" />;
      case 'DELETE_TREK':
      case 'DELETE_REGISTRATION':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case 'UPDATE_TREK_STATUS':
        return <Map className="w-4 h-4 text-amber-600" />;
      default:
        return <Clock className="w-4 h-4 text-stone-500" />;
    }
  };

  const formatLogDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    try {
      const normalizedStr = dateStr.includes('Z') || dateStr.includes('+')
        ? dateStr
        : dateStr.replace(' ', 'T') + 'Z';
      const d = new Date(normalizedStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        timeZone: 'Asia/Kathmandu',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' NPT';
    } catch (_) {
      return dateStr;
    }
  };

  const renderMetadata = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Object.keys(parsed).length === 0) return null;
      return (
        <div className="mt-3 p-3.5 bg-stone-50 rounded-xl border border-stone-150 text-[11px] font-mono text-stone-700 leading-relaxed overflow-x-auto max-w-full">
          <div className="text-[10px] uppercase font-sans font-bold text-stone-400 mb-1.5 tracking-wider">Payload Metadata</div>
          <pre>{JSON.stringify(parsed, null, 2)}</pre>
        </div>
      );
    } catch (_) {
      return null;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="w-full bg-white rounded-2xl shadow-xs border border-[#EFEAE4] overflow-hidden">
      {/* Header Panel */}
      <div className="p-6 border-b border-[#F5F2EE] bg-[#FCFAF7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#F38020]/10 flex items-center justify-center rounded-xl">
            <Clock className="w-5 h-5 text-[#F38020]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">Admin Audit Trail</h2>
            <p className="text-xs text-stone-500 mt-0.5">Secure, immutable event logs of all content edits and administrator operations.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs()}
          className="flex items-center justify-center gap-2 self-start sm:self-center px-4 py-2 bg-white text-stone-700 hover:text-stone-950 border border-stone-250 hover:bg-stone-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="p-4 bg-stone-50/50 border-b border-[#F5F2EE] flex flex-col lg:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Admin Email Search input */}
          <div className="flex-1 relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by admin email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-250 focus:border-[#F38020] rounded-xl text-xs text-stone-900 placeholder-stone-400 outline-none transition-all shadow-xs"
            />
            {searchEmail && (
              <button
                type="button"
                onClick={() => setSearchEmail('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            Search
          </button>
        </form>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Action type Filter dropdown */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setOffset(0);
            }}
            className="px-3 py-2.5 bg-white border border-stone-250 focus:border-[#F38020] rounded-xl text-xs text-stone-800 outline-none transition-all shadow-xs cursor-pointer min-w-[200px]"
          >
            {ACTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {(selectedAction || searchEmail) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main logs display list */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-[#F38020] animate-spin mb-3.5" />
            <p className="text-xs text-stone-500 font-bold">Querying D1 for audit records...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-150 text-red-850 p-5 rounded-2xl flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-black">Audit Log Query Unsuccessful</h4>
              <p className="text-xs mt-1.5 leading-relaxed font-bold">{error}</p>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="mt-3 text-xs text-red-700 hover:text-red-900 underline font-black cursor-pointer"
              >
                Retry Request
              </button>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-stone-50/40 rounded-2xl border border-dashed border-stone-200">
            <Clock className="w-10 h-10 text-stone-350 mb-3" />
            <h4 className="text-sm font-black text-stone-800">No activity logs found</h4>
            <p className="text-xs text-stone-500 mt-1.5 max-w-sm px-6">
              There are no audit records recorded that match your active email/action filter constraints.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  className={`border rounded-2xl transition-all duration-200 ${
                    isExpanded
                      ? 'bg-[#FAF8F5]/80 border-stone-300 shadow-xs'
                      : 'border-stone-150 hover:border-stone-250 bg-white hover:bg-stone-50/40'
                  }`}
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-white border border-stone-200 shadow-2xs">
                        {getActionIcon(log.action_type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${getActionBadgeColor(log.action_type || '')}`}>
                            {(log.action_type || 'SYSTEM').replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-bold text-stone-900 leading-tight">
                            {log.description}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-[#F38020]">{log.admin_email}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            <span>{formatLogDate(log.created_at)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-14 pb-4 border-t border-stone-150/60 pt-3">
                      <div className="text-[11px] text-stone-600 space-y-1.5 leading-relaxed font-semibold">
                        <div>
                          <strong className="text-stone-500 uppercase text-[10px] tracking-wider block sm:inline sm:mr-1.5">Action ID:</strong>
                          <span className="font-mono bg-stone-100 px-1.5 py-0.2 rounded-md text-stone-800">{log.id}</span>
                        </div>
                        <div>
                          <strong className="text-stone-500 uppercase text-[10px] tracking-wider block sm:inline sm:mr-1.5">Operator:</strong>
                          <span className="text-stone-800">{log.admin_email}</span>
                        </div>
                        <div>
                          <strong className="text-stone-500 uppercase text-[10px] tracking-wider block sm:inline sm:mr-1.5">Executed At:</strong>
                          <span className="text-stone-800 font-mono">{formatLogDate(log.created_at)}</span>
                        </div>
                      </div>

                      {renderMetadata(log.metadata_json)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with pagination metrics */}
        {!loading && !error && total > 0 && (
          <div className="mt-6 pt-5 border-t border-[#F5F2EE] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-stone-500 font-bold">
              Showing <span className="text-stone-800">{offset + 1}</span> to{' '}
              <span className="text-stone-800">{Math.min(offset + limit, total)}</span> of{' '}
              <span className="text-stone-800">{total}</span> actions
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(offset - limit, 0))}
                className="p-2 border border-stone-250 bg-white hover:bg-stone-50 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-xs text-stone-600 font-bold">
                Page <span className="text-stone-800">{currentPage}</span> of{' '}
                <span className="text-[#F38020]">{totalPages}</span>
              </div>

              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="p-2 border border-stone-250 bg-white hover:bg-stone-50 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
