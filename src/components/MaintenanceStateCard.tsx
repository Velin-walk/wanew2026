import React from 'react';
import { Wrench, ShieldAlert, ArrowLeft, Home, Sparkles, ShieldCheck } from 'lucide-react';

interface MaintenanceStateCardProps {
  title?: string;
  message?: string;
  sectionName?: string;
  onReturnHome?: () => void;
  isAdmin?: boolean;
  onBypassAdmin?: () => void;
}

export const MaintenanceStateCard: React.FC<MaintenanceStateCardProps> = ({
  title = 'Under Scheduled Maintenance',
  message = 'This section is currently undergoing maintenance and upgrades. Please check back soon!',
  sectionName,
  onReturnHome,
  isAdmin = false,
  onBypassAdmin,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-[#E5E1DB] shadow-xs text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
      {/* Admin Preview Header if user is admin */}
      {isAdmin && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs font-bold text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Admin Preview: Hidden from public visitors</span>
          </div>
          {onBypassAdmin && (
            <button
              onClick={onBypassAdmin}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-xs active:scale-95"
            >
              View Anyway
            </button>
          )}
        </div>
      )}

      {/* Decorative Icon */}
      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FAF8F5] border border-[#EFEAE4] flex items-center justify-center text-[#E08828] shadow-inner">
        <Wrench className="w-8 h-8 animate-pulse text-[#E08828]" />
      </div>

      <div className="space-y-2">
        {sectionName && (
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#FAF8F5] text-[#8B8680] border border-[#EFEAE4]">
            {sectionName}
          </span>
        )}
        <h3 className="text-xl sm:text-2xl font-black text-[#1F1F1F] tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#5A5551] max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        {onReturnHome && (
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Upcoming Hikes</span>
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-[#F0EBE5] text-[11px] text-[#8B8680] flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[#E08828]" />
        <span>Walk Nepal Walk • System Maintenance</span>
      </div>
    </div>
  );
};
