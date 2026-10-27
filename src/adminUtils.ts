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
