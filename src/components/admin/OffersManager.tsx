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
  Archive,
  RotateCcw,
  Copy,
  X,
  Layers,
  Edit,
  EyeOff,
} from 'lucide-react';
import { apiFetch, uploadImageToR2WithProgress, recordAdminAuditLog } from '../../services/api';
import {
  useSiteVisibility,
  saveSiteVisibilitySettings,
} from '../../services/siteVisibilityService';

export const OFFER_TREK_ID = 'OFFER_FLASHCARD';
export const OFFERS_STORAGE_KEY = 'wnw_offers_cache';
export const ARCHIVED_OFFERS_STORAGE_KEY = 'wnw_archived_offers_list';

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
  const [archivedOffers, setArchivedOffers] = useState<OfferItem[]>(() => {
    try {
      const cached = localStorage.getItem(ARCHIVED_OFFERS_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      const rawGallery = localStorage.getItem('wnw_flashcards_gallery_archive');
      if (rawGallery) {
        const parsed = JSON.parse(rawGallery);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [offersViewTab, setOffersViewTab] = useState<'active' | 'archived' | 'all'>('active');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
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

  // Site visibility toggle state for Flashcards Banner
  const { visibility } = useSiteVisibility();
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const isPublicVisible = visibility.flashcards !== false;

  // Edit Offer Modal state
  const [editingOffer, setEditingOffer] = useState<OfferItem | null>(null);
  const [editOfferText, setEditOfferText] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editCardColor, setEditCardColor] = useState('orange');
  const [editDirectUrl, setEditDirectUrl] = useState('');
  const [editSelectedImage, setEditSelectedImage] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

          // Auto-sync any expired items into archivedOffers so they are permanently preserved
          const expiredItems = sorted.filter((item) => !isNotExpired(item));
          if (expiredItems.length > 0) {
            setArchivedOffers((prev) => {
              const merged = [...expiredItems, ...prev].filter(
                (item, index, self) => index === self.findIndex((t) => t.id === item.id)
              );
              try {
                localStorage.setItem(ARCHIVED_OFFERS_STORAGE_KEY, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }

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

      // Record in Admin Audit Trail
      const offerTitle = offerText || 'Special Offer';
      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `Published offer flashcard: "${offerTitle.slice(0, 45)}"`,
        metadata: {
          offer_id: newRecord.id,
          title: offerTitle,
          color: cardColor,
          expires_at: expiresAtIso || 'None',
          url: finalImageUrl,
        },
        adminEmail: currentUserEmail,
      });

      // Auto-save existing past offers to the archived list so they are never lost
      if (offers.length > 0) {
        const pastOffersList: OfferItem[] = offers.map((item) => {
          const meta = parseOfferMetadata(item);
          return {
            ...item,
            color: meta.color || item.color,
            expiresAt: meta.expiresAt || item.expiresAt,
          };
        });

        setArchivedOffers((prev) => {
          const merged = [...pastOffersList, ...prev].filter(
            (item, index, self) => index === self.findIndex((t) => t.id === item.id)
          );
          try {
            localStorage.setItem(ARCHIVED_OFFERS_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          return merged;
        });

        // Background backup to D1 OFFER_ARCHIVE for multi-device persistence
        pastOffersList.forEach(async (pastItem) => {
          try {
            await apiFetch('trek_photos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...pastItem,
                id: pastItem.id.startsWith('archived_') ? pastItem.id : `archived_${pastItem.id}`,
                trekId: 'OFFER_ARCHIVE',
                trekName: 'Archived Offer',
              }),
            });
          } catch {}
        });
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
        text: 'Offer / Flashcard published successfully! Past offers auto-saved to archive.',
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

  const handleArchiveOffer = async (item: OfferItem) => {
    setStatusMsg(null);
    try {
      const meta = parseOfferMetadata(item);
      const archivedItem: OfferItem = {
        ...item,
        color: meta.color || item.color,
        expiresAt: meta.expiresAt || item.expiresAt,
      };

      const updatedArchived = [archivedItem, ...archivedOffers.filter((a) => a.id !== item.id)];
      setArchivedOffers(updatedArchived);
      try {
        localStorage.setItem(ARCHIVED_OFFERS_STORAGE_KEY, JSON.stringify(updatedArchived));
      } catch {}

      // Delete from active list
      await apiFetch(`trek_photos/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const updatedActive = offers.filter((o) => o.id !== item.id);
      setOffers(updatedActive);
      try {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(updatedActive));
      } catch {}

      // Record in Admin Audit Trail
      const offerTitle = cleanOfferCaption(item.caption) || item.id;
      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `Archived offer flashcard: "${offerTitle.slice(0, 45)}"`,
        metadata: {
          offer_id: item.id,
          title: offerTitle,
          action: 'archive',
        },
        adminEmail: currentUserEmail,
      });

      window.dispatchEvent(new CustomEvent('wnw-offers-updated'));

      setStatusMsg({
        text: 'Offer successfully archived to past offers list.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Failed to archive offer.',
        type: 'error',
      });
    }
  };

  const handleRestoreArchivedOffer = async (item: OfferItem) => {
    setStatusMsg(null);
    try {
      const meta = parseOfferMetadata(item);
      const restoredRecord: OfferItem = {
        ...item,
        id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trekId: OFFER_TREK_ID,
        uploadedAt: new Date().toISOString(),
        color: meta.color || item.color || 'orange',
      };

      const saveRes = await apiFetch('trek_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restoredRecord),
      });

      if (!saveRes.ok) {
        throw new Error('Could not restore offer to active list.');
      }

      const updatedActive = [restoredRecord, ...offers];
      setOffers(updatedActive);
      try {
        localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(updatedActive));
      } catch {}

      // Record in Admin Audit Trail
      const offerTitle = cleanOfferCaption(item.caption) || item.id;
      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `Restored offer flashcard from archive: "${offerTitle.slice(0, 45)}"`,
        metadata: {
          offer_id: restoredRecord.id,
          title: offerTitle,
          action: 'restore',
        },
        adminEmail: currentUserEmail,
      });

      window.dispatchEvent(new CustomEvent('wnw-offers-updated'));
      setOffersViewTab('active');

      setStatusMsg({
        text: 'Archived offer restored to active homepage offers!',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Failed to restore offer.',
        type: 'error',
      });
    }
  };

  const handleReuseArchivedOffer = (item: OfferItem) => {
    const meta = parseOfferMetadata(item);
    if (item.url) {
      setDirectUrl(item.url);
      setSelectedImage(null);
    }
    setOfferText(cleanOfferCaption(item.caption));
    setCardColor(meta.color || item.color || 'orange');
    if (meta.expiresAt) {
      try {
        // If deadline hasn't passed, keep it; otherwise blank out so admin can pick new date
        const dt = new Date(meta.expiresAt);
        if (dt.getTime() > Date.now()) {
          setDeadline(dt.toISOString().slice(0, 16));
        } else {
          setDeadline('');
        }
      } catch {
        setDeadline('');
      }
    } else {
      setDeadline('');
    }

    setStatusMsg({
      text: 'Archived offer details loaded into the creation form above. Edit and publish anytime!',
      type: 'success',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTogglePublicVisibility = async () => {
    const nextState = !isPublicVisible;
    setTogglingVisibility(true);
    setStatusMsg(null);
    try {
      await saveSiteVisibilitySettings(
        { flashcards: nextState },
        currentUserEmail || 'admin'
      );
      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `${nextState ? 'Turned ON' : 'Turned OFF'} Homepage Flashcards public display`,
        metadata: {
          public_visible: nextState,
        },
        adminEmail: currentUserEmail,
      });
      setStatusMsg({
        text: nextState
          ? 'Homepage Flashcards & Special Offers are now VISIBLE to the public.'
          : 'Homepage Flashcards & Special Offers are now HIDDEN from public view.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || 'Failed to update flashcard visibility setting.',
        type: 'error',
      });
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleOpenEditOffer = (item: OfferItem) => {
    const meta = parseOfferMetadata(item);
    setEditingOffer(item);
    setEditOfferText(cleanOfferCaption(item.caption));
    setEditCardColor(meta.color || item.color || 'orange');
    setEditDirectUrl(item.url || '');
    setEditSelectedImage(null);
    if (meta.expiresAt) {
      try {
        const dt = new Date(meta.expiresAt);
        if (!isNaN(dt.getTime())) {
          setEditDeadline(dt.toISOString().slice(0, 16));
        } else {
          setEditDeadline('');
        }
      } catch {
        setEditDeadline('');
      }
    } else {
      setEditDeadline('');
    }
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditSelectedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleSaveEditOffer = async () => {
    if (!editingOffer) return;
    const sourceImage = editSelectedImage || editDirectUrl.trim() || editingOffer.url;
    if (!sourceImage) {
      setStatusMsg({
        text: 'Please provide an image for the flashcard offer.',
        type: 'error',
      });
      return;
    }
    if (!editOfferText.trim()) {
      setStatusMsg({
        text: 'Please enter offer text or announcement details.',
        type: 'error',
      });
      return;
    }

    setSavingEdit(true);
    setStatusMsg(null);

    try {
      let finalImageUrl = sourceImage;
      let publicId = editingOffer.publicId || '';

      if (sourceImage.startsWith('data:') || sourceImage.startsWith('blob:')) {
        const blob = await dataUrlToBlob(sourceImage);
        const uploadData = await uploadImageToR2WithProgress(blob, 'offers');
        finalImageUrl = uploadData.url;
        publicId = uploadData.fileName || '';
      }

      const expiresAtIso = editDeadline ? new Date(editDeadline).toISOString() : '';
      const metaPayload = JSON.stringify({ color: editCardColor, expiresAt: expiresAtIso });
      const encodedHikeNumber = `OFFER|${editCardColor}|${expiresAtIso}`;
      const encodedCaption = `${editOfferText.trim()} [color:${editCardColor}]${expiresAtIso ? ` [expires:${expiresAtIso}]` : ''}`;

      const updatedRecord: OfferItem = {
        ...editingOffer,
        url: finalImageUrl,
        publicId: metaPayload,
        hikeNumber: encodedHikeNumber,
        caption: encodedCaption,
        color: editCardColor,
        expiresAt: expiresAtIso || undefined,
      };

      // 1. Delete previous version by ID in D1
      await apiFetch(`trek_photos/${encodeURIComponent(editingOffer.id)}`, {
        method: 'DELETE',
      });

      // 2. Re-insert updated record with same ID in D1
      const saveRes = await apiFetch('trek_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      });

      if (!saveRes.ok) {
        throw new Error(`Failed to save updated offer (HTTP ${saveRes.status})`);
      }

      // Update active offers list if it was active
      const wasActive = offers.some((o) => o.id === editingOffer.id);
      if (wasActive) {
        const newOffers = offers.map((o) => (o.id === editingOffer.id ? updatedRecord : o));
        setOffers(newOffers);
        try {
          localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(newOffers));
        } catch {}
      }

      // Update archived offers list if it was archived
      const wasArchived = archivedOffers.some((a) => a.id === editingOffer.id);
      if (wasArchived) {
        const newArchived = archivedOffers.map((a) => (a.id === editingOffer.id ? updatedRecord : a));
        setArchivedOffers(newArchived);
        try {
          localStorage.setItem(ARCHIVED_OFFERS_STORAGE_KEY, JSON.stringify(newArchived));
        } catch {}
      }

      // Keep gallery archive updated
      try {
        const rawArchive = localStorage.getItem('wnw_flashcards_gallery_archive');
        const existingArchive: OfferItem[] = rawArchive ? JSON.parse(rawArchive) : [];
        const mergedArchive = [updatedRecord, ...existingArchive.filter((item) => item.id !== updatedRecord.id)];
        localStorage.setItem('wnw_flashcards_gallery_archive', JSON.stringify(mergedArchive));
      } catch {}

      // Broadcast update to live homepage banner
      window.dispatchEvent(new CustomEvent('wnw-offers-updated'));

      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `Edited offer flashcard: "${editOfferText.slice(0, 45)}"`,
        metadata: {
          offer_id: editingOffer.id,
          title: editOfferText,
          color: editCardColor,
          expires_at: expiresAtIso || 'None',
          url: finalImageUrl,
        },
        adminEmail: currentUserEmail,
      });

      setStatusMsg({
        text: 'Offer / Flashcard successfully updated!',
        type: 'success',
      });
      setEditingOffer(null);
    } catch (err: any) {
      console.error('Error updating offer:', err);
      setStatusMsg({
        text: err?.message || 'Failed to update offer.',
        type: 'error',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteArchivedOffer = (id: string) => {
    const deletedItem = archivedOffers.find((item) => item.id === id);
    const offerTitle = deletedItem ? (cleanOfferCaption(deletedItem.caption) || id) : id;
    const updated = archivedOffers.filter((item) => item.id !== id);
    setArchivedOffers(updated);
    try {
      localStorage.setItem(ARCHIVED_OFFERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_OFFERS',
      description: `Removed offer flashcard from archive: "${offerTitle.slice(0, 45)}"`,
      metadata: {
        offer_id: id,
        title: offerTitle,
        action: 'delete_archived',
      },
      adminEmail: currentUserEmail,
    });

    setStatusMsg({
      text: 'Offer removed from archive.',
      type: 'success',
    });
  };

  const handleClearAllArchived = () => {
    if (!window.confirm('Are you sure you want to clear all archived past offers? This cannot be undone.')) {
      return;
    }
    const count = archivedOffers.length;
    setArchivedOffers([]);
    try {
      localStorage.removeItem(ARCHIVED_OFFERS_STORAGE_KEY);
    } catch {}

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_OFFERS',
      description: `Cleared all archived past offer flashcards (${count} items removed)`,
      metadata: {
        cleared_count: count,
        action: 'clear_all_archived',
      },
      adminEmail: currentUserEmail,
    });

    setStatusMsg({
      text: 'All archived past offers have been cleared.',
      type: 'success',
    });
  };

  const handleDeleteOffer = async (id: string) => {
    const deletedItem = offers.find((item) => item.id !== id);
    const offerTitle = deletedItem ? (cleanOfferCaption(deletedItem.caption) || id) : id;
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

      // Record in Admin Audit Trail
      recordAdminAuditLog({
        actionType: 'UPDATE_OFFERS',
        description: `Deleted offer flashcard: "${offerTitle.slice(0, 45)}"`,
        metadata: {
          offer_id: id,
          title: offerTitle,
          action: 'delete',
        },
        adminEmail: currentUserEmail,
      });

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

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            {/* Public View Toggle */}
            <button
              type="button"
              onClick={handleTogglePublicVisibility}
              disabled={togglingVisibility}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-3xs active:scale-95 disabled:opacity-60 ${
                isPublicVisible
                  ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
              }`}
              title={isPublicVisible ? 'Click to hide flashcards from visitors' : 'Click to show flashcards to visitors'}
            >
              {togglingVisibility ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPublicVisible ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span>Public View: {isPublicVisible ? 'ON (Visible)' : 'OFF (Hidden)'}</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Tag className="w-3.5 h-3.5 text-[#E08828]" />
              <span>{offers.filter(isNotExpired).length} Active Offers</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold">
              <Archive className="w-3.5 h-3.5 text-stone-600" />
              <span>{archivedOffers.length} Archived Past</span>
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

        {/* Navigation Tabs between Active Offers and Archived Past Offers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFEAE4] pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setOffersViewTab('active')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                offersViewTab === 'active'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-stone-100 text-[#5A5551] hover:bg-stone-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Active Offers ({offers.filter(isNotExpired).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setOffersViewTab('archived')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                offersViewTab === 'archived'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-stone-100 text-[#5A5551] hover:bg-stone-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archived Past Offers ({archivedOffers.length})</span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500 text-white">Auto-Saved</span>
            </button>

            <button
              type="button"
              onClick={() => setOffersViewTab('all')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                offersViewTab === 'all'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'text-[#8B8680] hover:bg-stone-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View Both</span>
            </button>
          </div>

          {offersViewTab === 'archived' && archivedOffers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllArchived}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Archive</span>
            </button>
          )}
        </div>

        {/* Active Offers Section */}
        {(offersViewTab === 'active' || offersViewTab === 'all') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>Current / Active Offers ({offers.length})</span>
              </h3>
            </div>

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
                          <div
                            onClick={() => setZoomImageUrl(item.url)}
                            className="relative cursor-pointer group shrink-0"
                            title="Click to zoom image"
                          >
                            <img
                              src={item.url}
                              alt="Offer thumbnail"
                              className="w-24 h-auto max-h-24 rounded-xl object-contain border border-[#EFEAE4] bg-stone-100 group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>
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

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditOffer(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                          title="Edit this offer flashcard"
                        >
                          <Edit className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleArchiveOffer(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Move to archived past offers"
                        >
                          <Archive className="w-3.5 h-3.5 text-stone-500" />
                          <span>Archive</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(item.id)}
                          disabled={deletingId === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {offersViewTab === 'active' && archivedOffers.length > 0 && (
              <div
                onClick={() => setOffersViewTab('archived')}
                className="p-3 bg-stone-50 hover:bg-stone-100 border border-[#EFEAE4] rounded-2xl flex items-center justify-between cursor-pointer text-xs font-bold text-[#5A5551] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-emerald-600" />
                  <span>Looking for past announcements? You have <strong>{archivedOffers.length} auto-saved archived offers</strong>.</span>
                </div>
                <span className="text-amber-600 hover:underline">View Archived List →</span>
              </div>
            )}
          </div>
        )}

        {/* Archived Past Offers Section */}
        {(offersViewTab === 'archived' || offersViewTab === 'all') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Archived Past Offers ({archivedOffers.length})</span>
                </h3>
                <p className="text-[11px] text-[#8B8680] mt-0.5">
                  Whenever you add new offers, past offers are automatically saved here so they are never lost. You can restore or re-use any past offer anytime.
                </p>
              </div>
            </div>

            {archivedOffers.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-[#D5D1CB] text-center space-y-1.5 bg-[#FAF8F5]/50">
                <Archive className="w-8 h-8 text-[#8B8680] mx-auto opacity-60" />
                <p className="text-xs font-bold text-[#1F1F1F]">No archived past offers yet</p>
                <p className="text-[11px] text-[#8B8680]">
                  When you publish new offers, your previous offers will automatically be archived and safely kept here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedOffers.map((item) => {
                  const meta = parseOfferMetadata(item);
                  const itemColor = meta.color || item.color || 'orange';
                  const itemExpires = meta.expiresAt || item.expiresAt;
                  const displayCaption = cleanOfferCaption(item.caption);

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl p-4 border border-[#E5E1DB] bg-white hover:bg-stone-50/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        {item.url && (
                          <div
                            onClick={() => setZoomImageUrl(item.url)}
                            className="relative cursor-pointer group shrink-0"
                            title="Click to zoom image"
                          >
                            <img
                              src={item.url}
                              alt="Archived Offer thumbnail"
                              className="w-24 h-auto max-h-24 rounded-xl object-contain border border-[#EFEAE4] bg-stone-100 group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-stone-800 text-white text-[10px] font-black uppercase flex items-center gap-1">
                              <Archive className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Archived (Auto-Saved)</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 border text-stone-800">
                              Theme: {itemColor}
                            </span>
                            <span className="text-[11px] text-[#8B8680]">
                              Originally published {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : 'Earlier'} {item.uploadedBy ? `by ${item.uploadedBy}` : ''}
                            </span>
                            {itemExpires && (
                              <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-500" />
                                Deadline was: {new Date(itemExpires).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#1F1F1F] leading-relaxed whitespace-pre-line">
                            {displayCaption || 'No description text'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditOffer(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                          title="Edit this offer flashcard"
                        >
                          <Edit className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestoreArchivedOffer(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Restore this offer back to the active homepage banner"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Restore as Active</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReuseArchivedOffer(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Copy details into creation form above"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-600" />
                          <span>Re-use in Form</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteArchivedOffer(item.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Delete from archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Offer Modal */}
      {editingOffer && (
        <div className="fixed inset-0 z-[2500] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E1DB] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#EFEAE4] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                  <Edit className="w-5 h-5 text-[#E08828]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1F1F1F]">Edit Offer / Flashcard</h3>
                  <p className="text-xs text-[#8B8680]">Update image, announcement message, card theme color, or expiry deadline.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview & Replacement */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#5A5551]">1. Offer Image</label>
              {(editSelectedImage || editDirectUrl.trim() || editingOffer.url) && (
                <div className="relative w-full max-h-48 rounded-2xl bg-stone-100 border border-[#EFEAE4] overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={editSelectedImage || editDirectUrl.trim() || editingOffer.url}
                    alt="Current offer"
                    className="max-h-44 object-contain rounded-xl"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="py-2.5 px-3 bg-stone-50 hover:bg-stone-100 border border-dashed border-[#D5D1CB] rounded-xl text-xs font-bold text-[#1F1F1F] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#7ABA42]" />
                  <span>Upload Replacement Image</span>
                </button>

                <div className="relative">
                  <input
                    type="text"
                    value={editDirectUrl}
                    onChange={(e) => {
                      setEditDirectUrl(e.target.value);
                      if (e.target.value.trim()) setEditSelectedImage(null);
                    }}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden text-[#1F1F1F]"
                  />
                  <LinkIcon className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* Offer Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5A5551]">
                2. Offer Text / Announcement Details *
              </label>
              <textarea
                rows={3}
                value={editOfferText}
                onChange={(e) => setEditOfferText(e.target.value)}
                placeholder="Enter offer text..."
                className="w-full p-3 bg-white border border-[#E5E1DB] rounded-xl text-xs focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden text-[#1F1F1F]"
              />
            </div>

            {/* Deadline & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5A5551] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
                  <span>Removal Deadline (Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#1F1F1F] focus:ring-2 focus:ring-[#7ABA42]/20 focus:border-[#7ABA42] outline-hidden"
                />
                {editDeadline && (
                  <button
                    type="button"
                    onClick={() => setEditDeadline('')}
                    className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                  >
                    Clear deadline (keep active indefinitely)
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5A5551] flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-[#E08828]" />
                  <span>Card Theme Color</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {[
                    { id: 'orange', label: 'Orange', bg: 'bg-amber-500', ring: 'ring-amber-400' },
                    { id: 'green', label: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
                    { id: 'blue', label: 'Blue', bg: 'bg-sky-500', ring: 'ring-sky-400' },
                    { id: 'red', label: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-400' },
                    { id: 'yellow', label: 'Yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-300' },
                    { id: 'purple', label: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-400' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditCardColor(c.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${c.bg} ${
                        c.id === 'yellow' ? 'text-stone-900' : 'text-white'
                      } ${
                        editCardColor === c.id ? `ring-2 ${c.ring} ring-offset-2 scale-105 shadow-xs` : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview within Edit Modal */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#5A5551] flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-[#7ABA42]" /> Updated Live Preview:
              </span>
              {(() => {
                const theme = getOfferThemeStyles(editCardColor);
                const previewImg = editSelectedImage || editDirectUrl.trim() || editingOffer.url;
                return (
                  <div className={`relative ${theme.cardBg} rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center gap-3 border ${theme.border}`}>
                    {previewImg && (
                      <div className="w-full sm:max-w-xs rounded-xl overflow-hidden shrink-0">
                        <img
                          src={previewImg}
                          alt="Edit Preview"
                          className="w-full h-auto max-h-36 object-contain rounded-xl"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1 w-full text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${theme.badgeBg}`}>
                          <Tag className={`w-3 h-3 ${theme.badgeIcon}`} />
                          <span>Special Offer</span>
                        </span>
                        {editDeadline && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900/30 text-white text-[10px] font-bold border border-white/20">
                            <Clock className="w-3 h-3" />
                            <span>Deadline: {new Date(editDeadline).toLocaleString()}</span>
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${theme.textMain}`}>
                        {editOfferText.trim() || 'Offer description text will appear here...'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EFEAE4]">
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                disabled={savingEdit}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditOffer}
                disabled={savingEdit || !editOfferText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] disabled:bg-stone-300 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full Image Zoom */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomImageUrl}
              alt="Offer full preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-3 -right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
