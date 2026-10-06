import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  AlertTriangle,
  Info,
  Calendar,
  Wrench,
  ArrowRight,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import {
  SiteNotice,
  fetchSiteNotice,
  markNoticeSeen,
  shouldPopNotice,
} from '../services/noticeService';

interface NoticeBoardModalProps {
  manualOpen?: boolean;
  onCloseManual?: () => void;
}

export const NoticeBoardModal: React.FC<NoticeBoardModalProps> = ({
  manualOpen,
  onCloseManual,
}) => {
  const [notice, setNotice] = useState<SiteNotice | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const checkAndTriggerNotice = async () => {
      const activeNotice = await fetchSiteNotice(true);
      if (activeNotice) {
        setNotice(activeNotice);
        if (shouldPopNotice(activeNotice)) {
          // Delay popup by 1.2s so initial page paint is calm and assets are ready
          timer = setTimeout(() => {
            setIsOpen(true);
          }, 1200);
        }
      }
    };

    checkAndTriggerNotice();

    // Listen for live updates dispatched by Admin Panel or other components
    const handleNoticeUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<SiteNotice>;
      if (customEvt.detail) {
        setNotice(customEvt.detail);
        if (shouldPopNotice(customEvt.detail)) {
          setIsOpen(true);
        }
      } else {
        checkAndTriggerNotice();
      }
    };

    window.addEventListener('wnw-notice-updated', handleNoticeUpdated);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('wnw-notice-updated', handleNoticeUpdated);
    };
  }, []);

  // Sync with manual open if requested externally
  useEffect(() => {
    if (manualOpen !== undefined) {
      if (manualOpen) {
        fetchSiteNotice().then((n) => {
          if (n) setNotice(n);
          setIsOpen(true);
        });
      } else {
        setIsOpen(false);
      }
    }
  }, [manualOpen]);

  const handleDismiss = () => {
    if (notice?.updatedAt) {
      markNoticeSeen(notice.updatedAt);
    }
    setIsOpen(false);
    if (onCloseManual) onCloseManual();
  };

  const handleCtaClick = () => {
    if (!notice?.ctaLink) {
      handleDismiss();
      return;
    }

    const link = notice.ctaLink.trim();
    handleDismiss();

    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (link.startsWith('#')) {
      const el = document.querySelector(link);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.location.href = link;
    }
  };

  if (!isOpen || !notice || !notice.enabled) return null;

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'urgent':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          badgeText: 'Urgent Announcement',
          headerBg: 'bg-gradient-to-r from-rose-50 to-orange-50',
          btnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
        };
      case 'event':
        return {
          icon: <Calendar className="w-5 h-5 text-[#E08828]" />,
          badgeClass: 'bg-amber-50 text-[#C06F17] border-amber-200',
          badgeText: 'Trek & Event Alert',
          headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50',
          btnClass: 'bg-[#E08828] hover:bg-[#C06F17] text-white shadow-amber-200',
        };
      case 'maintenance':
        return {
          icon: <Wrench className="w-5 h-5 text-purple-600" />,
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          badgeText: 'Service Update',
          headerBg: 'bg-gradient-to-r from-purple-50 to-indigo-50',
          btnClass: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-600" />,
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
          badgeText: 'Official Notice',
          headerBg: 'bg-gradient-to-r from-sky-50 to-blue-50',
          btnClass: 'bg-[#1F1F1F] hover:bg-neutral-800 text-white shadow-stone-200',
        };
    }
  };

  const config = getTypeConfig(notice.type);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E5E1DB] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header Strip with notice icon and badge */}
        <div className={`px-6 py-5 border-b border-[#E5E1DB] ${config.headerBg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-2xl shadow-xs border border-black/5 flex items-center justify-center">
              {config.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.badgeClass}`}>
                  {config.badgeText}
                </span>
                <span className="text-[10px] font-medium text-[#8B8680]">
                  Walk Nepal Walk
                </span>
              </div>
              <h3 id="notice-modal-title" className="text-base sm:text-lg font-black text-[#1F1F1F] tracking-tight mt-0.5">
                {notice.title || 'Official Notice'}
              </h3>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Close notice"
            className="p-2 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-white/70 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          <div className="text-xs sm:text-sm text-[#4A4541] leading-relaxed whitespace-pre-line font-medium">
            {notice.message}
          </div>

          {notice.expiresAt && (
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-[#8B8680]">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Valid until: {new Date(notice.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 bg-[#FAF8F5] border-t border-[#E5E1DB] flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {notice.ctaText && notice.ctaLink && (
            <button
              onClick={handleCtaClick}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${config.btnClass}`}
            >
              <span>{notice.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-[#F2ECE4] border border-[#D5CEC5] text-[#1F1F1F] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Got it, Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
