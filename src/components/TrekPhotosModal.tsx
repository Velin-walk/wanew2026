import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Trash2,
  Image as ImageIcon,
  Clock,
  User,
  Heart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  UploadCloud,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Trek } from '../types';
import { apiFetch } from '../services/api';

interface TrekPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  trek: Trek;
}

interface TrekPhoto {
  id: string;
  trekId: string;
  hikeNumber: string;
  trekName: string;
  url: string;
  publicId?: string;
  uploadedBy: string;
  userUid: string;
  uploadedAt: string;
  caption?: string;
}

export const TrekPhotosModal: React.FC<TrekPhotosModalProps> = React.memo(({
  isOpen,
  onClose,
  trek,
}) => {
  const { user, isAdmin, openAuthModal } = useAuth();
  const [photos, setPhotos] = useState<TrekPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<TrekPhoto | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(-1);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewerPovMode, setViewerPovMode] = useState(false);
  const [uploadingPreviews, setUploadingPreviews] = useState<{ id: string; url: string; file: File }[]>([]);
  const [stagedFiles, setStagedFiles] = useState<{ id: string; url: string; file: File }[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exact Cloudinary credentials for the walknepalwalk preset
  const CLOUD_NAME = 'mx7cxnsf';
  const UPLOAD_PRESET = 'walknepalwalk';

  // 1. Prevent background page scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      console.log('🔄 TrekPhotosModal opened, trekId:', trek?.id);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, trek?.id]);

  // 2. Load photos from Cloudflare D1 API with Local Storage fallback (optimized no-flash loading)
  const fetchPhotos = async () => {
    if (!isOpen || !trek.id) return;
    if (photos.length === 0) {
      setLoading(true);
    }
    let list: TrekPhoto[] = [];
    let fetchSucceeded = false;

    // 1. Fetch from Cloudflare API
    try {
      const res = await apiFetch(`trek_photos?trekId=${encodeURIComponent(trek.id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          list = json.data;
          fetchSucceeded = true;
        }
      }
    } catch (err) {
      console.warn('Cloudflare photos fetch fallback to storage:', err);
    }

    // 2. Merge local storage saved photos ONLY if live fetch failed
    if (!fetchSucceeded) {
      try {
        const localKey = `wnw_photos_${trek.id}`;
        const localSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (Array.isArray(localSaved)) {
          const existingIds = new Set(list.map((p) => p.id));
          for (const lp of localSaved) {
            if (!existingIds.has(lp.id)) {
              list.push(lp);
            }
          }
        }
      } catch (e) {}
    } else {
      // Keep local storage clean to prevent stale/deleted photos from being resurrected
      try {
        const localKey = `wnw_photos_${trek.id}`;
        localStorage.setItem(localKey, JSON.stringify(list));
      } catch (e) {}
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    setPhotos(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, [isOpen, trek.id]);

  if (!isOpen) return null;

  // Ultra-fast, zero-flicker image downscaling using direct Blob Object URLs (No Base64 thread locking)
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      // Small images (under 1.2MB) don't need heavy canvas scaling
      if (file.size <= 1.2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.82
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  const handleUploadClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!user) {
      openAuthModal('Sign in to upload your hike memories with the community.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const uploadCountKey = `wnw_uploads_${user.uid}_${todayStr}`;
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) || '0', 10);

    // Daily upload throttling check (max 4 per day for regular users; unlimited for admins)
    if (!isAdmin) {
      const selectCount = files.length + stagedFiles.length;
      if (currentCount + selectCount > 4) {
        setUploadError(`Daily upload limit exceeded. You can select up to 4 photos per day. (Remaining today: ${Math.max(0, 4 - currentCount)})`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploadError(null);
    setUploadSuccessMsg(null);

    // Create immediate local Blob previews to prevent layout flickering
    const newStaged = Array.from(files).map((f) => ({
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url: URL.createObjectURL(f),
      file: f,
    }));

    setStagedFiles((prev) => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handlePublishUpload = async () => {
    if (stagedFiles.length === 0) {
      setUploadError('Please select at least one photo to share!');
      return;
    }
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const uploadCountKey = `wnw_uploads_${user.uid}_${todayStr}`;
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) || '0', 10);

    // Final limit check right before processing
    if (!isAdmin) {
      if (currentCount + stagedFiles.length > 4) {
        setUploadError(`Daily limit exceeded. You can only upload up to 4 photos per day.`);
        return;
      }
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      let uploadedThisBatch = 0;
      const newPhotosToAppend: TrekPhoto[] = [];

      for (let i = 0; i < stagedFiles.length; i++) {
        const staged = stagedFiles[i];

        // 1. Compress image in browser (fast zero-base64)
        const compressedBlob = await compressImage(staged.file);

        // 2. Upload directly to Cloudinary
        const formData = new FormData();
        formData.append('file', compressedBlob, staged.file.name);
        formData.append('upload_preset', UPLOAD_PRESET);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errorDetails = errBody.error?.message || response.statusText;
          throw new Error(`Cloudinary upload failed: ${errorDetails}`);
        }

        const resData = await response.json();
        const imageUrl = resData.secure_url;
        const publicId = resData.public_id;

        const photoRecord: TrekPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          trekId: trek.id,
          hikeNumber: trek.hike_number || '',
          trekName: trek.name,
          url: imageUrl,
          publicId: publicId,
          uploadedBy: user.displayName || user.email?.split('@')[0] || 'Nepal Hiker',
          userUid: user.uid,
          uploadedAt: new Date().toISOString(),
          caption: uploadCaption.trim() || undefined,
        };

        // 3. Save photo index to Cloudflare D1 Backend
        try {
          await apiFetch('trek_photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(photoRecord),
          });
        } catch (cfErr) {
          console.warn('Cloudflare photo index save notice:', cfErr);
        }

        newPhotosToAppend.push(photoRecord);
        uploadedThisBatch++;
      }

      // Clean up object URLs
      stagedFiles.forEach((p) => URL.revokeObjectURL(p.url));
      setStagedFiles([]);
      setUploadCaption('');

      // Update local storage cache
      try {
        const localKey = `wnw_photos_${trek.id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = [...newPhotosToAppend, ...existing];
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch (e) {}

      // Update local state immediately
      setPhotos((prev) => [...newPhotosToAppend, ...prev]);

      // Update daily counter
      localStorage.setItem(uploadCountKey, String(currentCount + uploadedThisBatch));

      setUploadSuccessMsg(`✓ Post Shared Successfully! ${uploadedThisBatch} photo(s) added to live gallery.`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'An error occurred during photo upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: TrekPhoto, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Delete from Cloudflare D1
      await apiFetch(`trek_photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Delete photo from Cloudflare notice:', err);
    }

    // Remove from local state and storage
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    try {
      const localKey = `wnw_photos_${trek.id}`;
      const existing: TrekPhoto[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtered = existing.filter((p) => p.id !== photo.id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    } catch (e) {}

    if (activePhoto?.id === photo.id) {
      handleCloseLightbox();
    }
  };

  const handleOpenLightbox = (photo: TrekPhoto, idx: number) => {
    setActivePhoto(photo);
    setActivePhotoIndex(idx);
    setShowOptionsMenu(false);
  };

  const handleCloseLightbox = () => {
    setActivePhoto(null);
    setActivePhotoIndex(-1);
    setShowOptionsMenu(false);
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    if (activePhotoIndex > 0) {
      const prevIdx = activePhotoIndex - 1;
      setActivePhotoIndex(prevIdx);
      setActivePhoto(photos[prevIdx]);
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    if (activePhotoIndex < photos.length - 1) {
      const nextIdx = activePhotoIndex + 1;
      setActivePhotoIndex(nextIdx);
      setActivePhoto(photos[nextIdx]);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const uploadCountKey = user ? `wnw_uploads_${user.uid}_${todayStr}` : null;
  const currentCount = uploadCountKey ? parseInt(localStorage.getItem(uploadCountKey) || '0', 10) : 0;
  const remainingToday = Math.max(0, 4 - currentCount);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#EFEAE4] bg-[#FAF8F5] space-y-3">
          {/* Row 1: Trek Title, Badges & Close Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center text-[#7ABA42] shrink-0 mt-0.5">
                <Camera className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-[#1F1F1F] tracking-tight">
                    {trek.name}
                  </h3>
                  {trek.hike_number && (
                    <span className="px-2.5 py-0.5 bg-[#7ABA42]/15 text-[#5F9632] text-[11px] font-black rounded-lg shrink-0">
                      Hike #{trek.hike_number}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[11px] font-bold rounded-lg shrink-0 border border-stone-200/60">
                    {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                <p className="text-xs text-[#8B8680] font-medium">
                  Official Event Photo Gallery & Community Memories
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-stone-200/60 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Close Gallery Popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Row 2: Daily Upload Limit Indicator & Upload Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#EFEAE4]/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 bg-white px-3 py-1.5 rounded-xl border border-[#EFEAE4]">
              <div className="w-2 h-2 rounded-full bg-[#7ABA42] animate-pulse shrink-0" />
              {isAdmin ? (
                <span>
                  Upload limit: <strong className="text-[#7ABA42] font-extrabold">Unlimited (Admin)</strong>
                </span>
              ) : (
                <>
                  <span>
                    Upload limit: <strong className="text-stone-800 font-extrabold">Max 4 photos per day</strong>
                  </span>
                  {user && (
                    <span className="text-[11px] text-[#5F9632] font-extrabold bg-[#7ABA42]/15 px-2 py-0.5 rounded-md ml-1 shrink-0">
                      {remainingToday} left today
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
              {stagedFiles.length > 0 ? (
                <div className="text-xs font-black text-[#7ABA42] bg-[#7ABA42]/10 border border-[#7ABA42]/20 px-3 py-2 rounded-xl flex items-center gap-1.5 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7ABA42]" />
                  <span>Composer active below ↓</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs font-extrabold rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <UploadCloud className="w-4 h-4 shrink-0" />
                  <span>Upload Hike Photos</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#F7F4EF]">
          {/* Staged Post Composer (Facebook/Instagram Style) */}
          {stagedFiles.length > 0 && (
            <div className="bg-white border border-[#EFEAE4] rounded-2xl p-4.5 shadow-md space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F7F4EF]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#7ABA42] text-white text-xs font-black flex items-center justify-center">
                    {user?.displayName?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || 'H'}
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1F1F1F]">
                      {user?.displayName || user?.email?.split('@')[0] || 'Nepal Hiker'}
                    </p>
                    <span className="text-[10px] text-[#8B8680] font-bold">Creating a hike post</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-[#7ABA42] bg-[#7ABA42]/10 px-2.5 py-1 rounded-md">
                  Posting to {trek.name}
                </span>
              </div>

              {/* Textarea caption */}
              <div className="space-y-1">
                <textarea
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Write a caption or tell a story about this photo..."
                  maxLength={120}
                  rows={3}
                  className="w-full border-0 focus:ring-0 p-0 text-xs font-medium text-[#1F1F1F] placeholder-[#8B8680] resize-none bg-transparent focus:outline-hidden"
                />
                <div className="flex justify-end text-[10px] text-[#A39E98] font-semibold">
                  {uploadCaption.length}/120 characters
                </div>
              </div>

              {/* Photos Previews */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-[#8B8680] uppercase tracking-wider block">
                  Photos Selected ({stagedFiles.length})
                </label>

                {stagedFiles.length === 1 ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-[#EFEAE4] bg-[#FAF8F5]">
                    <img 
                      src={stagedFiles[0].url} 
                      alt="Staged hike" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedFile(stagedFiles[0].id)}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {stagedFiles.map((staged) => (
                      <div key={staged.id} className="relative aspect-square rounded-xl overflow-hidden border border-[#EFEAE4] bg-[#FAF8F5]">
                        <img 
                          src={staged.url} 
                          alt="Staged hike" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedFile(staged.id)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {stagedFiles.length < 4 && (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-[#7ABA42] bg-[#FAF8F5] flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-white transition-colors"
                      >
                        <Camera className="w-5 h-5 text-[#7ABA42]" />
                        <span className="text-[10px] font-black text-[#7ABA42]">Add More</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Composer actions */}
              <div className="flex justify-between items-center pt-3 border-t border-[#F7F4EF]">
                <button
                  type="button"
                  onClick={() => {
                    stagedFiles.forEach((f) => URL.revokeObjectURL(f.url));
                    setStagedFiles([]);
                    setUploadCaption('');
                  }}
                  className="px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#EFEAE4] text-stone-600 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handlePublishUpload}
                  disabled={uploading}
                  className="px-5 py-2 bg-[#7ABA42] hover:bg-[#6AA437] disabled:bg-stone-300 text-white text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Sharing...</span>
                    </>
                  ) : (
                    <span>Publish Hike Post</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {uploadSuccessMsg && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold shadow-2xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>{uploadSuccessMsg}</span>
              </div>
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Photo Grid - Second Format View (Direct spacious photos) */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#7ABA42]" />
              <p className="text-xs font-semibold">Loading trek photo gallery...</p>
            </div>
          ) : photos.length === 0 && uploadingPreviews.length === 0 ? (
            <div className="text-center py-16 bg-white border-2 border-dashed border-stone-200 rounded-3xl space-y-3 p-6">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-stone-700">No photos shared yet</h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Be the first hiker to share your photos from this trail with the Walk Nepal Walk community!
                </p>
              </div>
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Upload First Photo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Optimistic Zero-Flicker Uploading Cards */}
              {uploadingPreviews.map((preview) => (
                <div
                  key={preview.id}
                  className="relative aspect-square sm:aspect-4/3 rounded-3xl overflow-hidden bg-stone-900 border-2 border-[#7ABA42]/50 shadow-md flex items-center justify-center"
                >
                  <img
                    src={preview.url}
                    alt="Uploading memory preview"
                    className="w-full h-full object-cover opacity-60 blur-xs"
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-2 text-center text-white space-y-1">
                    <Loader2 className="w-6 h-6 animate-spin text-[#7ABA42]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                      Uploading...
                    </span>
                  </div>
                </div>
              ))}

              {/* Live Photos Grid - Second Format (Spacious rounded 2-column cards) */}
              {photos.map((photo, idx) => {
                const isOwner = user && user.uid === photo.userUid;
                const canDelete = isOwner || isAdmin;

                return (
                  <div
                    key={photo.id}
                    className="group relative aspect-square sm:aspect-4/3 rounded-3xl overflow-hidden bg-white border border-stone-200/80 shadow-xs hover:shadow-xl transition-all cursor-pointer"
                    onClick={() => handleOpenLightbox(photo, idx)}
                  >
                    <img
                      src={photo.url}
                      alt={`${photo.trekName} photo by ${photo.uploadedBy}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 sm:p-4">
                      {photo.caption && (
                        <p className="text-white text-xs italic font-semibold line-clamp-2 mb-1.5 leading-relaxed bg-black/30 p-1.5 rounded-lg border border-white/10 backdrop-blur-3xs">
                          "{photo.caption}"
                        </p>
                      )}
                      <div className="text-white text-[11px] space-y-0.5">
                        <div className="flex items-center gap-1 font-bold line-clamp-1">
                          <User className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                          <span>{photo.uploadedBy}</span>
                        </div>
                        {photo.uploadedAt && (
                          <div className="flex items-center gap-1 text-stone-300 text-[10px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{new Date(photo.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseLightbox();
            }
          }}
        >
          <button
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Controls */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                disabled={activePhotoIndex <= 0}
                className="absolute left-4 z-[10000] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handleNextPhoto}
                disabled={activePhotoIndex >= photos.length - 1}
                className="absolute right-4 z-[10000] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePhoto.url}
              alt="Full view memory"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />

            {activePhoto.caption && (
              <p className="mt-3 text-center text-sm font-bold italic text-stone-100 max-w-2xl px-4 py-2 bg-black/40 border border-white/10 rounded-xl">
                "{activePhoto.caption}"
              </p>
            )}

            <div className="mt-4 flex items-center justify-between w-full text-white text-xs px-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#7ABA42]">{activePhoto.uploadedBy}</span>
                <span className="text-stone-400">•</span>
                <span className="text-stone-300">
                  {new Date(activePhoto.uploadedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activePhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>

                {/* More Options (...) Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                      showOptionsMenu
                        ? 'bg-white/30 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="More options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Options Menu Dropdown */}
                  {showOptionsMenu && (
                    <div
                      className="absolute right-0 bottom-full mb-2 w-44 bg-[#1F1F1F] border border-white/20 rounded-2xl shadow-2xl p-1.5 text-white z-[10010] animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(user && user.uid === activePhoto.userUid) || isAdmin ? (
                        confirmDeleteId === activePhoto.id ? (
                          <div className="p-2 space-y-2">
                            <p className="text-[10px] font-black text-stone-300 text-center uppercase tracking-wider">Confirm Delete?</p>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                  setShowOptionsMenu(false);
                                }}
                                className="flex-1 py-1 bg-stone-700 hover:bg-stone-600 rounded-lg text-[10px] font-black text-center transition-colors cursor-pointer text-white"
                              >
                                No
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                  setShowOptionsMenu(false);
                                  handleDeletePhoto(activePhoto, e);
                                }}
                                className="flex-1 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-[10px] font-black text-center text-white transition-colors cursor-pointer"
                              >
                                Yes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(activePhoto.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 rounded-xl transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                            <span>Delete Photo</span>
                          </button>
                        )
                      ) : (
                        <div className="px-3 py-2 text-[11px] text-stone-400 font-medium text-center">
                          Shared by hiker
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}, (prevProps, nextProps) => {
  return prevProps.isOpen === nextProps.isOpen && prevProps.trek?.id === nextProps.trek?.id;
});
