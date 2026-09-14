import React, { useState } from 'react';
import {
  SavedHikeRecord,
  generateWhatsAppSummary
} from '../../data/defaultItineraryTemplate';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Globe,
  Radio,
  Eye
} from 'lucide-react';

interface ShareHikeModalProps {
  hike: SavedHikeRecord;
  onClose: () => void;
  onStatusChange?: (newStatus: 'draft' | 'published' | 'archived') => void;
  onPreview?: () => void;
}

export const ShareHikeModal: React.FC<ShareHikeModalProps> = ({
  hike,
  onClose,
  onStatusChange,
  onPreview,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Generate web link based on current origin or hike number
  const shareableUrl = `${window.location.origin}/#itinerary-${hike.id || hike.hikeNumber || 'preview'}`;
  const whatsappSummary = generateWhatsAppSummary(hike);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappSummary);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2200);
    } catch (e) {
      console.error('Failed to copy WhatsApp summary:', e);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    const encoded = encodeURIComponent(whatsappSummary);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div
      id="share-hike-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="share-hike-modal-content"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E5E1DB] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 bg-[#FAF8F5] border-b border-[#EFEAE4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E08828]/10 flex items-center justify-center text-[#E08828]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#1F1F1F] text-white">
                  Hike #{hike.data.hikeNumber || hike.hikeNumber || 'TBA'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    hike.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {hike.status === 'published' ? '● Published Live' : '● Draft'}
                </span>
              </div>
              <h3 className="text-base font-black text-[#1F1F1F] mt-1 leading-tight line-clamp-1">
                {hike.title}
              </h3>
            </div>
          </div>

          <button
            id="btn-close-share-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#EFEAE4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Publish Status Banner */}
          {onStatusChange && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-[#F9F7F5] rounded-2xl border border-[#E5E1DB]">
              <div className="flex items-center gap-2.5">
                <Radio className={`w-4 h-4 ${hike.status === 'published' ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div>
                  <div className="text-xs font-bold text-[#1F1F1F]">Publication Visibility</div>
                  <div className="text-[11px] text-[#8B8680]">
                    {hike.status === 'published'
                      ? 'Active and visible on the live catalog for participants.'
                      : 'Saved in draft mode. Visible only to admins.'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => onStatusChange('draft')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    hike.status === 'draft'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F0EBE5]'
                  }`}
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange('published')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    hike.status === 'published'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F0EBE5]'
                  }`}
                >
                  Published
                </button>
              </div>
            </div>
          )}

          {/* Option 1: WhatsApp Group & Chat Broadcast Copier */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1F1F1F]">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
                <span>WhatsApp Group Broadcast Text</span>
              </div>
              <span className="text-[11px] text-[#8B8680]">Ready to copy & paste</span>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={7}
                value={whatsappSummary}
                className="w-full font-mono text-xs p-3.5 bg-[#FAF8F5] text-[#2C2926] rounded-2xl border border-[#E5E1DB] focus:outline-none select-all resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-copy-whatsapp-text"
                type="button"
                onClick={handleCopyWhatsApp}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  copiedWhatsApp
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm'
                }`}
              >
                {copiedWhatsApp ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied WhatsApp Message!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy WhatsApp Summary</span>
                  </>
                )}
              </button>

              <button
                id="btn-open-whatsapp-direct"
                type="button"
                onClick={handleOpenWhatsAppDirect}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-[#E5E1DB] text-[#25D366] hover:bg-[#F9F7F5] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Send directly via WhatsApp Web/App"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Open App</span>
              </button>
            </div>
          </div>

          {/* Option 2: Public Itinerary Web Link */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1F1F1F]">
                <Globe className="w-4 h-4 text-[#E08828]" />
                <span>Public Web Link</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 text-xs px-3.5 py-2.5 bg-[#FAF8F5] text-[#5A5551] rounded-xl border border-[#E5E1DB] focus:outline-none select-all"
              />

              <button
                id="btn-copy-web-link"
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1F1F1F] hover:bg-black text-white'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>

              {onPreview && (
                <button
                  id="btn-preview-from-share"
                  type="button"
                  onClick={onPreview}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] text-[#1F1F1F] hover:bg-[#F0EBE5] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Open Full Page Preview"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF8F5] border-t border-[#EFEAE4] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white border border-[#E5E1DB] hover:bg-[#F9F7F5] text-[#1F1F1F] rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
