import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type NoticeType = 'info' | 'urgent' | 'event' | 'maintenance';

export interface SiteNotice {
  id?: string;
  enabled: boolean;
  title: string;
  message: string;
  type: NoticeType;
  ctaText?: string;
  ctaLink?: string;
  expiresAt?: string;
  updatedAt: string;
}

const NOTICE_STORAGE_KEY = 'wnw_site_notice_cache';
const LAST_SEEN_STORAGE_KEY = 'wnw_last_seen_notice_time';
const FIRESTORE_COLLECTION = 'pwa_metrics';
const FIRESTORE_DOC_ID = 'site_notice_board';

export const DEFAULT_NOTICE: SiteNotice = {
  enabled: false,
  title: 'Himalayan Trekking Season Update',
  message: 'Welcome to Walk Nepal Walk! Check out our upcoming weekend hikes and live roster for open spots.',
  type: 'info',
  ctaText: 'Explore Upcoming Hikes',
  ctaLink: '#treks',
  updatedAt: new Date().toISOString(),
};

/**
 * Fetch the active notice board from Firestore,
 * with graceful local cache fallback.
 */
export async function fetchSiteNotice(forceFresh = false): Promise<SiteNotice | null> {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        const remoteNotice: SiteNotice = {
          enabled: Boolean(data.enabled),
          title: String(data.title || '').trim(),
          message: String(data.message || '').trim(),
          type: (data.type as NoticeType) || 'info',
          ctaText: String(data.ctaText || '').trim(),
          ctaLink: String(data.ctaLink || '').trim(),
          expiresAt: String(data.expiresAt || '').trim(),
          updatedAt: String(data.updatedAt || new Date().toISOString()),
        };
        try {
          localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(remoteNotice));
        } catch (_) {}
        return remoteNotice;
      }
    }
  } catch (err) {
    console.warn('[NoticeService] Failed to fetch notice from Firestore:', err);
  }

  // Fallback to local cache if Firestore is unreachable/offline
  try {
    const cached = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached) as SiteNotice;
    }
  } catch (_) {}

  return null;
}

/**
 * Save / publish notice from Admin Panel directly to Firestore.
 * Sets updatedAt to current timestamp so it pops for all users.
 */
export async function saveSiteNotice(notice: Partial<SiteNotice>): Promise<SiteNotice> {
  const nowIso = new Date().toISOString();
  const payload: SiteNotice = {
    enabled: Boolean(notice.enabled),
    title: (notice.title || '').trim(),
    message: (notice.message || '').trim(),
    type: notice.type || 'info',
    ctaText: (notice.ctaText || '').trim(),
    ctaLink: (notice.ctaLink || '').trim(),
    expiresAt: notice.expiresAt || '',
    updatedAt: nowIso,
  };

  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    try {
      localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('wnw-notice-updated', { detail: payload }));
    return payload;
  } catch (err) {
    console.warn('[NoticeService] Error saving notice to Firestore:', err);
  }

  // Save to local cache as local fallback
  try {
    localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('wnw-notice-updated', { detail: payload }));
  return payload;
}

// In-memory dismissal state scoped to the user's site visit session
let dismissedNoticeUpdatedAt: string | null = null;

/**
 * Returns the ISO timestamp string of the last seen notice in this visit, if dismissed.
 */
export function getLastSeenNoticeTime(): string | null {
  return dismissedNoticeUpdatedAt;
}

/**
 * Marks the notice as dismissed for this visit when the visitor clicks "Got it".
 */
export function markNoticeSeen(updatedAt: string): void {
  try {
    dismissedNoticeUpdatedAt = updatedAt;
    // Clear legacy permanent storage key if present so it doesn't linger
    try {
      localStorage.removeItem(LAST_SEEN_STORAGE_KEY);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('wnw-notice-seen', { detail: updatedAt }));
  } catch (_) {}
}

/**
 * Determines whether the notice modal should pop up for the user.
 * It will pop every time the user visits the site if:
 * 1. Notice is enabled.
 * 2. Notice has title or message.
 * 3. Notice is not expired.
 * 4. Visitor has not already clicked "Got it" to dismiss this notice during their current visit.
 */
export function shouldPopNotice(notice: SiteNotice | null): boolean {
  if (!notice || !notice.enabled) return false;
  if (!notice.title.trim() && !notice.message.trim()) return false;

  // Check expiration date
  if (notice.expiresAt) {
    const expiryTime = new Date(notice.expiresAt).getTime();
    if (!isNaN(expiryTime) && expiryTime < Date.now()) {
      return false;
    }
  }

  // If visitor already clicked "Got it" to dismiss this notice during this visit, stay dismissed
  if (dismissedNoticeUpdatedAt && dismissedNoticeUpdatedAt === notice.updatedAt) {
    return false;
  }

  // Notice pops every time user visits the site
  return true;
}
