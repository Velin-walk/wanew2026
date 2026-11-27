import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Trophy,
  Calendar,
  HeartPulse,
  MapPin,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  Activity,
  Star,
  Camera,
  FileText,
  Compass,
  Bookmark,
  Navigation,
  Users,
  CheckCircle2,
  Link2,
  Utensils,
  StickyNote,
  Lock,
} from 'lucide-react';
import { AdminRegistration } from './BookingsManager';
import { Trek } from '../../types';
import { HikerStats, HikerCompletedEvent } from '../../types/leaderboard';
import { apiFetch, fetchLeaderboardData } from '../../services/api';
import { cleanPhoneDigits, matchesPhone } from '../../utils/matchingUtils';
import { getGenderTextColorClass } from '../../adminUtils';

/**
 * Match a hiker/guide name to their Leaderboard record without loose substring collisions
 */
function findLeaderboardGuide(guideName: string, hikers: HikerStats[]): HikerStats | null {
  if (!guideName || !hikers || hikers.length === 0) return null;

  const clean = guideName.trim().toLowerCase().replace(/\s+/g, ' ');
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return null;

  // 1. Exact normalized match
  const exact = hikers.find((h) => (h.n || '').toLowerCase().trim().replace(/\s+/g, ' ') === clean);
  if (exact) return exact;

  // 2. Both first and last name match or phonetics (e.g. "biraj thing" <-> "biraj theeng")
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];

    const match = hikers.find((h) => {
      const hn = (h.n || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const hParts = hn.split(' ').filter(Boolean);
      if (hParts.length < 2) return false;
      const hFirst = hParts[0];
      const hLast = hParts[hParts.length - 1];

      if (hFirst !== first) return false;
      if (hLast === last) return true;
      if (last.startsWith('th') && hLast.startsWith('th')) return true;
      return hLast.length >= 4 && last.length >= 4 && (hLast.includes(last) || last.includes(hLast));
    });

    if (match) return match;
  }

  // 3. Single name match ONLY for distinct >= 3-char first-word boundaries (e.g. "Salina")
  if (parts.length === 1 && parts[0].length >= 3) {
    const first = parts[0];
    const candidates = hikers.filter((h) => {
      const hn = (h.n || '').toLowerCase().trim();
      return hn === first || hn.startsWith(first + ' ');
    });
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length > 1) {
      candidates.sort((a, b) => (b.d || 0) - (a.d || 0));
      return candidates[0];
    }
  }

  return null;
}

interface UserIdentityData {
  id: string;
  display_name: string | null;
  created_at: string | null;
  profile: {
    gender?: string;
    age_group?: string;
    emergency_contact?: string;
    emergency_backup_contact?: string;
    whatsapp_number?: string;
    profession?: string;
    fitness?: string;
    preferences?: string;
    trekking_experience?: string;
    dietary?: string;
  };
  contacts: Array<{ type: 'uid' | 'email' | 'phone' | string; value: string }>;
}

interface AdminHikerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  hikerName: string;
  hikerPhone?: string;
  hikerEmail?: string;
  allRegistrations: AdminRegistration[];
  treks?: Trek[];
  onViewVoucher?: (voucherUrl: string, reg: AdminRegistration) => void;
}

const isPhoneMatch = matchesPhone;

const isEmptyOrNo = (val?: string | null) => {
  const s = (val || '').trim().toLowerCase();
  return !s || s === 'no' || s === 'none' || s === 'n/a' || s === 'na' || s === '-' || s === 'nil';
};

const formatDurationSec = (secs?: number) => {
  const s = Number(secs) || 0;
  if (s <= 0) return '—';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const formatDateShort = (raw?: string | number | null) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const AdminHikerProfileModal: React.FC<AdminHikerProfileModalProps> = ({
  isOpen,
  onClose,
  hikerName,
  hikerPhone,
  hikerEmail,
  allRegistrations,
  onViewVoucher,
}) => {
  const [leaderboardData, setLeaderboardData] = useState<HikerStats[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'leaderboard' | 'history' | 'medical' | 'community' | 'mapminers'
  >('leaderboard');

  // Additional D1 sources (excluding user_behavior_events)
  const [userIdentity, setUserIdentity] = useState<UserIdentityData | null>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [trekPhotos, setTrekPhotos] = useState<any[]>([]);
  const [photoComments, setPhotoComments] = useState<any[]>([]);
  const [blogsList, setBlogsList] = useState<any[]>([]);
  const [communityTrails, setCommunityTrails] = useState<any[]>([]);
  const [trailComments, setTrailComments] = useState<any[]>([]);
  const [userActivities, setUserActivities] = useState<any[]>([]);
  const [savedTrailIds, setSavedTrailIds] = useState<string[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const normTargetEmail = (hikerEmail || '').toLowerCase().trim();
  const normTargetName = (hikerName || '').toLowerCase().trim();

  // Fetch leaderboard data on open (Primary Source of Truth - matching public trek card)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingLeaderboard(true);
    fetchLeaderboardData(false)
      .then((data: any) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.hikers)) {
          setLeaderboardData(data.hikers);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch leaderboard data for admin hiker profile:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingLeaderboard(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Match all registrations across the platform
  const hikerRegistrations = useMemo(() => {
    if (!normTargetName && !hikerPhone && !normTargetEmail) return [];
    const targetCleanName = normTargetName.replace(/\s+/g, ' ');
    const targetPhoneDigits = cleanPhoneDigits(hikerPhone);

    return allRegistrations
      .filter((reg) => {
        const regPhones = [reg.phone, reg.whatsapp, reg.whatsapp_number].filter(Boolean);
        const regEmail = (reg.email || reg.email_address || reg.user_email || '').toLowerCase().trim();
        const regName = (reg.full_name || '').toLowerCase().trim().replace(/\s+/g, ' ');

        if (hikerPhone && regPhones.some((rp) => isPhoneMatch(hikerPhone, rp))) return true;
        if (normTargetEmail && regEmail && normTargetEmail === regEmail) return true;

        // Strict exact normalized full-name fallback, guarded against conflicting phones/emails
        if (targetCleanName && regName && targetCleanName === regName) {
          const hasConflictingPhone =
            targetPhoneDigits.length >= 7 &&
            regPhones.some((rp) => cleanPhoneDigits(rp).length >= 7) &&
            !regPhones.some((rp) => isPhoneMatch(hikerPhone, rp));
          const hasConflictingEmail =
            normTargetEmail && regEmail && normTargetEmail !== regEmail;
          if (!hasConflictingPhone && !hasConflictingEmail) {
            return true;
          }
        }

        // Check team members (phone or exact full name match)
        if (Array.isArray(reg.team_members)) {
          return reg.team_members.some((m) => {
            const mName = (m.full_name || '').toLowerCase().trim().replace(/\s+/g, ' ');
            const mPhone = (m as any).phone;
            return (
              (mPhone && isPhoneMatch(hikerPhone, mPhone)) ||
              (targetCleanName && mName && mName === targetCleanName)
            );
          });
        }

        return false;
      })
      .sort((a, b) => {
        const da = new Date(a.created_at || a.trek_date || 0).getTime();
        const db = new Date(b.created_at || b.trek_date || 0).getTime();
        return db - da;
      });
  }, [allRegistrations, hikerName, hikerPhone, normTargetName, normTargetEmail]);

  // Extract primary contact details
  const primaryPhone =
    hikerPhone ||
    hikerRegistrations.find((r) => r.phone)?.phone ||
    hikerRegistrations.find((r) => r.whatsapp || r.whatsapp_number)?.whatsapp ||
    hikerRegistrations.find((r) => r.whatsapp_number)?.whatsapp_number ||
    '';
  const primaryEmail =
    hikerEmail ||
    hikerRegistrations.find((r) => r.email || r.email_address || r.user_email)?.email ||
    hikerRegistrations.find((r) => r.email_address)?.email_address ||
    hikerRegistrations.find((r) => r.user_email)?.user_email ||
    '';
  const registrationUserId = hikerRegistrations.find((r) => r.user_id)?.user_id || '';

  // Fetch unified identity + D1 community & MapMiners data on open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadingExtra(true);

    const identityParams = new URLSearchParams();
    if (registrationUserId) identityParams.set('user_id', registrationUserId);
    if (primaryEmail) identityParams.set('email', primaryEmail.trim().toLowerCase());
    if (primaryPhone) identityParams.set('phone', primaryPhone.trim());

    const safeJson = async (promise: Promise<Response>) => {
      try {
        const res = await promise;
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const loadAll = async () => {
      const [
        identityJson,
        feedbackJson,
        photosJson,
        photoCommentsJson,
        blogsJson,
        trailsJson,
        trailCommentsJson,
      ] = await Promise.all([
        identityParams.toString()
          ? safeJson(apiFetch(`admin/user-identity?${identityParams.toString()}`))
          : Promise.resolve(null),
        safeJson(apiFetch('feedback')),
        safeJson(apiFetch('trek_photos')),
        safeJson(apiFetch('photo_comments')),
        safeJson(apiFetch('blogs')),
        safeJson(apiFetch('mapminers/trails')),
        safeJson(apiFetch('mapminers/comments')),
      ]);

      if (!isMounted) return;

      const resolvedIdentity: UserIdentityData | null = identityJson?.data || null;
      setUserIdentity(resolvedIdentity);
      setFeedbackList(
        Array.isArray(feedbackJson) ? feedbackJson : Array.isArray(feedbackJson?.data) ? feedbackJson.data : []
      );
      setTrekPhotos(Array.isArray(photosJson?.data) ? photosJson.data : []);
      setPhotoComments(Array.isArray(photoCommentsJson?.data) ? photoCommentsJson.data : []);
      setBlogsList(Array.isArray(blogsJson?.data) ? blogsJson.data : []);
      setCommunityTrails(Array.isArray(trailsJson?.data) ? trailsJson.data : []);
      setTrailComments(Array.isArray(trailCommentsJson?.comments) ? trailCommentsJson.comments : []);

      // Gather all emails and UIDs for targeted MapMiners user_activities & saved_trails queries
      const emailSet = new Set<string>();
      const uidSet = new Set<string>();
      if (primaryEmail) emailSet.add(primaryEmail.trim().toLowerCase());
      hikerRegistrations.forEach((r) => {
        const e = (r.email || r.email_address || r.user_email || '').trim().toLowerCase();
        if (e) emailSet.add(e);
        if (r.user_id) uidSet.add(String(r.user_id).trim());
      });
      if (resolvedIdentity) {
        if (resolvedIdentity.id) uidSet.add(resolvedIdentity.id);
        for (const c of resolvedIdentity.contacts || []) {
          if (c.type === 'email' && c.value) emailSet.add(c.value.trim().toLowerCase());
          if (c.type === 'uid' && c.value) uidSet.add(c.value.trim());
        }
      }

      const activityQueries: Promise<any>[] = [];
      for (const e of emailSet) {
        activityQueries.push(safeJson(apiFetch(`mapminers/activities?user_email=${encodeURIComponent(e)}`)));
      }
      for (const u of uidSet) {
        activityQueries.push(safeJson(apiFetch(`mapminers/activities?user_id=${encodeURIComponent(u)}`)));
      }
      const savedQueries = Array.from(emailSet).map((e) =>
        safeJson(apiFetch(`mapminers/saved?email=${encodeURIComponent(e)}`))
      );

      const [actResults, savedResults] = await Promise.all([
        Promise.all(activityQueries),
        Promise.all(savedQueries),
      ]);

      if (!isMounted) return;

      const mergedActivities = new Map<string, any>();
      for (const res of actResults) {
        if (Array.isArray(res?.activities)) {
          for (const a of res.activities) {
            const key = String(a.id || `${a.trail_id}_${a.start_time}_${a.created_at}`);
            if (!mergedActivities.has(key)) mergedActivities.set(key, a);
          }
        }
      }
      setUserActivities(
        Array.from(mergedActivities.values()).sort(
          (a, b) => new Date(b.created_at || b.start_time || 0).getTime() - new Date(a.created_at || a.start_time || 0).getTime()
        )
      );

      const mergedSaved = new Set<string>();
      for (const res of savedResults) {
        if (Array.isArray(res?.trailIds)) {
          res.trailIds.forEach((tid: string) => tid && mergedSaved.add(String(tid)));
        }
      }
      setSavedTrailIds(Array.from(mergedSaved));
      setLoadingExtra(false);
    };

    loadAll().catch(() => {
      if (isMounted) setLoadingExtra(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, primaryEmail, primaryPhone, registrationUserId, hikerRegistrations]);

  // Admin internal notes pulled directly from bookings_roster (deduplicated)
  const adminInternalNotes = useMemo(() => {
    const items: Array<{ hikeLabel: string; date: string; note: string }> = [];
    const seen = new Set<string>();
    hikerRegistrations.forEach((r) => {
      const note = (r.admin_notes || '').trim();
      if (!note) return;
      const hikeLabel = `Hike #${r.hike_number || 'TBD'} • ${r.trek_name || 'Trek'}`;
      const key = `${hikeLabel.toLowerCase()}::${note.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        hikeLabel,
        date: r.trek_date || (r.created_at ? formatDateShort(r.created_at) : ''),
        note,
      });
    });
    return items;
  }, [hikerRegistrations]);

  // Known identifiers (emails, phones, UIDs, names) for accurate non-duplicating matching
  const knownEmails = useMemo(() => {
    const s = new Set<string>();
    if (primaryEmail) s.add(primaryEmail.trim().toLowerCase());
    hikerRegistrations.forEach((r) => {
      const e = (r.email || r.email_address || r.user_email || '').trim().toLowerCase();
      if (e) s.add(e);
    });
    (userIdentity?.contacts || []).forEach((c) => {
      if (c.type === 'email' && c.value) s.add(c.value.trim().toLowerCase());
    });
    return s;
  }, [primaryEmail, hikerRegistrations, userIdentity]);

  const knownUids = useMemo(() => {
    const s = new Set<string>();
    if (registrationUserId) s.add(registrationUserId);
    if (userIdentity?.id) s.add(userIdentity.id);
    (userIdentity?.contacts || []).forEach((c) => {
      if (c.type === 'uid' && c.value) s.add(c.value.trim());
    });
    return s;
  }, [registrationUserId, userIdentity]);

  const knownNames = useMemo(() => {
    const s = new Set<string>();
    if (normTargetName) s.add(normTargetName);
    if (userIdentity?.display_name) s.add(userIdentity.display_name.trim().toLowerCase());
    hikerRegistrations.forEach((r) => {
      const n = (r.full_name || '').trim().toLowerCase();
      if (n) s.add(n);
    });
    return s;
  }, [normTargetName, userIdentity, hikerRegistrations]);

  // Extra linked contacts (excluding primaryEmail & primaryPhone to avoid duplication)
  const additionalContacts = useMemo(() => {
    const extra: Array<{ label: string; value: string; type: string }> = [];
    const seen = new Set<string>();

    const primaryEmailNorm = primaryEmail.trim().toLowerCase();
    const waCandidate =
      userIdentity?.profile?.whatsapp_number ||
      hikerRegistrations.find((r) => r.whatsapp_number)?.whatsapp_number ||
      hikerRegistrations.find((r) => r.whatsapp)?.whatsapp ||
      '';

    if (waCandidate && !isPhoneMatch(waCandidate, primaryPhone)) {
      seen.add(`phone:${cleanPhoneDigits(waCandidate)}`);
      extra.push({ label: 'WhatsApp', value: waCandidate, type: 'phone' });
    }

    for (const c of userIdentity?.contacts || []) {
      if (!c.value) continue;
      if (c.type === 'email') {
        const norm = c.value.trim().toLowerCase();
        if (norm === primaryEmailNorm || seen.has(`email:${norm}`)) continue;
        seen.add(`email:${norm}`);
        extra.push({ label: 'Linked Email', value: c.value, type: 'email' });
      } else if (c.type === 'phone') {
        const digits = cleanPhoneDigits(c.value);
        if (isPhoneMatch(c.value, primaryPhone) || seen.has(`phone:${digits}`)) continue;
        seen.add(`phone:${digits}`);
        extra.push({ label: 'Linked Phone', value: c.value, type: 'phone' });
      } else if (c.type === 'uid') {
        if (seen.has(`uid:${c.value}`)) continue;
        seen.add(`uid:${c.value}`);
        extra.push({ label: 'Firebase UID', value: c.value, type: 'uid' });
      }
    }

    return extra;
  }, [userIdentity, primaryEmail, primaryPhone, hikerRegistrations]);

  // Merged, deduplicated Emergency Contacts
  const emergencyContacts = useMemo(() => {
    const result: string[] = [];
    const seenDigits = new Set<string>();
    const addCandidate = (raw?: string) => {
      const val = (raw || '').trim();
      if (isEmptyOrNo(val)) return;
      const digits = cleanPhoneDigits(val);
      const key = digits.length >= 7 ? digits.slice(-9) : val.toLowerCase();
      if (seenDigits.has(key)) return;
      seenDigits.add(key);
      result.push(val);
    };
    addCandidate(userIdentity?.profile?.emergency_contact);
    addCandidate(userIdentity?.profile?.emergency_backup_contact);
    hikerRegistrations.forEach((r) => {
      addCandidate(r.emergency_contact);
      addCandidate(r.emergency_backup_contact);
    });
    return result;
  }, [userIdentity, hikerRegistrations]);

  // Merged, deduplicated Medical History (fixes D1 medical_condition column mismatch)
  const medicalDetails = useMemo(() => {
    const items: Array<{ hikeLabel: string; detail: string }> = [];
    const seen = new Set<string>();

    hikerRegistrations.forEach((r) => {
      const cond = (r.medical_condition || '').trim();
      const hasMed = (r.has_medical || '').trim();
      const spec = (r.specify_medical || '').trim();

      let detail = '';
      if (!isEmptyOrNo(spec)) {
        detail = spec;
      } else if (!isEmptyOrNo(cond) && cond.toLowerCase() !== 'yes') {
        detail = cond;
      } else if (!isEmptyOrNo(hasMed) && hasMed.toLowerCase() !== 'yes') {
        detail = hasMed;
      } else if (hasMed.toLowerCase() === 'yes' || cond.toLowerCase() === 'yes') {
        detail = 'Medical condition flagged on registration form.';
      }

      if (!detail) return;
      const hikeLabel = `Hike #${r.hike_number || 'TBD'} (${r.trek_name || 'Trek'})`;
      const dedupeKey = `${hikeLabel}::${detail.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      items.push({ hikeLabel, detail });
    });

    return items;
  }, [hikerRegistrations]);

  // Merged, deduplicated Profile & Background attributes
  const profileAttributes = useMemo(() => {
    const prof = userIdentity?.profile || {};
    const profession =
      (prof.profession || '').trim() ||
      (hikerRegistrations.find((r) => r.profession && !isEmptyOrNo(r.profession))?.profession || '').trim();
    const fitness =
      (prof.fitness || '').trim() ||
      (hikerRegistrations.find((r) => r.fitness && !isEmptyOrNo(r.fitness))?.fitness || '').trim();

    const expValues: string[] = [];
    const seenExp = new Set<string>();
    const addExp = (v?: string) => {
      const s = (v || '').trim();
      if (isEmptyOrNo(s)) return;
      const k = s.toLowerCase();
      if (seenExp.has(k)) return;
      seenExp.add(k);
      expValues.push(s);
    };
    addExp(prof.trekking_experience);
    hikerRegistrations.forEach((r) => addExp(r.recent_hikes));

    const dietary = (prof.dietary || '').trim();
    const preferences = (prof.preferences || '').trim();

    return {
      profession,
      fitness,
      experience: expValues.join(' • '),
      dietary,
      preferences,
    };
  }, [userIdentity, hikerRegistrations]);

  // Match hiker with Leaderboard stats using shared phone & strict name fallback
  const matchedHiker: HikerStats | null = useMemo(() => {
    if (!leaderboardData.length) return null;

    const targetPh = hikerPhone || primaryPhone;
    if (cleanPhoneDigits(targetPh).length >= 7) {
      const byPhone = leaderboardData.find((h) => matchesPhone(h.phone || h.p, targetPh));
      if (byPhone) return byPhone;
    }

    return findLeaderboardGuide(hikerName, leaderboardData);
  }, [leaderboardData, hikerPhone, primaryPhone, hikerName]);

  const leaderboardRank = useMemo(() => {
    if (!matchedHiker || !leaderboardData.length) return 0;
    const idx = leaderboardData.indexOf(matchedHiker);
    return idx >= 0 ? idx + 1 : 0;
  }, [matchedHiker, leaderboardData]);

  const leaderboardMatch = matchedHiker ? { stats: matchedHiker, rank: leaderboardRank } : null;

  // Completed hikes directly from master leaderboard
  const completedHikes: HikerCompletedEvent[] = useMemo(() => {
    if (!matchedHiker || !Array.isArray(matchedHiker.hikes)) return [];
    return [...matchedHiker.hikes].sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  }, [matchedHiker]);

  // Filtered Community items for this user
  const userFeedback = useMemo(() => {
    return feedbackList.filter((f) => {
      const em = (f.email_address || '').trim().toLowerCase();
      const uid = (f.uid || '').trim();
      const nm = (f.full_name || '').trim().toLowerCase();
      return (em && knownEmails.has(em)) || (uid && knownUids.has(uid)) || (nm && knownNames.has(nm));
    });
  }, [feedbackList, knownEmails, knownUids, knownNames]);

  const userPhotos = useMemo(() => {
    return trekPhotos.filter((p) => {
      const uid = (p.user_uid || '').trim();
      const by = (p.uploaded_by || '').trim().toLowerCase();
      return (uid && knownUids.has(uid)) || (by && (knownEmails.has(by) || knownNames.has(by)));
    });
  }, [trekPhotos, knownUids, knownEmails, knownNames]);

  const userPhotoComments = useMemo(() => {
    return photoComments.filter((c) => {
      const uid = (c.user_uid || '').trim();
      const nm = (c.user_name || '').trim().toLowerCase();
      return (uid && knownUids.has(uid)) || (nm && knownNames.has(nm));
    });
  }, [photoComments, knownUids, knownNames]);

  const userBlogs = useMemo(() => {
    return blogsList.filter((b) => {
      const em = (b.author_email || '').trim().toLowerCase();
      const nm = (b.author_name || '').trim().toLowerCase();
      return (em && knownEmails.has(em)) || (nm && knownNames.has(nm));
    });
  }, [blogsList, knownEmails, knownNames]);

  const communityCount =
    userFeedback.length + userPhotos.length + userPhotoComments.length + userBlogs.length;

  // Filtered MapMiners items for this user
  const trailsById = useMemo(() => {
    const map = new Map<string, any>();
    communityTrails.forEach((t) => {
      if (t.id) map.set(String(t.id), t);
    });
    return map;
  }, [communityTrails]);

  const userContributedTrails = useMemo(() => {
    return communityTrails.filter((t) => {
      const em = (t.contributor_email || t.contributorEmail || '').trim().toLowerCase();
      const nm = (t.contributor_name || '').trim().toLowerCase();
      return (em && knownEmails.has(em)) || (nm && knownNames.has(nm));
    });
  }, [communityTrails, knownEmails, knownNames]);

  const userTrailComments = useMemo(() => {
    return trailComments.filter((c) => {
      const em = (c.authorEmail || c.author_email || '').trim().toLowerCase();
      const nm = (c.authorName || c.author_name || '').trim().toLowerCase();
      return (em && knownEmails.has(em)) || (nm && knownNames.has(nm));
    });
  }, [trailComments, knownEmails, knownNames]);

  const mapMinersCount =
    userActivities.length + userContributedTrails.length + userTrailComments.length + savedTrailIds.length;

  // Extract Gender and Age Range (merged without duplication)
  const primaryGender =
    hikerRegistrations.find((r) => r.gender)?.gender || userIdentity?.profile?.gender || '';
  const primaryAgeGroup =
    hikerRegistrations.find((r) => r.age_group)?.age_group || userIdentity?.profile?.age_group || '';
  const genderAgeLabel =
    primaryGender && primaryAgeGroup
      ? `${primaryGender} (${primaryAgeGroup})`
      : primaryGender
      ? primaryGender
      : primaryAgeGroup
      ? `Age ${primaryAgeGroup}`
      : '';

  // Compute financial & attendance summary from website registrations
  const totalBookings = hikerRegistrations.length;
  const confirmedBookings = hikerRegistrations.filter(
    (r) => (r.status || 'Confirmed') === 'Confirmed'
  ).length;
  const totalPaid = hikerRegistrations.reduce((acc, r) => acc + (Number(r.paid_amount) || 0), 0);
  const totalDue = hikerRegistrations.reduce((acc, r) => acc + (Number(r.due_amount) || 0), 0);

  const totalDistance = matchedHiker?.d ? Math.round(matchedHiker.d * 10) / 10 : 0;
  const totalEvents = matchedHiker?.c || completedHikes.length || 0;
  const masterHikesCount = totalEvents || confirmedBookings;
  const masterDistanceKm = totalDistance;
  const totalHikesCount = masterHikesCount;

  const getHikerTier = (count: number) => {
    if (count >= 20)
      return { label: 'Himalayan Summit Legend', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    if (count >= 10)
      return { label: 'Alpine Master', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (count >= 5)
      return { label: 'Mountain Explorer', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (count >= 2)
      return { label: 'Trail Enthusiast', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    return { label: 'Trail Pioneer', color: 'bg-stone-100 text-stone-700 border-stone-300' };
  };

  const tier = getHikerTier(totalHikesCount);

  const showAccountName =
    userIdentity?.display_name &&
    userIdentity.display_name.trim().toLowerCase() !== normTargetName;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#FAF8F5] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-[#E5E1DB] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-white border-b border-[#F0EBE5] p-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF9F2] border border-[#FFE7CC] flex items-center justify-center text-[#E08828] text-xl font-black shadow-2xs shrink-0">
              {hikerName ? hikerName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-[#1F1F1F] tracking-tight truncate">
                  {hikerName}
                </h2>
                {showAccountName && (
                  <span className="text-[11px] font-semibold text-[#8B8680]">
                    ({userIdentity?.display_name})
                  </span>
                )}
                {genderAgeLabel && (
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#EFEAE4] border border-[#D5D0C9] whitespace-nowrap shadow-3xs ${getGenderTextColorClass(
                      primaryGender,
                      'text-[#4A4541]'
                    )}`}
                  >
                    {genderAgeLabel}
                  </span>
                )}
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${tier.color}`}
                >
                  {tier.label}
                </span>
                {leaderboardMatch && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-[#E08828] border border-amber-200 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500 fill-amber-100" />
                    <span>Rank #{leaderboardMatch.rank}</span>
                  </span>
                )}
              </div>

              {/* Direct Quick Contact Links */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A5551]">
                {primaryPhone && (
                  <a
                    href={`tel:${primaryPhone}`}
                    className="flex items-center gap-1 hover:text-[#E08828] font-semibold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#8B8680]" />
                    <span>{primaryPhone}</span>
                  </a>
                )}

                {primaryPhone && (
                  <a
                    href={`https://wa.me/${primaryPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {primaryEmail && (
                  <a
                    href={`mailto:${primaryEmail}`}
                    className="flex items-center gap-1 hover:text-[#E08828] font-semibold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#8B8680]" />
                    <span>{primaryEmail}</span>
                  </a>
                )}
              </div>

              {/* Unified Account Metadata & Additional Linked Contacts (never duplicates primary) */}
              {(userIdentity?.created_at || additionalContacts.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {userIdentity?.created_at && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                      Joined {formatDateShort(userIdentity.created_at)}
                    </span>
                  )}
                  {additionalContacts.map((c, idx) => (
                    <span
                      key={idx}
                      title={`${c.label}: ${c.value}`}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 flex items-center gap-1 max-w-[200px] truncate"
                    >
                      <Link2 className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                      <span className="truncate">
                        {c.label}: {c.type === 'uid' ? `${c.value.slice(0, 10)}…` : c.value}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8B8680] hover:text-[#1F1F1F] hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="bg-white border-b border-[#F0EBE5] px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Master Hikes</div>
            <div className="text-base font-black text-[#1F1F1F] mt-0.5">{masterHikesCount}</div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Master Distance</div>
            <div className="text-base font-black text-[#E08828] mt-0.5">
              {masterDistanceKm ? `${masterDistanceKm} km` : '—'}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">App Bookings</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">{totalBookings}</div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Total Paid</div>
            <div className="text-base font-black text-[#1F1F1F] mt-0.5">
              NPR {totalPaid.toLocaleString()}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-[#8B8680] uppercase tracking-wider">Balance Due</div>
            <div
              className={`text-base font-black mt-0.5 ${
                totalDue > 0 ? 'text-amber-700 font-black' : 'text-stone-500'
              }`}
            >
              NPR {totalDue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white px-5 pt-3 border-b border-[#F0EBE5] flex items-center gap-4 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#E08828]" />
            <span>
              Leaderboard {leaderboardMatch ? `(${leaderboardMatch.stats.c || 0})` : ''}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            Bookings ({hikerRegistrations.length})
          </button>

          <button
            onClick={() => setActiveTab('medical')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'medical'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            <span>Profile &amp; Safety</span>
            {medicalDetails.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('community')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'community'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Reviews &amp; Community ({communityCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('mapminers')}
            className={`pb-3 text-xs font-black tracking-tight border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'mapminers'
                ? 'border-[#E08828] text-[#E08828]'
                : 'border-transparent text-[#8B8680] hover:text-[#1F1F1F]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>MapMiners &amp; GPS ({mapMinersCount})</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'history' && (
            <div className="space-y-3">
              {hikerRegistrations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">
                    No active bookings found for this hiker
                  </p>
                </div>
              ) : (
                hikerRegistrations.map((reg, idx) => {
                  const isPrivate =
                    reg.hike_number === 'PRIVATE' ||
                    reg.trek_name?.toLowerCase().includes('private');
                  const isCancelled = (reg.status || '').toLowerCase().includes('cancelled');
                  const guideMode = reg.guide_preference || reg.guide_mode;
                  const transportMode = reg.transport_preference || reg.transport_mode;
                  const showSuggestions =
                    reg.suggestions &&
                    reg.suggestions.trim() &&
                    reg.suggestions.trim() !== (reg.person_remarks || '').trim();

                  return (
                    <div
                      key={reg.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCancelled
                          ? 'bg-rose-50/25 border-rose-200'
                          : isPrivate
                          ? 'bg-purple-50/30 border-purple-200'
                          : 'bg-white border-[#E5E1DB]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#E08828]/10 text-[#E08828] border border-[#E08828]/20">
                              Hike #{reg.hike_number || 'TBD'}
                            </span>
                            <span className="text-xs font-black text-[#1F1F1F]">
                              {reg.trek_name || 'Himalayan Trek'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8B8680] flex flex-wrap items-center gap-2">
                            <Calendar className="w-3 h-3 text-[#8B8680]" />
                            <span>
                              {reg.trek_date || reg.created_at?.slice(0, 10) || 'Scheduled Date'}
                            </span>
                            {reg.pickup_point && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-[#5A5551]">
                                  <MapPin className="w-3 h-3 text-stone-400" />
                                  <span>Pickup: {reg.pickup_point}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              isCancelled
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : reg.status === 'Confirmed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {reg.status || 'Confirmed'}
                          </span>

                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              reg.payment_status === 'Fully Paid'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : reg.payment_status === 'Deposit Paid'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {reg.payment_status || 'Unpaid'}
                          </span>
                        </div>
                      </div>

                      {/* Logistics, Group & Outreach Badges */}
                      {(guideMode ||
                        transportMode ||
                        reg.part_of_group ||
                        reg.phone_call ||
                        reg.whatsapp_group ||
                        reg.agreement) && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {guideMode && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                              {guideMode}
                            </span>
                          )}
                          {transportMode && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                              {transportMode}
                            </span>
                          )}
                          {reg.part_of_group &&
                            !(Number(reg.paxCount || 1) > 1 && reg.part_of_group.toLowerCase() === 'group') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                                {reg.part_of_group}
                              </span>
                            )}
                          {reg.phone_call && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Called</span>
                            </span>
                          )}
                          {reg.whatsapp_group && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>WA Group</span>
                            </span>
                          )}
                          {reg.agreement && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                              Agreement: {reg.agreement}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Payment & Group Info */}
                      <div className="pt-2 border-t border-[#F0EBE5] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A5551]">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            Paid:{' '}
                            <strong className="text-[#1F1F1F]">
                              NPR {Number(reg.paid_amount || 0).toLocaleString()}
                            </strong>
                          </span>
                          <span>
                            Due:{' '}
                            <strong
                              className={`${
                                Number(reg.due_amount || 0) > 0
                                  ? 'text-amber-700 font-bold'
                                  : 'text-stone-500'
                              }`}
                            >
                              NPR {Number(reg.due_amount || 0).toLocaleString()}
                            </strong>
                          </span>
                          {reg.paxCount && Number(reg.paxCount) > 1 && (
                            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]">
                              {reg.paxCount} Pax Group
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {reg.payment_voucher_submitted_at && (
                            <span className="text-[10px] text-[#8B8680]">
                              Voucher sent {formatDateShort(reg.payment_voucher_submitted_at)}
                            </span>
                          )}
                          {reg.payment_voucher_url && onViewVoucher && (
                            <button
                              type="button"
                              onClick={() => onViewVoucher(reg.payment_voucher_url!, reg)}
                              className="text-[11px] font-bold text-[#E08828] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Voucher</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {Array.isArray(reg.team_members) && reg.team_members.length > 0 && (
                        <div className="mt-2 text-[11px] bg-stone-50 p-2 rounded-xl border border-stone-200 text-stone-700 flex items-start gap-1.5">
                          <Users className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-stone-900">Companions:</strong>{' '}
                            {reg.team_members
                              .map((m, mIdx, arr) => {
                                if (!m.full_name && !m.gender) return null;
                                return (
                                  <React.Fragment key={mIdx}>
                                    {m.full_name && <span>{m.full_name}</span>}
                                    {m.gender && (
                                      <span className={`font-semibold ${getGenderTextColorClass(m.gender, '')}`}>
                                        {m.full_name ? ` (${m.gender})` : m.gender}
                                      </span>
                                    )}
                                    {mIdx < arr.length - 1 ? ', ' : ''}
                                  </React.Fragment>
                                );
                              })
                              .filter(Boolean)}
                          </div>
                        </div>
                      )}

                      {reg.person_remarks && (
                        <div className="mt-2 text-[11px] bg-purple-50/50 p-2 rounded-xl border border-purple-200 text-purple-950">
                          <strong className="text-purple-900">Role / List Notes:</strong>{' '}
                          {reg.person_remarks}
                        </div>
                      )}

                      {showSuggestions && (
                        <div className="mt-2 text-[11px] bg-amber-50/60 p-2 rounded-xl border border-amber-200 text-amber-950">
                          <strong className="text-amber-900">Hiker Suggestions:</strong>{' '}
                          {reg.suggestions}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              {loadingLeaderboard ? (
                <div className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-[#E08828] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-xs text-[#8B8680]">Loading leaderboard profile...</p>
                </div>
              ) : leaderboardMatch ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#8B8680]">Lifetime Distance Walked</div>
                      <div className="text-2xl font-black text-[#1F1F1F] mt-0.5">
                        {leaderboardMatch.stats.d || 0} km
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#8B8680]">Leaderboard Rank</div>
                      <div className="text-2xl font-black text-[#E08828] mt-0.5">
                        #{leaderboardMatch.rank}
                      </div>
                    </div>
                  </div>

                  {completedHikes.length > 0 && (
                    <div className="bg-white rounded-2xl border border-[#E5E1DB] overflow-hidden">
                      <div className="p-3 bg-[#FAF8F5] border-b border-[#F0EBE5] text-xs font-black text-[#1F1F1F] flex items-center justify-between">
                        <span>Master Completed Events ({completedHikes.length})</span>
                        <span className="text-[10px] text-[#7ABA42] font-bold">
                          Verified Master Ledger
                        </span>
                      </div>
                      <div className="divide-y divide-[#F0EBE5] max-h-80 overflow-y-auto">
                        {completedHikes.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 flex items-center justify-between text-xs hover:bg-[#FAF8F5] transition-colors"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="font-bold text-[#1F1F1F] flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#E08828]/10 text-[#E08828] border border-[#E08828]/20 shrink-0">
                                  Hike #{ev.no || '—'}
                                </span>
                                <span className="truncate">{ev.name || 'Hike Event'}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-[#1F1F1F]">
                                {ev.dist ? `${ev.dist} km` : ''}
                              </div>
                              {ev.date && (
                                <div className="text-[10px] text-[#8B8680] font-semibold mt-0.5">
                                  {ev.date}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Trophy className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">
                    No external leaderboard entry linked yet
                  </p>
                  <p className="text-[11px] text-[#8B8680] mt-1">
                    Stats are computed from current confirmed bookings roster.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'medical' && (
            <div className="space-y-4">
              {/* Staff-Only Admin Internal Notes (fetched from bookings_roster) */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-2.5">
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4 text-[#E08828]" />
                  <span>Admin Internal Notes ({adminInternalNotes.length})</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold normal-case tracking-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Staff Only</span>
                  </span>
                </h4>

                {adminInternalNotes.length > 0 ? (
                  <div className="space-y-2">
                    {adminInternalNotes.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-[#1F1F1F] space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-amber-900">
                          <span>{item.hikeLabel}</span>
                          {item.date && <span className="text-[#8B8680]">{item.date}</span>}
                        </div>
                        <p className="text-[#5A5551]">{item.note}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-900/70 italic">
                    No internal admin notes recorded in Bookings Roster for this hiker.
                  </p>
                )}
              </div>

              {/* Hiker Background & Profile Attributes (from users.profile_json + registrations) */}
              <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#E08828]" />
                  <span>Hiker Background &amp; Preferences</span>
                </h4>

                {profileAttributes.profession ||
                profileAttributes.fitness ||
                profileAttributes.experience ||
                profileAttributes.dietary ||
                profileAttributes.preferences ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {profileAttributes.profession && (
                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
                        <div className="text-[10px] font-bold uppercase text-[#8B8680]">Profession</div>
                        <div className="font-bold text-[#1F1F1F] mt-0.5">{profileAttributes.profession}</div>
                      </div>
                    )}
                    {profileAttributes.fitness && (
                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
                        <div className="text-[10px] font-bold uppercase text-[#8B8680]">Fitness Level</div>
                        <div className="font-bold text-[#1F1F1F] mt-0.5 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{profileAttributes.fitness}</span>
                        </div>
                      </div>
                    )}
                    {profileAttributes.experience && (
                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] sm:col-span-2">
                        <div className="text-[10px] font-bold uppercase text-[#8B8680]">
                          Recent Hikes &amp; Trekking Experience
                        </div>
                        <div className="font-semibold text-[#1F1F1F] mt-0.5">
                          {profileAttributes.experience}
                        </div>
                      </div>
                    )}
                    {profileAttributes.dietary && (
                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
                        <div className="text-[10px] font-bold uppercase text-[#8B8680] flex items-center gap-1">
                          <Utensils className="w-3 h-3" />
                          <span>Dietary</span>
                        </div>
                        <div className="font-semibold text-[#1F1F1F] mt-0.5">
                          {profileAttributes.dietary}
                        </div>
                      </div>
                    )}
                    {profileAttributes.preferences && (
                      <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5]">
                        <div className="text-[10px] font-bold uppercase text-[#8B8680]">Preferences</div>
                        <div className="font-semibold text-[#1F1F1F] mt-0.5">
                          {profileAttributes.preferences}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">
                    No profession, fitness, or experience notes recorded yet.
                  </p>
                )}
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Emergency Contacts</span>
                </h4>

                <div className="text-xs text-[#5A5551] space-y-1.5">
                  {emergencyContacts.length > 0 ? (
                    emergencyContacts.map((ec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#8B8680]" />
                        <strong className="text-[#1F1F1F]">
                          {idx === 0 ? 'Emergency:' : `Backup #${idx + 1}:`}
                        </strong>
                        <a
                          href={`tel:${ec}`}
                          className="text-[#E08828] font-bold hover:underline"
                        >
                          {ec}
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-stone-400 italic">
                      No specific emergency contact provided on signup.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Medical History &amp; Specific Conditions</span>
                </h4>

                {medicalDetails.length > 0 ? (
                  <div className="space-y-2">
                    {medicalDetails.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 text-xs text-rose-950"
                      >
                        <div className="font-bold text-rose-900 mb-0.5">
                          Reported on {m.hikeLabel}:
                        </div>
                        <p>{m.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    No medical conditions or physical restrictions reported by this hiker.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-4">
              {loadingExtra ? (
                <div className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-[#E08828] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-xs text-[#8B8680]">Loading reviews &amp; community contributions...</p>
                </div>
              ) : communityCount === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Star className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">
                    No reviews, photos, comments, or blog posts found for this hiker
                  </p>
                </div>
              ) : (
                <>
                  {/* Post-Hike Reviews (feedback) */}
                  {userFeedback.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span>Post-Hike Reviews ({userFeedback.length})</span>
                      </h4>
                      <div className="space-y-2.5">
                        {userFeedback.map((fb, idx) => (
                          <div
                            key={fb.id || idx}
                            className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-bold text-[#1F1F1F]">
                                {fb.hike_number ? `Hike #${fb.hike_number} • ` : ''}
                                {fb.trek_name || 'Trek Feedback'}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-bold">
                                {fb.overall_rating && (
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                    Overall: {fb.overall_rating}/5 ★
                                  </span>
                                )}
                                {fb.team_rating && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    Team: {fb.team_rating}/5 ★
                                  </span>
                                )}
                              </div>
                            </div>
                            {fb.overall_feedback && (
                              <p className="text-[#5A5551]">{fb.overall_feedback}</p>
                            )}
                            {fb.team_feedback && fb.team_feedback !== fb.overall_feedback && (
                              <p className="text-[#5A5551]">
                                <strong>Team note:</strong> {fb.team_feedback}
                              </p>
                            )}
                            {fb.submitted_at && (
                              <div className="text-[10px] text-[#8B8680]">
                                Submitted {formatDateShort(fb.submitted_at)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gallery Photos Uploaded (trek_photos) */}
                  {userPhotos.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-[#E08828]" />
                        <span>Gallery Photos Uploaded ({userPhotos.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {userPhotos.map((ph, idx) => (
                          <a
                            key={ph.id || idx}
                            href={ph.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] hover:border-[#E08828]/40 transition-colors"
                          >
                            {ph.url && (
                              <img
                                src={ph.url}
                                alt={ph.caption || ph.trek_name || 'Hiker upload'}
                                className="w-12 h-12 rounded-lg object-cover shrink-0 bg-stone-200"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="font-bold text-[#1F1F1F] truncate">
                                {ph.hike_number ? `#${ph.hike_number} ` : ''}
                                {ph.trek_name || 'Trek Photo'}
                              </div>
                              {ph.caption && (
                                <div className="text-[11px] text-[#5A5551] truncate">{ph.caption}</div>
                              )}
                              {ph.uploaded_at && (
                                <div className="text-[10px] text-[#8B8680] mt-0.5">
                                  {formatDateShort(ph.uploaded_at)}
                                </div>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo Comments (photo_comments) */}
                  {userPhotoComments.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span>Photo Comments ({userPhotoComments.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {userPhotoComments.map((c, idx) => (
                          <div
                            key={c.id || idx}
                            className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs flex items-start justify-between gap-2"
                          >
                            <p className="text-[#1F1F1F]">{c.comment_text}</p>
                            {c.created_at && (
                              <span className="text-[10px] text-[#8B8680] shrink-0">
                                {formatDateShort(c.created_at)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Community Blogs (blogs) */}
                  {userBlogs.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>Community Blogs ({userBlogs.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {userBlogs.map((b, idx) => (
                          <div
                            key={b.id || idx}
                            className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-[#1F1F1F] truncate">{b.title}</div>
                              <div className="text-[10px] text-[#8B8680] mt-0.5">
                                {b.category || 'Trail Stories'} • {b.status || 'published'} •{' '}
                                {formatDateShort(b.created_at)}
                              </div>
                            </div>
                            <div className="text-[11px] font-bold text-[#5A5551] shrink-0">
                              ♥ {b.likes_count || 0} • 👁 {b.views_count || 0}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'mapminers' && (
            <div className="space-y-4">
              {loadingExtra ? (
                <div className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-[#E08828] border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-xs text-[#8B8680]">Loading MapMiners &amp; GPS data...</p>
                </div>
              ) : mapMinersCount === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-[#E5E1DB] p-4">
                  <Compass className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">
                    No GPS recordings, contributed trails, or saved maps linked to this hiker
                  </p>
                </div>
              ) : (
                <>
                  {/* Recorded GPS Activities (user_activities) */}
                  {userActivities.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-[#E08828]" />
                        <span>Recorded GPS Tracks ({userActivities.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {userActivities.map((act, idx) => (
                          <div
                            key={act.id || idx}
                            className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-[#1F1F1F]">
                                {act.trail_name || 'Recorded Hike Track'}
                              </div>
                              <div className="text-[11px] text-[#5A5551] flex flex-wrap items-center gap-2">
                                <span>{Number(act.distance || 0).toFixed(2)} km</span>
                                <span>•</span>
                                <span>{formatDurationSec(act.duration)}</span>
                                {Number(act.elevation_gain) > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>+{Math.round(Number(act.elevation_gain))}m elev</span>
                                  </>
                                )}
                                {act.pace && (
                                  <>
                                    <span>•</span>
                                    <span>Pace {act.pace}</span>
                                  </>
                                )}
                                {Number(act.calories) > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{act.calories} kcal</span>
                                  </>
                                )}
                              </div>
                              {(act.start_time || act.created_at) && (
                                <div className="text-[10px] text-[#8B8680]">
                                  {formatDateShort(act.start_time || act.created_at)}
                                </div>
                              )}
                            </div>
                            {act.gpx_url && (
                              <a
                                href={act.gpx_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-[#E08828] hover:underline flex items-center gap-1"
                              >
                                <span>GPX</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contributed Trails (community_trails) */}
                  {userContributedTrails.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-emerald-600" />
                        <span>Contributed Community Trails ({userContributedTrails.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {userContributedTrails.map((tr, idx) => (
                          <div
                            key={tr.id || idx}
                            className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-bold text-[#1F1F1F]">{tr.name || tr.file_name}</div>
                              <div className="text-[11px] text-[#5A5551] mt-0.5">
                                {[
                                  tr.difficulty,
                                  tr.distance ? `${Number(tr.distance).toFixed(1)} km` : null,
                                  tr.elevation_gain ? `+${Math.round(Number(tr.elevation_gain))}m` : null,
                                  tr.district || tr.province,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </div>
                            </div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                              {tr.status || 'approved'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved / Bookmarked Trails (saved_trails) */}
                  {savedTrailIds.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <Bookmark className="w-4 h-4 text-amber-600" />
                        <span>Saved Trails ({savedTrailIds.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {savedTrailIds.map((tid) => {
                          const t = trailsById.get(tid);
                          return (
                            <span
                              key={tid}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E5E1DB] text-[#1F1F1F]"
                            >
                              {t?.name || tid}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Trail Comments (trail_comments) */}
                  {userTrailComments.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-[#E5E1DB] space-y-3">
                      <h4 className="text-xs font-black text-[#1F1F1F] uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span>Trail Comments ({userTrailComments.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {userTrailComments.map((tc, idx) => {
                          const t = trailsById.get(String(tc.trailId || tc.trail_id));
                          return (
                            <div
                              key={tc.id || idx}
                              className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0EBE5] text-xs space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-2 text-[10px] text-[#8B8680] font-bold">
                                <span>{t?.name || tc.trailId || 'Community Trail'}</span>
                                {tc.timestamp && <span>{formatDateShort(tc.timestamp)}</span>}
                              </div>
                              <p className="text-[#1F1F1F]">{tc.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-[#F0EBE5] p-4 px-5 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#8B8680]">
            Walk Nepal Walk Hiker Intelligence • {hikerRegistrations.length} booking record(s) indexed
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
