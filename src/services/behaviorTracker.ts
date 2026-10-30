/**
 * Lightweight Client-Side Behavior Tracking Service
 * Batches anonymous interaction telemetry and sends directly to Cloudflare D1.
 * Non-blocking, battery-friendly, zero external dependencies.
 */

import { CLOUDFLARE_WORKER_URL } from './api';
import { getAdminDeviceMetadata } from '../adminUtils';

export interface BehaviorEvent {
  id?: string;
  sessionId?: string;
  userEmail?: string | null;
  eventType: string;
  category: 'discovery' | 'mapping' | 'funnel' | 'search' | 'engagement';
  targetId?: string | null;
  metadata?: Record<string, any>;
  createdAt?: string;
}

const STORAGE_SESSION_KEY = 'wnw_behavior_session_id';
const STORAGE_LAST_ACTIVE_KEY = 'wnw_behavior_last_active';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
const FLUSH_INTERVAL_MS = 25000;          // Flush queue every 25 seconds
const MAX_QUEUE_SIZE = 8;                 // Or immediately when 8 events accumulate
const MAX_BACKLOG_SIZE = 30;              // Max re-queued items on network failure

// In-memory queue
let eventQueue: BehaviorEvent[] = [];
let flushTimer: any = null;

export function getDeviceInfo(): Record<string, any> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua) || isIPadOS;
  const isMobile = !isTablet && /Mobi|iPhone|Android/i.test(ua);

  const adminMeta = getAdminDeviceMetadata();

  return {
    deviceType: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    lang: navigator.language || 'en',
    user_agent: ua,
    device_id: adminMeta.device_id,
    device_name: adminMeta.device_name
  };
}

/**
 * Returns or creates an anonymous session identifier stored in browser sessionStorage
 * with a 30-minute inactivity timeout.
 */
export function getBehaviorSessionId(): string {
  try {
    if (typeof window === 'undefined') return 'server_session';

    const now = Date.now();
    const lastActiveStr = sessionStorage.getItem(STORAGE_LAST_ACTIVE_KEY) || localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;

    let sid = sessionStorage.getItem(STORAGE_SESSION_KEY);

    // Rotate session if inactive for > 30 minutes or not set
    if (!sid || (lastActive > 0 && now - lastActive > SESSION_TIMEOUT_MS)) {
      sid = `sess_${now}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(STORAGE_SESSION_KEY, sid);
    }

    sessionStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    return sid;
  } catch {
    return 'anonymous_session';
  }
}

/**
 * Returns user email if currently authenticated or cached from prior registration.
 */
function getCachedUserEmail(): string | null {
  try {
    const dev = localStorage.getItem('wnw_dev_user');
    if (dev) {
      const p = JSON.parse(dev);
      if (p?.email) return p.email;
    }
    const prof = localStorage.getItem('wnw_user_registration_profile');
    if (prof) {
      const p = JSON.parse(prof);
      if (p?.email || p?.email_address) return p.email || p.email_address;
    }
  } catch {}
  return null;
}

/**
 * Flushes the current queue to the Cloudflare Worker.
 */
export async function flushBehaviorEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  const baseUrl = (CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
  const endpoint = baseUrl ? `${baseUrl}/behavior_events` : '/api/behavior_events';

  const payload = JSON.stringify({ events: batch });

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'text/plain' });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });

    if (!res.ok) {
      throw new Error(`Server status ${res.status}`);
    }
  } catch (err) {
    // Non-blocking retry: re-queue unsent events at the front with a max backlog cap
    eventQueue = [...batch, ...eventQueue].slice(0, MAX_BACKLOG_SIZE);
    console.debug('[BehaviorTracker] Failed to flush events, re-queued:', err);
  }
}

/**
 * Main tracking dispatcher. Enqueues an event and schedules background flush.
 */
export function trackEvent(
  eventType: string,
  category: BehaviorEvent['category'],
  targetId?: string | null,
  metadata?: Record<string, any>
): void {
  try {
    const deviceData = getDeviceInfo();
    const event: BehaviorEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: getBehaviorSessionId(),
      userEmail: getCachedUserEmail(),
      eventType,
      category,
      targetId: targetId || null,
      metadata: { ...deviceData, ...(metadata || {}) },
      createdAt: new Date().toISOString(),
    };

    eventQueue.push(event);

    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      flushBehaviorEvents();
    } else if (!flushTimer && typeof window !== 'undefined') {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBehaviorEvents();
      }, FLUSH_INTERVAL_MS);
    }
  } catch {}
}

// Convenience Helpers
export function trackTrekCardClick(hikeNumber: string, trekTitle?: string, difficulty?: string, region?: string): void {
  trackEvent('trek_card_click', 'discovery', hikeNumber, {
    title: trekTitle,
    difficulty,
    region,
  });
}

export function trackItineraryView(hikeNumber: string, trekTitle?: string): void {
  trackEvent('itinerary_view', 'discovery', hikeNumber, { title: trekTitle });
}

export function trackFaqView(hikeNumber: string, trekTitle?: string): void {
  trackEvent('faq_view', 'discovery', hikeNumber, { title: trekTitle });
}

export function trackSearchQuery(query: string, resultCount: number): void {
  if (!query || query.trim().length < 2) return;
  trackEvent('search_query', 'search', null, {
    query: query.trim().toLowerCase(),
    resultCount,
  });
}

export function trackFilterChange(filterName: string, filterValue: string): void {
  trackEvent('filter_change', 'discovery', filterName, { value: filterValue });
}

export function trackRegistrationStart(hikeNumber: string, trekTitle?: string): void {
  trackEvent('registration_start', 'funnel', hikeNumber, { title: trekTitle });
}

export function trackRegistrationComplete(hikeNumber: string, pax?: number): void {
  trackEvent('registration_complete', 'funnel', hikeNumber, { pax: pax || 1 });
}

export function trackMapInteraction(action: string, routeId?: string, details?: Record<string, any>): void {
  trackEvent(action, 'mapping', routeId || null, details);
}

// Hook document visibility change & pagehide to flush pending events automatically
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBehaviorEvents();
    }
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    flushBehaviorEvents();
  });
}
