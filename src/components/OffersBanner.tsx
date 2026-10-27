import React, { useState, useEffect, useCallback } from 'react';
import { Tag, ChevronLeft, ChevronRight, X, Eye, Megaphone, Clock } from 'lucide-react';
import { apiFetch } from '../services/api';
import { OFFER_TREK_ID, OFFERS_STORAGE_KEY, OfferItem, getOfferThemeStyles, parseOfferMetadata } from './admin/OffersManager';

export const OffersBanner: React.FC = () => {
  const isNotExpired = (item: OfferItem) => {
    const meta = parseOfferMetadata(item);
    const expStr = meta.expiresAt || item.expiresAt;
    if (!expStr) return true;
    const expTime = new Date(expStr).getTime();
    return !isNaN(expTime) && expTime > Date.now();
  };

  const [offers, setOffers] = useState<OfferItem[]>(() => {
    try {
      const cached = localStorage.getItem(OFFERS_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item) => item && item.url)
            .map((item) => {
              const meta = parseOfferMetadata(item);
              return {
                ...item,
                color: meta.color,
                expiresAt: meta.expiresAt || item.expiresAt,
              };
            })
            .filter(isNotExpired);
        }
      }
    } catch {}
    return [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await apiFetch(`trek_photos?trekId=${encodeURIComponent(OFFER_TREK_ID)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          const validOffers = (json.data as OfferItem[])
            .filter((item) => item && item.id && item.url)
            .map((item) => {
              const meta = parseOfferMetadata(item);
              return {
                ...item,
                color: meta.color,
                expiresAt: meta.expiresAt || item.expiresAt,
              };
            })
            .filter(isNotExpired)
            .sort((a, b) => {
              const tA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
              const tB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
              return tB - tA;
            });
          setOffers(validOffers);
          try {
            localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(validOffers));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('OffersBanner fetch notice:', err);
    }
  }, []);

  useEffect(() => {
    fetchOffers();

    // Check every 30 seconds for auto-expiration of deadlines
    const timer = setInterval(() => {
      setOffers((prev) => prev.filter(isNotExpired));
    }, 30000);

    const handleOffersUpdated = () => {
      fetchOffers();
    };

    window.addEventListener('wnw-offers-updated', handleOffersUpdated);
    return () => {
      clearInterval(timer);
      window.removeEventListener('wnw-offers-updated', handleOffersUpdated);
    };
  }, [fetchOffers]);

  const activeOffers = offers.filter(isNotExpired);

  if (dismissed || activeOffers.length === 0) {
    return null;
  }

  const currentOffer = activeOffers[currentIndex] || activeOffers[0];
  const meta = parseOfferMetadata(currentOffer);
  const currentColor = meta.color || currentOffer.color || 'green';
  const currentExpiresAt = meta.expiresAt || currentOffer.expiresAt;
  const theme = getOfferThemeStyles(currentColor);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeOffers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeOffers.length) % activeOffers.length);
  };

  const formatDeadline = (expStr?: string) => {
    if (!expStr) return null;
    const dt = new Date(expStr);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full my-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`relative ${theme.cardBg} text-white rounded-2xl p-3.5 sm:p-5 shadow-md border ${theme.border} overflow-hidden`}>
        {/* Background Ambient Glow & Sparkle accents */}
        <div className={`absolute -top-12 -right-12 w-48 h-48 ${theme.glowBg1} rounded-full blur-2xl pointer-events-none`} />
        <div className={`absolute -bottom-12 -left-12 w-48 h-48 ${theme.glowBg2} rounded-full blur-2xl pointer-events-none`} />

        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border backdrop-blur-md text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-2xs ${theme.badgeBg}`}>
              <Megaphone className={`w-3.5 h-3.5 ${theme.badgeIcon} animate-pulse`} />
              <span>Special Offer &amp; Flashcard</span>
            </span>

            {currentExpiresAt && formatDeadline(currentExpiresAt) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1F1F1F]/40 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold">
                <Clock className="w-3 h-3 text-amber-300" />
                <span>Expires: {formatDeadline(currentExpiresAt)}</span>
              </span>
            )}

            {activeOffers.length > 1 && (
              <span className="text-[10px] font-bold opacity-90">
                ({currentIndex + 1} of {activeOffers.length})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg bg-black/30 hover:bg-black/60 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Area: Natural Unframed Image + Text */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
          {/* Uploaded Unframed Offer Image */}
          {currentOffer.url && (
            <div
              className="relative w-full sm:max-w-xs md:max-w-sm rounded-xl overflow-hidden cursor-pointer group shrink-0 flex items-center justify-center bg-black/20"
              onClick={() => setLightboxUrl(currentOffer.url)}
              title="Click to view full image"
            >
              <img
                src={currentOffer.url}
                alt={currentOffer.caption || 'Special Offer'}
                className="w-full h-auto max-h-72 object-contain rounded-xl group-hover:scale-102 transition-transform duration-300"
              />
              <div className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/60 backdrop-blur-xs text-white opacity-80 group-hover:opacity-100 transition-opacity">
                <Eye className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Uploaded Offer Text / Caption */}
          <div className="flex-1 space-y-2 text-left w-full">
            <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${theme.textMain || 'text-white font-bold'}`}>
              {currentOffer.caption || 'Special announcement from Walk Nepal Walk.'}
            </p>

            <div className="flex items-center justify-between pt-1">
              <span className={`text-[10px] font-bold ${theme.textAccent}`}>
                Published {new Date(currentOffer.uploadedAt).toLocaleDateString()}
              </span>

              {/* Carousel Controls if multiple offers */}
              {activeOffers.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
                    title="Previous offer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {activeOffers.map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          idx === currentIndex ? `${theme.dotActive} w-3` : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-1 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
                    title="Next offer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for zooming offer image */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={lightboxUrl}
              alt="Offer full view"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
