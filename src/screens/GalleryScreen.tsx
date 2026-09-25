import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  MoreVertical,
  LayoutGrid,
  Grid,
  ArrowUpDown,
  FolderOpen,
  Plus,
  MapPin,
  MessageSquare
} from 'lucide-react';
import { Trek } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fetchPhotoComments } from '../services/api';
import { PhotoCommentsSection } from '../components/PhotoCommentsSection';
import galleryHeroImg from '../assets/images/gallery_trail_hero_1790246900034.jpg';

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
  caption?: string;
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

  // View mode & Sort order state
  const [viewMode, setViewMode] = useState<'boxed' | 'grid'>('boxed');
  const [sortBy, setSortBy] = useState<'hike_desc' | 'hike_asc' | 'newest'>('hike_desc');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadTrekId, setSelectedUploadTrekId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(-1);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [mobileDiscussionOpen, setMobileDiscussionOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [activeCommentCount, setActiveCommentCount] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Viewer POV state & upload previews
  const [viewerPovMode, setViewerPovMode] = useState(false);
  const [uploadingPreviews, setUploadingPreviews] = useState<{ id: string; url: string; file: File }[]>([]);
  const [stagedFiles, setStagedFiles] = useState<{ id: string; url: string; file: File }[]>([]);

  const CLOUD_NAME = 'mx7cxnsf';
  const UPLOAD_PRESET = 'walknepalwalk';

  // Fetch all community photos from Cloudflare D1
  const fetchAllPhotos = async () => {
    setLoading(true);
    let list: GalleryPhoto[] = [];
    let fetchSucceeded = false;

    try {
      const res = await apiFetch('trek_photos');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          list = json.data;
          fetchSucceeded = true;
        }
      }
    } catch (err) {
      console.warn('Error fetching community gallery photos from Cloudflare:', err);
    }

    // Merge local storage saved photos across all treks ONLY if live fetch failed
    if (!fetchSucceeded) {
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
    } else {
      // Keep local storage clean to prevent stale/deleted photos from being resurrected
      try {
        const photosByTrek: Record<string, GalleryPhoto[]> = {};
        for (const p of list) {
          if (!photosByTrek[p.trekId]) {
            photosByTrek[p.trekId] = [];
          }
          photosByTrek[p.trekId].push(p);
        }

        const keysToClean: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('wnw_photos_')) {
            keysToClean.push(key);
          }
        }
        for (const key of keysToClean) {
          const tId = key.replace('wnw_photos_', '');
          const subset = photosByTrek[tId] || [];
          localStorage.setItem(key, JSON.stringify(subset));
        }
      } catch (e) {}
    }

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
    setUploadCaption('');
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.url));
    setStagedFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!user) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const uploadCountKey = `wnw_uploads_${user.uid}_${todayStr}`;
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) || '0', 10);

    // Daily upload limit check (unlimited for admins)
    if (!isAdmin) {
      const selectCount = files.length + stagedFiles.length;
      if (currentCount + selectCount > 4) {
        setUploadError(`Daily limit exceeded. Regular users can upload up to 4 photos per day. (You have staged/uploaded: ${currentCount + selectCount} today)`);
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

    const targetTrek = treks.find((t) => t.id === selectedUploadTrekId) || treks[0];
    if (!targetTrek) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const uploadCountKey = `wnw_uploads_${user.uid}_${todayStr}`;
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) || '0', 10);

    // Final limit check right before processing
    if (!isAdmin) {
      if (currentCount + stagedFiles.length > 4) {
        setUploadError(`Daily upload limit exceeded. You can only upload up to 4 photos per day.`);
        return;
      }
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      let uploadedThisBatch = 0;
      const newPhotosToAppend: GalleryPhoto[] = [];

      for (let i = 0; i < stagedFiles.length; i++) {
        const staged = stagedFiles[i];

        // 1. Compress
        const compressedBlob = await compressImage(staged.file);

        // 2. Upload to Cloudinary
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
          caption: uploadCaption.trim() || undefined,
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
      stagedFiles.forEach((p) => URL.revokeObjectURL(p.url));
      setStagedFiles([]);
      setUploadCaption('');

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

      setUploadSuccessMsg(`Post Shared Successfully! ${uploadedThisBatch} photo(s) published.`);
      setTimeout(() => {
        setUploadModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'An error occurred during photo upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: GalleryPhoto, e: React.MouseEvent) => {
    e.stopPropagation();

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

  // Enrich photos with matched trek metadata
  const enrichedPhotos = useMemo(() => {
    return photos.map((p) => {
      const matchedTrek = treks.find((t) => t.id === p.trekId);
      return {
        ...p,
        hikeNumber: p.hikeNumber || matchedTrek?.hike_number || '',
        trekName: p.trekName || matchedTrek?.name || 'Walk Nepal Walk Hike',
      };
    });
  }, [photos, treks]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return enrichedPhotos.filter((photo) => {
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
  }, [enrichedPhotos, selectedTrekFilter, searchQuery]);

  // Group filtered photos into "Hike Boxes"
  const groupedHikeBoxes = useMemo(() => {
    const map = new Map<
      string,
      {
        trekId: string;
        hikeNumber: string;
        trekName: string;
        trek?: Trek;
        photos: GalleryPhoto[];
      }
    >();

    for (const photo of filteredPhotos) {
      const trekObj = treks.find((t) => t.id === photo.trekId);
      const hikeNum = photo.hikeNumber || trekObj?.hike_number || '0';
      const name = photo.trekName || trekObj?.name || 'Walk Nepal Walk Hike';

      if (!map.has(photo.trekId)) {
        map.set(photo.trekId, {
          trekId: photo.trekId,
          hikeNumber: hikeNum,
          trekName: name,
          trek: trekObj,
          photos: [],
        });
      }
      map.get(photo.trekId)!.photos.push(photo);
    }

    const groups = Array.from(map.values());

    groups.sort((a, b) => {
      const numA = parseInt(a.hikeNumber || '0', 10);
      const numB = parseInt(b.hikeNumber || '0', 10);

      if (sortBy === 'hike_desc') {
        return numB - numA;
      } else if (sortBy === 'hike_asc') {
        return numA - numB;
      } else {
        const newestA = a.photos[0]?.uploadedAt ? new Date(a.photos[0].uploadedAt).getTime() : 0;
        const newestB = b.photos[0]?.uploadedAt ? new Date(b.photos[0].uploadedAt).getTime() : 0;
        return newestB - newestA;
      }
    });

    return groups;
  }, [filteredPhotos, treks, sortBy]);

  const handleOpenUploadModalForTrek = (trekId: string) => {
    if (!user && onOpenAuthModal) {
      onOpenAuthModal('Sign in to upload hike photos with the community.');
      return;
    }
    setSelectedUploadTrekId(trekId);
    setUploadError(null);
    setUploadSuccessMsg(null);
    setUploadCaption('');
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.url));
    setStagedFiles([]);
    setUploadingPreviews([]);
    setUploadModalOpen(true);
  };

  const handleOpenLightbox = (photo: GalleryPhoto, idx: number) => {
    setActivePhoto(photo);
    setActivePhotoIndex(idx);
    setShowOptionsMenu(false);
    setMobileDiscussionOpen(false);
    setCaptionExpanded(false);
    setActiveCommentCount(null);
    fetchPhotoComments(photo.id).then((res) => {
      setActiveCommentCount(res.length);
    }).catch(() => {});
  };

  const handleCloseLightbox = () => {
    setActivePhoto(null);
    setActivePhotoIndex(-1);
    setShowOptionsMenu(false);
    setMobileDiscussionOpen(false);
    setCaptionExpanded(false);
    setActiveCommentCount(null);
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    setMobileDiscussionOpen(false);
    setCaptionExpanded(false);
    if (activePhotoIndex > 0) {
      const prevIdx = activePhotoIndex - 1;
      const targetPhoto = filteredPhotos[prevIdx];
      setActivePhotoIndex(prevIdx);
      setActivePhoto(targetPhoto);
      setActiveCommentCount(null);
      if (targetPhoto) {
        fetchPhotoComments(targetPhoto.id).then((res) => {
          setActiveCommentCount(res.length);
        }).catch(() => {});
      }
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowOptionsMenu(false);
    setMobileDiscussionOpen(false);
    setCaptionExpanded(false);
    if (activePhotoIndex < filteredPhotos.length - 1) {
      const nextIdx = activePhotoIndex + 1;
      const targetPhoto = filteredPhotos[nextIdx];
      setActivePhotoIndex(nextIdx);
      setActivePhoto(targetPhoto);
      setActiveCommentCount(null);
      if (targetPhoto) {
        fetchPhotoComments(targetPhoto.id).then((res) => {
          setActiveCommentCount(res.length);
        }).catch(() => {});
      }
    }
  };

  // Touch Swipe Handlers for Lightbox Modal
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;
    const minSwipeDistance = 50; // threshold in pixels

    if (diffX > minSwipeDistance) {
      // Swiped left -> Next photo
      handleNextPhoto();
    } else if (diffX < -minSwipeDistance) {
      // Swiped right -> Prev photo
      handlePrevPhoto();
    }
    setTouchStartX(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hero Header & Controls nested inside Mountain Trail Art Image Container */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-stone-300 w-full p-4 sm:p-7 space-y-5">
        {/* Background Image with Gradient Scrim for crisp readability */}
        <img
          src={galleryHeroImg}
          alt="Community Trail Gallery"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/70 pointer-events-none" />

        {/* Foreground Content inside Image */}
        <div className="relative z-10 space-y-5">
          {/* Header & Upload Action */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white">
            <div className="space-y-1.5 max-w-2xl text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/25 text-[#FFF3E0] text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wider shadow-3xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Walk Nepal Walk Community Wall</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                Community Trail Gallery
              </h1>
              <p className="text-[11px] sm:text-xs text-[#FFF3E0] font-medium leading-relaxed drop-shadow-xs">
                Explore photo memories captured by hikers along Nepal's rivers, ridges, and mountain trails.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenUploadModal}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0 border border-white/30 backdrop-blur-xs self-start md:self-auto mr-auto md:mr-0"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>Upload Hike Photo</span>
            </button>
          </div>

          {/* Filter, Sort, and View Mode Bar inside Hero Image */}
          <div className="bg-white/50 backdrop-blur-md border border-white/50 rounded-2xl p-2.5 sm:p-3 shadow-xl flex flex-col items-start justify-start gap-2 max-w-full md:max-w-[25%] mr-auto">
            {/* Search */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by hike #, name, or hiker..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-stone-100/90 border border-stone-300 rounded-lg text-[11px] font-semibold text-stone-900 placeholder-stone-500 focus:outline-hidden focus:border-[#7ABA42] focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-stone-100/90 border border-stone-300 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('boxed')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === 'boxed'
                    ? 'bg-white text-emerald-800 shadow-2xs border border-stone-300'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Boxed by Hike Albums"
              >
                <LayoutGrid className="w-3 h-3 text-emerald-600" />
                <span>Hike Boxes</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-emerald-800 shadow-2xs border border-stone-300'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="All Photos Stream Grid"
              >
                <Grid className="w-3 h-3 text-emerald-600" />
                <span>All Photos</span>
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-stone-100/90 border border-stone-300 px-2 py-1 rounded-lg">
              <ArrowUpDown className="w-3 h-3 text-stone-600 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-[10px] font-bold text-stone-900 focus:outline-hidden cursor-pointer"
              >
                <option value="hike_desc">Hike # (High → Low)</option>
                <option value="hike_asc">Hike # (Low → High)</option>
                <option value="newest">Newest Uploads</option>
              </select>
            </div>
          </div>
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
      ) : viewMode === 'boxed' ? (
        /* Boxed by Hike Album View */
        <div className="space-y-8">
          {groupedHikeBoxes.map((box) => (
            <div
              key={box.trekId}
              className="bg-white border border-[#EFEAE4] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Hike Box Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEAE4]/80">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#7ABA42]/15 border border-[#7ABA42]/30 text-[#7ABA42] flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    #{box.hikeNumber || '?'}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[#1F1F1F] leading-tight flex items-center gap-2">
                      <span>{box.trekName}</span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[#8B8680] font-semibold mt-0.5">
                      {box.trek?.start_location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#E08828]" />
                          <span>{box.trek.start_location}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[#7ABA42] font-extrabold bg-[#7ABA42]/10 px-2 py-0.5 rounded-md">
                        <FolderOpen className="w-3 h-3" />
                        <span>{box.photos.length} {box.photos.length === 1 ? 'Photo' : 'Photos'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Add Photos Button for this Hike */}
                <button
                  type="button"
                  onClick={() => handleOpenUploadModalForTrek(box.trekId)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#7ABA42] hover:text-white border border-[#EFEAE4] hover:border-[#7ABA42] text-stone-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Photos to Hike #{box.hikeNumber}</span>
                </button>
              </div>

              {/* Photos Grid inside Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {box.photos.map((photo) => {
                  const globalIdx = filteredPhotos.findIndex((p) => p.id === photo.id);
                  return (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-[#EFEAE4] shadow-xs hover:shadow-xl transition-all cursor-pointer"
                      onClick={() => handleOpenLightbox(photo, globalIdx >= 0 ? globalIdx : 0)}
                    >
                      <img
                        src={photo.url}
                        alt={`${photo.trekName || 'Trek'} photo by ${photo.uploadedBy}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white text-[11px]">
                        {photo.caption && (
                          <p className="text-white text-xs italic font-semibold line-clamp-2 mb-1.5 leading-relaxed bg-black/30 p-1.5 rounded-lg border border-white/10 backdrop-blur-3xs">
                            "{photo.caption}"
                          </p>
                        )}
                        <p className="font-bold text-stone-100 truncate">By {photo.uploadedBy}</p>
                        {photo.uploadedAt && (
                          <p className="text-[10px] text-stone-300">
                            {new Date(photo.uploadedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat Grid View */
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <div className="flex justify-between items-start gap-1">
                    {photo.hikeNumber && (
                      <span className="px-2 py-0.5 bg-[#7ABA42] text-white text-[9px] font-black rounded-md shadow-xs">
                        #{photo.hikeNumber}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {photo.caption && (
                      <p className="text-white text-[11px] italic font-semibold line-clamp-2 leading-relaxed bg-black/40 p-1.5 rounded-lg border border-white/10 backdrop-blur-3xs">
                        "{photo.caption}"
                      </p>
                    )}

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
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#EFEAE4] px-6 py-4.5 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center text-[#7ABA42]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1F1F1F]">Create community post</h3>
                  <p className="text-[11px] text-[#8B8680] font-medium">
                    Share your hike memories with Walk Nepal Walk
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                disabled={uploading}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Composer Body */}
            <div className="p-6 overflow-y-auto space-y-4.5 flex-1 min-h-0 bg-[#FCFAF7]">
              {stagedFiles.length === 0 ? (
                /* 1. INITIAL SELECT FLOW */
                <div className="space-y-4">
                  {/* Select Trek Dropdown first so they know where it goes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#1F1F1F] block">
                      Which hike are you sharing from?
                    </label>
                    <select
                      value={selectedUploadTrekId}
                      onChange={(e) => setSelectedUploadTrekId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#EFEAE4] rounded-xl text-xs font-bold text-[#1F1F1F] focus:outline-hidden focus:border-[#7ABA42] cursor-pointer shadow-xs"
                    >
                      {treks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.hike_number ? `Hike #${t.hike_number} - ` : ''}
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Big Dashed Dropzone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-200 bg-white hover:border-[#7ABA42] rounded-2xl p-10 text-center space-y-4 transition-all cursor-pointer shadow-xs group"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#7ABA42]/5 group-hover:bg-[#7ABA42]/10 flex items-center justify-center mx-auto transition-colors">
                      <Camera className="w-8 h-8 text-[#7ABA42]" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-[#1F1F1F]">
                        Drag and drop your hike photos here
                      </p>
                      <p className="text-[11px] text-[#8B8680] font-semibold">
                        Or click to browse your files
                      </p>
                    </div>
                    <p className="text-[10px] text-[#A39E98] max-w-xs mx-auto">
                      {isAdmin ? 'Unlimited admin uploads • Fast automatic compression' : 'Regular users can share up to 4 photos per day'}
                    </p>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                  </div>
                </div>
              ) : (
                /* 2. INSTAGRAM / FACEBOOK STYLE COMPOSER FLOW */
                <div className="space-y-4 bg-white border border-[#EFEAE4] rounded-2xl p-4.5 shadow-xs">
                  {/* User Profile Header & Album Selection */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F7F4EF]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#7ABA42] text-white text-xs font-black flex items-center justify-center">
                        {user?.displayName?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || 'H'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#1F1F1F]">
                          {user?.displayName || user?.email?.split('@')[0] || 'Nepal Hiker'}
                        </p>
                        <span className="text-[10px] text-[#8B8680] font-bold">Posting to Gallery</span>
                      </div>
                    </div>

                    {/* Album select bubble */}
                    <div className="shrink-0">
                      <select
                        value={selectedUploadTrekId}
                        onChange={(e) => setSelectedUploadTrekId(e.target.value)}
                        className="px-2.5 py-1.5 bg-[#FAF8F5] border border-[#EFEAE4] rounded-lg text-[11px] font-black text-[#1F1F1F] focus:outline-hidden focus:border-[#7ABA42] cursor-pointer shadow-2xs"
                      >
                        {treks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.hike_number ? `#${t.hike_number} ` : ''}
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Caption Textarea at the Top */}
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

                  {/* Staged Photo Previews with "x" deletes */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-[#8B8680] uppercase tracking-wider block">
                      Photos Selected ({stagedFiles.length})
                    </label>

                    {stagedFiles.length === 1 ? (
                      /* Single photo: Large beautiful preview */
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
                      /* Multiple photos: Horizontal list or Grid */
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
                        {/* "+" card to add more photos */}
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

                    {/* Hidden Native File Picker for Adding More */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    {/* Choose different files option */}
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#F7F4EF]">
                      <button
                        type="button"
                        onClick={() => {
                          stagedFiles.forEach((f) => URL.revokeObjectURL(f.url));
                          setStagedFiles([]);
                        }}
                        className="text-[#E08828] font-bold hover:underline"
                      >
                        Clear selected files
                      </button>
                      {stagedFiles.length < 4 && stagedFiles.length === 1 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#7ABA42] font-black hover:underline"
                        >
                          + Add more photos
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Feedbacks */}
              {uploadError && (
                <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-bold leading-relaxed shadow-2xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccessMsg && (
                <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-black shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            {stagedFiles.length > 0 && (
              <div className="px-6 py-4.5 border-t border-[#EFEAE4] bg-white flex justify-between items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    stagedFiles.forEach((f) => URL.revokeObjectURL(f.url));
                    setStagedFiles([]);
                    setUploadCaption('');
                  }}
                  className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#F2ECE4] border border-[#EFEAE4] text-[#8B8680] hover:text-[#1F1F1F] text-xs font-extrabold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handlePublishUpload}
                  disabled={uploading}
                  className="px-6 py-2.5 bg-[#7ABA42] hover:bg-[#6AA437] disabled:bg-stone-300 text-white text-xs font-black rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Sharing Post...</span>
                    </>
                  ) : (
                    <span>Publish Post</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-0 md:p-4 select-none overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mobileDiscussionOpen) {
              handleCloseLightbox();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Close Button (Desktop & Mobile) */}
          <button
            onClick={handleCloseLightbox}
            className="fixed top-3 right-3 md:top-4 md:right-4 z-[10020] w-10 h-10 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 text-white flex items-center justify-center border border-white/20 shadow-xl transition-all cursor-pointer active:scale-95"
            title="Close viewer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Controls */}
          {filteredPhotos.length > 1 && (
            <>
              <button
                onClick={handlePrevPhoto}
                disabled={activePhotoIndex <= 0}
                className="fixed left-2 md:left-4 z-[10010] w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center border border-white/15 transition-all cursor-pointer shadow-xl active:scale-95"
                title="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handleNextPhoto}
                disabled={activePhotoIndex >= filteredPhotos.length - 1}
                className="fixed right-2 md:right-4 z-[10010] w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center border border-white/15 transition-all cursor-pointer shadow-xl active:scale-95"
                title="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* DESKTOP VIEW (md:flex) - Side-by-side spacious modal */}
          <div
            className="hidden md:flex relative max-w-5xl w-full bg-[#121214] border border-stone-800 rounded-2xl overflow-hidden shadow-2xl flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left side: High-Res Image Panel */}
            <div className="flex-1 bg-black/70 flex flex-col items-center justify-center p-4 relative min-h-[350px]">
              <img
                src={activePhoto.url}
                alt="Community memory"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Right side: Sidebar with details & Comments */}
            <div className="w-[340px] lg:w-[380px] bg-[#0c0c0e] border-l border-stone-800 flex flex-col p-4 overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-3 text-white text-xs gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[#7ABA42] text-sm truncate">{activePhoto.uploadedBy}</span>
                    {activePhoto.hikeNumber && (
                      <span className="px-1.5 py-0.5 bg-white/20 text-white text-[9px] font-black rounded">
                        Hike #{activePhoto.hikeNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-0.5">
                    <span>{new Date(activePhoto.uploadedAt).toLocaleDateString()}</span>
                    {activePhoto.trekName && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{activePhoto.trekName}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={activePhoto.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    title="Download photo"
                  >
                    <Download className="w-4 h-4" />
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
                                  className="flex-1 py-1 bg-red-600 hover:bg-[#ff4444] rounded-lg text-[10px] font-black text-center text-white transition-colors cursor-pointer"
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

              {activePhoto.caption && (
                <p className="mb-4 text-xs font-bold italic text-stone-100 px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl leading-relaxed">
                  "{activePhoto.caption}"
                </p>
              )}

              {/* Photo Comments Section Component */}
              <div className="flex-1 min-h-0">
                <PhotoCommentsSection
                  photoId={activePhoto.id}
                  isDarkTheme={true}
                  onCommentCountChange={(cnt) => setActiveCommentCount(cnt)}
                />
              </div>
            </div>
          </div>

          {/* MOBILE VIEW (flex md:hidden) - Immersive Edge-to-Edge Photo with Slide-up Drawer */}
          <div
            className="flex md:hidden relative w-full h-[100dvh] flex-col justify-between overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Floating Glass Bar: Uploader badge + Hike tag + Download/Options */}
            <div className="absolute top-3 left-3 right-14 z-30 flex items-center justify-between pointer-events-auto">
              <div className="bg-black/70 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-xs shadow-lg max-w-[72%]">
                <span className="font-bold text-[#7ABA42] truncate">{activePhoto.uploadedBy}</span>
                {activePhoto.hikeNumber && (
                  <span className="px-1.5 py-0.2 bg-[#7ABA42]/30 text-emerald-300 text-[9px] font-black rounded shrink-0">
                    #{activePhoto.hikeNumber}
                  </span>
                )}
                <span className="text-stone-400 text-[10px] shrink-0">
                  {new Date(activePhoto.uploadedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={activePhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="p-2 bg-black/70 backdrop-blur-md hover:bg-black/90 text-white rounded-full border border-white/20 transition-colors shadow-lg"
                  title="Download photo"
                >
                  <Download className="w-4 h-4" />
                </a>

                {/* Mobile Options (...) Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-2 bg-black/70 backdrop-blur-md hover:bg-black/90 text-white rounded-full border border-white/20 transition-colors shadow-lg cursor-pointer"
                    title="More options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showOptionsMenu && (
                    <div
                      className="absolute right-0 top-full mt-2 w-44 bg-[#1F1F1F] border border-white/20 rounded-2xl shadow-2xl p-1.5 text-white z-[10050] animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(!viewerPovMode && ((user && user.uid === activePhoto.userUid) || isAdmin)) ? (
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
                                className="flex-1 py-1 bg-red-600 hover:bg-[#ff4444] rounded-lg text-[10px] font-black text-center text-white transition-colors cursor-pointer"
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

            {/* Immersive Photo Hero Area (Maximum Screen Real Estate on Mobile) */}
            <div className="flex-1 w-full flex items-center justify-center p-2 pt-14 pb-24 overflow-hidden">
              <img
                src={activePhoto.url}
                alt="Community memory"
                className="max-w-full max-h-[82dvh] object-contain rounded-2xl shadow-2xl transition-all"
              />
            </div>

            {/* Bottom Floating Overlay: Caption + Open Discussion Action Pill */}
            <div className="absolute bottom-3 inset-x-3 z-30 flex flex-col gap-2 pointer-events-auto">
              {/* Collapsible Floating Caption */}
              {activePhoto.caption && (
                <div
                  onClick={() => setCaptionExpanded(!captionExpanded)}
                  className="bg-black/75 backdrop-blur-md border border-white/20 p-2.5 rounded-2xl text-white shadow-xl cursor-pointer transition-all active:scale-99"
                >
                  <p className={`text-xs text-stone-100 font-medium leading-relaxed italic ${captionExpanded ? '' : 'line-clamp-2'}`}>
                    "{activePhoto.caption}"
                  </p>
                  {activePhoto.caption.length > 80 && (
                    <span className="text-[10px] font-bold text-[#7ABA42] mt-0.5 inline-block">
                      {captionExpanded ? 'Show less' : 'Read more...'}
                    </span>
                  )}
                </div>
              )}

              {/* Discussion Drawer Trigger Pill */}
              <button
                type="button"
                onClick={() => setMobileDiscussionOpen(true)}
                className="w-full py-2.5 px-4 bg-[#7ABA42] hover:bg-[#68A337] active:scale-98 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-2xl border border-white/20 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  {typeof activeCommentCount === 'number' && activeCommentCount > 0
                    ? `Comments (${activeCommentCount})`
                    : 'Comments'}
                </span>
              </button>
            </div>

            {/* Mobile Discussion Slide-Up Drawer */}
            {mobileDiscussionOpen && (
              <>
                {/* Drawer Backdrop */}
                <div
                  className="fixed inset-0 z-[10030] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
                  onClick={() => setMobileDiscussionOpen(false)}
                />

                {/* Bottom Sheet Modal */}
                <div
                  className="absolute bottom-0 inset-x-0 z-[10040] bg-[#121214] border-t border-stone-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] h-[75vh] animate-in slide-in-from-bottom duration-200 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drawer Drag Bar & Header */}
                  <div className="p-3 border-b border-stone-800/80 flex items-center justify-between shrink-0 bg-[#0e0e10]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#7ABA42] animate-pulse" />
                      <span className="font-bold text-white text-xs uppercase tracking-wider">
                        Comments {typeof activeCommentCount === 'number' && activeCommentCount > 0 ? `(${activeCommentCount})` : ''}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileDiscussionOpen(false)}
                      className="p-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                      title="Close comments"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Caption preview inside drawer if available */}
                  {activePhoto.caption && (
                    <div className="px-4 py-2 bg-stone-900/60 border-b border-stone-800/50 text-[11px] text-stone-300 italic">
                      "{activePhoto.caption}"
                    </div>
                  )}

                  {/* Comments Thread Area */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    <PhotoCommentsSection
                      photoId={activePhoto.id}
                      isDarkTheme={true}
                      onCommentCountChange={(cnt) => setActiveCommentCount(cnt)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
