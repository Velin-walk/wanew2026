import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

export interface CitizenPricingFilter {
  isNepaliCitizen: boolean;
  isForeigner: boolean;
  detectedCountry: string;
  loading: boolean;
  formatPrice: (rawPrice: string | number | undefined | null) => {
    isAvailable: boolean;
    display: string;
    isInternational: boolean;
  };
  setNationalityPreference: (pref: 'nepali' | 'international' | 'auto') => void;
  nationalityPreference: 'nepali' | 'international' | 'auto';
}

const GEO_STORAGE_KEY = 'wnw_geo_country';
const NATIONALITY_PREF_KEY = 'wnw_user_nationality';

// Helper to check if a phone number matches Nepal mobile or country format
export function isNepalPhoneNumber(phoneStr?: string | null): boolean {
  if (!phoneStr) return false;
  const cleaned = phoneStr.trim().replace(/[\s\-_()]/g, '');
  if (!cleaned) return false;

  // Has +977 or 977 country code prefix
  if (cleaned.startsWith('+977') || cleaned.startsWith('977')) {
    return true;
  }

  // 10-digit mobile number starting with 98, 97, or 96 (NTC, Ncell, SmartCell)
  if (/^[9][678]\d{8}$/.test(cleaned)) {
    return true;
  }

  // Standard Nepal landline or 9-10 digit local format
  if (/^0[1-9]\d{7,8}$/.test(cleaned)) {
    return true;
  }

  return false;
}

// Helper to detect if email or account belongs to a Nepali institution
export function isNepalEmail(emailStr?: string | null): boolean {
  if (!emailStr) return false;
  const lower = emailStr.trim().toLowerCase();
  return lower.endsWith('.np') || lower.endsWith('.edu.np') || lower.endsWith('.gov.np');
}

export function useCitizenPricing(): CitizenPricingFilter {
  const { user, isAdmin, userPhone } = useAuth();

  const [nationalityPreference, setNationalityPreferenceState] = useState<'nepali' | 'international' | 'auto'>(() => {
    try {
      const saved = localStorage.getItem(NATIONALITY_PREF_KEY);
      if (saved === 'nepali' || saved === 'international') return saved;
      return 'auto';
    } catch {
      return 'auto';
    }
  });

  const [detectedCountry, setDetectedCountry] = useState<string>(() => {
    try {
      return sessionStorage.getItem(GEO_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [loading, setLoading] = useState<boolean>(!detectedCountry);

  // Detect country via Cloudflare Edge or fallback IP geolocation
  useEffect(() => {
    if (detectedCountry) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function detectCountry() {
      // 1. Try Cloudflare Worker endpoint
      try {
        const res = await apiFetch('geo', { cacheTtl: 3600000 }); // cache 1 hr
        if (res.ok) {
          const json = await res.json();
          if (json?.country && typeof json.country === 'string') {
            const code = json.country.toUpperCase();
            if (isMounted) {
              setDetectedCountry(code);
              try { sessionStorage.setItem(GEO_STORAGE_KEY, code); } catch (_) {}
              setLoading(false);
              return;
            }
          }
        }
      } catch (_) {
        // Continue to fallback
      }

      // 2. Fallback: lightweight country lookup API
      try {
        const res = await fetch('https://api.country.is', { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const json = await res.json();
          if (json?.country) {
            const code = String(json.country).toUpperCase();
            if (isMounted) {
              setDetectedCountry(code);
              try { sessionStorage.setItem(GEO_STORAGE_KEY, code); } catch (_) {}
              setLoading(false);
              return;
            }
          }
        }
      } catch (_) {
        // Fallback using device timezone heuristic
      }

      // 3. Fallback heuristic: Nepal has unique UTC+05:45 timezone (Asia/Kathmandu)
      if (isMounted) {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz === 'Asia/Kathmandu') {
            setDetectedCountry('NP');
            try { sessionStorage.setItem(GEO_STORAGE_KEY, 'NP'); } catch (_) {}
          } else {
            // Default to 'INTL' if outside Nepal
            setDetectedCountry('INTL');
          }
        } catch (_) {
          setDetectedCountry('NP');
        }
        setLoading(false);
      }
    }

    detectCountry();

    return () => {
      isMounted = false;
    };
  }, [detectedCountry]);

  const setNationalityPreference = useCallback((pref: 'nepali' | 'international' | 'auto') => {
    setNationalityPreferenceState(pref);
    try {
      if (pref === 'auto') {
        localStorage.removeItem(NATIONALITY_PREF_KEY);
      } else {
        localStorage.setItem(NATIONALITY_PREF_KEY, pref);
      }
    } catch (_) {}
  }, []);

  // Compute final isNepaliCitizen status using our 4-tier signal hierarchy:
  // Level 1: Admin override (always true)
  // Level 2: User preference in profile / local storage
  // Level 3: Verified phone number (+977) or local email (.np)
  // Level 4: Cloudflare Country Detection ('NP')
  const isNepaliCitizen = useMemo(() => {
    // 1. Admin always sees full citizen rates
    if (isAdmin) return true;

    // 2. Explicit user profile override
    if (nationalityPreference === 'nepali') return true;
    if (nationalityPreference === 'international') return false;

    // 3. Phone number verification (+977 / Nepal mobile)
    const phone = userPhone || user?.phoneNumber || (typeof localStorage !== 'undefined' ? localStorage.getItem('wnw_user_phone') : null);
    if (isNepalPhoneNumber(phone)) return true;

    // 4. WhatsApp number verification
    const whatsapp = typeof localStorage !== 'undefined' ? localStorage.getItem('wnw_user_whatsapp') : null;
    if (isNepalPhoneNumber(whatsapp)) return true;

    // 5. Account email domain (.np, tu.edu.np, gov.np)
    if (isNepalEmail(user?.email)) return true;

    // 6. Cloudflare Country Detection
    if (detectedCountry) {
      return detectedCountry === 'NP';
    }

    // Default to true while detecting so local users don't see sudden flashes
    return true;
  }, [isAdmin, nationalityPreference, userPhone, user?.phoneNumber, user?.email, detectedCountry]);

  const isForeigner = !isNepaliCitizen;

  const formatPrice = useCallback((rawPrice: string | number | undefined | null) => {
    if (!rawPrice) {
      return {
        isAvailable: false,
        display: '',
        isInternational: false,
      };
    }

    if (isNepaliCitizen) {
      return {
        isAvailable: true,
        display: String(rawPrice),
        isInternational: false,
      };
    }

    return {
      isAvailable: true,
      display: 'Inquire for International Rates',
      isInternational: true,
    };
  }, [isNepaliCitizen]);

  return {
    isNepaliCitizen,
    isForeigner,
    detectedCountry,
    loading,
    formatPrice,
    setNationalityPreference,
    nationalityPreference,
  };
}
