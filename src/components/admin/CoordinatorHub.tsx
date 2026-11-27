import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Phone,
  MessageSquare,
  AlertTriangle,
  MapPin,
  CheckCircle,
  Users,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  Eye,
  Trophy
} from 'lucide-react';
import { Trek } from '../../types';
import {
  AdminRegistration,
  doesRegistrationMatchTrek,
  normalizeGuideCompare,
  resolveTrekGuides,
  useResolvedGuideProfiles,
} from './BookingsManager';
import { HISTORICAL_TREKS } from '../../data/historicalTreks';
import { apiFetch, fetchLeaderboardData } from '../../services/api';
import { getGuidesSettings, EVENT_NAME as GUIDES_UPDATED_EVENT } from '../../services/guidesService';
import { HikerStats } from '../../types/leaderboard';
import { AdminHikerProfileModal } from './AdminHikerProfileModal';
import { useAuth } from '../../context/AuthContext';
import {
  getGenderCategory,
  getGenderTextColorClass,
  isCoordinatorEmail,
  isFullAdminEmail,
  parseTrekDate,
} from '../../adminUtils';
import {
  cleanPhoneDigits,
  extractHikeNumber,
  getRegistrationEventKey,
  guideNamesMatch,
  matchesPhone,
  normalizePhoneLast10,
} from '../../utils/matchingUtils';

interface CoordinatorHubProps {
  treks: Trek[];
  registrations: AdminRegistration[];
  loading: boolean;
  onRefresh: () => void;
  currentUserEmail?: string;
  restrictToAssignedEvents?: boolean;
}

type FilterType = 'all' | 'paid' | 'pending' | 'due';
type SortCol =
  | 'sn'
  | 'name'
  | 'phone'
  | 'pickup'
  | 'pax'
  | 'paid'
  | 'due'
  | 'gender'
  | 'age'
  | 'suggestions'
  | 'updates'
  | 'medical'
  | 'totalHikes';

const getRegPaxDisplay = (r: AdminRegistration): string | number => {
  const raw = r.paxCount !== undefined && r.paxCount !== '' ? r.paxCount : (r as any).pax;
  if (raw === undefined || raw === null || String(raw).trim() === '') return 1;
  return raw;
};

const isGenericTitle = (name?: string): boolean => {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  return (
    !n ||
    n === 'himalayan trek' ||
    n === 'hike event' ||
    n === 'untitled hike' ||
    n === 'day hike' ||
    n === 'overnight bus hikes' ||
    n === 'trek' ||
    n === 'hike' ||
    n === 'himalayan trek / event'
  );
};

export const getHikeNumberFromAny = extractHikeNumber;

const getTrekNameForHike = (hikeNum: string, fallbackName?: string): string => {
  if (fallbackName && !isGenericTitle(fallbackName)) {
    return fallbackName;
  }
  if (hikeNum) {
    const cleanNum = getHikeNumberFromAny(hikeNum);
    const hist = HISTORICAL_TREKS.find(
      (h) => getHikeNumberFromAny(h.hike_number) === cleanNum
    );
    if (hist && hist.title) {
      return hist.title;
    }
    return `Hike #${hikeNum}`;
  }
  return fallbackName && !isGenericTitle(fallbackName) ? fallbackName : 'Hike Event';
};


export const CoordinatorHub: React.FC<CoordinatorHubProps> = ({
  treks,
  registrations: rawRegistrations,
  loading,
  onRefresh,
  currentUserEmail,
  restrictToAssignedEvents,
}) => {
  const { user, userEmail: authEmail, userPhone: authPhone } = useAuth();
  const effectiveEmail = (currentUserEmail || authEmail || user?.email || '').toLowerCase().trim();
  const isRestrictedGuide = Boolean(
    restrictToAssignedEvents ??
      (effectiveEmail && !isFullAdminEmail(effectiveEmail) && isCoordinatorEmail(effectiveEmail))
  );

  // Exclude Cancelled, Waitlisted, and Cancelled by User from Coordinator Hub
  const [leaderboardHikers, setLeaderboardHikers] = useState<HikerStats[]>([]);
  const [activeProfileHiker, setActiveProfileHiker] = useState<{ name: string; phone?: string; email?: string } | null>(null);
  const [guideIdentityInfo, setGuideIdentityInfo] = useState<{ names: string[]; phones: string[] }>({
    names: [],
    phones: [],
  });
  const [customGuidesList, setCustomGuidesList] = useState(() => {
    try {
      return getGuidesSettings().custom_guides || [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    const handleGuidesUpdated = () => {
      try {
        setCustomGuidesList(getGuidesSettings().custom_guides || []);
      } catch {}
    };
    window.addEventListener(GUIDES_UPDATED_EVENT, handleGuidesUpdated);
    return () => window.removeEventListener(GUIDES_UPDATED_EVENT, handleGuidesUpdated);
  }, []);

  React.useEffect(() => {
    if (!isRestrictedGuide || !effectiveEmail) {
      setGuideIdentityInfo({ names: [], phones: [] });
      return;
    }
    let cancelled = false;
    apiFetch(`admin/user-identity?email=${encodeURIComponent(effectiveEmail)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data;
        if (!data || cancelled) return;
        const profile = data.profile || {};
        const contacts: Array<{ type: string; value: string }> = Array.isArray(data.contacts)
          ? data.contacts
          : [];
        const names = [profile.full_name, profile.display_name]
          .map((n) => String(n || '').trim())
          .filter(Boolean);
        const phones = [
          profile.whatsapp_number,
          ...contacts.filter((c) => c.type === 'phone').map((c) => c.value),
        ]
          .map((p) => String(p || '').trim())
          .filter(Boolean);
        setGuideIdentityInfo({ names, phones });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isRestrictedGuide, effectiveEmail]);

  // Load Leaderboard data for lifetime hikes and phone matching
  React.useEffect(() => {
    let isMounted = true;
    const loadLeaderboard = async () => {
      try {
        const res = await fetchLeaderboardData(false);
        if (isMounted && res && Array.isArray(res.hikers)) {
          setLeaderboardHikers(res.hikers);
        }
      } catch (err) {
        console.warn('[CoordinatorHub] Could not load leaderboard data:', err);
      }
    };
    loadLeaderboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const registrations = useMemo(() => {
    return rawRegistrations.filter((r) => {
      const st = (r.status || 'Confirmed').toLowerCase().trim();
      return st !== 'cancelled' && st !== 'waitlisted' && st !== 'cancelled by user' && !st.includes('cancelled');
    });
  }, [rawRegistrations]);

  // 1. Merge library treks + synthesize virtual trek events from registrations if not yet in library
  const allAvailableTreks = useMemo(() => {
    const existingHikeNums = new Set<string>();
    const existingIds = new Set<string>();

    treks.forEach((t) => {
      if (t.id) existingIds.add(t.id.toLowerCase());
      const hNum = getHikeNumberFromAny(t);
      if (hNum) existingHikeNums.add(hNum);
    });

    const virtualTreks: Trek[] = [];
    const seenHikeKeys = new Set<string>();

    // Group registrations by hike number or ID
    registrations.forEach((r) => {
      const hNum = getHikeNumberFromAny(r);
      const rawId = (r.trek_id || r.hike_number || '').trim();
      const trekKey = hNum || rawId || (r.trek_name || '').trim();

      if (!trekKey || seenHikeKeys.has(trekKey)) return;

      const isCovered =
        (hNum && existingHikeNums.has(hNum)) ||
        (rawId && existingIds.has(rawId.toLowerCase()));

      if (!isCovered) {
        seenHikeKeys.add(trekKey);

        const allMatchingRegs = registrations.filter(
          (other) => getHikeNumberFromAny(other) === hNum
        );
        const namedReg = allMatchingRegs.find((other) => other.trek_name && !isGenericTitle(other.trek_name));
        const datedReg = allMatchingRegs.find((other) => other.trek_date && other.trek_date.trim().length > 0);

        const trekName = getTrekNameForHike(hNum, namedReg?.trek_name || r.trek_name);
        const trekDate = datedReg?.trek_date || r.trek_date || '';

        virtualTreks.push({
          id: rawId || (hNum ? `hike-${hNum}` : `v-${Math.random().toString(36).substring(2, 7)}`),
          hike_number: hNum || rawId || '',
          name: trekName,
          date: trekDate,
          days: '1',
          difficulty: 'moderate',
          leader: 'Walk Nepal Walk Guide',
          capacity: 30,
          participants: 0,
          price: 'NPR 1,500',
          featured_image: '',
          status: 'published',
        });
      }
    });

    // Also enrich any existing library treks with real historical names if their title is generic
    const enrichedTreksList = treks.map((t) => {
      const hNum = getHikeNumberFromAny(t);
      if (hNum && isGenericTitle(t.name)) {
        const namedReg = registrations.find(
          (r) => getHikeNumberFromAny(r) === hNum && r.trek_name && !isGenericTitle(r.trek_name)
        );
        const realName = getTrekNameForHike(hNum, namedReg?.trek_name);
        return { ...t, name: realName };
      }
      return t;
    });

    return [...enrichedTreksList, ...virtualTreks];
  }, [treks, registrations]);


  // 2. Filter for upcoming events + events in last 1 month
  const unscopedUpcomingTreks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);

    const getHikeNum = (t: Trek) => {
      const m = String(t.hike_number || t.id || '').match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };

    return allAvailableTreks
      .filter((t) => {
        const dt = parseTrekDate(t.date);
        return !dt || dt.getTime() >= oneMonthAgo.getTime();
      })
      .sort((a, b) => {
        const da = parseTrekDate(a.date)?.getTime() ?? null;
        const db = parseTrekDate(b.date)?.getTime() ?? null;

        const aIsUpcoming = da !== null && da >= todayMs;
        const bIsUpcoming = db !== null && db >= todayMs;

        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;

        if (aIsUpcoming && bIsUpcoming) {
          if (da !== db) return da - db;
          return getHikeNum(b) - getHikeNum(a);
        }

        if (da !== null && db === null) return -1;
        if (da === null && db !== null) return 1;
        if (da !== null && db !== null && da !== db) {
          return db - da;
        }

        return getHikeNum(b) - getHikeNum(a);
      });
  }, [allAvailableTreks, registrations]);

  // Resolve guide profiles across all candidate upcoming events when restricting visibility for guides
  const allUpcomingGuideNames = useMemo(() => {
    if (!isRestrictedGuide) return [] as string[];
    const set = new Set<string>();
    unscopedUpcomingTreks.forEach((t) => {
      const mRegs = registrations.filter((r) => doesRegistrationMatchTrek(r, t));
      const { leadName, asstNames } = resolveTrekGuides(t, mRegs);
      if (leadName) set.add(leadName);
      asstNames.forEach((a) => {
        if (a) set.add(a);
      });
    });
    return Array.from(set);
  }, [isRestrictedGuide, unscopedUpcomingTreks, registrations]);

  const upcomingGuideProfiles = useResolvedGuideProfiles(
    allUpcomingGuideNames,
    rawRegistrations,
    leaderboardHikers
  );

  const upcomingTreks = useMemo(() => {
    if (!isRestrictedGuide) return unscopedUpcomingTreks;
    if (!effectiveEmail) return [];

    const emailMatchesGuideName = (guideName: string, email: string): boolean => {
      if (!guideName || !email) return false;
      const local = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z]/g, '');
      if (local.length < 3) return false;
      const tokens = normalizeGuideCompare(guideName)
        .split(' ')
        .map((t) => t.replace(/[^a-z]/g, ''))
        .filter((t) => t.length >= 3);
      if (tokens.length === 0) return false;
      if (tokens.length === 1) {
        return tokens[0].length >= 4 && (local === tokens[0] || (tokens[0].length >= 5 && local.includes(tokens[0])));
      }
      return tokens.every((t) => local.includes(t));
    };

    const guideNamesForUser = new Set<string>();
    const guidePhonesForUser = new Set<string>();

    if (user?.displayName && user.displayName.trim()) {
      guideNamesForUser.add(user.displayName.trim());
    }
    guideIdentityInfo.names.forEach((n) => guideNamesForUser.add(n));
    guideIdentityInfo.phones.forEach((p) => guidePhonesForUser.add(p));
    if (authPhone && authPhone.trim()) guidePhonesForUser.add(authPhone.trim());

    rawRegistrations.forEach((r) => {
      const rEmails = [r.email, r.user_email, r.email_address]
        .map((e) => String(e || '').toLowerCase().trim())
        .filter(Boolean);
      if (rEmails.includes(effectiveEmail)) {
        if (r.full_name) guideNamesForUser.add(r.full_name.trim());
        const ph = r.phone || r.whatsapp || (r as any).whatsapp_number;
        if (ph) guidePhonesForUser.add(String(ph).trim());
      }
    });

    leaderboardHikers.forEach((h) => {
      if (String(h.e || '').toLowerCase().trim() === effectiveEmail) {
        if (h.n) guideNamesForUser.add(h.n.trim());
        const ph = h.phone || h.p;
        if (ph) guidePhonesForUser.add(String(ph).trim());
      }
    });

    customGuidesList.forEach((cg) => {
      if (emailMatchesGuideName(cg.name, effectiveEmail)) {
        guideNamesForUser.add(cg.name.trim());
        if (cg.phone) guidePhonesForUser.add(cg.phone.trim());
      }
    });

    const userNamesArr = Array.from(guideNamesForUser);
    const userPhonesArr = Array.from(guidePhonesForUser);

    return unscopedUpcomingTreks.filter((t) => {
      const mRegs = registrations.filter((r) => doesRegistrationMatchTrek(r, t));
      const { leadName, asstNames } = resolveTrekGuides(t, mRegs);
      const allottedGuides = [leadName, ...asstNames].filter(Boolean);
      if (allottedGuides.length === 0) return false;

      return allottedGuides.some((gName) => {
        if (emailMatchesGuideName(gName, effectiveEmail)) return true;
        if (userNamesArr.some((myName) => guideNamesMatch(gName, myName, { allowSingleWordFirstName: true }))) {
          return true;
        }
        const profile = upcomingGuideProfiles.get(normalizeGuideCompare(gName));
        if (profile) {
          if (profile.email && profile.email.toLowerCase().trim() === effectiveEmail) {
            return true;
          }
          if (profile.phone && userPhonesArr.some((myPh) => matchesPhone(profile.phone, myPh))) {
            return true;
          }
        }
        return false;
      });
    });
  }, [
    isRestrictedGuide,
    unscopedUpcomingTreks,
    effectiveEmail,
    user?.displayName,
    authPhone,
    guideIdentityInfo,
    rawRegistrations,
    registrations,
    leaderboardHikers,
    customGuidesList,
    upcomingGuideProfiles,
  ]);

  const [selectedTrekId, setSelectedTrekId] = useState<string>('');
  const [showZeroParticipants, setShowZeroParticipants] = useState<boolean>(false);

  // 3. Auto-select first trek with bookings or first available event
  React.useEffect(() => {
    if (upcomingTreks.length > 0) {
      const selHikeNum = getHikeNumberFromAny(selectedTrekId);
      const isCurrentValid = Boolean(
        selectedTrekId &&
          upcomingTreks.some(
            (t) =>
              t.id === selectedTrekId ||
              (t.hike_number && t.hike_number !== 'TBD' && t.hike_number === selectedTrekId) ||
              (selHikeNum && getHikeNumberFromAny(t) === selHikeNum)
          )
      );

      if (!selectedTrekId || !isCurrentValid) {
        const trekWithBookings = upcomingTreks.find((t) =>
          registrations.some((r) => doesRegistrationMatchTrek(r, t))
        );
        const chosen = trekWithBookings || upcomingTreks[0];
        setSelectedTrekId(chosen.id || chosen.hike_number || '');
      }
    } else if (selectedTrekId) {
      setSelectedTrekId('');
    }
  }, [upcomingTreks, selectedTrekId, registrations]);

  const [tableFilter, setTableFilter] = useState<FilterType>('all');
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewingVoucherUrl, setViewingVoucherUrl] = useState<string | null>(null);
  const [viewingVoucherReg, setViewingVoucherReg] = useState<AdminRegistration | null>(null);
  const pageSize = 50;

  // Selected Active Trek
  const currentTrek = useMemo(() => {
    if (upcomingTreks.length === 0) return null;
    const selHikeNum = getHikeNumberFromAny(selectedTrekId);
    return (
      upcomingTreks.find(
        (t) =>
          t.id === selectedTrekId ||
          (t.hike_number && t.hike_number !== 'TBD' && t.hike_number === selectedTrekId) ||
          (selHikeNum && getHikeNumberFromAny(t) === selHikeNum)
      ) ||
      upcomingTreks[0] ||
      null
    );
  }, [upcomingTreks, selectedTrekId]);

  // Participant counts for top strip cards to filter out 0-participant cards by default
  const treksWithParticipantCounts = useMemo(() => {
    return upcomingTreks.map((t) => {
      const matchedRegs = registrations.filter((r) => doesRegistrationMatchTrek(r, t));
      const fallbackParticipants = typeof t.participants === 'number' ? t.participants : (Number(t.participants) || 0);
      let extraGuidesCount = 0;
      if (matchedRegs.length > 0) {
        const { leadName, asstNames } = resolveTrekGuides(t, matchedRegs);
        const existingNames = new Set(
          matchedRegs.map((r) => normalizeGuideCompare(r.full_name)).filter(Boolean)
        );
        if (leadName && !existingNames.has(normalizeGuideCompare(leadName))) {
          extraGuidesCount++;
        }
        asstNames.forEach((a) => {
          if (!existingNames.has(normalizeGuideCompare(a))) {
            extraGuidesCount++;
          }
        });
      }
      return {
        trek: t,
        regsCount: matchedRegs.length > 0 ? matchedRegs.length + extraGuidesCount : fallbackParticipants,
      };
    });
  }, [upcomingTreks, registrations]);

  const zeroParticipantCount = useMemo(() => {
    return treksWithParticipantCounts.filter((item) => item.regsCount <= 0).length;
  }, [treksWithParticipantCounts]);

  const visibleTreksWithCounts = useMemo(() => {
    if (showZeroParticipants) {
      return treksWithParticipantCounts;
    }
    const curHikeNum = getHikeNumberFromAny(currentTrek);
    return treksWithParticipantCounts.filter((item) => {
      if (item.regsCount > 0) return true;
      const t = item.trek;
      const tHikeNum = getHikeNumberFromAny(t);
      const isSelected =
        currentTrek?.id === t.id ||
        (t.hike_number && t.hike_number !== 'TBD' && currentTrek?.hike_number === t.hike_number) ||
        Boolean(curHikeNum && tHikeNum && curHikeNum === tHikeNum);
      return isSelected;
    });
  }, [treksWithParticipantCounts, showZeroParticipants, currentTrek]);

  // Registrations matching active trek
  const trekRegistrations = useMemo(() => {
    if (!currentTrek) return [];
    return registrations.filter((r) => doesRegistrationMatchTrek(r, currentTrek));
  }, [currentTrek, registrations]);

  type CoordinatorRow = AdminRegistration & {
    _guideRole?: 'leader' | 'assistant';
    _isSyntheticGuide?: boolean;
  };

  const activeTrekGuideInfo = useMemo(() => {
    if (!currentTrek) return { leadName: '', asstNames: [] as string[] };
    return resolveTrekGuides(currentTrek, trekRegistrations);
  }, [currentTrek, trekRegistrations]);

  const activeTrekGuideNames = useMemo(() => {
    return [activeTrekGuideInfo.leadName, ...activeTrekGuideInfo.asstNames].filter(Boolean);
  }, [activeTrekGuideInfo]);

  const resolvedGuideProfiles = useResolvedGuideProfiles(
    activeTrekGuideNames,
    rawRegistrations,
    leaderboardHikers
  );

  const trekRosterWithGuides: CoordinatorRow[] = useMemo(() => {
    if (!currentTrek) return [];
    const { leadName, asstNames } = activeTrekGuideInfo;
    const leadKey = normalizeGuideCompare(leadName);
    const asstKeys = new Set(asstNames.map((a) => normalizeGuideCompare(a)));

    const applyProfileFallback = (row: CoordinatorRow, guideName: string): CoordinatorRow => {
      const profile = resolvedGuideProfiles.get(normalizeGuideCompare(guideName));
      if (!profile) return row;
      return {
        ...row,
        phone: row.phone || profile.phone || '',
        whatsapp: row.whatsapp || profile.whatsapp || profile.phone || '',
        email: row.email || profile.email || '',
        gender: row.gender || profile.gender || '',
        age_group: row.age_group || profile.age_group || '',
      };
    };

    const flaggedRows: CoordinatorRow[] = trekRegistrations.map((r) => {
      const nameKey = normalizeGuideCompare(r.full_name);
      if (nameKey && leadKey && nameKey === leadKey) {
        return applyProfileFallback({ ...r, _guideRole: 'leader' }, r.full_name);
      }
      if (nameKey && asstKeys.has(nameKey)) {
        return applyProfileFallback({ ...r, _guideRole: 'assistant' }, r.full_name);
      }
      return r;
    });

    const existingNames = new Set(
      flaggedRows.map((r) => normalizeGuideCompare(r.full_name)).filter(Boolean)
    );
    const guideRows: CoordinatorRow[] = [];
    const buildGuideRow = (name: string, role: 'leader' | 'assistant', idx: number): CoordinatorRow => {
      const profile = resolvedGuideProfiles.get(normalizeGuideCompare(name));
      return {
        id: `__coord_guide_${role}_${currentTrek.hike_number || currentTrek.id}_${idx}`,
        trek_id: currentTrek.id,
        hike_number: currentTrek.hike_number,
        trek_name: currentTrek.name,
        trek_date: currentTrek.date,
        full_name: name,
        phone: profile?.phone || '',
        whatsapp: profile?.whatsapp || profile?.phone || '',
        email: profile?.email || '',
        gender: profile?.gender || '',
        age_group: profile?.age_group || '',
        paxCount: 1,
        status: 'Confirmed',
        payment_status: 'Fully Paid',
        paid_amount: 0,
        due_amount: 0,
        _guideRole: role,
        _isSyntheticGuide: true,
      };
    };

    if (leadName && !existingNames.has(leadKey)) {
      guideRows.push(buildGuideRow(leadName, 'leader', 0));
    }
    asstNames.forEach((asstName, idx) => {
      if (!existingNames.has(normalizeGuideCompare(asstName))) {
        guideRows.push(buildGuideRow(asstName, 'assistant', idx + 1));
      }
    });

    return [...guideRows, ...flaggedRows];
  }, [currentTrek, trekRegistrations, activeTrekGuideInfo, resolvedGuideProfiles]);

  const getDuplicateNamePhoneKey = (r: AdminRegistration): string => {
    const cleanName = (r.full_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const rawDigits = (r.phone || r.whatsapp || (r as any).whatsapp_number || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    if (!cleanName || !cleanPhone) return '';
    return `${cleanName}|${cleanPhone}`;
  };

  const duplicateNamePhoneKeys = useMemo(() => {
    const counts = new Map<string, number>();
    trekRegistrations.forEach((r) => {
      const key = getDuplicateNamePhoneKey(r);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const dups = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) dups.add(key);
    });
    return dups;
  }, [trekRegistrations]);

  // Lifetime Leaderboard Phone & Name Map
  const leaderboardPhoneMap = useMemo(() => {
    const phoneMap = new Map<string, number>();
    const nameMap = new Map<string, number>();

    leaderboardHikers.forEach((h) => {
      const rawPhone = (h.phone || h.p || '').replace(/[^0-9]/g, '');
      const count = Number(h.c || (Array.isArray(h.hikes) ? h.hikes.length : 0)) || 0;
      if (count <= 0) return;

      if (rawPhone.length >= 7) {
        phoneMap.set(rawPhone, Math.max(phoneMap.get(rawPhone) || 0, count));
        if (rawPhone.length > 10) {
          const last10 = rawPhone.slice(-10);
          phoneMap.set(last10, Math.max(phoneMap.get(last10) || 0, count));
        }
      }

      const cleanName = (h.n || '').toLowerCase().trim();
      if (cleanName.length >= 3) {
        nameMap.set(cleanName, Math.max(nameMap.get(cleanName) || 0, count));
      }
    });

    return { phoneMap, nameMap };
  }, [leaderboardHikers]);

  // Lifetime Hike Count Map from local registrations (unique events only, excluding duplicate/cancelled applications)
  const hikerPastHikesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    registrations.forEach((r) => {
      const st = String(r.status || (r as any).registration_status || '').trim().toLowerCase();
      if (st.includes('duplicate') || st.includes('double') || st.includes('cancel') || st === 'waitlisted') return;
      const rawPh = r.phone || r.whatsapp || (r as any).whatsapp_number || '';
      const phKey = cleanPhoneDigits(rawPh).length >= 7 ? normalizePhoneLast10(rawPh) : '';
      const nameKey = (r.full_name || '').toLowerCase().trim();
      const eventKey = getRegistrationEventKey(r);
      if (!eventKey) return;
      if (phKey) {
        const existing = map.get(phKey);
        if (existing) existing.add(eventKey);
        else map.set(phKey, new Set([eventKey]));
      }
      if (nameKey) {
        const nKey = `name:${nameKey}`;
        const existing = map.get(nKey);
        if (existing) existing.add(eventKey);
        else map.set(nKey, new Set([eventKey]));
      }
    });
    return map;
  }, [registrations]);

  const getHikerPastCount = (phone: string, name: string): number => {
    const cleanPh = cleanPhoneDigits(phone);
    const last10 = normalizePhoneLast10(phone);
    const cleanName = (name || '').toLowerCase().trim();

    // 1. Primary: Match by phone number in Leaderboard (lifetime master data)
    if (cleanPh.length >= 7) {
      if (leaderboardPhoneMap.phoneMap.has(cleanPh)) {
        return leaderboardPhoneMap.phoneMap.get(cleanPh)!;
      }
      if (last10.length >= 7 && leaderboardPhoneMap.phoneMap.has(last10)) {
        return leaderboardPhoneMap.phoneMap.get(last10)!;
      }
      for (const [key, count] of leaderboardPhoneMap.phoneMap.entries()) {
        if (matchesPhone(cleanPh, key)) {
          return count;
        }
      }
    }

    // 2. Secondary: Match by exact name in Leaderboard
    if (cleanName && leaderboardPhoneMap.nameMap.has(cleanName)) {
      return leaderboardPhoneMap.nameMap.get(cleanName)!;
    }

    // 3. Fallback: Local registrations unique event count (normalized phone key)
    const nameKey = `name:${cleanName}`;
    if (last10.length >= 7 && hikerPastHikesMap.has(last10)) {
      return hikerPastHikesMap.get(last10)?.size || 1;
    }
    if (nameKey && hikerPastHikesMap.has(nameKey)) {
      return hikerPastHikesMap.get(nameKey)?.size || 1;
    }
    return 1;
  };

  // Metrics Calculations (Confirmed individual hikers from roster + assigned guides)
  const hikerCount = trekRegistrations.length;
  const totalRegistered =
    trekRegistrations.length > 0
      ? trekRosterWithGuides.length
      : Number(currentTrek?.participants) || trekRosterWithGuides.length || 0;
  const paidCount = trekRegistrations
    .filter((r) => r.payment_status?.toLowerCase() === 'fully paid' || (r.paid_amount || 0) > 0)
    .length;
  const totalRevenue = trekRegistrations.reduce((acc, r) => acc + (r.paid_amount || 0), 0);
  const dueCount = trekRegistrations.filter((r) => r.due_amount > 0).length;

  const returningCount = trekRegistrations
    .filter((r) => getHikerPastCount(r.phone || r.whatsapp || (r as any).whatsapp_number || '', r.full_name) > 1)
    .length;
  const firstTimersCount = hikerCount - returningCount;

  // Demographic Calculations
  const genderBreakdown = useMemo(() => {
    let female = 0;
    let male = 0;
    let other = 0;
    trekRegistrations.forEach((r) => {
      const g = (r.gender || '').toLowerCase().trim();
      if (g.includes('female') || g === 'f') female += 1;
      else if (g.includes('male') || g === 'm') male += 1;
      else other += 1;
    });
    const total = female + male + other || 1;
    return {
      female,
      male,
      other,
      femalePct: Math.round((female / total) * 100),
      malePct: Math.round((male / total) * 100),
    };
  }, [trekRegistrations]);

  const ageBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    let total = 0;
    trekRegistrations.forEach((r) => {
      const a = (r.age_group || 'Unspecified').trim();
      groups[a] = (groups[a] || 0) + 1;
      total += 1;
    });
    const denom = total || 1;
    return Object.entries(groups).map(([group, count]) => ({
      group,
      count,
      pct: Math.round((count / denom) * 100),
    }));
  }, [trekRegistrations]);

  // Table Filtering & Sorting
  const filteredAndSortedRegistrations = useMemo(() => {
    let result = [...trekRosterWithGuides];

    // Apply Filter Chips
    if (tableFilter === 'paid') {
      result = result.filter(
        (r) => !r._isSyntheticGuide && (r.payment_status?.toLowerCase() === 'fully paid' || r.paid_amount > 0)
      );
    } else if (tableFilter === 'pending') {
      result = result.filter(
        (r) => !r._isSyntheticGuide && r.payment_status?.toLowerCase() !== 'fully paid' && r.paid_amount === 0
      );
    } else if (tableFilter === 'due') {
      result = result.filter((r) => !r._isSyntheticGuide && r.due_amount > 0);
    }

    // Apply Sorting
    result.sort((a, b) => {
      if (sortCol === 'name' && sortAsc) {
        if (a._isSyntheticGuide && !b._isSyntheticGuide) return -1;
        if (!a._isSyntheticGuide && b._isSyntheticGuide) return 1;
        if (a._isSyntheticGuide && b._isSyntheticGuide) {
          if (a._guideRole === 'leader' && b._guideRole !== 'leader') return -1;
          if (a._guideRole !== 'leader' && b._guideRole === 'leader') return 1;
        }
      }

      let valA: any = '';
      let valB: any = '';

      switch (sortCol) {
        case 'name':
          valA = a.full_name.toLowerCase();
          valB = b.full_name.toLowerCase();
          break;
        case 'phone':
          valA = a.phone;
          valB = b.phone;
          break;
        case 'pickup':
          valA = (a.pickup_point || '').toLowerCase();
          valB = (b.pickup_point || '').toLowerCase();
          break;
        case 'pax':
          valA = String(getRegPaxDisplay(a)).toLowerCase();
          valB = String(getRegPaxDisplay(b)).toLowerCase();
          break;
        case 'paid':
          valA = a.paid_amount;
          valB = b.paid_amount;
          break;
        case 'due':
          valA = a.due_amount;
          valB = b.due_amount;
          break;
        case 'gender':
          valA = (a.gender || '').toLowerCase();
          valB = (b.gender || '').toLowerCase();
          break;
        case 'age':
          valA = (a.age_group || '').toLowerCase();
          valB = (b.age_group || '').toLowerCase();
          break;
        case 'updates':
          valA = (a.admin_notes || '').toLowerCase();
          valB = (b.admin_notes || '').toLowerCase();
          break;
        case 'totalHikes':
          valA = a._isSyntheticGuide
            ? -1
            : getHikerPastCount(a.phone || a.whatsapp || (a as any).whatsapp_number || '', a.full_name);
          valB = b._isSyntheticGuide
            ? -1
            : getHikerPastCount(b.phone || b.whatsapp || (b as any).whatsapp_number || '', b.full_name);
          break;
        default:
          valA = a.full_name.toLowerCase();
          valB = b.full_name.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [trekRosterWithGuides, tableFilter, sortCol, sortAsc, leaderboardPhoneMap]);

  const totalRows = filteredAndSortedRegistrations.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRegistrations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRegistrations.slice(start, start + pageSize);
  }, [filteredAndSortedRegistrations, currentPage]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  // Export CSV Excel
  const handleExportExcel = () => {
    if (!currentTrek) return;
    const headers = [
      'S.N.',
      'Full Name',
      'Phone',
      'Pickup Point',
      'Pax',
      'Paid (NPR)',
      'Due (NPR)',
      'Gender',
      'Age Group',
      'Suggestions',
      'Updates',
      'Medical Notes',
      'Total Hikes'
    ];

    const rows = trekRosterWithGuides.map((r, i) => [
      i + 1,
      `"${(r._guideRole === 'leader' ? `${r.full_name} (Leader)` : r._guideRole === 'assistant' ? `${r.full_name} (Asst. Leader)` : r.full_name).replace(/"/g, '""')}"`,
      `"${r.phone || '—'}"`,
      `"${r.pickup_point || '—'}"`,
      `"${String(getRegPaxDisplay(r)).replace(/"/g, '""')}"`,
      r.paid_amount || 0,
      r.due_amount || 0,
      `"${r.gender || '—'}"`,
      `"${r.age_group || '—'}"`,
      `"${(r.suggestions || '').replace(/"/g, '""')}"`,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      `"${(r.has_medical || '').replace(/"/g, '""')}"`,
      r._isSyntheticGuide ? '—' : getHikerPastCount(r.phone || '', r.full_name)
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentTrek.name}_Coordinator_Manifest.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLeaderboardCsv = () => {
    if (!currentTrek) return;

    const escapeCsv = (val: string | number | undefined | null) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    // Format Trek Name as "Name (Weekday D Mon YYYY)" when a valid date is available
    const baseName = (currentTrek.name || 'Trek').trim();
    let formattedDate = '';
    const parsedDt = parseTrekDate(currentTrek.date);
    if (parsedDt) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      formattedDate = `${dayNames[parsedDt.getDay()]} ${parsedDt.getDate()} ${monthNames[parsedDt.getMonth()]} ${parsedDt.getFullYear()}`;
    } else if (currentTrek.date && currentTrek.date.trim()) {
      formattedDate = currentTrek.date.trim();
    }

    const alreadyHasParenDate = /\(\s*[^)]*\b20\d\d\b[^)]*\)\s*$/i.test(baseName);
    const trekNameCol =
      formattedDate && !alreadyHasParenDate && !baseName.includes(formattedDate)
        ? `${baseName} (${formattedDate})`
        : baseName;

    const hikeNumberCol = getHikeNumberFromAny(currentTrek) || '';
    const rawDist =
      currentTrek.distance ||
      currentTrek.data?.overview?.approxDistance ||
      currentTrek.data?.approxDistance ||
      currentTrek.data?.distance ||
      '';
    const distMatch = String(rawDist).match(/(\d+(?:\.\d+)?)/);
    const distanceCol = distMatch ? distMatch[1] : '';

    const headers = [
      'Trek Name',
      'Full Name',
      'Phone',
      'Email Address',
      'Age group',
      'Gender',
      'Hike Number #',
      'Distance'
    ];

    const rows = trekRosterWithGuides.map((r) => {
      const phone = (r.phone || r.whatsapp || (r as any).whatsapp_number || '').trim();
      const email = (r.email || (r as any).email_address || '').trim();
      const ageGroup = (r.age_group || '').trim();
      const gender = (r.gender || '').trim();
      const rowHikeNum = hikeNumberCol || getHikeNumberFromAny(r) || '';

      return [
        escapeCsv(trekNameCol),
        escapeCsv((r.full_name || '').trim()),
        escapeCsv(phone),
        escapeCsv(email),
        escapeCsv(ageGroup),
        escapeCsv(gender),
        rowHikeNum || '',
        distanceCol || ''
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${baseName}_Leaderboard.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintManifest = () => {
    if (!currentTrek) return;

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth(); // 297
      const pageH = doc.internal.pageSize.getHeight(); // 210
      const margin = 10;
      const contentW = pageW - margin * 2; // 277

      const rows = filteredAndSortedRegistrations;
      const guideCount = rows.filter((r) => Boolean(r._guideRole)).length;
      const guestCount = rows.filter((r) => !r._guideRole).length;
      const totalPaidAmt = rows.reduce((acc, r) => acc + (r.paid_amount || 0), 0);
      const totalDueAmt = rows.reduce((acc, r) => acc + (r.due_amount || 0), 0);

      const hikeNumPrefix =
        currentTrek.hike_number && currentTrek.hike_number !== 'TBD'
          ? `Hike #${currentTrek.hike_number} — `
          : '';
      const titleText = `${hikeNumPrefix}${currentTrek.name || 'Trek Roster'}`;
      const dateText = currentTrek.date || 'Flexible Date';

      const cols = [
        { label: 'S.N.', w: 9, align: 'center' as const },
        { label: 'NAME', w: 44, align: 'left' as const },
        { label: 'PHONE', w: 24, align: 'left' as const },
        { label: 'PICKUP', w: 30, align: 'left' as const },
        { label: 'PAX', w: 12, align: 'center' as const },
        { label: 'PAID', w: 18, align: 'left' as const },
        { label: 'DUE', w: 18, align: 'left' as const },
        { label: 'AGE', w: 14, align: 'left' as const },
        { label: 'GENDER', w: 15, align: 'left' as const },
        { label: 'SUGGESTIONS', w: 29, align: 'left' as const },
        { label: 'UPDATES', w: 28, align: 'left' as const },
        { label: 'MEDICAL', w: 23, align: 'left' as const },
        { label: 'HIKES', w: 13, align: 'center' as const },
      ];

      const colXs: number[] = [];
      let accX = margin;
      for (const c of cols) {
        colXs.push(accX);
        accX += c.w;
      }

      const drawHeaderBanner = () => {
        doc.setFillColor(22, 163, 74);
        doc.rect(margin, 8, contentW, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(31, 41, 55);
        doc.text(titleText, margin, 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `${dateText}   •   ${rows.length} Listed (Guides ${guideCount}, Guests ${guestCount})   •   Collected: Rs ${totalPaidAmt.toLocaleString()}   •   Due: Rs ${totalDueAmt.toLocaleString()}`,
          margin,
          21.5
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(21, 128, 61);
        doc.text('Walk Nepal Walk — Coordinator Manifest', pageW - margin, 16, { align: 'right' });
      };

      const drawTableHeader = (yPos: number): number => {
        const thH = 7;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(229, 231, 235);
        doc.rect(margin, yPos, contentW, thH, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        cols.forEach((c, i) => {
          const x = c.align === 'center' ? colXs[i] + c.w / 2 : colXs[i] + 1.5;
          doc.text(c.label, x, yPos + 4.7, { align: c.align });
        });
        return yPos + thH;
      };

      drawHeaderBanner();
      let y = drawTableHeader(25);

      const lineH = 3.6;

      if (rows.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175);
        doc.text('No registered hikers found matching criteria', pageW / 2, y + 10, {
          align: 'center',
        });
      } else {
        rows.forEach((r, idx) => {
          const pastHikes = r._isSyntheticGuide
            ? '—'
            : String(getHikerPastCount(r.phone || r.whatsapp || (r as any).whatsapp_number || '', r.full_name));

          const roleLabel =
            r._guideRole === 'leader'
              ? ' (Leader)'
              : r._guideRole === 'assistant'
              ? ' (Asst. Leader)'
              : '';
          const nameVal = `${r.full_name || 'Participant'}${roleLabel}`;
          const phoneVal = r.phone || '—';
          const pickupVal = r.pickup_point || '—';
          const paxVal = String(getRegPaxDisplay(r));
          const paidVal = r._isSyntheticGuide
            ? '—'
            : r.paid_amount > 0
            ? `Rs ${r.paid_amount}`
            : '-';
          const dueVal = r.due_amount > 0 ? `Rs ${r.due_amount}` : '—';
          const ageVal = r.age_group || '—';
          const genderVal = r.gender || '—';
          const suggVal = r.suggestions || '—';
          const updVal = r.admin_notes || r.person_remarks || '—';
          const hasMed =
            Boolean(r.has_medical) &&
            r.has_medical!.toLowerCase() !== 'no' &&
            r.has_medical!.toLowerCase() !== 'none';
          const medVal = hasMed ? r.specify_medical || r.has_medical || 'Yes' : 'None';

          const cellTexts = [
            String(idx + 1),
            nameVal,
            phoneVal,
            pickupVal,
            paxVal,
            paidVal,
            dueVal,
            ageVal,
            genderVal,
            suggVal,
            updVal,
            medVal,
            pastHikes,
          ];

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          const wrappedCells = cellTexts.map((txt, ci) =>
            doc.splitTextToSize(String(txt), Math.max(4, cols[ci].w - 3))
          );
          const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
          const rowH = Math.max(7, maxLines * lineH + 3);

          if (y + rowH > pageH - 14) {
            doc.addPage();
            drawHeaderBanner();
            y = drawTableHeader(25);
          }

          if (r._guideRole === 'leader') {
            doc.setFillColor(255, 251, 235);
          } else if (r._guideRole === 'assistant') {
            doc.setFillColor(240, 249, 255);
          } else if (idx % 2 === 1) {
            doc.setFillColor(250, 248, 245);
          } else {
            doc.setFillColor(255, 255, 255);
          }
          doc.rect(margin, y, contentW, rowH, 'F');
          doc.setDrawColor(243, 244, 246);
          doc.line(margin, y + rowH, margin + contentW, y + rowH);

          wrappedCells.forEach((lines, ci) => {
            if (ci === 1) {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(17, 24, 39);
            } else if (ci === 8) {
              const gCat = getGenderCategory(r.gender);
              doc.setFont('helvetica', 'bold');
              if (gCat === 'female') doc.setTextColor(126, 34, 206);
              else if (gCat === 'male') doc.setTextColor(29, 78, 216);
              else doc.setTextColor(55, 65, 81);
            } else if (ci === 6 && r.due_amount > 0) {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(190, 18, 60);
            } else if (ci === 11 && hasMed) {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(225, 29, 72);
            } else if (ci === 0 || ci === 4 || ci === 12) {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(55, 65, 81);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(75, 85, 99);
            }

            const align = cols[ci].align;
            const x = align === 'center' ? colXs[ci] + cols[ci].w / 2 : colXs[ci] + 1.5;
            doc.text(lines, x, y + 4.4, { align });
          });

          y += rowH;
        });

        // Total summary row
        if (y + 8 > pageH - 12) {
          doc.addPage();
          drawHeaderBanner();
          y = drawTableHeader(25);
        }
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(229, 231, 235);
        doc.rect(margin, y, contentW, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('TOTAL', colXs[3] + cols[3].w - 2, y + 5.2, { align: 'right' });

        doc.setTextColor(31, 41, 55);
        doc.text(String(rows.length), colXs[4] + cols[4].w / 2, y + 5.2, { align: 'center' });

        doc.setTextColor(4, 120, 87);
        doc.text(`Rs ${totalPaidAmt.toLocaleString()}`, colXs[5] + 1.5, y + 5.2);

        doc.setTextColor(190, 18, 60);
        doc.text(`Rs ${totalDueAmt.toLocaleString()}`, colXs[6] + 1.5, y + 5.2);
      }

      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, pageH - 5);
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 5, { align: 'right' });
      }

      const safeFileBase = (currentTrek.name || 'Trek')
        .trim()
        .replace(/[^a-z0-9\-_ ]/gi, '')
        .replace(/\s+/g, '_');
      doc.save(`${safeFileBase || 'Trek'}_Coordinator_Manifest.pdf`);
    } catch (err) {
      console.error('Coordinator Manifest PDF generation failed:', err);
      window.print();
    }
  };

  const handleExportParticipantViewPng = () => {
    if (!currentTrek) return;

    const orderedRoster = [...trekRosterWithGuides].sort((a, b) => {
      const rank = (r: CoordinatorRow) =>
        r._guideRole === 'leader' ? 0 : r._guideRole === 'assistant' ? 1 : 2;
      return rank(a) - rank(b);
    });

    const guideCount = orderedRoster.filter((r) => Boolean(r._guideRole)).length;
    const guestCount = orderedRoster.filter((r) => !r._guideRole).length;
    const totalCount = orderedRoster.length;

    const scale = 2;
    const pad = 24;
    const width = 1000;
    const cardW = width - pad * 2;
    const headerH = 92;
    const thH = 38;
    const rowH = 40;
    const footerH = 44;
    const bodyRows = Math.max(1, orderedRoster.length);
    const height = pad * 2 + headerH + thH + bodyRows * rowH + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const fitText = (text: string, maxW: number): string => {
      const str = String(text || '');
      if (ctx.measureText(str).width <= maxW) return str;
      let cut = str;
      while (cut.length > 1 && ctx.measureText(cut + '…').width > maxW) {
        cut = cut.slice(0, -1);
      }
      return cut + '…';
    };

    // Outer background
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, width, height);

    // Main card container
    ctx.save();
    drawRoundRect(pad, pad, cardW, height - pad * 2, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#E7E5E4';
    ctx.stroke();
    ctx.clip();

    // Top green accent bar
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(pad, pad, cardW, 5);

    // Header text
    const hikeNum =
      currentTrek.hike_number && currentTrek.hike_number !== 'TBD'
        ? `Hike #${currentTrek.hike_number} — `
        : '';
    const titleText = `${hikeNum}${currentTrek.name || 'Trek Roster'}`;
    const dateText = currentTrek.date || 'Flexible Date';

    ctx.fillStyle = '#1F2937';
    ctx.font = '800 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(titleText, cardW - 180), pad + 20, pad + 34);

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(
      fitText(`${dateText}   •   ${totalCount} Participants (Guides ${guideCount}, Guests ${guestCount})`, cardW - 180),
      pad + 20,
      pad + 60
    );

    // Right brand pill in header
    const brandText = 'Walk Nepal Walk';
    ctx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const brandW = ctx.measureText(brandText).width + 20;
    drawRoundRect(pad + cardW - brandW - 20, pad + 24, brandW, 24, 12);
    ctx.fillStyle = '#ECFDF5';
    ctx.fill();
    ctx.strokeStyle = '#A7F3D0';
    ctx.stroke();
    ctx.fillStyle = '#15803D';
    ctx.textAlign = 'center';
    ctx.fillText(brandText, pad + cardW - brandW / 2 - 20, pad + 36);
    ctx.textAlign = 'left';

    // Divider under header
    const thY = pad + headerH;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(pad, thY, cardW, thH);
    ctx.strokeStyle = '#E5E7EB';
    ctx.beginPath();
    ctx.moveTo(pad, thY);
    ctx.lineTo(pad + cardW, thY);
    ctx.moveTo(pad, thY + thH);
    ctx.lineTo(pad + cardW, thY + thH);
    ctx.stroke();

    // Column geometry (S.N., NAME, GENDER, PICKUP POINT, PAX, TOTAL HIKES)
    const colSnX = pad + 28;
    const colNameX = pad + 70;
    const colGenderX = pad + 470;
    const colPickupX = pad + 528;
    const colPaxX = pad + 802;
    const colHikesX = pad + 898;

    ctx.fillStyle = '#64748B';
    ctx.font = '800 10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const thMidY = thY + thH / 2;
    ctx.textAlign = 'center';
    ctx.fillText('S.N.', colSnX, thMidY);
    ctx.textAlign = 'left';
    ctx.fillText('NAME', colNameX, thMidY);
    ctx.textAlign = 'center';
    ctx.fillText('GENDER', colGenderX, thMidY);
    ctx.textAlign = 'left';
    ctx.fillText('PICKUP POINT', colPickupX, thMidY);
    ctx.textAlign = 'center';
    ctx.fillText('PAX', colPaxX, thMidY);
    ctx.fillText('TOTAL HIKES', colHikesX, thMidY);
    ctx.textAlign = 'left';

    // Rows
    if (orderedRoster.length === 0) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No registered participants found', pad + cardW / 2, thY + thH + rowH / 2);
      ctx.textAlign = 'left';
    } else {
      orderedRoster.forEach((r, idx) => {
        const y = thY + thH + idx * rowH;
        const midY = y + rowH / 2;

        // Row background
        if (r._guideRole === 'leader') {
          ctx.fillStyle = '#FFFBEB';
        } else if (r._guideRole === 'assistant') {
          ctx.fillStyle = '#F0F9FF';
        } else {
          ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#FAF8F5';
        }
        ctx.fillRect(pad, y, cardW, rowH);

        // Row bottom border
        ctx.strokeStyle = '#F3F4F6';
        ctx.beginPath();
        ctx.moveTo(pad, y + rowH);
        ctx.lineTo(pad + cardW, y + rowH);
        ctx.stroke();

        // S.N.
        ctx.fillStyle = '#4B5563';
        ctx.font = '700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), colSnX, midY);
        ctx.textAlign = 'left';

        // NAME + optional role badge
        const badgeText =
          r._guideRole === 'leader'
            ? 'LEADER'
            : r._guideRole === 'assistant'
            ? 'ASST. LEADER'
            : '';
        let badgeSpace = 0;
        if (badgeText) {
          ctx.font = '800 9px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          badgeSpace = ctx.measureText(badgeText).width + 22;
        }

        ctx.fillStyle = '#111827';
        ctx.font = '700 12.5px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        const displayName = fitText(r.full_name || 'Participant', colGenderX - colNameX - 58 - badgeSpace);
        ctx.fillText(displayName, colNameX, midY);

        if (badgeText) {
          const nameW = ctx.measureText(displayName).width;
          ctx.font = '800 9px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          const pillW = ctx.measureText(badgeText).width + 12;
          const pillX = colNameX + nameW + 8;
          const pillY = midY - 9;
          drawRoundRect(pillX, pillY, pillW, 18, 9);
          ctx.fillStyle = r._guideRole === 'leader' ? '#FEF3C7' : '#E0F2FE';
          ctx.fill();
          ctx.strokeStyle = r._guideRole === 'leader' ? '#FCD34D' : '#7DD3FC';
          ctx.stroke();
          ctx.fillStyle = r._guideRole === 'leader' ? '#92400E' : '#075985';
          ctx.textAlign = 'center';
          ctx.fillText(badgeText, pillX + pillW / 2, midY + 0.5);
          ctx.textAlign = 'left';
        }

        // GENDER
        const gCat = getGenderCategory(r.gender);
        ctx.fillStyle =
          gCat === 'female' ? '#7E22CE' : gCat === 'male' ? '#1D4ED8' : '#4B5563';
        ctx.font = '700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fitText(r.gender || '—', 84), colGenderX, midY);
        ctx.textAlign = 'left';

        // PICKUP POINT
        ctx.fillStyle = '#4B5563';
        ctx.font = '500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText(fitText(r.pickup_point || '—', colPaxX - colPickupX - 36), colPickupX, midY);

        // PAX
        ctx.fillStyle = '#1F2937';
        ctx.font = '700 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(getRegPaxDisplay(r)), colPaxX, midY);

        // TOTAL HIKES
        const hikesVal = r._isSyntheticGuide
          ? '—'
          : String(getHikerPastCount(r.phone || r.whatsapp || (r as any).whatsapp_number || '', r.full_name));
        ctx.fillStyle = '#374151';
        ctx.fillText(hikesVal, colHikesX, midY);
        ctx.textAlign = 'left';
      });
    }

    // Footer bar
    const footerY = thY + thH + bodyRows * rowH;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(pad, footerY, cardW, footerH);
    ctx.strokeStyle = '#E5E7EB';
    ctx.beginPath();
    ctx.moveTo(pad, footerY);
    ctx.lineTo(pad + cardW, footerY);
    ctx.stroke();

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Participant Roster • Shared Event List', pad + 20, footerY + footerH / 2);

    ctx.fillStyle = '#1F2937';
    ctx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Total Participants: ${totalCount}`, pad + cardW - 20, footerY + footerH / 2);
    ctx.textAlign = 'left';

    ctx.restore();

    const safeFileBase = (currentTrek.name || 'Trek')
      .trim()
      .replace(/[^a-z0-9\-_ ]/gi, '')
      .replace(/\s+/g, '_');
    const fileName = `${safeFileBase || 'Trek'}_Participant_View.png`;

    const triggerDownload = (href: string, revokeAfter: boolean) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revokeAfter) {
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          triggerDownload(URL.createObjectURL(blob), true);
        } else {
          triggerDownload(canvas.toDataURL('image/png'), false);
        }
      }, 'image/png');
    } else {
      triggerDownload(canvas.toDataURL('image/png'), false);
    }
  };

  return (
    <div className="w-full space-y-5 font-sans text-stone-800 print:m-0 print:p-0">
      {/* ── HEADER TITLE BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F2937] tracking-tight">
            Upcoming <span className="text-[#16A34A]">Events</span>
          </h1>
          <p className="text-xs font-semibold text-[#8B8680] mt-0.5">
            Click an event to view its registered hikers
          </p>
        </div>

        {/* Top Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportLeaderboardCsv}
            title="Download CSV formatted for Leaderboard Google Sheet"
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>Leaderboard CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintManifest}
            title="Print roster or Save as PDF"
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportParticipantViewPng}
            title="Download shareable participant roster PNG (excludes phone, payments, medical & admin notes)"
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-sky-600" />
            <span>Participant View</span>
          </button>
        </div>
      </div>

      {/* ── TOP EVENT CARDS STRIP ── */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(125px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-2.5 print:hidden">
        {visibleTreksWithCounts.map(({ trek: t, regsCount: tRegsCount }) => {
          const curHikeNum = getHikeNumberFromAny(currentTrek);
          const tHikeNum = getHikeNumberFromAny(t);
          const isSelected =
            currentTrek?.id === t.id ||
            (t.hike_number && t.hike_number !== 'TBD' && currentTrek?.hike_number === t.hike_number) ||
            Boolean(curHikeNum && tHikeNum && curHikeNum === tHikeNum);

          const dt = parseTrekDate(t.date);
          const todayStartMs = new Date().setHours(0, 0, 0, 0);
          const isPast = dt !== null && dt.getTime() < todayStartMs;
          const isUpcoming = !isPast;

          const cardThemeClass = isUpcoming
            ? isSelected
              ? 'border-2 border-orange-500 bg-orange-500/25 shadow-md ring-2 ring-orange-500/25 -translate-y-0.5'
              : 'border border-orange-300/60 bg-orange-500/15 shadow-[0_4px_14px_rgba(234,88,12,0.12)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.22)] hover:bg-orange-500/20 hover:-translate-y-0.5'
            : isSelected
              ? 'border-2 border-blue-500 bg-blue-500/25 shadow-md ring-2 ring-blue-500/25 -translate-y-0.5'
              : 'border border-blue-300/60 bg-blue-500/15 shadow-[0_4px_14px_rgba(37,99,235,0.12)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.22)] hover:bg-blue-500/20 hover:-translate-y-0.5';

          return (
            <div
              key={t.id}
              onClick={() => setSelectedTrekId(t.id || t.hike_number || '')}
              className={`p-2 sm:p-2.5 rounded-xl w-full cursor-pointer transition-all flex flex-col justify-between overflow-hidden backdrop-blur-xs ${cardThemeClass}`}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between text-[9px] font-bold text-stone-500 mb-0.5">
                  <span className="truncate">{t.date || 'Flexible'}</span>
                  {t.is_cancelled && (
                    <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[7.5px] font-extrabold border border-rose-200 shrink-0 ml-1">
                      CANCELLED
                    </span>
                  )}
                </div>
                <h3 className="text-[11px] font-bold text-[#1F2937] truncate mb-1" title={t.name}>
                  {t.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[9.5px] font-bold min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-black/5 text-stone-800 font-extrabold shrink-0">
                    #{t.hike_number || tHikeNum || 'N/A'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded font-black truncate ${
                    isUpcoming ? 'bg-orange-500/20 text-orange-950' : 'bg-blue-500/20 text-blue-950'
                  }`}>
                    {tRegsCount || 0} JOINED
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Show More / Show Less Button Card for expeditions with 0 participants */}
        {zeroParticipantCount > 0 && (
          <button
            type="button"
            onClick={() => setShowZeroParticipants((prev) => !prev)}
            className="p-2 sm:p-2.5 rounded-xl w-full cursor-pointer transition-all border border-dashed border-stone-300 hover:border-amber-500 bg-stone-50/90 hover:bg-amber-50/60 text-stone-600 hover:text-amber-900 flex flex-col justify-between overflow-hidden shadow-2xs group text-left min-h-[64px]"
            title={showZeroParticipants ? "Hide expeditions with 0 participants" : `Show ${zeroParticipantCount} expeditions with 0 participants`}
          >
            <div className="flex items-center justify-between text-[9px] font-bold text-stone-400 group-hover:text-amber-700/80 mb-0.5">
              <span>{showZeroParticipants ? 'COLLAPSE' : 'EXPAND'}</span>
              {showZeroParticipants ? (
                <ChevronUp className="w-3 h-3 text-stone-400 group-hover:text-amber-700 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 text-stone-400 group-hover:text-amber-700 shrink-0" />
              )}
            </div>
            <h3 className="text-[11px] font-bold text-stone-700 group-hover:text-amber-900 truncate mb-1">
              {showZeroParticipants ? 'Show Less' : 'Show More'}
            </h3>
            <div className="flex items-center gap-1.5 text-[9.5px] font-bold min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-black/5 group-hover:bg-amber-100 text-stone-600 group-hover:text-amber-900 font-extrabold shrink-0">
                {showZeroParticipants ? 'HIDE' : `+${zeroParticipantCount}`}
              </span>
              <span className="text-[9px] text-stone-400 group-hover:text-amber-700 truncate font-medium">
                0 Joined
              </span>
            </div>
          </button>
        )}
      </div>

      {/* ── CANCELLATION NOTICE BANNER (IF EVENT CANCELLED) ── */}
      {currentTrek?.is_cancelled && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-rose-900">
                  EVENT CANCELLED IN EVENT EXECUTION
                </h3>
                <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-black rounded-md">
                  HALT DEPLOYMENT
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-0.5 font-medium">
                {currentTrek.cancellation_reason
                  ? `Reason: ${currentTrek.cancellation_reason}`
                  : 'This event has been marked as cancelled by the organizer. Do not dispatch field guides or buses.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 whitespace-nowrap">
            {trekRegistrations.length} Registrations on File
          </span>
        </div>
      )}

      {/* ── COMPACT KPI & DEMOGRAPHICS SUMMARY (SINGLE ROW, ZERO DUPLICATION) ── */}
      {!(isRestrictedGuide && upcomingTreks.length === 0) && (() => {
        const newPct = hikerCount > 0 ? Math.round((firstTimersCount / hikerCount) * 100) : 0;
        const retPct = hikerCount > 0 ? Math.round((returningCount / hikerCount) * 100) : 0;
        const guideCount = trekRosterWithGuides.filter((r) => Boolean(r._guideRole)).length;
        const guestCount =
          trekRegistrations.length > 0
            ? trekRosterWithGuides.filter((r) => !r._guideRole).length
            : Math.max(0, totalRegistered - guideCount);
        const totalDue = trekRegistrations.reduce((acc, r) => acc + (r.due_amount || 0), 0);
        const hikeNumLabel =
          currentTrek?.hike_number && currentTrek.hike_number !== 'TBD'
            ? `#${currentTrek.hike_number}`
            : '';
        const ageColors = ['bg-[#DC2626]', 'bg-[#EA580C]', 'bg-[#D97706]', 'bg-[#2563EB]'];

        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5">
            {/* Core KPIs (2 compact metrics in 1 unified card) */}
            <div className="xl:col-span-5 bg-white rounded-xl border border-stone-200 shadow-2xs grid grid-cols-2 divide-x divide-stone-100 overflow-hidden">
              {/* Registered */}
              <div className="p-3 relative">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#16A34A]" />
                <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider truncate">
                  Registered {hikeNumLabel ? `• ${hikeNumLabel}` : ''}
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#1F2937] leading-tight mt-0.5">
                  {totalRegistered}
                </div>
                <div className="text-[11px] font-medium text-stone-500 mt-0.5 truncate">
                  Guides {guideCount} • Guests {guestCount}
                </div>
              </div>

              {/* Revenue Collected & Due Total */}
              <div className="p-3 relative">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563EB]" />
                <div className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider truncate">
                  Collected
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#1F2937] leading-tight mt-0.5 truncate">
                  Rs {totalRevenue.toLocaleString()}
                </div>
                <div className={`text-[11px] font-semibold mt-0.5 truncate ${totalDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Due: Rs {totalDue.toLocaleString()}{dueCount > 0 ? ` (${dueCount})` : ''}
                </div>
              </div>
            </div>

            {/* Compact Demographics Strip (New vs Returning, Gender, Age Group) */}
            <div className="xl:col-span-7 bg-white rounded-xl border border-stone-200 shadow-2xs p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              {/* New vs Returning */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold text-[#1F2937]">New vs Returning</div>
                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${hikerCount > 0 ? (firstTimersCount / hikerCount) * 100 : 0}%` }}
                    className="bg-[#2563EB] h-full transition-all"
                  />
                  <div
                    style={{ width: `${hikerCount > 0 ? (returningCount / hikerCount) * 100 : 0}%` }}
                    className="bg-[#16A34A] h-full transition-all"
                  />
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-semibold text-stone-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-[#2563EB]" /> New {firstTimersCount} ({newPct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-[#16A34A]" /> Ret. {returningCount} ({retPct}%)
                  </span>
                </div>
              </div>

              {/* Gender Breakdown */}
              <div className="space-y-1.5 sm:border-l sm:border-stone-100 sm:pl-3">
                <div className="text-[11px] font-extrabold text-[#1F2937]">Gender</div>
                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${genderBreakdown.femalePct}%` }}
                    className="bg-purple-600 h-full transition-all"
                  />
                  <div
                    style={{ width: `${genderBreakdown.malePct}%` }}
                    className="bg-blue-600 h-full transition-all"
                  />
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-semibold flex-wrap">
                  <span className="flex items-center gap-1 text-purple-700">
                    <span className="w-2 h-2 rounded-xs bg-purple-600" /> F {genderBreakdown.female} ({genderBreakdown.femalePct}%)
                  </span>
                  <span className="flex items-center gap-1 text-blue-700">
                    <span className="w-2 h-2 rounded-xs bg-blue-600" /> M {genderBreakdown.male} ({genderBreakdown.malePct}%)
                  </span>
                </div>
              </div>

              {/* Age Group Breakdown */}
              <div className="space-y-1.5 sm:border-l sm:border-stone-100 sm:pl-3">
                <div className="text-[11px] font-extrabold text-[#1F2937]">Age Group</div>
                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden flex">
                  {ageBreakdown.map((item, idx) => (
                    <div
                      key={item.group}
                      style={{ width: `${item.pct}%` }}
                      className={`${ageColors[idx % ageColors.length]} h-full transition-all`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-600 flex-wrap">
                  {ageBreakdown.map((item, idx) => (
                    <span key={item.group} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-xs ${ageColors[idx % ageColors.length]}`} /> {item.group}: {item.count} ({item.pct}%)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {isRestrictedGuide && upcomingTreks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-2xs space-y-2">
          <Compass className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="text-base font-bold text-[#1F2937]">No Events Allotted to You</h3>
          <p className="text-xs font-medium text-stone-500 max-w-md mx-auto">
            Only events where you are allotted as the Lead Guide or Assistant Guide appear here.
          </p>
        </div>
      ) : (
        <>
      {/* ── HIKER ROSTER TABLE WRAP ── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-2.5 sm:p-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h2 className="text-sm sm:text-base font-bold text-[#1F2937]">
            {currentTrek?.hike_number && currentTrek.hike_number !== 'TBD' ? `Hike #${currentTrek.hike_number} - ` : ''}
            {currentTrek?.name || 'Event'} ({currentTrek?.date || 'Flexible'}) — {totalRegistered} hikers
          </h2>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTableFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                tableFilter === 'all'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('paid')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'paid'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('pending')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'pending'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('due')}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                tableFilter === 'due'
                  ? 'bg-emerald-50 text-[#16A34A] border border-[#16A34A]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Has Due
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-stone-200 text-[10px] font-bold uppercase text-stone-500 tracking-wider">
                <th className="py-2 px-2.5 text-center w-[40px]">S.N.</th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  NAME {sortCol === 'name' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  PHONE {sortCol === 'phone' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('pickup')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  PICKUP {sortCol === 'pickup' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('pax')}
                  className="py-2 px-2.5 text-center cursor-pointer hover:text-stone-700 select-none"
                >
                  PAX {sortCol === 'pax' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('paid')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  PAID {sortCol === 'paid' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('due')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  DUE {sortCol === 'due' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('age')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  AGE GROUP {sortCol === 'age' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th
                  onClick={() => handleSort('gender')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  GENDER {sortCol === 'gender' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th className="py-2 px-2.5 select-none">SUGGESTIONS ⇅</th>
                <th
                  onClick={() => handleSort('updates')}
                  className="py-2 px-2.5 cursor-pointer hover:text-stone-700 select-none"
                >
                  UPDATES {sortCol === 'updates' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
                <th className="py-2 px-2.5 select-none">MEDICAL ⇅</th>
                <th
                  onClick={() => handleSort('totalHikes')}
                  className="py-2 px-2.5 text-center cursor-pointer hover:text-stone-700 select-none"
                >
                  TOTAL HIKES {sortCol === 'totalHikes' ? (sortAsc ? '▲' : '▼') : '⇅'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {paginatedRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-stone-400 font-semibold text-xs">
                    No registered hikers found matching criteria
                  </td>
                </tr>
              ) : (
                paginatedRegistrations.map((r, index) => {
                  const pastHikes = r._isSyntheticGuide
                    ? null
                    : getHikerPastCount(r.phone || r.whatsapp || (r as any).whatsapp_number || '', r.full_name);

                  const sn = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        r._guideRole === 'leader'
                          ? 'bg-amber-50/40 hover:bg-amber-100/40'
                          : r._guideRole === 'assistant'
                          ? 'bg-sky-50/35 hover:bg-sky-100/35'
                          : index % 2 === 0
                          ? 'bg-white hover:bg-stone-50/80'
                          : 'bg-[#FAF8F5] hover:bg-stone-100/70'
                      }`}
                    >
                      {/* S.N. */}
                      <td className="py-2 px-2.5 text-center font-bold text-stone-600 text-xs">
                        {sn}
                      </td>

                      {/* NAME */}
                      <td className="py-2 px-2.5 font-semibold text-[#1F2937] text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveProfileHiker({
                                name: r.full_name,
                                phone: r.phone || r.whatsapp,
                                email: r.email || r.email_address || r.user_email,
                              })
                            }
                            className="hover:text-[#E08828] hover:underline cursor-pointer text-left transition-colors font-semibold"
                            title="Click to view full hiker profile, stats & lifetime records"
                          >
                            {r.full_name}
                          </button>
                          {r._guideRole === 'leader' && (
                            <span className="inline-flex items-center font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              Leader
                            </span>
                          )}
                          {r._guideRole === 'assistant' && (
                            <span className="inline-flex items-center font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
                              Asst. Leader
                            </span>
                          )}
                          {r.paxCount && Number(r.paxCount) > 1 && (
                            <span className="font-bold text-purple-800 bg-purple-100/70 border border-purple-200 px-1.5 py-0.2 rounded text-[9.5px]">
                              {r.paxCount} Pax
                            </span>
                          )}
                          {!r._isSyntheticGuide && duplicateNamePhoneKeys.has(getDuplicateNamePhoneKey(r)) && (
                            <span
                              className="inline-flex items-center gap-0.5 font-bold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.2 rounded text-[9.5px]"
                              title="Duplicate warning: same participant name and phone appears more than once in this event"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-red-600 shrink-0" />
                              <span>Duplicate</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PHONE */}
                      <td className="py-2 px-2.5 font-medium text-stone-600 text-xs">
                        {r.phone || '—'}
                      </td>

                      {/* PICKUP */}
                      <td className="py-2 px-2.5 font-medium text-stone-500 text-xs">
                        {r.pickup_point || '—'}
                      </td>

                      {/* PAX */}
                      <td className="py-2 px-2.5 text-center font-bold text-stone-700 text-xs">
                        {getRegPaxDisplay(r)}
                      </td>

                      {/* PAID */}
                      <td className="py-2 px-2.5">
                        {r._isSyntheticGuide ? (
                          <span className="text-stone-400 text-xs">—</span>
                        ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.paid_amount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold">
                              Rs {r.paid_amount}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10.5px] font-bold">
                              -
                            </span>
                          )}

                          {/* Payment Voucher Button pops next to paid amount */}
                          {r.payment_voucher_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingVoucherUrl(r.payment_voucher_url || null);
                                setViewingVoucherReg(r);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 shadow-2xs transition-all cursor-pointer active:scale-95"
                              title="View uploaded payment voucher"
                            >
                              <FileText className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                              <span>
                                Voucher
                                {r.payment_voucher_url.split(',').filter(Boolean).length > 1
                                  ? ` (${r.payment_voucher_url.split(',').filter(Boolean).length})`
                                  : ''}
                              </span>
                            </button>
                          )}
                        </div>
                        )}
                      </td>

                      {/* DUE */}
                      <td className="py-2 px-2.5">
                        {r.due_amount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10.5px] font-bold">
                            Rs {r.due_amount}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-xs">—</span>
                        )}
                      </td>

                      {/* AGE GROUP */}
                      <td className="py-2 px-2.5 font-medium text-stone-700 text-xs">
                        {r.age_group || '—'}
                      </td>

                      {/* GENDER */}
                      <td className={`py-2 px-2.5 font-semibold text-xs ${getGenderTextColorClass(r.gender)}`}>
                        {r.gender || '—'}
                      </td>

                      {/* SUGGESTIONS */}
                      <td className="py-2 px-2.5 text-stone-500 max-w-[150px] truncate text-xs" title={r.suggestions}>
                        {r.suggestions || '—'}
                      </td>

                      {/* UPDATES */}
                      <td className="py-2 px-2.5 text-stone-500 max-w-[150px] truncate text-xs" title={r.admin_notes || r.person_remarks}>
                        {r.admin_notes || r.person_remarks || '—'}
                      </td>

                      {/* MEDICAL */}
                      <td className="py-2 px-2.5 font-medium text-xs">
                        {r.has_medical && r.has_medical.toLowerCase() !== 'no' && r.has_medical.toLowerCase() !== 'none' ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{r.specify_medical || r.has_medical}</span>
                          </span>
                        ) : (
                          <span className="text-stone-400 font-medium">None</span>
                        )}
                      </td>

                      {/* TOTAL HIKES */}
                      <td className="py-2 px-2.5 text-center font-bold text-stone-700 text-xs">
                        {pastHikes === null ? '—' : pastHikes}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-[#F8FAFC] border-t-2 border-stone-200 font-bold text-stone-800">
              <tr>
                <td colSpan={4} className="py-2.5 px-2.5 text-right uppercase text-[9px] tracking-wider text-stone-500">
                  Total
                </td>
                <td className="py-2.5 px-2.5 text-center text-stone-800 font-black text-xs">
                  {filteredAndSortedRegistrations.length}
                </td>
                <td className="py-2.5 px-2.5 text-emerald-700 font-black text-xs">
                  Rs {filteredAndSortedRegistrations.reduce((acc, r) => acc + (r.paid_amount || 0), 0).toLocaleString()}
                </td>
                <td className="py-2.5 px-2.5 text-rose-700 font-black text-xs">
                  Rs {filteredAndSortedRegistrations.reduce((acc, r) => acc + (r.due_amount || 0), 0).toLocaleString()}
                </td>
                <td colSpan={6} className="py-2.5 px-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-4 bg-[#F8FAFC] border-t border-stone-200 flex items-center justify-between text-xs font-semibold text-stone-500">
          <div>
            Showing {totalRows > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                type="button"
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  currentPage === i + 1
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Lightbox Modal for Admin/Coordinator Viewing Payment Voucher */}
      {viewingVoucherUrl && (
        <div
          className="fixed inset-0 z-[2200] bg-black/90 p-4 flex flex-col items-center justify-center animate-in fade-in"
          onClick={() => {
            setViewingVoucherUrl(null);
            setViewingVoucherReg(null);
          }}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] bg-stone-900 rounded-2xl overflow-hidden flex flex-col p-4 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white font-bold text-sm">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Payment Voucher — {viewingVoucherReg?.full_name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewingVoucherUrl(null);
                  setViewingVoucherReg(null);
                }}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewingVoucherReg && (
              <div className="p-3 bg-stone-800/80 my-2 rounded-xl text-xs space-y-1 text-stone-200">
                <div className="flex justify-between font-bold">
                  <span>Hike: #{viewingVoucherReg.hike_number || '?'} - {viewingVoucherReg.trek_name || 'Trek'}</span>
                  <span className="text-amber-400">Date: {viewingVoucherReg.trek_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-400">
                  <span>Phone: {viewingVoucherReg.phone} ({viewingVoucherReg.email})</span>
                  <span>
                    Submitted:{' '}
                    {viewingVoucherReg.payment_voucher_submitted_at
                      ? new Date(viewingVoucherReg.payment_voucher_submitted_at).toLocaleString()
                      : 'Recently'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto flex flex-col items-center gap-4 p-2 bg-black/40 rounded-xl">
              {viewingVoucherUrl
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean)
                .map((url, idx, arr) => (
                  <div key={idx} className="w-full flex flex-col items-center gap-1.5">
                    {arr.length > 1 && (
                      <div className="flex items-center justify-between w-full px-2 text-[11px] font-bold text-amber-400">
                        <span>Receipt #{idx + 1}</span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-stone-300 hover:text-white underline"
                        >
                          Open Full Size ↗
                        </a>
                      </div>
                    )}
                    <img
                      src={url}
                      alt={`Payment Voucher Receipt ${idx + 1}`}
                      className="max-w-full max-h-[55vh] object-contain rounded-lg"
                    />
                  </div>
                ))}
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 text-xs">
              <a
                href={viewingVoucherUrl.split(',')[0]?.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold transition-all"
              >
                Open Full Size ↗
              </a>
              <button
                type="button"
                onClick={() => {
                  setViewingVoucherUrl(null);
                  setViewingVoucherReg(null);
                }}
                className="px-4 py-1.5 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Hiker Profile Intelligence Modal */}
      {activeProfileHiker && (
        <AdminHikerProfileModal
          isOpen={Boolean(activeProfileHiker)}
          onClose={() => setActiveProfileHiker(null)}
          hikerName={activeProfileHiker.name}
          hikerPhone={activeProfileHiker.phone}
          hikerEmail={activeProfileHiker.email}
          allRegistrations={rawRegistrations}
          treks={treks}
          onViewVoucher={(url, reg) => {
            setViewingVoucherUrl(url);
            setViewingVoucherReg(reg);
          }}
        />
      )}
    </div>
  );
};
