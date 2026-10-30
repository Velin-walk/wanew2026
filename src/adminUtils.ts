import { db } from './lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const FULL_ADMINS_STORAGE_KEY = 'wnw_full_admin_emails';
const COORDINATORS_STORAGE_KEY = 'wnw_coordinator_emails';
const ROLES_DOC_PATH = 'pwa_metrics';
const ROLES_DOC_ID = 'admin_roles';

// Default Full Admin Level emails
export const DEFAULT_FULL_ADMIN_EMAILS: string[] = [
  'velinrai.vr@gmail.com',
  'thingbiraj77@gmail.com',
  'business.seekscape@gmail.com',
  'salinatmg.npl@gmail.com',
  'wanewasalina@gmail.com',
  'sundargurung110@gmail.com',
  'walknepalwalk@gmail.com'
];

// Default Team Coordinator Level emails
export const DEFAULT_COORDINATOR_EMAILS: string[] = [
  'raihochhali@gmail.com',
  'saraswotitamang2004@gmail.com',
  'themusafir29@gmail.com',
  'chiranjibisinghsaud484@gmail.com',
  'sujankhadka6492@gmail.com'
];

export const getFullAdminEmails = (): string[] => {
  try {
    const stored = localStorage.getItem(FULL_ADMINS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set(parsed.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
      }
    }
  } catch (_) {}
  return [...DEFAULT_FULL_ADMIN_EMAILS];
};

export const getCoordinatorEmails = (): string[] => {
  try {
    const stored = localStorage.getItem(COORDINATORS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
      }
    }
  } catch (_) {}
  return [...DEFAULT_COORDINATOR_EMAILS];
};

const notifyRolesUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-admin-roles-updated'));
  }
};

const syncRolesToRemote = async (fullAdmins: string[], coordinators: string[]) => {
  try {
    const docRef = doc(db, ROLES_DOC_PATH, ROLES_DOC_ID);
    await setDoc(
      docRef,
      {
        fullAdmins,
        coordinators,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[AdminRoles] Failed to sync roles to Firestore:', err);
  }
};

export const saveFullAdminEmails = (emails: string[]): void => {
  const clean = Array.from(new Set(emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
  try {
    localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  notifyRolesUpdated();
  syncRolesToRemote(clean, getCoordinatorEmails());
};

export const saveCoordinatorEmails = (emails: string[]): void => {
  const clean = Array.from(new Set(emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
  try {
    localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  notifyRolesUpdated();
  syncRolesToRemote(getFullAdminEmails(), clean);
};

export const addFullAdminEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return false;
  const currentFull = getFullAdminEmails();
  const newFull = currentFull.includes(normalized) ? currentFull : [...currentFull, normalized];
  const currentCoords = getCoordinatorEmails().filter((e) => e !== normalized);

  try {
    localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(newFull));
    localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(currentCoords));
  } catch (_) {}

  notifyRolesUpdated();
  syncRolesToRemote(newFull, currentCoords);
  return true;
};

export const removeFullAdminEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  const newFull = getFullAdminEmails().filter((e) => e !== normalized);
  const currentCoords = getCoordinatorEmails();

  try {
    localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(newFull));
  } catch (_) {}

  notifyRolesUpdated();
  syncRolesToRemote(newFull, currentCoords);
  return true;
};

export const addCoordinatorEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return false;
  const currentCoords = getCoordinatorEmails();
  const newCoords = currentCoords.includes(normalized) ? currentCoords : [...currentCoords, normalized];
  const newFull = getFullAdminEmails().filter((e) => e !== normalized);

  try {
    localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(newCoords));
    localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(newFull));
  } catch (_) {}

  notifyRolesUpdated();
  syncRolesToRemote(newFull, newCoords);
  return true;
};

export const removeCoordinatorEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  const newCoords = getCoordinatorEmails().filter((e) => e !== normalized);
  const currentFull = getFullAdminEmails();

  try {
    localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(newCoords));
  } catch (_) {}

  notifyRolesUpdated();
  syncRolesToRemote(currentFull, newCoords);
  return true;
};

export const isFullAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return getFullAdminEmails().includes(clean);
};

export const isCoordinatorEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return getCoordinatorEmails().includes(clean);
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return isFullAdminEmail(clean) || isCoordinatorEmail(clean);
};

// Start Firestore real-time listener for multi-device sync
if (typeof window !== 'undefined') {
  try {
    const docRef = doc(db, ROLES_DOC_PATH, ROLES_DOC_ID);
    onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.fullAdmins)) {
            const mergedFull = Array.from(
              new Set([
                ...DEFAULT_FULL_ADMIN_EMAILS,
                ...data.fullAdmins.map((e: any) => String(e).toLowerCase().trim()),
              ])
            ).filter(Boolean);
            localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(mergedFull));
          }
          if (Array.isArray(data.coordinators)) {
            const cleanCoords = Array.from(
              new Set(data.coordinators.map((e: any) => String(e).toLowerCase().trim()))
            ).filter(Boolean);
            localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(cleanCoords));
          }
          notifyRolesUpdated();
        }
      },
      (err) => {
        console.warn('[AdminRoles] Firestore listener error:', err);
      }
    );
  } catch (err) {
    console.warn('[AdminRoles] Failed to subscribe to Firestore admin roles:', err);
  }
}

// Backwards compatibility getters
export const FULL_ADMIN_EMAILS = getFullAdminEmails();
export const COORDINATOR_EMAILS = getCoordinatorEmails();
export const ADMIN_EMAILS = [...FULL_ADMIN_EMAILS, ...COORDINATOR_EMAILS];

const DEVICE_ID_KEY = 'wnw_admin_device_id';
const DEVICE_NAME_KEY = 'wnw_admin_device_name';

const getGpuRenderer = (): string => {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    return String((gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
  } catch {
    return '';
  }
};

const detectOs = (ua: string, uaPlatform?: string): string => {
  if (uaPlatform) return uaPlatform;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone/i.test(ua)) return 'iOS (iPhone)';
  if (/iPad/i.test(ua)) return 'iPadOS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '';
};

const detectBrowser = (ua: string): string => {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return '';
};

const extractHardwareModel = (ua: string, gpuRenderer: string): { modelName: string; tagPrefix: string } => {
  // 1. Android model from User-Agent (e.g., SM-S938B, SM-S928B, Pixel 8)
  const androidModelMatch = ua.match(/;\s*([^;]+?)\s+Build\//i) || ua.match(/Android[^;]+;\s*([^;)]+)\)/i);
  if (androidModelMatch && androidModelMatch[1]) {
    const raw = androidModelMatch[1].trim();
    if (!/^(K|wv|Linux|Mobile)$/i.test(raw)) {
      if (/SM-S938/i.test(raw) || /S25\s*Ultra/i.test(raw)) return { modelName: 'Samsung S25 Ultra', tagPrefix: 'S25' };
      if (/SM-S928/i.test(raw) || /S24\s*Ultra/i.test(raw)) return { modelName: 'Samsung S24 Ultra', tagPrefix: 'S24' };
      if (/SM-S918/i.test(raw) || /S23\s*Ultra/i.test(raw)) return { modelName: 'Samsung S23 Ultra', tagPrefix: 'S23' };
      const cleanTag = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
      return { modelName: raw, tagPrefix: cleanTag || 'AND' };
    }
  }

  // 2. Windows PC (only label Acer Nitro if explicitly present in UA or model)
  if (/Windows/i.test(ua)) {
    if (/Nitro/i.test(ua)) {
      return { modelName: 'Acer Nitro (Windows PC)', tagPrefix: 'NITRO' };
    }
    return { modelName: 'Windows PC', tagPrefix: 'WIN' };
  }

  // 3. Apple devices (fact-based)
  if (/iPhone/i.test(ua)) return { modelName: 'iPhone', tagPrefix: 'IPHONE' };
  if (/iPad/i.test(ua)) return { modelName: 'iPad', tagPrefix: 'IPAD' };
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return { modelName: 'MacBook', tagPrefix: 'MAC' };
  }

  // 4. Android general
  if (/Android/i.test(ua)) {
    return { modelName: 'Android Mobile', tagPrefix: 'AND' };
  }

  // 5. Linux
  if (/Linux/i.test(ua)) {
    return { modelName: 'Linux Workstation', tagPrefix: 'LNX' };
  }

  return { modelName: '', tagPrefix: 'DEV' };
};

/**
 * Persistent, per-browser device identity (never derived from the login email).
 * Same browser => same ID for any admin email; same email on another browser => different ID.
 * Only values actually detected are used. If storage is unavailable, ID/name are omitted.
 */
export const getAdminDeviceMetadata = (): { device_name?: string; device_id?: string; user_agent?: string } => {
  if (typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const result: { device_name?: string; device_id?: string; user_agent?: string } = {};
  if (ua) result.user_agent = ua;

  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    let name = localStorage.getItem(DEVICE_NAME_KEY);

    if (!id || !name) {
      const gpu = getGpuRenderer();
      const uaData = (navigator as any).userAgentData;
      const os = detectOs(ua, uaData?.platform);
      const browser = detectBrowser(ua);
      const { modelName, tagPrefix } = extractHardwareModel(ua, gpu);

      name = modelName
        ? `${modelName} (${[browser, os].filter(Boolean).join(' on ')})`
        : [browser, os && `on ${os}`].filter(Boolean).join(' ');

      const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
      id = `#DEV-${tagPrefix}-${String(rand).padStart(4, '0')}`;

      if (name) localStorage.setItem(DEVICE_NAME_KEY, name);
      localStorage.setItem(DEVICE_ID_KEY, id);

      // Async upgrade when High-Entropy Model is available on Chromium
      uaData?.getHighEntropyValues?.(['model'])
        .then((v: { model?: string }) => {
          if (v?.model && v.model.trim()) {
            const upgradedModel = v.model.trim();
            const upgradedName = `${upgradedModel} (${[browser, os].filter(Boolean).join(' on ')})`;
            localStorage.setItem(DEVICE_NAME_KEY, upgradedName);
          }
        })
        .catch(() => {});
    }

    if (name) result.device_name = name;
    if (id) result.device_id = id;
  } catch {
    // Storage blocked: omit ID/name rather than invent them
  }
  return result;
};
