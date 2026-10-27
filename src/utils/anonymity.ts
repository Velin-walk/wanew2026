import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'wnw_anonymized_hikers';
const FIRESTORE_DOC_PATH = 'pwa_metrics';
const FIRESTORE_DOC_ID = 'anonymized_hikers';

export interface AnonymizedRegistry {
  uids: string[];
  emails: string[];
  phones: string[];
  names: string[];
  updatedAt?: string;
}

const defaultRegistry: AnonymizedRegistry = {
  uids: [],
  emails: [],
  phones: [],
  names: [],
};

const normalizeStr = (s?: string | null): string => {
  if (!s) return '';
  return s.toLowerCase().trim();
};

const normalizePhone = (p?: string | null): string => {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// Memory cache
let registryCache: AnonymizedRegistry = (() => {
  if (typeof window === 'undefined') return defaultRegistry;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        uids: Array.isArray(parsed.uids) ? parsed.uids.map(normalizeStr).filter(Boolean) : [],
        emails: Array.isArray(parsed.emails) ? parsed.emails.map(normalizeStr).filter(Boolean) : [],
        phones: Array.isArray(parsed.phones) ? parsed.phones.map(normalizePhone).filter(Boolean) : [],
        names: Array.isArray(parsed.names) ? parsed.names.map(normalizeStr).filter(Boolean) : [],
      };
    }
  } catch (_) {}
  return defaultRegistry;
})();

const notifyListeners = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-anonymity-updated'));
  }
};

const saveRegistry = (registry: AnonymizedRegistry, syncRemote = true) => {
  registryCache = registry;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    } catch (_) {}
    notifyListeners();
  }

  if (syncRemote) {
    try {
      const docRef = doc(db, FIRESTORE_DOC_PATH, FIRESTORE_DOC_ID);
      setDoc(
        docRef,
        {
          uids: registry.uids,
          emails: registry.emails,
          phones: registry.phones,
          names: registry.names,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn('[Anonymity] Remote sync error:', err);
      });
    } catch (err) {
      console.warn('[Anonymity] Failed to setDoc:', err);
    }
  }
};

// Real-time Firestore sync
if (typeof window !== 'undefined') {
  try {
    const docRef = doc(db, FIRESTORE_DOC_PATH, FIRESTORE_DOC_ID);
    onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const remote: AnonymizedRegistry = {
            uids: Array.from(new Set([...(registryCache.uids || []), ...(Array.isArray(data.uids) ? data.uids.map(normalizeStr) : [])])).filter(Boolean),
            emails: Array.from(new Set([...(registryCache.emails || []), ...(Array.isArray(data.emails) ? data.emails.map(normalizeStr) : [])])).filter(Boolean),
            phones: Array.from(new Set([...(registryCache.phones || []), ...(Array.isArray(data.phones) ? data.phones.map(normalizePhone) : [])])).filter(Boolean),
            names: Array.from(new Set([...(registryCache.names || []), ...(Array.isArray(data.names) ? data.names.map(normalizeStr) : [])])).filter(Boolean),
            updatedAt: data.updatedAt,
          };
          saveRegistry(remote, false);
        }
      },
      (err) => {
        console.warn('[Anonymity] Snapshot listener error:', err);
      }
    );
  } catch (err) {
    console.warn('[Anonymity] Could not init snapshot:', err);
  }
}

/**
 * Check if a hiker is marked as anonymous.
 */
export const isHikerAnonymous = (params: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  uid?: string | null;
}): boolean => {
  const { name, phone, email, uid } = params;

  if (uid && registryCache.uids.includes(normalizeStr(uid))) {
    return true;
  }

  if (email && registryCache.emails.includes(normalizeStr(email))) {
    return true;
  }

  if (phone) {
    const pNorm = normalizePhone(phone);
    if (pNorm && pNorm.length >= 7 && registryCache.phones.includes(pNorm)) {
      return true;
    }
  }

  if (name) {
    const nNorm = normalizeStr(name);
    if (nNorm && nNorm !== 'anonymous hiker' && nNorm !== 'hiker') {
      if (registryCache.names.includes(nNorm)) {
        return true;
      }
      // Check partial match for names
      for (const regName of registryCache.names) {
        if (regName.length >= 3 && (nNorm === regName || nNorm.includes(regName) || regName.includes(nNorm))) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Toggle or set anonymity for a hiker.
 */
export const setHikerAnonymity = async (
  params: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    uid?: string | null;
  },
  anonymize: boolean
): Promise<void> => {
  const current = { ...registryCache };
  const uid = normalizeStr(params.uid);
  const email = normalizeStr(params.email);
  const phone = normalizePhone(params.phone);
  const name = normalizeStr(params.name);

  if (anonymize) {
    if (uid && !current.uids.includes(uid)) current.uids.push(uid);
    if (email && !current.emails.includes(email)) current.emails.push(email);
    if (phone && phone.length >= 7 && !current.phones.includes(phone)) current.phones.push(phone);
    if (name && name.length >= 2 && name !== 'anonymous hiker' && !current.names.includes(name)) current.names.push(name);
  } else {
    if (uid) current.uids = current.uids.filter((x) => x !== uid);
    if (email) current.emails = current.emails.filter((x) => x !== email);
    if (phone) current.phones = current.phones.filter((x) => x !== phone);
    if (name) current.names = current.names.filter((x) => x !== name && !x.includes(name) && !name.includes(x));
  }

  saveRegistry(current, true);
};

/**
 * Helper to get the public display name. If anonymous, returns "Anonymous Hiker".
 */
export const getPublicDisplayName = (
  rawName?: string | null,
  meta?: { phone?: string | null; email?: string | null; uid?: string | null }
): string => {
  if (!rawName || !rawName.trim()) return 'Anonymous Hiker';
  const clean = rawName.trim();
  if (clean.toLowerCase() === 'anonymous hiker') return 'Anonymous Hiker';

  if (isHikerAnonymous({ name: clean, phone: meta?.phone, email: meta?.email, uid: meta?.uid })) {
    return 'Anonymous Hiker';
  }

  return clean;
};

/**
 * React hook to listen for anonymity updates.
 */
export const useAnonymity = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('wnw-anonymity-updated', handleUpdate);
    return () => window.removeEventListener('wnw-anonymity-updated', handleUpdate);
  }, []);

  return {
    isHikerAnonymous,
    setHikerAnonymity,
    getPublicDisplayName,
  };
};
