import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const RESTRICTED_ADMIN_EMAIL = 'walknepalwalk@gmail.com';

export type AllowedDeviceSlot = 'acer_nitro_v16_ai' | 'samsung_s25_ultra';

export const ALLOWED_DEVICE_LABELS: Record<AllowedDeviceSlot, string> = {
  acer_nitro_v16_ai: 'Acer Nitro V16 AI',
  samsung_s25_ultra: 'Samsung S25 Ultra',
};

export interface BoundDeviceSlotRecord {
  slot: AllowedDeviceSlot;
  label: string;
  secretHash: string;
  hardwareSignature: string;
  platform: string;
  model: string;
  cores: number;
  deviceId: string;
  boundAt: string;
  lastUsedAt: string;
}

export interface RestrictedAdminDevicesDoc {
  email: string;
  slots: {
    acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
    samsung_s25_ultra: BoundDeviceSlotRecord | null;
  };
  updatedAt: string;
}

export interface HardwareEligibilityResult {
  eligible: boolean;
  slot: AllowedDeviceSlot | null;
  detectedLabel: string;
  platform: string;
  model: string;
  cores: number;
  hardwareSignature: string;
  reason: string;
}

export type DeviceVerificationStatus =
  | 'idle'
  | 'checking'
  | 'authorized'
  | 'needs_binding'
  | 'denied';

export interface DeviceVerificationResult {
  status: Exclude<DeviceVerificationStatus, 'idle' | 'checking'>;
  slot: AllowedDeviceSlot | null;
  eligibility: HardwareEligibilityResult;
  slots: {
    acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
    samsung_s25_ultra: BoundDeviceSlotRecord | null;
  };
  reason: string;
}

const LOCAL_SECRET_KEY = 'wnw_restricted_device_secret_v1';
const LOCAL_VERIFIED_CACHE_KEY = 'wnw_restricted_device_verified_v1';
const LOCAL_SLOTS_FALLBACK_KEY = 'wnw_restricted_device_slots_fallback_v1';
const HIGH_ENTROPY_CACHE_KEY = 'wnw_high_entropy_device_v1';
const IDB_NAME = 'wnw_device_lock_db';
const IDB_STORE = 'secrets';
const IDB_KEY = 'device_secret_v1';

interface CachedHighEntropy {
  model: string;
  platform: string;
  architecture: string;
  mobile: boolean;
  resolved: boolean;
}

let cachedHighEntropy: CachedHighEntropy | null = null;
let highEntropyInitPromise: Promise<CachedHighEntropy> | null = null;

// Active session verification state (fail-closed by default)
let activeVerifiedState: {
  authorized: boolean;
  email: string;
  uid: string;
  slot: AllowedDeviceSlot | null;
  slots: {
    acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
    samsung_s25_ultra: BoundDeviceSlotRecord | null;
  };
} = {
  authorized: false,
  email: '',
  uid: '',
  slot: null,
  slots: {
    acer_nitro_v16_ai: null,
    samsung_s25_ultra: null,
  },
};

const dispatchVerificationUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-admin-roles-updated'));
  }
};

export const isRestrictedAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === RESTRICTED_ADMIN_EMAIL;
};

export const getCachedHighEntropyModel = (): string => {
  if (cachedHighEntropy?.model) return cachedHighEntropy.model;
  try {
    const raw = sessionStorage.getItem(HIGH_ENTROPY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.model) return String(parsed.model);
    }
  } catch {}
  return '';
};

export const initDeviceModelDetection = async (): Promise<CachedHighEntropy> => {
  if (cachedHighEntropy?.resolved) return cachedHighEntropy;
  if (highEntropyInitPromise) return highEntropyInitPromise;

  highEntropyInitPromise = (async () => {
    const fallback: CachedHighEntropy = {
      model: '',
      platform: '',
      architecture: '',
      mobile: false,
      resolved: true,
    };

    if (typeof navigator === 'undefined') {
      cachedHighEntropy = fallback;
      return fallback;
    }

    try {
      const uaData = (navigator as any).userAgentData;
      if (uaData && typeof uaData.getHighEntropyValues === 'function') {
        const vals = await uaData.getHighEntropyValues([
          'model',
          'platform',
          'architecture',
        ]);
        const result: CachedHighEntropy = {
          model: String(vals?.model || '').trim(),
          platform: String(vals?.platform || uaData.platform || '').trim(),
          architecture: String(vals?.architecture || '').trim(),
          mobile: Boolean(uaData.mobile),
          resolved: true,
        };
        cachedHighEntropy = result;
        try {
          sessionStorage.setItem(HIGH_ENTROPY_CACHE_KEY, JSON.stringify(result));
        } catch {}
        return result;
      }
    } catch {}

    cachedHighEntropy = fallback;
    return fallback;
  })();

  return highEntropyInitPromise;
};

const extractAndroidModelFromUA = (ua: string): string => {
  const match =
    ua.match(/;\s*([^;]+?)\s+Build\//i) ||
    ua.match(/Android[^;]+;\s*([^;)]+)\)/i);
  if (match && match[1]) {
    const raw = match[1].trim();
    if (!/^(K|wv|Linux|Mobile|Android)$/i.test(raw)) {
      return raw;
    }
  }
  return '';
};

const isSamsungS25UltraModel = (text: string): boolean => {
  if (!text) return false;
  return (
    /\bSM-S938[A-Z0-9]*\b/i.test(text) ||
    /\bGalaxy\s*S25\s*Ultra\b/i.test(text) ||
    /\bS25\s*Ultra\b/i.test(text) ||
    /\bS25Ultra\b/i.test(text)
  );
};

export const detectHardwareEligibility = (): HardwareEligibilityResult => {
  if (typeof navigator === 'undefined') {
    return {
      eligible: false,
      slot: null,
      detectedLabel: 'Unknown Environment',
      platform: '',
      model: '',
      cores: 0,
      hardwareSignature: '',
      reason: 'Browser environment unavailable.',
    };
  }

  const ua = navigator.userAgent || '';
  const uaData = (navigator as any).userAgentData;
  const cached = cachedHighEntropy;
  let storedHighEntropy: CachedHighEntropy | null = cached;

  if (!storedHighEntropy) {
    try {
      const raw = sessionStorage.getItem(HIGH_ENTROPY_CACHE_KEY);
      if (raw) storedHighEntropy = JSON.parse(raw);
    } catch {}
  }

  const hePlatform = storedHighEntropy?.platform || uaData?.platform || '';
  const heModel = storedHighEntropy?.model || '';
  const isMobileHint = Boolean(storedHighEntropy?.mobile || uaData?.mobile);
  const cores = Number(navigator.hardwareConcurrency || 0);

  const isAndroid =
    /Android/i.test(hePlatform) || /Android/i.test(ua);
  const isWindows =
    /Windows/i.test(hePlatform) ||
    (/Windows/i.test(ua) && !isAndroid && !/iPhone|iPad|iPod/i.test(ua));

  // 1. Check Samsung S25 Ultra (Android SM-S938* / Galaxy S25 Ultra)
  if (isAndroid) {
    const uaModel = extractAndroidModelFromUA(ua);
    const detectedModel = heModel || uaModel;
    const isS25Ultra =
      isSamsungS25UltraModel(heModel) ||
      isSamsungS25UltraModel(uaModel) ||
      isSamsungS25UltraModel(ua);

    if (isS25Ultra) {
      const normalizedModel = detectedModel || 'SM-S938';
      return {
        eligible: true,
        slot: 'samsung_s25_ultra',
        detectedLabel: 'Samsung S25 Ultra',
        platform: 'Android',
        model: normalizedModel,
        cores,
        hardwareSignature: `android|s25ultra|${cores}`,
        reason: 'Verified Samsung S25 Ultra hardware.',
      };
    }

    return {
      eligible: false,
      slot: null,
      detectedLabel: detectedModel ? `Android (${detectedModel})` : 'Android Device',
      platform: 'Android',
      model: detectedModel,
      cores,
      hardwareSignature: '',
      reason: detectedModel
        ? `Detected Android model "${detectedModel}" is not an authorized Samsung S25 Ultra.`
        : 'Device model could not be verified as Samsung S25 Ultra. Please open on Samsung S25 Ultra using Chrome, Samsung Internet, or the official app.',
    };
  }

  // 2. Check Acer Nitro V16 AI (Windows Desktop/Laptop)
  if (isWindows && !isMobileHint && !/Phone|Mobile|Tablet|Xbox/i.test(ua)) {
    // If Chromium explicitly reports a non-Acer/non-Nitro model, reject
    if (heModel && !/Nitro|Acer/i.test(heModel)) {
      return {
        eligible: false,
        slot: null,
        detectedLabel: `Windows (${heModel})`,
        platform: 'Windows',
        model: heModel,
        cores,
        hardwareSignature: '',
        reason: `Windows device "${heModel}" is not an Acer Nitro V16 AI.`,
      };
    }

    return {
      eligible: true,
      slot: 'acer_nitro_v16_ai',
      detectedLabel: 'Acer Nitro V16 AI (Windows)',
      platform: 'Windows',
      model: heModel || 'Acer Nitro V16 AI',
      cores,
      hardwareSignature: `windows|${cores}|${navigator.maxTouchPoints || 0}`,
      reason: 'Windows laptop/desktop platform eligible for Acer Nitro V16 AI slot.',
    };
  }

  // 3. Reject all other OS/devices (iPhone, iPad, macOS, Linux, ChromeOS, etc.)
  let rejectedLabel = 'Unsupported Device';
  if (/iPhone/i.test(ua)) rejectedLabel = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) rejectedLabel = 'iPad (iPadOS)';
  else if (/Macintosh|Mac OS X/i.test(ua) || /macOS/i.test(hePlatform)) rejectedLabel = 'Mac (macOS)';
  else if (/CrOS/i.test(ua)) rejectedLabel = 'Chromebook (ChromeOS)';
  else if (/Linux/i.test(ua)) rejectedLabel = 'Linux Device';

  return {
    eligible: false,
    slot: null,
    detectedLabel: rejectedLabel,
    platform: hePlatform || rejectedLabel,
    model: heModel,
    cores,
    hardwareSignature: '',
    reason: `${rejectedLabel} is not authorized. Admin email ${RESTRICTED_ADMIN_EMAIL} is strictly restricted to Acer Nitro V16 AI and Samsung S25 Ultra only.`,
  };
};

// IndexedDB helper for resilient local device key storage
const openLockDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        } catch {}
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const readSecretFromIdb = async (): Promise<string | null> => {
  const idb = await openLockDb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(IDB_KEY);
      getReq.onsuccess = () => resolve(typeof getReq.result === 'string' ? getReq.result : null);
      getReq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const writeSecretToIdb = async (secret: string): Promise<void> => {
  const idb = await openLockDb();
  if (!idb) return;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(secret, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

const sha256Hex = async (input: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash if SubtleCrypto unavailable in insecure context
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

const generateRandomSecret = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const getOrCreateDeviceSecretHash = async (): Promise<string> => {
  let lsSecret: string | null = null;
  try {
    lsSecret = localStorage.getItem(LOCAL_SECRET_KEY);
  } catch {}

  const idbSecret = await readSecretFromIdb();
  let secret = lsSecret || idbSecret;

  if (!secret) {
    secret = generateRandomSecret();
  }

  // Self-heal storage across localStorage and IndexedDB
  try {
    if (!lsSecret || lsSecret !== secret) {
      localStorage.setItem(LOCAL_SECRET_KEY, secret);
    }
  } catch {}
  if (!idbSecret || idbSecret !== secret) {
    await writeSecretToIdb(secret);
  }

  return sha256Hex(secret);
};

const doesHardwareMatchBoundSlot = (
  eligibility: HardwareEligibilityResult,
  bound: BoundDeviceSlotRecord
): boolean => {
  if (!eligibility.eligible || eligibility.slot !== bound.slot) return false;
  if (bound.slot === 'samsung_s25_ultra') {
    return eligibility.platform === 'Android' && isSamsungS25UltraModel(eligibility.model);
  }
  if (bound.slot === 'acer_nitro_v16_ai') {
    if (eligibility.platform !== 'Windows') return false;
    if (bound.cores && eligibility.cores && bound.cores !== eligibility.cores) return false;
    return true;
  }
  return false;
};

const saveVerifiedCache = (uid: string, slot: AllowedDeviceSlot, secretHash: string, hardwareSignature: string) => {
  try {
    localStorage.setItem(
      LOCAL_VERIFIED_CACHE_KEY,
      JSON.stringify({
        uid,
        slot,
        secretHash,
        hardwareSignature,
        cachedAt: Date.now(),
      })
    );
  } catch {}
};

const checkOfflineVerifiedCache = (
  uid: string,
  eligibility: HardwareEligibilityResult,
  secretHash: string
): AllowedDeviceSlot | null => {
  try {
    const raw = localStorage.getItem(LOCAL_VERIFIED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.uid === uid &&
      parsed?.secretHash === secretHash &&
      parsed?.slot === eligibility.slot &&
      parsed?.hardwareSignature === eligibility.hardwareSignature
    ) {
      return parsed.slot as AllowedDeviceSlot;
    }
  } catch {}
  return null;
};

export const clearRestrictedAdminVerificationState = () => {
  activeVerifiedState = {
    authorized: false,
    email: '',
    uid: '',
    slot: null,
    slots: {
      acer_nitro_v16_ai: null,
      samsung_s25_ultra: null,
    },
  };
  dispatchVerificationUpdated();
};

export const isCurrentDeviceAuthorizedForRestrictedAdmin = (): boolean => {
  if (!activeVerifiedState.authorized || !activeVerifiedState.slot) {
    return false;
  }
  const eligibility = detectHardwareEligibility();
  return eligibility.eligible && eligibility.slot === activeVerifiedState.slot;
};

export const getRestrictedAdminActiveStatus = () => ({
  ...activeVerifiedState,
});

export const verifyRestrictedAdminDevice = async (
  uid: string,
  email: string
): Promise<DeviceVerificationResult> => {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail !== RESTRICTED_ADMIN_EMAIL) {
    return {
      status: 'denied',
      slot: null,
      eligibility: detectHardwareEligibility(),
      slots: { acer_nitro_v16_ai: null, samsung_s25_ultra: null },
      reason: 'Not restricted admin account.',
    };
  }

  await initDeviceModelDetection();
  const eligibility = detectHardwareEligibility();
  const emptySlots = { acer_nitro_v16_ai: null, samsung_s25_ultra: null };

  // Fail immediately if hardware is not Acer Nitro V16 AI (Windows) or Samsung S25 Ultra
  if (!eligibility.eligible || !eligibility.slot) {
    clearRestrictedAdminVerificationState();
    return {
      status: 'denied',
      slot: null,
      eligibility,
      slots: emptySlots,
      reason: eligibility.reason,
    };
  }

  const secretHash = await getOrCreateDeviceSecretHash();
  const userDocRef = doc(db, 'users', uid);

  let docData: any = null;
  try {
    const serverSnap = await getDocFromServer(userDocRef);
    if (serverSnap.exists()) {
      docData = serverSnap.data();
    }
  } catch (err: any) {
    // Fallback to Firestore cache or offline verification cache only if previously verified
    try {
      const cacheSnap = await getDoc(userDocRef);
      if (cacheSnap.exists()) {
        docData = cacheSnap.data();
      }
    } catch {}

    if (!docData) {
      const offlineSlot = checkOfflineVerifiedCache(uid, eligibility, secretHash);
      if (offlineSlot) {
        activeVerifiedState = {
          authorized: true,
          email: cleanEmail,
          uid,
          slot: offlineSlot,
          slots: emptySlots,
        };
        dispatchVerificationUpdated();
        return {
          status: 'authorized',
          slot: offlineSlot,
          eligibility,
          slots: emptySlots,
          reason: `Authorized offline on ${ALLOWED_DEVICE_LABELS[offlineSlot]}.`,
        };
      }

      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    }
  }

  const slots: {
    acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
    samsung_s25_ultra: BoundDeviceSlotRecord | null;
  } = {
    acer_nitro_v16_ai: docData?.restrictedAdminDevices?.slots?.acer_nitro_v16_ai || null,
    samsung_s25_ultra: docData?.restrictedAdminDevices?.slots?.samsung_s25_ultra || null,
  };

  const targetSlot = eligibility.slot;
  const boundSlot = slots[targetSlot];

  // Slot is currently unbound -> prompt the owner to explicitly bind this device
  if (!boundSlot) {
    activeVerifiedState = {
      authorized: false,
      email: cleanEmail,
      uid,
      slot: null,
      slots,
    };
    dispatchVerificationUpdated();
    return {
      status: 'needs_binding',
      slot: targetSlot,
      eligibility,
      slots,
      reason: `This ${ALLOWED_DEVICE_LABELS[targetSlot]} is not yet registered to ${RESTRICTED_ADMIN_EMAIL}.`,
    };
  }

  // Slot is bound -> strictly verify secretHash and hardware match
  if (
    boundSlot.secretHash === secretHash &&
    doesHardwareMatchBoundSlot(eligibility, boundSlot)
  ) {
    activeVerifiedState = {
      authorized: true,
      email: cleanEmail,
      uid,
      slot: targetSlot,
      slots,
    };
    saveVerifiedCache(uid, targetSlot, secretHash, eligibility.hardwareSignature);
    dispatchVerificationUpdated();

    // Opportunistically update lastUsedAt
    try {
      const lastUsedMs = boundSlot.lastUsedAt ? new Date(boundSlot.lastUsedAt).getTime() : 0;
      if (Date.now() - lastUsedMs > 12 * 60 * 60 * 1000) {
        setDoc(
          userDocRef,
          {
            email: cleanEmail,
            restrictedAdminDevices: {
              email: cleanEmail,
              slots: {
                ...slots,
                [targetSlot]: {
                  ...boundSlot,
                  lastUsedAt: new Date().toISOString(),
                },
              },
              updatedAt: new Date().toISOString(),
            },
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch {}

    return {
      status: 'authorized',
      slot: targetSlot,
      eligibility,
      slots,
      reason: `Authorized on ${ALLOWED_DEVICE_LABELS[targetSlot]}.`,
    };
  }

  // Bound to a DIFFERENT physical device -> strict denial
  clearRestrictedAdminVerificationState();
  return {
    status: 'denied',
    slot: null,
    eligibility,
    slots,
    reason: `Access Denied: The ${ALLOWED_DEVICE_LABELS[targetSlot]} slot for ${RESTRICTED_ADMIN_EMAIL} is already locked to a different physical device (${boundSlot.deviceId}).`,
  };
};

export const bindRestrictedAdminDevice = async (
  uid: string,
  email: string
): Promise<DeviceVerificationResult> => {
  const cleanEmail = email.toLowerCase().trim();
  await initDeviceModelDetection();
  const eligibility = detectHardwareEligibility();

  if (cleanEmail !== RESTRICTED_ADMIN_EMAIL || !eligibility.eligible || !eligibility.slot) {
    clearRestrictedAdminVerificationState();
    return {
      status: 'denied',
      slot: null,
      eligibility,
      slots: { acer_nitro_v16_ai: null, samsung_s25_ultra: null },
      reason: eligibility.reason || 'Device not eligible for binding.',
    };
  }

  const targetSlot = eligibility.slot;
  const secretHash = await getOrCreateDeviceSecretHash();
  const userDocRef = doc(db, 'users', uid);

  let existingSlots: {
    acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
    samsung_s25_ultra: BoundDeviceSlotRecord | null;
  } = {
    acer_nitro_v16_ai: null,
    samsung_s25_ultra: null,
  };

  try {
    const snap = await getDocFromServer(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      existingSlots = {
        acer_nitro_v16_ai: data?.restrictedAdminDevices?.slots?.acer_nitro_v16_ai || null,
        samsung_s25_ultra: data?.restrictedAdminDevices?.slots?.samsung_s25_ultra || null,
      };
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
  }

  // Never overwrite an already-bound slot from a different device
  const alreadyBound = existingSlots[targetSlot];
  if (alreadyBound && alreadyBound.secretHash !== secretHash) {
    clearRestrictedAdminVerificationState();
    return {
      status: 'denied',
      slot: null,
      eligibility,
      slots: existingSlots,
      reason: `Slot "${ALLOWED_DEVICE_LABELS[targetSlot]}" is already locked to another device (${alreadyBound.deviceId}).`,
    };
  }

  const now = new Date().toISOString();
  const deviceTag =
    targetSlot === 'samsung_s25_ultra' ? 'S25' : 'NITRO16';
  const shortId = `#DEV-${deviceTag}-${secretHash.slice(0, 6).toUpperCase()}`;

  const newRecord: BoundDeviceSlotRecord = {
    slot: targetSlot,
    label: ALLOWED_DEVICE_LABELS[targetSlot],
    secretHash,
    hardwareSignature: eligibility.hardwareSignature,
    platform: eligibility.platform,
    model: eligibility.model,
    cores: eligibility.cores,
    deviceId: shortId,
    boundAt: alreadyBound?.boundAt || now,
    lastUsedAt: now,
  };

  const updatedSlots = {
    ...existingSlots,
    [targetSlot]: newRecord,
  };

  try {
    await setDoc(
      userDocRef,
      {
        id: uid,
        email: cleanEmail,
        restrictedAdminDevices: {
          email: cleanEmail,
          slots: updatedSlots,
          updatedAt: now,
        },
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  activeVerifiedState = {
    authorized: true,
    email: cleanEmail,
    uid,
    slot: targetSlot,
    slots: updatedSlots,
  };
  saveVerifiedCache(uid, targetSlot, secretHash, eligibility.hardwareSignature);
  dispatchVerificationUpdated();

  return {
    status: 'authorized',
    slot: targetSlot,
    eligibility,
    slots: updatedSlots,
    reason: `Locked ${ALLOWED_DEVICE_LABELS[targetSlot]} (${shortId}) to ${RESTRICTED_ADMIN_EMAIL}.`,
  };
};

export const unbindRestrictedAdminSlot = async (
  uid: string,
  email: string,
  slotToUnbind: AllowedDeviceSlot
): Promise<{
  acer_nitro_v16_ai: BoundDeviceSlotRecord | null;
  samsung_s25_ultra: BoundDeviceSlotRecord | null;
}> => {
  if (!isCurrentDeviceAuthorizedForRestrictedAdmin()) {
    throw new Error('Only an already-authorized device can unbind a slot.');
  }

  const cleanEmail = email.toLowerCase().trim();
  const userDocRef = doc(db, 'users', uid);

  let currentSlots = { ...activeVerifiedState.slots };
  try {
    const snap = await getDocFromServer(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      currentSlots = {
        acer_nitro_v16_ai: data?.restrictedAdminDevices?.slots?.acer_nitro_v16_ai || null,
        samsung_s25_ultra: data?.restrictedAdminDevices?.slots?.samsung_s25_ultra || null,
      };
    }
  } catch {}

  const updatedSlots = {
    ...currentSlots,
    [slotToUnbind]: null,
  };

  try {
    await setDoc(
      userDocRef,
      {
        email: cleanEmail,
        restrictedAdminDevices: {
          email: cleanEmail,
          slots: updatedSlots,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  const unbindingSelf = activeVerifiedState.slot === slotToUnbind;
  if (unbindingSelf) {
    try {
      localStorage.removeItem(LOCAL_VERIFIED_CACHE_KEY);
    } catch {}
    clearRestrictedAdminVerificationState();
  } else {
    activeVerifiedState = {
      ...activeVerifiedState,
      slots: updatedSlots,
    };
    dispatchVerificationUpdated();
  }

  return updatedSlots;
};

/**
 * Local-only verification for DEV preview fallback (when Google Sign-In domain is unauthorized).
 * Enforces hardware eligibility + strict 2-slot lock in local storage.
 */
export const verifyAndBindDevFallbackDevice = async (
  email: string
): Promise<{ allowed: boolean; reason: string; slot: AllowedDeviceSlot | null }> => {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail !== RESTRICTED_ADMIN_EMAIL) {
    return { allowed: true, reason: '', slot: null };
  }

  await initDeviceModelDetection();
  const eligibility = detectHardwareEligibility();
  if (!eligibility.eligible || !eligibility.slot) {
    clearRestrictedAdminVerificationState();
    return {
      allowed: false,
      reason: eligibility.reason,
      slot: null,
    };
  }

  const secretHash = await getOrCreateDeviceSecretHash();
  const targetSlot = eligibility.slot;

  let storedSlots: Record<AllowedDeviceSlot, { secretHash: string; hardwareSignature: string } | null> = {
    acer_nitro_v16_ai: null,
    samsung_s25_ultra: null,
  };

  try {
    const raw = localStorage.getItem(LOCAL_SLOTS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        storedSlots = {
          acer_nitro_v16_ai: parsed.acer_nitro_v16_ai || null,
          samsung_s25_ultra: parsed.samsung_s25_ultra || null,
        };
      }
    }
  } catch {}

  const existing = storedSlots[targetSlot];
  if (existing && existing.secretHash !== secretHash) {
    clearRestrictedAdminVerificationState();
    return {
      allowed: false,
      reason: `Access Denied: ${ALLOWED_DEVICE_LABELS[targetSlot]} slot is already bound to another browser/device.`,
      slot: null,
    };
  }

  if (!existing) {
    storedSlots[targetSlot] = {
      secretHash,
      hardwareSignature: eligibility.hardwareSignature,
    };
    try {
      localStorage.setItem(LOCAL_SLOTS_FALLBACK_KEY, JSON.stringify(storedSlots));
    } catch {}
  }

  activeVerifiedState = {
    authorized: true,
    email: cleanEmail,
    uid: 'dev-restricted',
    slot: targetSlot,
    slots: {
      acer_nitro_v16_ai: null,
      samsung_s25_ultra: null,
    },
  };
  dispatchVerificationUpdated();

  return {
    allowed: true,
    reason: `Authorized on ${ALLOWED_DEVICE_LABELS[targetSlot]}.`,
    slot: targetSlot,
  };
};
