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
  { value: 'UPSERT_TREK', label: 'Trek Upsert' },
  { value: 'UPDATE_TREK_STATUS', label: 'Status Update' },
  { value: 'UPDATE_EVENT_EXECUTION', label: 'Event Execution' },
  { value: 'UPDATE_BOOKING', label: 'Booking / Roster' },
  { value: 'CLONE_TREK', label: 'Clone Trek' },
  { value: 'DELETE_TREK', label: 'Delete Trek' },
  { value: 'DELETE_REGISTRATION', label: 'Delete Registration' },
  { value: 'SYNC_ALL_PROFILES', label: 'Profile Sync' },
  { value: 'SYNC_LEADERBOARD', label: 'Leaderboard Sync' },
  { value: 'MIGRATE_IMAGES_R2', label: 'R2 Migration' },
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
  const [showRawJsonId, setShowRawJsonId] = useState<number | null>(null);
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
      case 'SYNC_LEADERBOARD':
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
      case 'MIGRATE_IMAGES_R2':
        return 'bg-purple-50 text-purple-800 border border-purple-200';
      default:
        return 'bg-stone-50 text-stone-800 border border-stone-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'SYNC_ALL_PROFILES':
      case 'SYNC_LEADERBOARD':
        return <Database className="w-3.5 h-3.5 text-emerald-600" />;
      case 'UPSERT_TREK':
        return <Layers className="w-3.5 h-3.5 text-blue-600" />;
      case 'CLONE_TREK':
        return <Sparkles className="w-3.5 h-3.5 text-sky-600" />;
      case 'UPDATE_BOOKING':
        return <CreditCard className="w-3.5 h-3.5 text-indigo-600" />;
      case 'DELETE_TREK':
      case 'DELETE_REGISTRATION':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-600" />;
      case 'UPDATE_TREK_STATUS':
        return <Map className="w-3.5 h-3.5 text-amber-600" />;
      case 'UPDATE_EVENT_EXECUTION':
        return <Calendar className="w-3.5 h-3.5 text-amber-600" />;
      case 'MIGRATE_IMAGES_R2':
        return <RefreshCw className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-stone-500" />;
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

  const formatChangesTarget = (desc: string) => {
    if (!desc || typeof desc !== 'string') return '';
    return desc
      .replace(/^updated\s+booking\/roster\s+(?:for\s+)?/i, '')
      .replace(/^upserted\s+trek\s+/i, '')
      .replace(/^updated\s+event\s+execution\s+for\s+trek\s+/i, '')
      .replace(/^updated\s+event\s+execution\s+for\s+/i, '')
      .replace(/^changed\s+status\s+of\s+/i, '')
      .replace(/^updated\s+trek\s+(\S+)\s+status\s+to\s+['"]?([^'"]+)['"]?/i, 'Hike #$1 → $2')
      .replace(/^deleted\s+registration\s+id\s+/i, 'Registration #')
      .replace(/^deleted\s+registration\s+/i, 'Registration ')
      .replace(/^deleted\s+trek\s+/i, 'Trek ')
      .replace(/^cloned\s+trek\s+/i, '')
      .replace(/^batch\s+migrated\s+/i, '')
      .trim();
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

      {/* Action Filter Buttons */}
      <div className="px-4 py-3 bg-[#FCFAF7] border-b border-[#F0EBE5]">
        <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2">
          Filter by Action Type
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {ACTION_TYPES.map((type) => {
            const isSelected = selectedAction === type.value;
            return (
              <button
                key={type.value || 'all'}
                type="button"
                onClick={() => {
                  setSelectedAction(type.value);
                  setOffset(0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 select-none ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-xs ring-2 ring-stone-900/20'
                    : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-250 shadow-3xs'
                }`}
              >
                {type.value ? getActionIcon(type.value) : <Clock className="w-3.5 h-3.5 text-stone-400" />}
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-250 focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:border-[#7ABA42] rounded-xl text-xs text-stone-900 placeholder-stone-400 transition-all shadow-xs"
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
            className="px-3 py-2.5 bg-white border border-stone-250 focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:border-[#7ABA42] rounded-xl text-xs text-stone-800 transition-all shadow-xs cursor-pointer min-w-[200px]"
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
          <div className="overflow-x-auto border border-[#EFEAE4] rounded-2xl shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF8F5] border-b border-[#EFEAE4] text-[10px] font-bold text-stone-600 uppercase tracking-wider select-none">
                <tr>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Action Type & ID</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Executed At</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Operator</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Changes Made To</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Payload Metadatas</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F2EE]">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  let meta: Record<string, any> | null = null;
                  try {
                    if (log.metadata_json) {
                      meta = JSON.parse(log.metadata_json);
                    }
                  } catch (_) {
                    meta = null;
                  }

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded ? 'bg-[#FAF8F5]' : 'hover:bg-stone-50/70'
                        }`}
                      >
                        {/* 1. Action Type & ID */}
                        <td className="py-2.5 px-3.5 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-stone-100 border border-stone-200">
                              {getActionIcon(log.action_type)}
                            </div>
                            <div>
                              <span className={`text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-md inline-block ${getActionBadgeColor(log.action_type || '')}`}>
                                {(log.action_type || 'SYSTEM').replace(/_/g, ' ')}
                              </span>
                              <div className="text-[10px] font-mono text-stone-500 font-bold mt-0.5">
                                ID: #{log.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Executed At */}
                        <td className="py-2.5 px-3 align-top whitespace-nowrap text-stone-700">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{formatLogDate(log.created_at)}</span>
                          </div>
                        </td>

                        {/* 3. Operator */}
                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-800">
                            <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="text-[#F38020]">{log.admin_email}</span>
                          </div>
                        </td>

                        {/* 4. Changes Made To */}
                        <td className="py-2.5 px-3 align-top text-stone-800">
                          <div className="text-xs font-semibold leading-relaxed">
                            {formatChangesTarget(log.description)}
                          </div>
                        </td>

                        {/* 5. Payload Metadatas */}
                        <td className="py-2.5 px-3 align-top">
                          {meta && Object.keys(meta).length > 0 ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              {meta.registration_id && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 font-mono">
                                  Reg: #{meta.registration_id}
                                </span>
                              )}
                              {meta.status && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  {meta.status}
                                </span>
                              )}
                              {meta.payment_status && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  {meta.payment_status}
                                </span>
                              )}
                              {meta.paid_amount !== undefined && meta.paid_amount !== null && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                  Paid: Rs. {Number(meta.paid_amount).toLocaleString()}
                                </span>
                              )}
                              {meta.due_amount !== undefined && meta.due_amount !== null && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700">
                                  Due: Rs. {Number(meta.due_amount).toLocaleString()}
                                </span>
                              )}
                              {meta.pickup_point ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">
                                  {meta.pickup_point}
                                </span>
                              ) : null}
                              {!meta.registration_id && !meta.status && !meta.payment_status && (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(meta).slice(0, 3).map(([k, v]) => (
                                    <span key={k} className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700 font-mono">
                                      {k}: {typeof v === 'object' ? '...' : String(v).slice(0, 20)}
                                    </span>
                                  ))}
                                  {Object.keys(meta).length > 3 && (
                                    <span className="text-[10px] text-stone-400 font-semibold">+{Object.keys(meta).length - 3} more</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-400 text-[11px] italic">—</span>
                          )}
                        </td>

                        {/* 6. Details */}
                        <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedLogId(isExpanded ? null : log.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-[11px] font-bold transition-all cursor-pointer shadow-3xs"
                          >
                            <span>{isExpanded ? 'Hide' : 'View'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-[#FAF8F5] border-b border-stone-200">
                          <td colSpan={6} className="p-3 sm:p-4">
                            <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between border-b border-stone-150 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-stone-800">
                                    Payload Metadata Details (Action #{log.id})
                                  </span>
                                  <span className="text-[10px] text-stone-400 font-mono">
                                    Operator: {log.admin_email}
                                  </span>
                                </div>
                                {meta && (
                                  <button
                                    type="button"
                                    onClick={() => setShowRawJsonId(showRawJsonId === log.id ? null : log.id)}
                                    className="text-[10px] font-bold text-[#F38020] hover:text-[#d96e17] underline cursor-pointer"
                                  >
                                    {showRawJsonId === log.id ? 'Show Table View' : 'Show Raw JSON'}
                                  </button>
                                )}
                              </div>

                              {meta && Object.keys(meta).length > 0 ? (
                                showRawJsonId === log.id ? (
                                  <pre className="p-3 bg-stone-900 text-stone-100 text-[11px] font-mono rounded-lg overflow-x-auto leading-relaxed">
                                    {JSON.stringify(meta, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-stone-200 rounded-lg overflow-hidden">
                                      <thead className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                        <tr>
                                          <th className="py-1.5 px-3 text-left w-1/3">Field / Attribute</th>
                                          <th className="py-1.5 px-3 text-left">Payload Value</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-stone-100">
                                        {Object.entries(meta).map(([key, val]) => (
                                          <tr key={key} className="hover:bg-stone-50/50">
                                            <td className="py-1.5 px-3 font-mono text-[11px] font-bold text-stone-700">
                                              {key}
                                            </td>
                                            <td className="py-1.5 px-3 font-mono text-[11px] text-stone-900">
                                              {val === null || val === undefined || val === '' ? (
                                                <span className="text-stone-400 italic font-sans text-[10px]">None / Empty</span>
                                              ) : typeof val === 'object' ? (
                                                <pre className="inline font-mono">{JSON.stringify(val)}</pre>
                                              ) : (
                                                String(val)
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              ) : (
                                <p className="text-xs text-stone-400 italic">No payload metadata recorded for this action.</p>
                              )}
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
