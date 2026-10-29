import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tag,
  Upload,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Link as LinkIcon,
  Sparkles,
  Eye,
  Megaphone,
  Calendar,
  Palette,
} from 'lucide-react';
import { apiFetch, uploadImageToR2WithProgress } from '../../services/api';

export const OFFER_TREK_ID = 'OFFER_FLASHCARD';
export const OFFERS_STORAGE_KEY = 'wnw_offers_cache';

export interface OfferItem {
  id: string;
  trekId: string;
  hikeNumber?: string;
  trekName?: string;
  url: string;
  publicId?: string;
  uploadedBy: string;
  userUid: string;
  uploadedAt: string;
  expiresAt?: string;
  color?: string;
  caption?: string;
}

export const cleanOfferCaption = (caption?: string): string => {
  if (!caption) return '';
  return caption
    .replace(/\[color:[a-z]+\]/gi, '')
    .replace(/\[expires:[^\]]+\]/gi, '')
    .trim();
};

export const parseOfferMetadata = (item: OfferItem): { color: string; expiresAt?: string } => {
  let color = item.color || 'orange';
  let expiresAt = item.expiresAt;

  if (item.publicId) {
    try {
      if (item.publicId.startsWith('{')) {
        const meta = JSON.parse(item.publicId);
        if (meta.color) color = meta.color;
        if (meta.expiresAt) expiresAt = meta.expiresAt;
      }
    } catch {}
  }

  if (item.hikeNumber && item.hikeNumber.includes('|')) {
    const parts = item.hikeNumber.split('|');
    if (parts[1]) color = parts[1];
    if (parts[2] && !expiresAt) expiresAt = parts[2];
  }

  if (item.caption) {
    const colorMatch = item.caption.match(/\[color:([a-z]+)\]/i);
    if (colorMatch && colorMatch[1]) {
      color = colorMatch[1].toLowerCase();
    }
    const expiresMatch = item.caption.match(/\[expires:([^\]]+)\]/i);
    if (expiresMatch && expiresMatch[1] && !expiresAt) {
      expiresAt = expiresMatch[1];
    }
  }

  return { color: color || 'orange', expiresAt };
};

export const getOfferThemeStyles = (color?: string) => {
  const normColor = (color || 'orange').toLowerCase();
  switch (normColor) {
    case 'blue':
      return {
        cardBg: 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white',
        border: 'border-sky-300/60 shadow-sky-500/20',
        badgeBg: 'bg-white/20 text-white border-white/30 backdrop-blur-md',
        badgeIcon: 'text-sky-100',
        textMain: 'text-white font-bold',
        textAccent: 'text-sky-100',
        glowBg1: 'bg-sky-300/30',
        glowBg2: 'bg-indigo-300/30',
        dotActive: 'bg-white',
      };
    case 'green':
      return {
        cardBg: 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white',
        border: 'border-emerald-300/60 shadow-emerald-500/20',
        badgeBg: 'bg-white/20 text-white border-white/30 backdrop-blur-md',
        badgeIcon: 'text-emerald-100',
        textMain: 'text-white font-bold',
        textAccent: 'text-emerald-100',
        glowBg1: 'bg-emerald-300/30',
        glowBg2: 'bg-teal-300/30',
        dotActive: 'bg-white',
      };
    case 'red':
      return {
        cardBg: 'bg-gradient-to-r from-rose-500 via-red-600 to-rose-600 text-white',
        border: 'border-rose-300/60 shadow-rose-500/20',
        badgeBg: 'bg-white/20 text-white border-white/30 backdrop-blur-md',
        badgeIcon: 'text-rose-100',
        textMain: 'text-white font-bold',
        textAccent: 'text-rose-100',
        glowBg1: 'bg-rose-300/30',
        glowBg2: 'bg-red-300/30',
        dotActive: 'bg-white',
      };
    case 'yellow':
      return {
        cardBg: 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-stone-950',
        border: 'border-yellow-300/80 shadow-yellow-500/20',
        badgeBg: 'bg-stone-950/80 text-yellow-300 border-yellow-200/40 backdrop-blur-md',
        badgeIcon: 'text-yellow-300',
        textMain: 'text-stone-950 font-black',
        textAccent: 'text-stone-800 font-bold',
        glowBg1: 'bg-yellow-200/50',
        glowBg2: 'bg-amber-200/40',
        dotActive: 'bg-stone-950',
      };
    case 'purple':
      return {
        cardBg: 'bg-gradient-to-r from-purple-500 via-violet-600 to-indigo-600 text-white',
        border: 'border-purple-300/60 shadow-purple-500/20',
        badgeBg: 'bg-white/20 text-white border-white/30 backdrop-blur-md',
        badgeIcon: 'text-purple-100',
        textMain: 'text-white font-bold',
        textAccent: 'text-purple-100',
        glowBg1: 'bg-purple-300/30',
        glowBg2: 'bg-fuchsia-300/30',
        dotActive: 'bg-white',
      };
    case 'orange':
    default:
      return {
        cardBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white',
        border: 'border-amber-300/60 shadow-amber-500/20',
        badgeBg: 'bg-white/20 text-white border-white/30 backdrop-blur-md',
        badgeIcon: 'text-amber-100',
        textMain: 'text-white font-bold',
        textAccent: 'text-amber-100',
        glowBg1: 'bg-amber-300/30',
        glowBg2: 'bg-orange-300/30',
        dotActive: 'bg-white',
      };
  }
};

interface OffersManagerProps {
  currentUserEmail?: string;
}

export const OffersManager: React.FC<OffersManagerProps> = ({
  currentUserEmail,
}) => {
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [deadline, setDeadline] = useState('');
  const [cardColor, setCardColor] = useState<string>('orange');
  const [directUrl, setDirectUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNotExpired = (item: OfferItem) => {
    const meta = parseOfferMetadata(item);
    const expStr = meta.expiresAt || item.expiresAt;
    if (!expStr) return true;
    const expTime = new Date(expStr).getTime();
    return isNaN(expTime) || expTime > Date.now();
  };

  const fetchOffers = useCallback(async (forceFresh = true) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `trek_photos?trekId=${encodeURIComponent(OFFER_TREK_ID)}`,
        { forceFresh }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          const sorted = (json.data as OfferItem[])
            .filter((item) => item && item.id && item.url)
            .map((item) => {
              const meta = parseOfferMetadata(item);
              return {
                ...item,
                color: meta.color,
                expiresAt: meta.expiresAt || item.expiresAt,
              };
            })
            .sort((a, b) => {
              const tA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
              const tB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
              return tB - tA;
            });
          setOffers(sorted);
          try {
            localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(sorted));
          } catch {}
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Error fetching offers in admin:', err);
    }

    try {
      const cached = localStorage.getItem(OFFERS_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const enriched = parsed.map((item) => {
            const meta = parseOfferMetadata(item);
            return {
              ...item,
              color: meta.color,
              expiresAt: meta.expiresAt || item.expiresAt,
            };
          });
          setOffers(enriched);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOffers(true);
  }, [fetchOffers]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const handlePublishOffer = async () => {
    const sourceImage = selectedImage || directUrl.trim();
    if (!sourceImage) {
      setStatusMsg({
        text: 'Please select an image file or provide an image URL.',
        type: 'error',
      });
      return;
    }
    if (!offerText.trim()) {
      setStatusMsg({
        text: 'Please enter details/caption text for this offer.',
        type: 'error',
      });
      return;
    }

    setUploading(true);
    setStatusMsg(null);

    try {
      let finalImageUrl = sourceImage;
      let publicId = '';

      if (sourceImage.startsWith('data:') || sourceImage.startsWith('blob:')) {
        const blob = await dataUrlToBlob(sourceImage);
        const uploadData = await uploadImageToR2WithProgress(blob, 'offers');
        finalImageUrl = uploadData.url;
        publicId = uploadData.fileName || '';
      }

      const expiresAtIso = deadline ? new Date(deadline).toISOString() : '';
      const metaPayload = JSON.stringify({ color: cardColor, expiresAt: expiresAtIso });
      const encodedHikeNumber = `OFFER|${cardColor}|${expiresAtIso}`;
      const encodedCaption = `${offerText.trim()} [color:${cardColor}]${expiresAtIso ? ` [expires:${expiresAtIso}]` : ''}`;

      const newRecord: OfferItem = {
        id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trekId: OFFER_TREK_ID,
        hikeNumber: encodedHikeNumber,
        trekName: 'Special Offers & Announcements',
        url: finalImageUrl,
        publicId: metaPayload,
        uploadedBy: currentUserEmail || 'Admin',
        userUid: 'admin',
        uploadedAt: new Date().toISOString(),
        expiresAt: expiresAtIso || undefined,
        color: cardColor,
        caption: encodedCaption,
      };

      const saveRes = await apiFetch('trek_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });

      if (!saveRes.ok) {
        throw new Error(`Cloudflare D1 save returned status ${saveRes.status}`);
      }

      const updatedList = [newRecord, ...offers];
      setOffers(updatedList);
      try {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}

      // Keep persistent gallery archive of all flashcard images so they never get lost or deleted when new post is made
      try {
        const rawArchive = localStorage.getItem('wnw_flashcards_gallery_archive');
        const existingArchive: OfferItem[] = rawArchive ? JSON.parse(rawArchive) : [];
        const mergedArchive = [newRecord, ...existingArchive.filter((item) => item.id !== newRecord.id)];
        localStorage.setItem('wnw_flashcards_gallery_archive', JSON.stringify(mergedArchive));
      } catch {}

      window.dispatchEvent(new CustomEvent('wnw-offers-updated'));

      setSelectedImage(null);
      setDirectUrl('');
      setOfferText('');
      setDeadline('');
      setStatusMsg({
        text: 'Offer / Flashcard published successfully! Color & metadata saved to Cloudflare.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Publish offer failed:', err);
      setStatusMsg({
        text: err.message || 'Failed to publish offer.',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    setDeletingId(id);
    setStatusMsg(null);
    try {
      await apiFetch(`trek_photos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const updatedList = offers.filter((item) => item.id !== id);
      setOffers(updatedList);
      try {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}

      window.dispatchEvent(new CustomEvent('wnw-offers-updated'));

      setStatusMsg({
        text: 'Offer / Flashcard deleted.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Failed to delete offer.',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const previewTheme = getOfferThemeStyles(cardColor);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#E5E1DB] shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFEAE4] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 shrink-0">
              <Megaphone className="w-6 h-6 text-[#E08828]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#1F1F1F]">
                Homepage Offers &amp; Flashcards Page
              </h2>
              <p className="text-xs sm:text-sm text-[#8B8680] font-medium">
                Upload unframed offer cards, choose custom bright colors (orange default, green, blue, red, yellow, purple), and set removal deadlines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Tag className="w-3.5 h-3.5 text-[#E08828]" />
              <span>{offers.filter(isNotExpired).length} Active Offers</span>
            </span>
            <button
              type="button"
              onClick={() => fetchOffers(true)}
              className="p-2 rounded-xl border border-[#E5E1DB] hover:bg-[#FAF8F5] text-[#5A5551] transition-colors cursor-pointer"
              title="Refresh offers"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#EFEAE4] space-y-4">
          <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E08828]" />
            <span>Create New Offer / Flashcard</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload Trigger */}
            <div>
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
                1. Select Offer Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border-2 border-dashed border-[#D5D1CB] hover:border-[#7ABA42] rounded-xl text-xs font-bold text-[#1F1F1F] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#7ABA42]" />
                <span>Upload Natural Image from Device</span>
              </button>
            </div>

            {/* Direct Image URL */}
            <div>
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
                Or Paste Image URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={directUrl}
                  onChange={(e) => {
                    setDirectUrl(e.target.value);
                    if (e.target.value.trim()) setSelectedImage(null);
                  }}
                  placeholder="https://..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden"
                />
                <LinkIcon className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Offer Text & Deadline Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
                2. Offer Text / Announcement Details *
              </label>
              <textarea
                rows={3}
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                placeholder="e.g. 🔥 Festival Offer: Get 20% OFF on all Langtang Valley & Mardi Himal treks booked this week! Use promo code NEPAL2026."
                className="w-full p-3 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden text-[#1F1F1F]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
                <span>Optional Removal Deadline</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#1F1F1F] focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden"
              />
              <p className="text-[10px] text-[#8B8680] mt-1 font-medium">
                Auto-removes offer card from homepage when deadline passes.
              </p>
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-[#E08828]" />
              <span>3. Choose Offer Card Theme Color (Default: Orange)</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'orange', label: 'Orange (Default)', bg: 'bg-amber-500', ring: 'ring-amber-400' },
                { id: 'green', label: 'Bright Green', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
                { id: 'blue', label: 'Bright Blue', bg: 'bg-sky-500', ring: 'ring-sky-400' },
                { id: 'red', label: 'Bright Red', bg: 'bg-rose-500', ring: 'ring-rose-400' },
                { id: 'yellow', label: 'Bright Yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-300' },
                { id: 'purple', label: 'Bright Purple', bg: 'bg-purple-500', ring: 'ring-purple-400' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardColor(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${c.bg} ${
                    c.id === 'yellow' ? 'text-stone-900' : 'text-white'
                  } ${
                    cardColor === c.id ? `ring-2 ${c.ring} ring-offset-2 scale-105 shadow-md` : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${c.id === 'yellow' ? 'bg-stone-900' : 'bg-white'}`} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          {(selectedImage || directUrl.trim() || offerText.trim()) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5A5551] flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-[#7ABA42]" /> Homepage Flashcard Live Preview ({cardColor} theme):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setDirectUrl('');
                    setOfferText('');
                    setDeadline('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Preview
                </button>
              </div>

              <div className={`relative ${previewTheme.cardBg} rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center gap-4 border ${previewTheme.border}`}>
                {(selectedImage || directUrl.trim()) && (
                  <div className="w-full sm:max-w-xs rounded-xl overflow-hidden shrink-0">
                    <img
                      src={selectedImage || directUrl.trim()}
                      alt="Offer Preview"
                      className="w-full h-auto max-h-48 object-contain rounded-xl"
                    />
                  </div>
                )}
                <div className="space-y-2 flex-1 w-full text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${previewTheme.badgeBg}`}>
                      <Tag className={`w-3 h-3 ${previewTheme.badgeIcon}`} />
                      <span>Special Offer</span>
                    </span>
                    {deadline && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900/30 text-white text-[10px] font-bold border border-white/20">
                        <Clock className="w-3 h-3" />
                        <span>Deadline: {new Date(deadline).toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                  <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${previewTheme.textMain}`}>
                    {offerText.trim() || 'Enter offer text above...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handlePublishOffer}
              disabled={uploading || (!selectedImage && !directUrl.trim()) || !offerText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] disabled:bg-stone-300 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Offer...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Publish Offer &amp; Store in Gallery</span>
                </>
              )}
            </button>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Published Offers List */}
        <div className="space-y-3">
          <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider">
            All Published Offers ({offers.length})
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-28 rounded-2xl bg-stone-100 animate-pulse border border-[#EFEAE4]" />
              ))}
            </div>
          ) : offers.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#D5D1CB] text-center space-y-1.5 bg-[#FAF8F5]/50">
              <Megaphone className="w-8 h-8 text-[#8B8680] mx-auto" />
              <p className="text-xs font-bold text-[#1F1F1F]">No active offers posted</p>
              <p className="text-[11px] text-[#8B8680]">
                Upload an image and offer text above to display your first offer on the homepage!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((item) => {
                const active = isNotExpired(item);
                const meta = parseOfferMetadata(item);
                const itemColor = meta.color || item.color || 'orange';
                const itemExpires = meta.expiresAt || item.expiresAt;
                const displayCaption = cleanOfferCaption(item.caption);

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-4 border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 ${
                      active ? 'bg-white border-[#E5E1DB]' : 'bg-stone-50 border-stone-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {item.url && (
                        <img
                          src={item.url}
                          alt="Offer thumbnail"
                          className="w-24 h-auto max-h-24 rounded-xl object-contain border border-[#EFEAE4] bg-stone-100 shrink-0"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {active ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              Active Offer
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                              Expired (Auto-Removed)
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 border text-stone-800">
                            Theme: {itemColor}
                          </span>
                          <span className="text-[11px] text-[#8B8680]">
                            Published {new Date(item.uploadedAt).toLocaleDateString()} by {item.uploadedBy}
                          </span>
                          {itemExpires && (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Deadline: {new Date(itemExpires).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#1F1F1F] leading-relaxed whitespace-pre-line">
                          {displayCaption || 'No description text'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(item.id)}
                      disabled={deletingId === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 self-end sm:self-center"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Delete Offer</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
