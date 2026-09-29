import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  Award,
  ArrowUpRight,
  PieChart,
  CheckCircle,
  FileSpreadsheet,
  Calendar,
  Layers
} from 'lucide-react';
import { Trek } from '../../types';
import { AdminRegistration } from './BookingsManager';

interface SalesAnalyticsManagerProps {
  treks: Trek[];
  registrations: AdminRegistration[];
  onSelectTrekRoster: (hikeNum: string) => void;
}

export const SalesAnalyticsManager: React.FC<SalesAnalyticsManagerProps> = ({
  treks,
  registrations,
  onSelectTrekRoster,
}) => {
  // Helper to extract numerical price from price string (e.g., "NPR 1,500" -> 1500)
  const parsePrice = (priceStr?: string): number => {
    if (!priceStr) return 1500;
    const num = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 1500 : num;
  };

  // Compute revenue metrics
  let totalProjectedRevenue = 0;
  let totalCollectedRevenue = 0;
  let totalConfirmedPax = 0;

  const normStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Map of trek ID to revenue and pax counts
  const trekSalesMap: Record<
    string,
    { projectedRev: number; collectedRev: number; confirmedPax: number; totalRegs: number }
  > = {};

  registrations.forEach((reg) => {
    const status = (reg.status || 'Confirmed').toLowerCase();
    if (status.includes('cancelled')) return;

    const regDateNorm = normStr(reg.trek_date);
    const regNameNorm = normStr(reg.trek_name);
    const regHikeNum = (reg.hike_number || '').trim();
    const regTrekId = (reg.trek_id || '').trim();

    const matchingTrek =
      treks.find((t) => {
        const tDateNorm = normStr(t.date);
        if (tDateNorm && regDateNorm && tDateNorm !== regDateNorm) return false;
        if (regTrekId && t.id === regTrekId) return true;
        if (regHikeNum && regHikeNum !== 'TBD' && t.hike_number === regHikeNum) return true;
        if (regNameNorm && normStr(t.name) === regNameNorm) return true;
        return false;
      }) ||
      treks.find(
        (t) =>
          (regHikeNum && regHikeNum !== 'TBD' && t.hike_number === regHikeNum) ||
          (regTrekId && t.id === regTrekId)
      );

    const key = matchingTrek?.id || (regHikeNum && regHikeNum !== 'TBD' ? regHikeNum : regTrekId || reg.trek_name || 'unknown');
    if (!trekSalesMap[key]) {
      trekSalesMap[key] = { projectedRev: 0, collectedRev: 0, confirmedPax: 0, totalRegs: 0 };
    }

    const companionCount = Array.isArray(reg.team_members) ? reg.team_members.length : 0;
    const pax = Math.max(Number(reg.paxCount) || 1, 1 + companionCount);
    const unitPrice = parsePrice(typeof matchingTrek?.price === 'string' ? matchingTrek.price : String(matchingTrek?.price || '1500'));

    const regProjected = unitPrice * pax;
    let regCollected = Number(reg.paid_amount) || 0;

    if (regCollected <= 0) {
      const payStatus = (reg.payment_status || '').toLowerCase();
      if (payStatus === 'fully paid' || payStatus === 'paid') {
        regCollected = regProjected;
      } else if (payStatus === 'deposit paid' || payStatus === 'partial') {
        regCollected = Math.round(regProjected * 0.4);
      }
    }

    trekSalesMap[key].projectedRev += regProjected;
    trekSalesMap[key].collectedRev += regCollected;
    trekSalesMap[key].confirmedPax += pax;
    trekSalesMap[key].totalRegs += 1;

    totalProjectedRevenue += regProjected;
    totalCollectedRevenue += regCollected;
    totalConfirmedPax += pax;
  });

  const conversionRate =
    registrations.length > 0
      ? Math.round(
          (registrations.filter((r) => (r.status || 'Confirmed') === 'Confirmed').length /
            registrations.length) *
            100
        )
      : 100;

  const avgTicket = totalConfirmedPax > 0 ? Math.round(totalProjectedRevenue / totalConfirmedPax) : 1500;

  return (
    <div className="w-full space-y-6">
      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold">
            <span>Projected Revenue</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1F1F1F]">
            NPR {totalProjectedRevenue.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>From {totalConfirmedPax} confirmed seat bookings</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold">
            <span>Collected Cash</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-950">
            NPR {totalCollectedRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8B8680]">
            {totalProjectedRevenue > 0
              ? `${Math.round((totalCollectedRevenue / totalProjectedRevenue) * 100)}% of total projected`
              : 'Deposits & full payments'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold">
            <span>Roster Conversion</span>
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-950">{conversionRate}%</div>
          <div className="text-[11px] text-[#8B8680]">Confirmed / total applications</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#8B8680] text-xs font-semibold">
            <span>Avg Hiker Ticket</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-[#E08828]" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1F1F1F]">
            NPR {avgTicket.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8B8680]">Average spend per trekker</div>
        </div>
      </div>

      {/* Trek Financial Performance Breakdown */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#F0EBE5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-[#1F1F1F] tracking-tight">
              Trek Sales & Occupancy Breakdown
            </h3>
            <p className="text-xs text-[#8B8680] mt-0.5">
              Financial performance, capacity fill rate, and seat revenues per event
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E08828] bg-[#FFF9F2] px-3 py-1.5 rounded-xl border border-[#FFE7CC]">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{treks.length} Treks Monitored</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#F0EBE5] text-[#5A5551] font-extrabold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Trek & Hike #</th>
                <th className="p-4">Ticket Price</th>
                <th className="p-4">Occupancy</th>
                <th className="p-4">Projected Revenue</th>
                <th className="p-4">Execution Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE5]">
              {treks.map((t) => {
                const priceStr = typeof t.price === 'string' ? t.price : String(t.price || '1500');
                const metrics = trekSalesMap[t.id] || (t.hike_number && t.hike_number !== 'TBD' ? trekSalesMap[t.hike_number] : undefined) || {
                  projectedRev: (t.participants || 0) * parsePrice(priceStr),
                  collectedRev: 0,
                  confirmedPax: t.participants || 0,
                  totalRegs: t.participants || 0,
                };

                const cap = t.capacity || 25;
                const pax = t.participants || metrics.confirmedPax;
                const pct = Math.min(Math.round((pax / cap) * 100), 100);
                const isCancelled = !!t.data?.is_cancelled || !!t.is_cancelled;

                return (
                  <tr key={t.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="p-4 font-bold text-[#1F1F1F]">
                      <div className="text-xs text-[#E08828] font-extrabold">Hike #{t.hike_number || t.id}</div>
                      <div className="text-sm font-black text-[#1F1F1F]">{t.name}</div>
                      <div className="text-[10px] text-[#8B8680] font-normal">{t.date || 'TBD Date'}</div>
                    </td>

                    <td className="p-4 font-bold text-[#5A5551]">
                      {t.price || 'NPR 1,500'}
                    </td>

                    <td className="p-4">
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span>{pax}/{cap} seats</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-[#EFEAE4] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
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

                    <td className="p-4 font-extrabold text-[#1F1F1F]">
                      NPR {metrics.projectedRev.toLocaleString()}
                    </td>

                    <td className="p-4">
                      {isCancelled ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                          Cancelled
                        </span>
                      ) : pct >= 100 ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                          Sold Out
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => onSelectTrekRoster(t.id || t.hike_number)}
                        className="px-3 py-1.5 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] text-[#1F1F1F] font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Roster ({pax})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
