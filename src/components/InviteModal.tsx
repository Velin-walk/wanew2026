import React, { useState } from 'react';
import { Trek } from '../types';
import { X, Share2, Copy, Check, MessageCircle } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrek?: Trek | null;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  selectedTrek,
}) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = selectedTrek
    ? `${window.location.origin}/?trek=${encodeURIComponent(selectedTrek.id)}`
    : window.location.origin;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join me on ${selectedTrek ? selectedTrek.name : 'Walk Nepal Walk'}!`,
          text: `Reserve your spot on the Himalayan roster for ${selectedTrek?.name || 'Walk Nepal Walk'}!`,
          url: shareUrl,
        });
      } catch (err) {
        // user dismissed or cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Join our trek on Walk Nepal Walk: ${selectedTrek ? selectedTrek.name : 'Himalayan Expedition'}! Reserve your slot: ${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-invite-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-all"
    >
      <div
        id="modal-invite-sheet"
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Mobile drag handle indicator */}
        <div className="w-12 h-1.5 rounded-full bg-[#E5E1DB] mx-auto mb-2 sm:hidden shrink-0" />

        <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5]">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#7ABA42]" />
            <h3 className="text-base font-bold text-[#1F1F1F]">
              Share Trek Event
            </h3>
          </div>
          <button
            type="button"
            id="close-invite-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#8B8680] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F9F7F5]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar space-y-4 py-3">
          {selectedTrek && (
            <div className="p-3.5 bg-[#F9F7F5] rounded-2xl border border-[#F0EBE5]">
              <span className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider block mb-1">
                Trek Details:
              </span>
              <h4 className="text-sm font-bold text-[#1F1F1F]">
                {selectedTrek.name}
              </h4>
              <p className="text-xs text-[#5A5551] mt-0.5">
                {selectedTrek.days} Days • Departure: {selectedTrek.date}
              </p>
            </div>
          )}

          <div className="space-y-3">
              <span className="text-xs font-semibold text-[#5A5551] block">
                Send this event link to other hikers:
              </span>
              
              <div className="flex items-center gap-2 p-2 bg-[#F9F7F5] rounded-xl border border-[#E5E1DB]">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent border-none text-xs text-[#1F1F1F] focus:outline-none select-all truncate pl-1 font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-bold text-[#7ABA42] hover:text-[#6CA838] px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E1DB] shadow-xs hover:bg-emerald-50 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Share Channels Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-[#1F1F1F] hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Sheet</span>
                </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
