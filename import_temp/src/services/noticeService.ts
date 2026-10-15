import { apiFetch } from './api';

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
 * Fetch the active notice board from the Cloudflare API,
 * with graceful local cache fallback.
 */
export async function fetchSiteNotice(forceFresh = false): Promise<SiteNotice | null> {
  try {
    const res = await apiFetch('notice', { forceFresh });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const remoteNotice = json.data as SiteNotice;
        try {
          localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(remoteNotice));
        } catch (_) {}
        return remoteNotice;
      }
    }
  } catch (err) {
    console.warn('[NoticeService] Failed to fetch remote notice:', err);
  }

  // Fallback to local cache if network/API unavailable
  try {
    const cached = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached) as SiteNotice;
    }
  } catch (_) {}

  return null;
}

/**
 * Save / publish notice from Admin Panel.
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
    const res = await apiFetch('admin/notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      forceFresh: true,
    });

    if (res.ok) {
      const json = await res.json();
      const saved = (json.data as SiteNotice) || payload;
      try {
        localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(saved));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('wnw-notice-updated', { detail: saved }));
      return saved;
    }
  } catch (err) {
    console.warn('[NoticeService] Error saving notice to backend:', err);
  }

  // Save to local cache as local fallback
  try {
    localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('wnw-notice-updated', { detail: payload }));
  return payload;
}

/**
 * Returns the ISO timestamp string of the last seen notice.
 */
export function getLastSeenNoticeTime(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

/**
 * Marks the notice as seen by storing its updatedAt timestamp in localStorage.
 */
export function markNoticeSeen(updatedAt: string): void {
  try {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, updatedAt);
    window.dispatchEvent(new CustomEvent('wnw-notice-seen', { detail: updatedAt }));
  } catch (_) {}
}

/**
 * Determines whether the notice modal should pop up for the user.
 * It will pop if:
 * 1. Notice is enabled.
 * 2. Notice is not expired.
 * 3. User has never seen this notice version, OR the notice updatedAt is newer than the user's last seen timestamp.
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

  const lastSeen = getLastSeenNoticeTime();
  if (!lastSeen) return true;

  const noticeUpdateTime = new Date(notice.updatedAt).getTime();
  const lastSeenTime = new Date(lastSeen).getTime();

  if (isNaN(noticeUpdateTime) || isNaN(lastSeenTime)) return true;

  // Notice was updated after the user last dismissed it -> Pop!
  return noticeUpdateTime > lastSeenTime;
}
