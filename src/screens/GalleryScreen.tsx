import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  User,
  Clock,
  Trash2,
  Download,
  X,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Tag,
  Eye,
  MoreVertical
} from 'lucide-react';
import { Trek } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

interface GalleryPhoto {
  id: string;
  trekId: string;
  hikeNumber?: string;
  trekName?: string;
  url: string;
  publicId?: string;
  uploadedBy: string;
  userUid: string;
  uploadedAt: string;
}

interface GalleryScreenProps {
  treks: Trek[];
  onOpenAuthModal?: (reason?: string) => void;
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  treks,
  onOpenAuthModal,
}) => {
  const { user, isAdmin } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrekFilter, setSelectedTrekFilter] = useState<string>('ALL');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadTrekId, setSelectedUploadTrekId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(-1);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Viewer POV state & upload previews
  const [viewerPovMode, setViewerPovMode] = useState(false);
  const [uploadingPreviews, setUploadingPreviews] = useState<{ id: string; url: string; file: File }[]>([]);

  const CLOUD_NAME = 'mx7cxnsf';
  const UPLOAD_PRESET = 'walknepalwalk';

  // Fetch all community photos from Cloudflare D1
  const fetchAllPhotos = async () => {
    setLoading(true);
    let list: GalleryPhoto[] = [];

    try {
      const res = await apiFetch('trek_photos');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          list = json.data;
        }
      }
    } catch (err) {
      console.warn('Error fetching community gallery photos from Cloudflare:', err);
    }

    // Merge local storage saved photos across all treks
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('wnw_photos_')) {
          const localSaved = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(localSaved)) {
            const existingIds = new Set(list.map((p) => p.id));
            for (const lp of localSaved) {
              if (!existingIds.has(lp.id)) {
                list.push(lp);
              }
            }
          }
        }
      }
    } catch (e) {}

    // Sort newest first
    list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    setPhotos(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllPhotos();
  }, []);

  // Pre-select first trek for upload modal if available
  useEffect(() => {
    if (treks.length > 0 && !selectedUploadTrekId) {
      setSelectedUploadTrekId(treks[0].id);
    }
  }, [treks]);

  // Ultra-fast zero-base64 image compressor using direct Blob Object URLs
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
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

  const handleOpenUploadModal = () => {
    if (!user) {
      onOpenAuthModal?.('Sign in to share your hike memories in the community gallery');
      return;
    }
    setUploadModalOpen(true);
    setUploadError(null);
    setUploadSuccessMsg(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!user) return;

    const targetTrek = treks.find((t) => t.id === selectedUploadTrekId) || treks[0];
    if (!targetTrek) return;

    // Daily upload limit check
    const todayStr = new Date().toISOString().split('T')[0];
    const uploadCountKey = `wnw_uploads_${user.uid}_${todayStr}`;
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) || '0', 10);

    const selectCount = files.length;
    if (currentCount + selectCount > 4) {
      setUploadError(`Daily upload limit reached. You can upload up to 4 photos per day. (Remaining: ${Math.max(0, 4 - currentCount)})`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    // Create immediate local Blob previews to prevent layout flickering
    const tempPreviews = Array.from(files).map((f) => ({
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url: URL.createObjectURL(f),
      file: f,
    }));
    setUploadingPreviews(tempPreviews);

    try {
      let uploadedThisBatch = 0;
      const newPhotosToAppend: GalleryPhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 1. Compress
        const compressedBlob = await compressImage(file);

        // 2. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', compressedBlob, file.name);
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

        const photoRecord: GalleryPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          trekId: targetTrek.id,
          hikeNumber: targetTrek.hike_number || '',
          trekName: targetTrek.name,
          url: imageUrl,
          publicId: publicId,
          uploadedBy: user.displayName || user.email?.split('@')[0] || 'Nepal Hiker',
          userUid: user.uid,
          uploadedAt: new Date().toISOString(),
        };

        // 3. Save to Cloudflare D1
        try {
          await apiFetch('trek_photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(photoRecord),
          });
        } catch (cfErr) {
          console.warn('Cloudflare photo save notice:', cfErr);
        }

        newPhotosToAppend.push(photoRecord);
        uploadedThisBatch++;
      }

      // Clean up object URLs
      tempPreviews.forEach((p) => URL.revokeObjectURL(p.url));
      setUploadingPreviews([]);

      // Save local storage cache for trek
      try {
        const localKey = `wnw_photos_${targetTrek.id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = [...newPhotosToAppend, ...existing];
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch (e) {}

      // Update local state
      setPhotos((prev) => [...newPhotosToAppend, ...prev]);
      localStorage.setItem(uploadCountKey, String(currentCount + uploadedThisBatch));

      setUploadSuccessMsg(`✓ Image Uploaded Successfully! ${uploadedThisBatch} photo(s) live in gallery.`);
      setTimeout(() => {
        setUploadModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'An error occurred during photo upload.');
      setUploadingPreviews([]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: GalleryPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this photo from the community gallery?')) return;

    try {
      await apiFetch(`trek_photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Delete photo error:', err);
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));

    // Remove from local storage cache
    try {
      const localKey = `wnw_photos_${photo.trekId}`;
      const existing: GalleryPhoto[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtered = existing.filter((p) => p.id !== photo.id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    } catch (e) {}

    if (activePhoto?.id === photo.id) {
      setActivePhoto(null);
      setActivePhotoIndex(-1);
    }
  };

  // Filtered photos
  const filteredPhotos = photos.filter((photo) => {
    const matchesFilter =
      selectedTrekFilter === 'ALL' || photo.trekId === selectedTrekFilter;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesFilter;

    const matchesQuery =
      (photo.trekName || '').toLowerCase().includes(q) ||
      (photo.uploadedBy || '').toLowerCase().includes(q) ||
      (photo.hikeNumber || '').toLowerCase().includes(q);

    return matchesFilter && matchesQuery;
  });

  const handleOpenLightbox = (photo: GalleryPhoto, idx: number) => {
    setActivePhoto(photo);
    setActivePhotoIndex(idx);
    setShowOptionsMenu(false);
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    if (activePhotoIndex > 0) {
      const prevIdx = activePhotoIndex - 1;
      setActivePhotoIndex(prevIdx);
      setActivePhoto(filteredPhotos[prevIdx]);
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    if (activePhotoIndex < filteredPhotos.length - 1) {
      const nextIdx = activePhotoIndex + 1;
      setActivePhotoIndex(nextIdx);
      setActivePhoto(filteredPhotos[nextIdx]);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1F1F1F] via-[#2A2A2A] to-[#121212] rounded-3xl p-6 sm:p-10 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#7ABA42]/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-extrabold text-[#7ABA42]">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>Walk Nepal Walk Community Wall</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Community Trail Gallery
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 font-medium leading-relaxed">
              Explore photo memories captured by hikers along Nepal's rivers, ridges, and mountain trails.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Upload Hike Photo</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#EFEAE4] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by trek name or hiker..."
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl text-xs font-semibold text-[#1F1F1F] placeholder-[#8B8680] focus:outline-hidden focus:border-[#7ABA42]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdown & Viewer POV switch */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => setViewerPovMode(!viewerPovMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                viewerPovMode
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
              title="Toggle public community viewer perspective"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{viewerPovMode ? 'Viewer POV Active' : 'Viewer POV'}</span>
            </button>
          )}

          <Filter className="w-4 h-4 text-[#8B8680] shrink-0" />
          <select
            value={selectedTrekFilter}
            onChange={(e) => setSelectedTrekFilter(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl text-xs font-bold text-[#1F1F1F] focus:outline-hidden focus:border-[#7ABA42] cursor-pointer"
          >
            <option value="ALL">All Hikes ({photos.length} Photos)</option>
            {treks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.hike_number ? `Hike #${t.hike_number} - ` : ''}
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Gallery Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7ABA42]" />
          <p className="text-xs font-bold">Loading community gallery photos...</p>
        </div>
      ) : filteredPhotos.length === 0 && uploadingPreviews.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-dashed border-[#EFEAE4] rounded-3xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[#7ABA42]/10 text-[#7ABA42] flex items-center justify-center mx-auto">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-[#1F1F1F]">
              {searchQuery || selectedTrekFilter !== 'ALL'
                ? 'No matching photos found'
                : 'No community photos uploaded yet'}
            </h3>
            <p className="text-xs text-[#8B8680] font-medium">
              Share your favorite trail memories with the Walk Nepal Walk community.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Upload Photo Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Optimistic Zero-Flicker Upload Previews */}
          {uploadingPreviews.map((preview) => (
            <div
              key={preview.id}
              className="relative aspect-square rounded-2xl overflow-hidden bg-stone-900 border-2 border-[#7ABA42] shadow-md flex items-center justify-center"
            >
              <img
                src={preview.url}
                alt="Uploading preview"
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

          {/* Live Community Photo Cards */}
          {filteredPhotos.map((photo, idx) => {
            const isOwner = user && user.uid === photo.userUid;
            const canDelete = !viewerPovMode && (isOwner || isAdmin);

            return (
              <div
                key={photo.id}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-[#EFEAE4] shadow-xs hover:shadow-xl transition-all cursor-pointer"
                onClick={() => handleOpenLightbox(photo, idx)}
              >
                <img
                  src={photo.url}
                  alt={`${photo.trekName || 'Trek'} photo by ${photo.uploadedBy}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start gap-1">
                    {photo.hikeNumber && (
                      <span className="px-2 py-0.5 bg-[#7ABA42] text-white text-[9px] font-black rounded-md shadow-xs">
                        #{photo.hikeNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-white text-[11px] space-y-0.5">
                    {photo.trekName && (
                      <p className="font-extrabold text-stone-100 line-clamp-1 leading-tight">
                        {photo.trekName}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-1 text-[10px] text-stone-300 font-medium">
                      <span className="truncate">By {photo.uploadedBy}</span>
                      {photo.uploadedAt && (
                        <span>{new Date(photo.uploadedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Upload Modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setUploadModalOpen(false);
            }
          }}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EFEAE4] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center text-[#7ABA42]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1F1F1F]">Share Hike Photo</h3>
                  <p className="text-xs text-[#8B8680] font-medium">
                    Upload your photos to the Walk Nepal Walk community gallery.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select Trek Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F1F1F] block">
                Select Hike / Trek:
              </label>
              <select
                value={selectedUploadTrekId}
                onChange={(e) => setSelectedUploadTrekId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#EFEAE4] rounded-xl text-xs font-bold text-[#1F1F1F] focus:outline-hidden focus:border-[#7ABA42] cursor-pointer"
              >
                {treks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.hike_number ? `Hike #${t.hike_number} - ` : ''}
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-stone-200 bg-[#FAF8F5] rounded-2xl p-6 text-center space-y-3">
              <Camera className="w-8 h-8 text-[#7ABA42] mx-auto" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#1F1F1F]">
                  Select photo files to upload
                </p>
                <p className="text-[11px] text-[#8B8680]">
                  Max 4 uploads per day • Auto-compressed for speed
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#7ABA42] hover:bg-[#6AA437] disabled:bg-stone-300 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Uploading to Cloudinary...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>Choose Photos</span>
                  </>
                )}
              </button>
            </div>

            {/* Error / Success feedback */}
            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccessMsg && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <button
            onClick={() => setActivePhoto(null)}
            className="absolute top-4 right-4 z-70 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {filteredPhotos.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                disabled={activePhotoIndex <= 0}
                className="absolute left-4 z-70 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handleNextPhoto}
                disabled={activePhotoIndex >= filteredPhotos.length - 1}
                className="absolute right-4 z-70 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
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
              alt="Community memory"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between w-full text-white text-xs px-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#7ABA42]">{activePhoto.uploadedBy}</span>
                  {activePhoto.hikeNumber && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-md">
                      Hike #{activePhoto.hikeNumber}
                    </span>
                  )}
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-300">
                    {new Date(activePhoto.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                {activePhoto.trekName && (
                  <p className="text-stone-300 font-medium text-[11px]">
                    {activePhoto.trekName}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
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
                      className="absolute right-0 bottom-full mb-2 w-44 bg-[#1F1F1F] border border-white/20 rounded-2xl shadow-2xl p-1.5 text-white z-70 animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(!viewerPovMode && ((user && user.uid === activePhoto.userUid) || isAdmin)) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            setShowOptionsMenu(false);
                            handleDeletePhoto(activePhoto, e);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 rounded-xl transition-colors cursor-pointer text-left"
                        >
                          <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Delete Photo</span>
                        </button>
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
    </div>
  );
};
