import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface ContentModerationSettings {
  hiddenPhotoCommentIds: string[];
  hiddenTrailCommentIds: string[];
  hiddenReviewKeys: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_CONTENT_MODERATION: ContentModerationSettings = {
  hiddenPhotoCommentIds: [],
  hiddenTrailCommentIds: [],
  hiddenReviewKeys: [],
  updatedAt: '',
  updatedBy: 'system',
};

const STORAGE_KEY = 'wnw_content_moderation_v1';
const EVENT_NAME = 'wnw-content-moderation-updated';
const FIRESTORE_COLLECTION = 'pwa_metrics';
const FIRESTORE_DOC_ID = 'content_moderation';

function normalizeSettings(raw?: Partial<ContentModerationSettings> | null): ContentModerationSettings {
  return {
    hiddenPhotoCommentIds: Array.isArray(raw?.hiddenPhotoCommentIds)
      ? Array.from(new Set(raw.hiddenPhotoCommentIds.map((s) => String(s).trim()).filter(Boolean)))
      : [],
    hiddenTrailCommentIds: Array.isArray(raw?.hiddenTrailCommentIds)
      ? Array.from(new Set(raw.hiddenTrailCommentIds.map((s) => String(s).trim()).filter(Boolean)))
      : [],
    hiddenReviewKeys: Array.isArray(raw?.hiddenReviewKeys)
      ? Array.from(new Set(raw.hiddenReviewKeys.map((s) => String(s).trim()).filter(Boolean)))
      : [],
    updatedAt: raw?.updatedAt || '',
    updatedBy: raw?.updatedBy || 'system',
  };
}

export function getCachedContentModeration(): ContentModerationSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_CONTENT_MODERATION;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSettings(JSON.parse(raw));
    }
  } catch (_) {}
  return DEFAULT_CONTENT_MODERATION;
}

function saveToLocalAndBroadcast(settings: ContentModerationSettings): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: settings }));
  }
}

export async function fetchContentModeration(): Promise<ContentModerationSettings> {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID));
    if (snap.exists()) {
      const normalized = normalizeSettings(snap.data() as Partial<ContentModerationSettings>);
      saveToLocalAndBroadcast(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('[ContentModeration] Failed to fetch remote settings, using cache:', err);
  }
  return getCachedContentModeration();
}

export async function saveContentModeration(
  next: Partial<ContentModerationSettings>,
  adminEmail: string = 'admin'
): Promise<ContentModerationSettings> {
  const current = getCachedContentModeration();
  const payload = normalizeSettings({
    ...current,
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail || 'admin',
  });

  saveToLocalAndBroadcast(payload);

  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID), payload, { merge: true });
  } catch (err) {
    console.warn('[ContentModeration] Firestore sync warning (saved locally):', err);
  }

  return payload;
}

/**
 * Generates stable lookup tokens for any review/feedback object across
 * D1 `/feedback`, `wnw_user_feedbacks` localStorage, and `HISTORIC_COMMUNITY_REVIEWS`.
 */
export function getReviewMatchTokens(review: any): string[] {
  if (!review || typeof review !== 'object') return [];
  const tokens: string[] = [];

  const rawId = review.id !== undefined && review.id !== null ? String(review.id).trim() : '';
  if (rawId) {
    tokens.push(`id:${rawId}`);
    const strippedId = rawId.replace(/^(live-)+/, '');
    if (strippedId && strippedId !== rawId) {
      tokens.push(`id:${strippedId}`);
    }
  }

  const name = String(review.full_name || review.name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const trek = String(review.trek_name || review.recentWalk || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const date = String(review.submitted_at || '').trim().slice(0, 10);
  const overall = String(review.overall_feedback || review.overallFeedback || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const team = String(review.team_feedback || review.teamFeedback || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 80);

  if (name || overall || team) {
    tokens.push(`fp:${name}|${trek}|${date}|${overall}|${team}`);
  }

  return Array.from(new Set(tokens));
}

export function isPhotoCommentHidden(
  commentId: string | number | undefined | null,
  settings: ContentModerationSettings = getCachedContentModeration()
): boolean {
  if (commentId === undefined || commentId === null) return false;
  return settings.hiddenPhotoCommentIds.includes(String(commentId).trim());
}

export function isTrailCommentHidden(
  commentId: string | number | undefined | null,
  settings: ContentModerationSettings = getCachedContentModeration()
): boolean {
  if (commentId === undefined || commentId === null) return false;
  return settings.hiddenTrailCommentIds.includes(String(commentId).trim());
}

export function isReviewHidden(
  review: any,
  settings: ContentModerationSettings = getCachedContentModeration()
): boolean {
  if (!review || settings.hiddenReviewKeys.length === 0) return false;
  const tokens = getReviewMatchTokens(review);
  return tokens.some((t) => settings.hiddenReviewKeys.includes(t));
}

export async function setPhotoCommentHidden(
  commentId: string,
  hidden: boolean,
  adminEmail?: string
): Promise<ContentModerationSettings> {
  const idStr = String(commentId).trim();
  const current = await fetchContentModeration();
  const set = new Set(current.hiddenPhotoCommentIds);
  if (hidden) set.add(idStr);
  else set.delete(idStr);
  return saveContentModeration({ ...current, hiddenPhotoCommentIds: Array.from(set) }, adminEmail);
}

export async function setTrailCommentHidden(
  commentId: string,
  hidden: boolean,
  adminEmail?: string
): Promise<ContentModerationSettings> {
  const idStr = String(commentId).trim();
  const current = await fetchContentModeration();
  const set = new Set(current.hiddenTrailCommentIds);
  if (hidden) set.add(idStr);
  else set.delete(idStr);
  return saveContentModeration({ ...current, hiddenTrailCommentIds: Array.from(set) }, adminEmail);
}

export async function setReviewHidden(
  review: any,
  hidden: boolean,
  adminEmail?: string
): Promise<ContentModerationSettings> {
  const tokens = getReviewMatchTokens(review);
  const current = await fetchContentModeration();
  const set = new Set(current.hiddenReviewKeys);
  if (hidden) {
    tokens.forEach((t) => set.add(t));
  } else {
    tokens.forEach((t) => set.delete(t));
  }
  return saveContentModeration({ ...current, hiddenReviewKeys: Array.from(set) }, adminEmail);
}

let listenerInitialized = false;

export function initContentModerationListener(): void {
  if (listenerInitialized || typeof window === 'undefined') return;
  listenerInitialized = true;

  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
    onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const normalized = normalizeSettings(snap.data() as Partial<ContentModerationSettings>);
          saveToLocalAndBroadcast(normalized);
        }
      },
      (err) => {
        console.warn('[ContentModeration] Snapshot listener error:', err);
      }
    );
  } catch (err) {
    console.warn('[ContentModeration] Failed to initialize Firestore listener:', err);
  }
}

if (typeof window !== 'undefined') {
  initContentModerationListener();
}

export function useContentModeration(): ContentModerationSettings {
  const [settings, setSettings] = useState<ContentModerationSettings>(() =>
    getCachedContentModeration()
  );

  useEffect(() => {
    initContentModerationListener();

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<ContentModerationSettings>;
      if (custom.detail) {
        setSettings(normalizeSettings(custom.detail));
      } else {
        setSettings(getCachedContentModeration());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSettings(getCachedContentModeration());
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return settings;
}
