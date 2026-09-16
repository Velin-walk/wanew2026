import React, { useState } from 'react';
import {
  Mountain,
  AlertTriangle,
  Users,
  CheckCircle,
  Calendar,
  RefreshCw,
  Search,
  Compass,
  Save,
  Check
} from 'lucide-react';
import { Trek } from '../../types';

interface EventExecutionManagerProps {
  treks: Trek[];
  loading: boolean;
  onRefresh: () => void;
  onUpdateTrekExecution: (trekId: string, updates: Partial<Trek> & { is_cancelled?: boolean; cancellation_reason?: string }) => Promise<void>;
  onSelectViewRoster: (trekId: string) => void;
}

export const EventExecutionManager: React.FC<EventExecutionManagerProps> = ({
  treks,
  loading,
  onRefresh,
  onUpdateTrekExecution,
  onSelectViewRoster,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Row-level draft states for inline table editing
  const [rowDrafts, setRowDrafts] = useState<
    Record<
      string,
      {
        status?: 'Active' | 'Registration Closed' | 'Completed' | 'Cancelled';
        capacity?: number;
        leader?: string;
        cancellation_reason?: string;
      }
    >
  >({});

  const [savingRowIds, setSavingRowIds] = useState<Record<string, boolean>>({});
  const [justSavedRowIds, setJustSavedRowIds] = useState<Record<string, boolean>>({});

  const filteredTreks = treks.filter((t) => {
    const q = searchTerm.toLowerCase().trim();
    return !q || t.name.toLowerCase().includes(q) || (t.hike_number && t.hike_number.includes(q));
  });

  const activeCount = treks.filter((t) => !t.data?.is_cancelled && t.participants < t.capacity).length;
  const fullCount = treks.filter((t) => t.participants >= t.capacity).length;
  const cancelledCount = treks.filter((t) => !!t.data?.is_cancelled).length;

  const handleRowChange = (id: string, field: string, value: any) => {
    setRowDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (t: Trek) => {
    const draft = rowDrafts[t.id] || {};
    const curStatus =
      draft.status !== undefined
        ? draft.status
        : t.data?.is_cancelled
        ? 'Cancelled'
        : t.participants >= t.capacity
        ? 'Registration Closed'
        : 'Active';

    const curCapacity = draft.capacity !== undefined ? Number(draft.capacity) : t.capacity || 25;
    const curLeader = draft.leader !== undefined ? draft.leader : t.leader || 'Walk Nepal Walk Guide';
    const curReason = draft.cancellation_reason !== undefined ? draft.cancellation_reason : t.data?.cancellation_reason || '';

    const isCancelling = curStatus === 'Cancelled';

    setSavingRowIds((prev) => ({ ...prev, [t.id]: true }));
    try {
      await onUpdateTrekExecution(t.id, {
        capacity: curCapacity,
        leader: curLeader,
        data: {
          ...t.data,
          is_cancelled: isCancelling,
          cancellation_reason: isCancelling ? curReason : '',
          execution_status: curStatus,
        },
      });

      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });

      setJustSavedRowIds((prev) => ({ ...prev, [t.id]: true }));
      setTimeout(() => {
        setJustSavedRowIds((prev) => ({ ...prev, [t.id]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to update event execution:', err);
    } finally {
      setSavingRowIds((prev) => ({ ...prev, [t.id]: false }));
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Execution Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold mb-1">
            <span>Total Events</span>
            <Compass className="w-4 h-4 text-[#E08828]" />
          </div>
          <div className="text-2xl font-black text-[#1F1F1F]">{treks.length}</div>
          <div className="text-[11px] text-[#8B8680] mt-0.5">Scheduled Himalayan hikes</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1">
            <span>Active &amp; Open</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950">{activeCount}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Accepting registrations</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-700 mb-1">
            <span>Sold Out / Closed</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950">{fullCount}</div>
          <div className="text-[11px] text-purple-700 mt-0.5">At max capacity</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 mb-1">
            <span>Cancelled Hikes</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-950">{cancelledCount}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Logistics halted</div>
        </div>
      </div>

      {/* Control Panel: Search & Refresh */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] shadow-2xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8B8680] absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search event execution by hike title or number..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] placeholder-[#8B8680] focus:bg-white focus:outline-none focus:border-[#E08828]"
          />
        </div>

        <button
          onClick={onRefresh}
          className="p-2.5 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] rounded-xl text-[#5A5551] transition-colors cursor-pointer"
          title="Refresh Events"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E08828]' : ''}`} />
        </button>
      </div>

      {/* Events Execution Table */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#F0EBE5] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#1F1F1F] tracking-tight">Event Execution Roster</h3>
            <p className="text-[11px] text-[#8B8680] mt-0.5">
              Showing {filteredTreks.length} event(s) • Inline status, leader assignment &amp; capacity controls
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-[#E08828]" />
          </div>
        ) : filteredTreks.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Mountain className="w-10 h-10 text-[#D8D2C9] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#5A5551]">No events found matching search criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#F0EBE5] text-[10px] font-extrabold uppercase text-[#5A5551] tracking-wider">
                  <th className="py-3 px-4 min-w-[220px]">Hike Event &amp; Date</th>
                  <th className="py-3 px-3 w-[160px]">Status</th>
                  <th className="py-3 px-3 min-w-[180px]">Occupancy &amp; Max Seats</th>
                  <th className="py-3 px-3 min-w-[180px]">Assigned Lead Guide</th>
                  <th className="py-3 px-3 min-w-[200px]">Cancellation Reason</th>
                  <th className="py-3 px-4 w-[180px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE5]">
                {filteredTreks.map((t) => {
                  const draft = rowDrafts[t.id] || {};

                  const curStatus =
                    draft.status !== undefined
                      ? draft.status
                      : t.data?.is_cancelled
                      ? 'Cancelled'
                      : t.participants >= t.capacity
                      ? 'Registration Closed'
                      : 'Active';

                  const curCapacity = draft.capacity !== undefined ? draft.capacity : t.capacity || 25;
                  const curLeader = draft.leader !== undefined ? draft.leader : t.leader || 'Walk Nepal Walk Guide';
                  const curReason = draft.cancellation_reason !== undefined ? draft.cancellation_reason : t.data?.cancellation_reason || '';

                  const isCancelled = curStatus === 'Cancelled';
                  const pct = Math.min(Math.round((t.participants / (Number(curCapacity) || 1)) * 100), 100);

                  const isDirty = Object.keys(draft).length > 0;
                  const isSavingThisRow = !!savingRowIds[t.id];
                  const isRowJustSaved = !!justSavedRowIds[t.id];

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-[#FAF8F5] transition-colors ${
                        isCancelled ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Hike Event & Date */}
                      <td className="py-3 px-4 align-middle">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#E08828] uppercase tracking-wider block">
                            Hike #{t.hike_number || t.id}
                          </span>
                          <span className="font-extrabold text-xs text-[#1F1F1F] block">{t.name}</span>
                          <div className="flex items-center gap-2 text-[11px] text-[#8B8680]">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#8B8680]" />
                              {t.date || 'TBD Date'}
                            </span>
                            <span>•</span>
                            <span>{t.days} Day(s)</span>
                          </div>
                        </div>
                      </td>

                      {/* Execution Status Dropdown */}
                      <td className="py-3 px-3 align-middle">
                        <select
                          value={curStatus}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            handleRowChange(t.id, 'status', val);
                          }}
                          className={`w-full p-2 rounded-xl text-xs font-extrabold border focus:outline-none cursor-pointer ${
                            curStatus === 'Active'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : curStatus === 'Registration Closed'
                              ? 'bg-purple-50 border-purple-300 text-purple-900'
                              : curStatus === 'Completed'
                              ? 'bg-blue-50 border-blue-300 text-blue-900'
                              : 'bg-rose-50 border-rose-300 text-rose-900'
                          }`}
                        >
                          <option value="Active">Active (Open)</option>
                          <option value="Registration Closed">Reg Closed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled Event</option>
                        </select>
                      </td>

                      {/* Occupancy & Capacity Input */}
                      <td className="py-3 px-3 align-middle">
                        <div className="space-y-1.5 min-w-[150px]">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F1F1F]">
                            <span className="text-[#5A5551]">{t.participants} /</span>
                            <input
                              type="number"
                              value={curCapacity}
                              onChange={(e) => handleRowChange(t.id, 'capacity', e.target.value)}
                              min={1}
                              max={100}
                              className="w-16 p-1 bg-[#F9F7F5] border border-[#E5E1DB] rounded-lg text-xs font-black text-[#1F1F1F] text-center focus:bg-white focus:outline-none focus:border-[#E08828]"
                              title="Max Seats Capacity"
                            />
                            <span className="text-[11px] text-[#8B8680]">Seats</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-[#EFEAE4] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCancelled
                                  ? 'bg-rose-500'
                                  : pct >= 100
                                  ? 'bg-purple-600'
                                  : 'bg-[#7ABA42]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Assigned Lead Guide */}
                      <td className="py-3 px-3 align-middle">
                        <input
                          type="text"
                          value={curLeader}
                          onChange={(e) => handleRowChange(t.id, 'leader', e.target.value)}
                          placeholder="Guide name & contact..."
                          className="w-full p-2 bg-[#F9F7F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] placeholder-[#8B8680] focus:bg-white focus:outline-none focus:border-[#E08828]"
                        />
                      </td>

                      {/* Cancellation Reason */}
                      <td className="py-3 px-3 align-middle">
                        {isCancelled ? (
                          <input
                            type="text"
                            value={curReason}
                            onChange={(e) => handleRowChange(t.id, 'cancellation_reason', e.target.value)}
                            placeholder="Reason for cancellation..."
                            className="w-full p-2 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 placeholder-rose-400 focus:bg-white focus:outline-none focus:border-rose-600"
                          />
                        ) : (
                          <span className="text-xs text-[#8B8680] italic px-1">Active / No Cancellation</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectViewRoster(t.hike_number || t.id)}
                            className="px-2.5 py-2 bg-[#F9F7F5] hover:bg-[#EFEAE4] text-[#1F1F1F] font-bold text-xs rounded-xl border border-[#E5E1DB] flex items-center gap-1 transition-all cursor-pointer"
                            title="View Hike Roster"
                          >
                            <Users className="w-3.5 h-3.5 text-[#E08828]" />
                            <span>Roster ({t.participants})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveRow(t)}
                            disabled={isSavingThisRow}
                            className={`px-3 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                              isDirty
                                ? 'bg-[#E08828] hover:bg-[#D07717] text-white animate-pulse'
                                : isRowJustSaved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#1F1F1F] hover:bg-black text-white'
                            }`}
                            title="Save Event Logistics"
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
                                <Save className="w-3.5 h-3.5 text-[#7ABA42]" />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
