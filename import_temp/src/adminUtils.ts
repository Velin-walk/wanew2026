export const ADMIN_EMAILS = [
  'velinrai.vr@gmail.com',
  'thingbiraj77@gmail.com',
  'business.seekscape@gmail.com',
  'salinatmg.npl@gmail.com',
  'wanewasalina@gmail.com',
  'sundargurung110@gmail.com',
  'walknepalwalk@gmail.com'
];

export const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

const DEVICE_ID_KEY = 'wnw_admin_device_id';
const DEVICE_NAME_KEY = 'wnw_admin_device_name';

const detectOs = (ua: string, uaPlatform?: string): string => {
  if (uaPlatform) return uaPlatform;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
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

/**
 * Persistent, per-browser device identity (never derived from the login email).
 * Same browser => same ID for any admin email; same email on another browser => different ID.
 * Only values actually detected are used. If storage is unavailable, ID/name are omitted (no guessing).
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
      const uaData = (navigator as any).userAgentData;
      const os = detectOs(ua, uaData?.platform);
      const browser = detectBrowser(ua);
      name = [browser, os && `on ${os}`].filter(Boolean).join(' ');
      const tag = (os || 'WEB').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
      id = `#DEV-${tag}-${String(rand).padStart(4, '0')}`;
      if (name) localStorage.setItem(DEVICE_NAME_KEY, name);
      localStorage.setItem(DEVICE_ID_KEY, id);

      // Upgrade the stored name with the real hardware model when the browser exposes it (Chromium on Android).
      uaData?.getHighEntropyValues?.(['model'])
        .then((v: { model?: string }) => {
          if (v?.model) {
            const upgraded = `${v.model} (${[browser, os].filter(Boolean).join(' / ')})`;
            localStorage.setItem(DEVICE_NAME_KEY, upgraded);
          }
        })
        .catch(() => {});
    }

    if (name) result.device_name = name;
    result.device_id = id;
  } catch {
    // Storage blocked: omit ID/name rather than invent them
  }
  return result;
};