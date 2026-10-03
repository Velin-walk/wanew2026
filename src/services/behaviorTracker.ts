/**
 * Lightweight Client-Side Behavior Tracking Service
 * Batches anonymous interaction telemetry and sends directly to Cloudflare D1.
 * Non-blocking, battery-friendly, zero external dependencies.
 */

import { CLOUDFLARE_WORKER_URL } from './api';

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
const FLUSH_INTERVAL_MS = 25000; // Flush queue every 25 seconds
const MAX_QUEUE_SIZE = 8;        // Or immediately when 8 events accumulate

// In-memory queue
let eventQueue: BehaviorEvent[] = [];
let flushTimer: any = null;

/**
 * Returns or creates an anonymous session identifier stored in browser localStorage.
 */
export function getBehaviorSessionId(): string {
  try {
    let sid = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_SESSION_KEY, sid);
    }
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
  if (eventQueue.length === 0) return;

  const batch = [...eventQueue];
  eventQueue = [];

  const baseUrl = (CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
  const endpoint = baseUrl ? `${baseUrl}/behavior_events` : '/api/behavior_events';

  const payload = JSON.stringify({ events: batch });

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch (err) {
    // Non-blocking: fail silently if network is offline; do not disrupt the user
    console.debug('[BehaviorTracker] Failed to flush events:', err);
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
    const event: BehaviorEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId: getBehaviorSessionId(),
      userEmail: getCachedUserEmail(),
      eventType,
      category,
      targetId: targetId || null,
      metadata: metadata || {},
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

// Hook tab exit / visibility change to flush pending events automatically
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBehaviorEvents();
    }
  });
  window.addEventListener('pagehide', () => {
    flushBehaviorEvents();
  });
}
