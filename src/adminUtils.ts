const FULL_ADMINS_STORAGE_KEY = 'wnw_full_admin_emails';
const COORDINATORS_STORAGE_KEY = 'wnw_coordinator_emails';

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
export const DEFAULT_COORDINATOR_EMAILS: string[] = [];

export const getFullAdminEmails = (): string[] => {
  try {
    const stored = localStorage.getItem(FULL_ADMINS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
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

export const saveFullAdminEmails = (emails: string[]): void => {
  const clean = Array.from(new Set(emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
  try {
    localStorage.setItem(FULL_ADMINS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-admin-roles-updated'));
  }
};

export const saveCoordinatorEmails = (emails: string[]): void => {
  const clean = Array.from(new Set(emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
  try {
    localStorage.setItem(COORDINATORS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-admin-roles-updated'));
  }
};

export const addFullAdminEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return false;
  const currentFull = getFullAdminEmails();
  if (!currentFull.includes(normalized)) {
    saveFullAdminEmails([...currentFull, normalized]);
  }
  // Remove from coordinator if present to avoid overlap
  const currentCoords = getCoordinatorEmails();
  if (currentCoords.includes(normalized)) {
    saveCoordinatorEmails(currentCoords.filter((e) => e !== normalized));
  }
  return true;
};

export const removeFullAdminEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  const currentFull = getFullAdminEmails();
  saveFullAdminEmails(currentFull.filter((e) => e !== normalized));
  return true;
};

export const addCoordinatorEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return false;
  const currentCoords = getCoordinatorEmails();
  if (!currentCoords.includes(normalized)) {
    saveCoordinatorEmails([...currentCoords, normalized]);
  }
  // Remove from full admin if present to avoid overlap
  const currentFull = getFullAdminEmails();
  if (currentFull.includes(normalized)) {
    saveFullAdminEmails(currentFull.filter((e) => e !== normalized));
  }
  return true;
};

export const removeCoordinatorEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  const currentCoords = getCoordinatorEmails();
  saveCoordinatorEmails(currentCoords.filter((e) => e !== normalized));
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

// Backwards compatibility exports
export const FULL_ADMIN_EMAILS = getFullAdminEmails();
export const COORDINATOR_EMAILS = getCoordinatorEmails();
export const ADMIN_EMAILS = [...FULL_ADMIN_EMAILS, ...COORDINATOR_EMAILS];
