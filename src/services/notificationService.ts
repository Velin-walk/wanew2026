/**
 * Contextual In-App Notification Service
 * Tracks unread states for Treks/Events, Gallery photos, Leaderboard updates, and MapMiners contributions.
 * Lightweight, zero dependencies, persistent across sessions.
 */

import { apiFetch } from './api';
import { Trek } from '../types';

export interface NotificationStatus {
  hasUnread: boolean;
  count: number;
  targetId?: string;
  title?: string;
}

export interface NavigationNotifications {
  treks: NotificationStatus;
  gallery: NotificationStatus;
  leaderboard: NotificationStatus;
  mapminers: NotificationStatus;
}

const STORAGE_KEYS = {
  treks: 'wnw_last_seen_trek_id',
  gallery: 'wnw_last_seen_photo_id',
  leaderboard: 'wnw_last_seen_leaderboard_time',
  mapminers: 'wnw_last_seen_route_id',
};

let latestTrekIdCache = '';
let latestPhotoIdCache = '';
let latestRouteIdCache = '';

/**
 * Marks a specific section as read, removing its notification badge.
 */
export function markNotificationAsRead(
  category: 'treks' | 'gallery' | 'leaderboard' | 'mapminers',
  currentLatestId?: string
): void {
  try {
    const key = STORAGE_KEYS[category];
    if (category === 'leaderboard') {
      localStorage.setItem(key, String(Date.now() + 3600000));
    } else if (category === 'treks') {
      const idToStore = currentLatestId || latestTrekIdCache;
      if (idToStore) localStorage.setItem(key, idToStore);
    } else if (category === 'gallery') {
      const idToStore = currentLatestId || latestPhotoIdCache;
      if (idToStore) localStorage.setItem(key, idToStore);
    } else if (category === 'mapminers') {
      const idToStore = currentLatestId || latestRouteIdCache;
      if (idToStore) localStorage.setItem(key, idToStore);
    }
  } catch (_) {}
}

/**
 * Checks for unread events/treks.
 */
export function checkTreksNotification(treks: Trek[]): NotificationStatus {
  if (!treks || treks.length === 0) return { hasUnread: false, count: 0 };
  try {
    const lastSeenId = localStorage.getItem(STORAGE_KEYS.treks);
    // Find newest trek by date/hike_number
    const sorted = [...treks].sort((a, b) => {
      const numA = parseInt(String(a.hike_number || a.id).replace(/\D/g, '') || '0', 10);
      const numB = parseInt(String(b.hike_number || b.id).replace(/\D/g, '') || '0', 10);
      return numB - numA;
    });

    const newest = sorted[0];
    if (!newest) return { hasUnread: false, count: 0 };

    const newestId = String(newest.id || newest.hike_number);
    latestTrekIdCache = newestId;

    if (!lastSeenId) {
      // First visit: mark current as seen silently so user doesn't get flooded
      localStorage.setItem(STORAGE_KEYS.treks, newestId);
      return { hasUnread: false, count: 0 };
    }

    if (lastSeenId !== newestId) {
      return {
        hasUnread: true,
        count: 1,
        targetId: newestId,
        title: newest.name,
      };
    }
  } catch (_) {}
  return { hasUnread: false, count: 0 };
}

/**
 * Checks for unread community photos in the gallery.
 */
export async function checkGalleryNotification(): Promise<NotificationStatus> {
  try {
    const res = await apiFetch('trek_photos');
    if (!res.ok) return { hasUnread: false, count: 0 };
    const json = await res.json();
    const photos: any[] = json?.data || [];
    if (!Array.isArray(photos) || photos.length === 0) return { hasUnread: false, count: 0 };

    const lastSeenId = localStorage.getItem(STORAGE_KEYS.gallery);
    const newestPhoto = photos[0]; // Cloudflare orders desc
    const newestId = String(newestPhoto?.id || '');
    if (newestId) latestPhotoIdCache = newestId;

    if (!lastSeenId) {
      localStorage.setItem(STORAGE_KEYS.gallery, newestId);
      return { hasUnread: false, count: 0 };
    }

    if (newestId && lastSeenId !== newestId) {
      return {
        hasUnread: true,
        count: 1,
        targetId: newestPhoto.trekId || newestId,
        title: newestPhoto.trekName || 'New Photos',
      };
    }
  } catch (_) {}
  return { hasUnread: false, count: 0 };
}

/**
 * Checks for unread community map contributions in Map Miners.
 */
export async function checkMapMinersNotification(): Promise<NotificationStatus> {
  try {
    const res = await apiFetch('mapminers/trails');
    if (!res.ok) return { hasUnread: false, count: 0 };
    const json = await res.json();
    const trails: any[] = json?.data || [];
    if (!Array.isArray(trails) || trails.length === 0) return { hasUnread: false, count: 0 };

    const lastSeenId = localStorage.getItem(STORAGE_KEYS.mapminers);
    // Find newest route
    const sorted = [...trails].sort((a, b) => {
      const timeA = new Date(a.uploadedAt || a.created_at || 0).getTime();
      const timeB = new Date(b.uploadedAt || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const newest = sorted[0];
    const newestId = String(newest?.id || newest?.name || '');
    if (newestId) latestRouteIdCache = newestId;

    if (!lastSeenId) {
      localStorage.setItem(STORAGE_KEYS.mapminers, newestId);
      return { hasUnread: false, count: 0 };
    }

    if (newestId && lastSeenId !== newestId) {
      return {
        hasUnread: true,
        count: 1,
        targetId: newestId,
        title: newest.name,
      };
    }
  } catch (_) {}
  return { hasUnread: false, count: 0 };
}

/**
 * Checks for leaderboard standings update.
 */
export function checkLeaderboardNotification(lastUpdatedIso?: string): NotificationStatus {
  try {
    const lastSeenTime = Number(localStorage.getItem(STORAGE_KEYS.leaderboard) || '0');
    if (!lastSeenTime) {
      localStorage.setItem(STORAGE_KEYS.leaderboard, String(Date.now()));
      return { hasUnread: false, count: 0 };
    }

    if (lastUpdatedIso) {
      const serverTime = new Date(lastUpdatedIso).getTime();
      if (serverTime > lastSeenTime) {
        return { hasUnread: true, count: 1 };
      }
    }
  } catch (_) {}
  return { hasUnread: false, count: 0 };
}
