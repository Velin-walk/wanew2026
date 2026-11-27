export interface RegistrationMatchOptions {
  /**
   * When true, matches cancelled/waitlisted/duplicate registrations to their trek
   * (used by SalesAnalyticsManager ratios and cancelled-per-event counters).
   * Defaults to false (active/confirmed-pipeline registrations only).
   */
  includeInactiveStatuses?: boolean;
}

const normAlnum = (s?: string | null): string =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const cleanPhoneDigits = (phone?: string | null): string =>
  String(phone || '').replace(/\D/g, '');

export const normalizePhoneLast10 = (phone?: string | null): string => {
  const digits = cleanPhoneDigits(phone);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Shared phone matcher: strips non-digits, requires >= 7 digits,
 * and matches exact, suffix (handles +977 / leading 0), or last-10-digit equality.
 */
export const matchesPhone = (p1?: string | null, p2?: string | null): boolean => {
  const d1 = cleanPhoneDigits(p1);
  const d2 = cleanPhoneDigits(p2);
  if (!d1 || !d2 || d1.length < 7 || d2.length < 7) return false;
  if (d1 === d2 || d1.endsWith(d2) || d2.endsWith(d1)) return true;
  if (d1.length >= 10 && d2.length >= 10 && d1.slice(-10) === d2.slice(-10)) return true;
  return false;
};

const isPlaceholderHikeValue = (val: string): boolean => {
  const lower = val.toLowerCase().trim();
  return !lower || lower === 'tbd' || lower === 'tba' || lower === 'private' || lower === 'undefined' || lower === 'null';
};

const extractHikeDigitsFromValue = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  const s = String(val).trim();
  if (isPlaceholderHikeValue(s)) return '';
  // Reject long UUIDs / timestamp-based IDs (e.g. hike-copy-1732000123-abc)
  if (s.length > 24) return '';

  const m =
    s.match(/^hike-(\d{1,4})$/i) ||
    s.match(/^#?(\d{1,4})$/) ||
    s.match(/\b(\d{1,4})\b/);
  if (!m) return '';
  const digits = m[1] || m[0];
  return parseInt(digits, 10) > 0 ? String(parseInt(digits, 10)) : '';
};

/**
 * Shared hike number extractor across Treks, Registrations, Historical events, and Reviews.
 * Safely rejects placeholder values ('TBD', 'PRIVATE') and timestamp/UUID IDs.
 */
export const extractHikeNumber = (input: any): string => {
  if (input === undefined || input === null) return '';
  if (typeof input === 'string' || typeof input === 'number') {
    return extractHikeDigitsFromValue(input);
  }
  if (typeof input !== 'object') return '';

  const fields = [
    input.hike_number,
    input.hikeNumber,
    input.event_no,
    input.no,
    input.trek_id,
    input.hike_id,
    input.id,
  ];
  for (const f of fields) {
    if (f !== undefined && f !== null) {
      const digits = extractHikeDigitsFromValue(f);
      if (digits) return digits;
    }
  }
  return '';
};

const normalizeExplicitHikeToken = (val?: unknown): string => {
  if (val === undefined || val === null) return '';
  const raw = String(val).trim().toLowerCase();
  if (isPlaceholderHikeValue(raw)) return '';
  return raw.replace(/^hike-/, '').replace(/^#/, '').replace(/\s+/g, ' ').trim();
};

/**
 * Produces a canonical event key for a registration so multiple submissions
 * by the same hiker for the same hike/trek collapse to 1 unique event.
 */
export const getRegistrationEventKey = (r: any): string => {
  if (!r) return '';
  const rawHikeNum = String(r.hike_number || '').trim();
  const isPriv =
    rawHikeNum.toUpperCase() === 'PRIVATE' ||
    String(r.trek_name || '').toLowerCase().includes('private');

  const nameNorm = normAlnum(r.trek_name);
  const dateNorm = normAlnum(r.trek_date || r.date);

  if (isPriv) {
    if (nameNorm || dateNorm) return `private:${nameNorm}:${dateNorm}`;
    return `private:row:${String(r.id || '')}`;
  }

  const hDigits = extractHikeNumber(r);
  if (hDigits) {
    return `hike:${hDigits}`;
  }

  const trekId = String(r.trek_id || '').trim().toLowerCase();
  if (trekId && !isPlaceholderHikeValue(trekId)) {
    return `trek:${trekId}`;
  }

  if (nameNorm || dateNorm) {
    return `name:${nameNorm}:${dateNorm}`;
  }

  return `row:${String(r.id || '')}`;
};

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const parseDayMonth = (d?: string): { day: number; month: string } | null => {
  if (!d) return null;
  const str = String(d).toLowerCase().trim();
  const m1 = str.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3,9})/);
  if (m1) return { day: parseInt(m1[1], 10), month: m1[2].slice(0, 3) };
  const m2 = str.match(/([a-z]{3,9})\s+(\d{1,2})/);
  if (m2) return { day: parseInt(m2[2], 10), month: m2[1].slice(0, 3) };
  const mIso = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    const mIdx = parseInt(mIso[2], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) return { day: parseInt(mIso[3], 10), month: MONTH_NAMES[mIdx] };
  }
  const mDmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mDmy) {
    const mIdx = parseInt(mDmy[2], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) return { day: parseInt(mDmy[1], 10), month: MONTH_NAMES[mIdx] };
  }
  return null;
};

const datesMatch = (d1?: string, d2?: string): boolean => {
  if (!d1 || !d2) return false;
  const p1 = parseDayMonth(d1);
  const p2 = parseDayMonth(d2);
  if (p1 && p2) {
    return p1.day === p2.day && p1.month === p2.month;
  }
  const s1 = normAlnum(d1);
  const s2 = normAlnum(d2);
  return s1 === s2 || (s1.length > 5 && s2.length > 5 && (s1.includes(s2) || s2.includes(s1)));
};

const datesConflict = (d1?: string, d2?: string): boolean => {
  if (!d1 || !d2) return false;
  const p1 = parseDayMonth(d1);
  const p2 = parseDayMonth(d2);
  if (p1 && p2) {
    return p1.day !== p2.day || p1.month !== p2.month;
  }
  return false;
};

const isGenericTitle = (title?: string): boolean => {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  if (!lower || lower === 'untitled hike' || lower === 'hike event' || lower === 'himalayan trek') return true;
  return /himalayan hike|day hike|overnight bus hike|upcoming trek|hike|trek/.test(lower) && lower.length < 25;
};

/**
 * Shared registration-to-trek matcher used across API enrichment, Bookings,
 * Coordinator Hub, Sales Analytics, and Reports.
 */
export const doesRegistrationMatchTrek = (
  r: any,
  t?: any,
  options?: RegistrationMatchOptions
): boolean => {
  if (!t || !r) return false;

  if (!options?.includeInactiveStatuses) {
    const regStatus = String(
      r.roster_registration_status || r.registration_status || r.status || 'Confirmed'
    )
      .toLowerCase()
      .trim();
    if (
      regStatus.includes('cancel') ||
      regStatus === 'waitlisted' ||
      regStatus === 'waitlist' ||
      regStatus === 'double registration' ||
      regStatus === 'duplicate'
    ) {
      return false;
    }
  }

  const tId = String(t.id || '').toLowerCase().trim();
  const rTrekId = String(r.trek_id || '').toLowerCase().trim();
  const rHikeNumRaw = String(r.hike_number || '').toLowerCase().trim();
  const tHikeNumRaw = String(t.hike_number || '').toLowerCase().trim();

  // 1. Direct ID match
  if (tId && (rTrekId === tId || rHikeNumRaw === tId)) return true;

  // 2. Explicit hike_number match / mismatch
  const tHikeToken = normalizeExplicitHikeToken(t.hike_number);
  const rHikeToken = normalizeExplicitHikeToken(r.hike_number);
  if (tHikeToken && rHikeToken) {
    if (tHikeToken === rHikeToken || (tHikeNumRaw && rTrekId === tHikeNumRaw)) return true;
    return false;
  }

  // 3. Extracted numeric hike_number match (handles trek_id: "hike-308" vs hike_number: "308")
  const tHikeDigits = extractHikeNumber(t);
  const rHikeDigits = extractHikeNumber(r);
  if (tHikeDigits && rHikeDigits) {
    return tHikeDigits === rHikeDigits;
  }

  const tDate = t.date || t.hike_date || t.data?.hikeDate || t.data?.date || t.data?.hike_date;
  const rDate = r.trek_date || r.date;

  // 4. Date conflict guard before any fallback name matching
  if (datesConflict(tDate, rDate)) {
    return false;
  }

  const tTitleRaw = t.name || t.title || t.data?.title || t.data?.name;
  const tNameNorm = normAlnum(tTitleRaw);
  const rNameNorm = normAlnum(r.trek_name);

  // 5. Non-generic title overlap (after date conflict guard)
  if (tNameNorm && rNameNorm && !isGenericTitle(tTitleRaw) && !isGenericTitle(r.trek_name)) {
    if (tNameNorm === rNameNorm || tNameNorm.includes(rNameNorm) || rNameNorm.includes(tNameNorm)) {
      return true;
    }
    if (tNameNorm.length > 3 && rNameNorm.length > 3 && tNameNorm !== rNameNorm) {
      return false;
    }
  }

  // 6. If trek has a specific hike number and registration has none, do not match different named treks
  if (tHikeToken && !rHikeToken && tNameNorm && rNameNorm && tNameNorm !== rNameNorm) {
    return false;
  }

  // 7. Exact date match only if titles are generic or compatible
  if (datesMatch(tDate, rDate)) {
    if (!rNameNorm || isGenericTitle(r.trek_name) || !tNameNorm || isGenericTitle(tTitleRaw)) {
      return true;
    }
    return tNameNorm === rNameNorm || tNameNorm.includes(rNameNorm) || rNameNorm.includes(tNameNorm);
  }

  return false;
};

export const normalizeGuideCompare = (name?: string | null): string =>
  String(name || '')
    .replace(/\s*\((?:lead\s+|assistant\s+|asst\.?\s+)?(?:guide|leader)\)/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const guideNamesMatch = (
  candidateName?: string | null,
  guideName?: string | null,
  options?: { allowSingleWordFirstName?: boolean }
): boolean => {
  const c = normalizeGuideCompare(candidateName);
  const g = normalizeGuideCompare(guideName);
  if (!c || !g) return false;
  if (c === g) return true;

  const cParts = c.split(' ').filter(Boolean);
  const gParts = g.split(' ').filter(Boolean);
  if (cParts.length >= 2 && gParts.length >= 2) {
    if (cParts[0] !== gParts[0]) return false;
    const cLast = cParts[cParts.length - 1];
    const gLast = gParts[gParts.length - 1];
    if (cLast === gLast) return true;
    if (cLast.startsWith('th') && gLast.startsWith('th')) return true;
    return cLast.length >= 4 && gLast.length >= 4 && (cLast.includes(gLast) || gLast.includes(cLast));
  }

  if (options?.allowSingleWordFirstName) {
    if (cParts.length === 1 && gParts.length >= 2 && cParts[0].length >= 4) {
      return cParts[0] === gParts[0];
    }
    if (gParts.length === 1 && cParts.length >= 2 && gParts[0].length >= 4) {
      return gParts[0] === cParts[0];
    }
  }

  return false;
};
