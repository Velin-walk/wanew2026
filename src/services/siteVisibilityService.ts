import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export interface SiteVisibilitySettings {
  // Main Navigation Tabs
  gallery: boolean;        // Community Gallery / Trek Photos
  vouchers: boolean;       // Payment Vouchers Upload feature
  mapminers: boolean;      // MapMiners GPS Trails & Offline Maps
  leaderboard: boolean;    // Community Leaderboard
  saved: boolean;          // Saved Hikes

  // Homepage Sections
  heroBanner: boolean;     // Hourly Rotating Hero Banner
  upcomingHikes: boolean;  // Upcoming Hikes Grid
  pastEvents: boolean;     // Past Events Archive
  prayerFlags: boolean;    // Authentic Nepali Prayer Flags Garland

  // Sub-pages / Info Modals
  paymentInfo: boolean;    // Payment & QR Guidelines
  reviews: boolean;        // Community Reviews & Testimonials
  blogs: boolean;          // Community Blogs & Stories
  trekTips: boolean;       // Trek Tips & Gear Guide
  safetyPolicy: boolean;   // Safety & Refund Policy
  privateTrek: boolean;    // Request Private Trek

  // Maintenance custom copy
  maintenanceNoticeTitle: string;
  maintenanceNoticeMessage: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_VISIBILITY_SETTINGS: SiteVisibilitySettings = {
  gallery: true,
  vouchers: true,
  mapminers: true,
  leaderboard: true,
  saved: true,

  heroBanner: true,
  upcomingHikes: true,
  pastEvents: true,
  prayerFlags: true,

  paymentInfo: true,
  reviews: true,
  blogs: true,
  trekTips: true,
  safetyPolicy: true,
  privateTrek: true,

  maintenanceNoticeTitle: 'Under Scheduled Maintenance',
  maintenanceNoticeMessage: 'This section is currently undergoing maintenance and upgrades. Please check back soon!',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

const STORAGE_KEY = 'wnw_site_visibility_settings';
const EVENT_NAME = 'wnw-visibility-updated';

/**
 * Returns the cached visibility settings from localStorage synchronously.
 * Guarantees zero-flicker on first page load.
 */
export function getCachedVisibilitySettings(): SiteVisibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VISIBILITY_SETTINGS, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_VISIBILITY_SETTINGS;
}

/**
 * Fetches latest settings from Firestore (pwa_metrics/site_visibility)
 */
export async function fetchSiteVisibilitySettings(): Promise<SiteVisibilitySettings> {
  try {
    const docRef = doc(db, 'pwa_metrics', 'site_visibility');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<SiteVisibilitySettings>;
      const merged = { ...DEFAULT_VISIBILITY_SETTINGS, ...data };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (_) {}
      return merged;
    }
  } catch (err) {
    console.warn('[SiteVisibility] Failed to fetch remote settings, using cache:', err);
  }
  return getCachedVisibilitySettings();
}

/**
 * Persists updated visibility settings to Firestore and localStorage,
 * broadcasting change to all active components.
 */
export async function saveSiteVisibilitySettings(
  settings: Partial<SiteVisibilitySettings>,
  adminEmail: string = 'admin'
): Promise<SiteVisibilitySettings> {
  const current = getCachedVisibilitySettings();
  const payload: SiteVisibilitySettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  // 1. Save synchronously to localStorage & broadcast immediately for zero-lag responsiveness
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  }

  // 2. Persist to Firestore in background (or catch permission errors gracefully)
  try {
    const docRef = doc(db, 'pwa_metrics', 'site_visibility');
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.warn('[SiteVisibility] Firestore sync warning (saved locally):', err);
  }

  return payload;
}

/**
 * React Hook to access reactive site visibility settings.
 * Synchronously initialized from localStorage to prevent UI flashing.
 */
export function useSiteVisibility(): {
  visibility: SiteVisibilitySettings;
  isSectionVisible: (key: keyof SiteVisibilitySettings) => boolean;
  loading: boolean;
} {
  const [visibility, setVisibility] = useState<SiteVisibilitySettings>(() => getCachedVisibilitySettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for local broadcast events
    const handleLocalUpdate = (e: Event) => {
      const custom = e as CustomEvent<SiteVisibilitySettings>;
      if (custom.detail) {
        setVisibility(custom.detail);
      }
    };
    window.addEventListener(EVENT_NAME, handleLocalUpdate);

    // 2. Real-time Firestore subscription
    let unsubscribe = () => {};
    try {
      const docRef = doc(db, 'pwa_metrics', 'site_visibility');
      unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<SiteVisibilitySettings>;
            const merged = { ...DEFAULT_VISIBILITY_SETTINGS, ...data };
            setVisibility(merged);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch (_) {}
          }
          setLoading(false);
        },
        (err) => {
          console.warn('[SiteVisibility] Snapshot listener error:', err);
          setLoading(false);
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      window.removeEventListener(EVENT_NAME, handleLocalUpdate);
      unsubscribe();
    };
  }, []);

  const isSectionVisible = (key: keyof SiteVisibilitySettings): boolean => {
    return Boolean(visibility[key]);
  };

  return { visibility, isSectionVisible, loading };
}
