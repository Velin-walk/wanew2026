import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import {
  HeroBannerItem,
  HERO_TREK_ID,
  HERO_STORAGE_KEY,
} from '../HomepageHeroBanner';

const CLOUD_NAME = 'mx7cxnsf';
const UPLOAD_PRESET = 'walknepalwalk';

interface HomepageHeroManagerProps {
  currentUserEmail?: string;
}

export const HomepageHeroManager: React.FC<HomepageHeroManagerProps> = ({
  currentUserEmail,
}) => {
  const [images, setImages] = useState<HeroBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hourIndex = Math.floor(Date.now() / 3600000);

  const fetchHeroImages = useCallback(async (forceFresh = true) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `trek_photos?trekId=${encodeURIComponent(HERO_TREK_ID)}`,
        { forceFresh }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          const sorted = (json.data as HeroBannerItem[])
            .filter((item) => item && item.id && item.url)
            .sort((a, b) => {
              const tA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
              const tB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
              return tA - tB;
            });
          setImages(sorted);
          try {
            localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(sorted));
          } catch {}
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Error fetching homepage hero images in admin:', err);
    }

    try {
      const cached = localStorage.getItem(HERO_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setImages(parsed);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHeroImages(true);
  }, [fetchHeroImages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    setSelectedFile(file);
    setDirectUrl('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCroppedPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const handlePublishHero = async () => {
    const sourceImage = croppedPreview || directUrl.trim();
    if (!sourceImage) {
      setStatusMsg({
        text: 'Please upload an image or provide an image URL first.',
        type: 'error',
      });
      return;
    }

    setUploading(true);
    setStatusMsg(null);

    try {
      let finalImageUrl = sourceImage;
      let publicId = '';

      // Upload original file or data URLs to Cloudinary without cropping or compression
      if (selectedFile || sourceImage.startsWith('data:') || sourceImage.startsWith('blob:')) {
        const fileOrBlob = selectedFile || (await dataUrlToBlob(sourceImage));
        const formData = new FormData();
        formData.append(
          'file',
          fileOrBlob,
          selectedFile ? selectedFile.name : `hero_${Date.now()}.jpg`
        );
        formData.append('upload_preset', UPLOAD_PRESET);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const errBody = await uploadRes.json().catch(() => ({}));
          throw new Error(
            errBody.error?.message || `Cloudinary upload failed (${uploadRes.status})`
          );
        }

        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.secure_url;
        publicId = uploadData.public_id || '';
      }

      const newRecord = {
        id: `hero_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trekId: HERO_TREK_ID,
        hikeNumber: 'HERO',
        trekName: 'Homepage Hero',
        url: finalImageUrl,
        publicId,
        uploadedBy: currentUserEmail || 'Admin',
        userUid: 'admin',
        uploadedAt: new Date().toISOString(),
        caption: caption.trim() || undefined,
      };

      const saveRes = await apiFetch('trek_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });

      if (!saveRes.ok) {
        throw new Error(`D1 save returned status ${saveRes.status}`);
      }

      const updatedList = [...images, newRecord];
      setImages(updatedList);
      try {
        localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}
      window.dispatchEvent(new CustomEvent('wnw-hero-images-updated'));

      setCroppedPreview(null);
      setSelectedFile(null);
      setDirectUrl('');
      setCaption('');
      setStatusMsg({
        text: 'Hero image added to the hourly rotation!',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Hero upload failed:', err);
      setStatusMsg({
        text: err.message || 'Failed to upload hero image.',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteHero = async (id: string) => {
    setDeletingId(id);
    setStatusMsg(null);
    try {
      await apiFetch(`trek_photos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const updatedList = images.filter((img) => img.id !== id);
      setImages(updatedList);
      try {
        localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}
      window.dispatchEvent(new CustomEvent('wnw-hero-images-updated'));
      setStatusMsg({
        text: 'Hero image removed from rotation.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Failed to delete hero image.',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const activeIndex = images.length > 0 ? hourIndex % images.length : -1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#E5E1DB] shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EFEAE4] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#7ABA42]/15 flex items-center justify-center text-[#7ABA42] shrink-0">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#1F1F1F]">
                Homepage Hero Banner Manager
              </h2>
              <p className="text-xs sm:text-sm text-[#8B8680] font-medium">
                Upload panoramic banners that automatically rotate every hour on the homepage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-[#E08828]" />
              <span>1-Hour Rotation ({images.length} Active)</span>
            </span>
            <button
              type="button"
              onClick={() => fetchHeroImages(true)}
              className="p-2 rounded-xl border border-[#E5E1DB] hover:bg-[#FAF8F5] text-[#5A5551] transition-colors cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Recommended Specs Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EFEAE4] text-xs">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8B8680] block">
              Recommended Size
            </span>
            <strong className="text-[#1F1F1F] font-extrabold">
              1800 × 900 px (3:1.5 / 2:1 Ratio)
            </strong>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8B8680] block">
              Placement
            </span>
            <strong className="text-[#1F1F1F] font-extrabold">
              Top of Homepage (Below Prayer Flags)
            </strong>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8B8680] block">
              Rotation Logic
            </span>
            <strong className="text-[#1F1F1F] font-extrabold">
              Changes automatically at the top of each hour
            </strong>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-[#EFEAE4] space-y-4">
          <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E08828]" />
            <span>Add New Hero Image to Rotation</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Upload Trigger */}
            <div>
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
                1. Upload Banner Image (Original Uncropped Quality)
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
                <span>Select Image from Device</span>
              </button>
            </div>

            {/* Or Direct URL */}
            <div>
              <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
                Or Paste Direct Image URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={directUrl}
                  onChange={(e) => {
                    setDirectUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setCroppedPreview(null);
                      setSelectedFile(null);
                    }
                  }}
                  placeholder="https://..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden"
                />
                <LinkIcon className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Optional Caption */}
          <div>
            <label className="block text-[11px] font-bold text-[#5A5551] mb-1.5">
              Optional Overlay Caption / Trail Tag
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Langtang Valley Trek • Autumn 2026"
              className="w-full px-3.5 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden"
            />
          </div>

          {/* Live Preview before publishing */}
          {(croppedPreview || directUrl.trim()) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5A5551]">
                  Homepage Hero Preview (3:1.5 / 2:1):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCroppedPreview(null);
                    setSelectedFile(null);
                    setDirectUrl('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Preview
                </button>
              </div>
              <div className="relative w-full max-w-xl aspect-[2/1] rounded-2xl overflow-hidden border border-[#E5E1DB] bg-stone-900">
                <img
                  src={croppedPreview || directUrl.trim()}
                  alt="Hero preview"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
                {caption.trim() && (
                  <div className="absolute bottom-2.5 left-3">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-black/45 backdrop-blur-xs border border-white/15 text-white text-xs font-bold">
                      {caption.trim()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handlePublishHero}
              disabled={uploading || (!croppedPreview && !directUrl.trim())}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] disabled:bg-stone-300 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading to Cloud...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Publish to Hourly Rotation</span>
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

        {/* Active Rotation Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider">
              Active Rotation Queue ({images.length})
            </h3>
            {images.length === 0 && !loading && (
              <span className="text-[11px] text-[#8B8680] font-medium">
                Currently showing default fallback hero image
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="aspect-[2/1] rounded-2xl bg-stone-100 animate-pulse border border-[#EFEAE4]"
                />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#D5D1CB] text-center space-y-1.5 bg-[#FAF8F5]/50">
              <ImageIcon className="w-8 h-8 text-[#8B8680] mx-auto" />
              <p className="text-xs font-bold text-[#1F1F1F]">
                No custom Hero images uploaded yet
              </p>
              <p className="text-[11px] text-[#8B8680]">
                Upload 2 or more banners above to start the automatic hourly rotation on the homepage.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((item, idx) => {
                const isLiveNow = idx === activeIndex;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl overflow-hidden border transition-all bg-white flex flex-col ${
                      isLiveNow
                        ? 'border-[#7ABA42] ring-2 ring-[#7ABA42]/25 shadow-sm'
                        : 'border-[#E5E1DB]'
                    }`}
                  >
                    <div className="relative w-full aspect-[2/1] bg-stone-900">
                      <img
                        src={item.url}
                        alt={item.caption || `Hero Slot #${idx + 1}`}
                        className="w-full h-full object-cover object-center"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-black">
                          Slot #{idx + 1}
                        </span>
                        {isLiveNow && (
                          <span className="px-2 py-0.5 rounded-md bg-[#7ABA42] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                            Live This Hour
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteHero(item.id)}
                        disabled={deletingId === item.id}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                        title="Remove from rotation"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {item.caption && (
                        <div className="absolute bottom-2 left-2.5 right-2.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-black/50 text-white text-[11px] font-bold truncate max-w-full">
                            {item.caption}
                          </span>
                        </div>
                      )}
                    </div>
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
