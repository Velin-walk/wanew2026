import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { apiFetch } from './api';

export type UserActivityType =
  | 'trek_registration'
  | 'voucher_uploaded'
  | 'private_trek_request'
  | 'feedback_submitted'
  | 'mapminers_gpx_uploaded'
  | 'mapminers_map_downloaded'
  | 'mapminers_comment_posted'
  | 'gallery_photo_uploaded'
  | 'gallery_comment_posted';

export interface UserActivityItem {
  id: string;
  type: UserActivityType;
  title: string;
  actorName: string;
  actorContact?: string;
  targetName?: string;
  summary: string;
  details?: Record<string, string | number | undefined>;
  linkUrl?: string;
  imageUrl?: string;
  createdAt: string; // ISO string
}

const LOCAL_STORAGE_KEY = 'wnw_user_activity_notifications';
const LAST_SEEN_KEY = 'wnw_admin_activity_last_seen_at';
const FIRESTORE_DOC_COLLECTION = 'pwa_metrics';
const FIRESTORE_DOC_ID = 'user_activity_feed';

export function getLocalUserActivities(): UserActivityItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalUserActivities(items: UserActivityItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    // Ignore storage quota errors
  }
}

export function getAdminLastSeenTimestamp(): number {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function markAllActivitiesSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent('wnw-user-activity-seen'));
  } catch {}
}

/**
 * Logs a user activity locally and syncs it to Firestore so admins see it across devices in real time.
 */
export async function logUserActivity(
  input: Omit<UserActivityItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<void> {
  const newItem: UserActivityItem = {
    ...input,
    id: input.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  // 1. Save to localStorage immediately
  const existingLocal = getLocalUserActivities();
  const updatedLocal = [newItem, ...existingLocal.filter((i) => i.id !== newItem.id)].slice(0, 200);
  saveLocalUserActivities(updatedLocal);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wnw-user-activity-logged', { detail: newItem }));
  }

  // 2. Sync to Firestore (using pwa_metrics/user_activity_feed which has open read/write rules)
  try {
    const feedRef = doc(db, FIRESTORE_DOC_COLLECTION, FIRESTORE_DOC_ID);
    const snap = await getDoc(feedRef);
    let remoteItems: UserActivityItem[] = [];
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        remoteItems = data.items;
      }
    }
    const merged = [newItem, ...remoteItems.filter((i) => i && i.id !== newItem.id)].slice(0, 150);
    await setDoc(
      feedRef,
      {
        items: merged,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Silently ignore if offline
    console.debug('[UserActivityNotifier] Firestore sync skipped:', err);
  }
}

/**
 * Aggregates real-time logged user events + live records from D1 endpoints into a single chronological feed.
 */
export async function fetchAllUserActivities(forceFresh = false): Promise<UserActivityItem[]> {
  const activityMap = new Map<string, UserActivityItem>();

  const addItem = (item: UserActivityItem) => {
    if (!item || !item.id) return;
    if (!activityMap.has(item.id)) {
      activityMap.set(item.id, item);
    }
  };

  // 1. Local logged events
  getLocalUserActivities().forEach(addItem);

  // 2. Firestore real-time feed
  try {
    const feedRef = doc(db, FIRESTORE_DOC_COLLECTION, FIRESTORE_DOC_ID);
    const snap = await getDoc(feedRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        data.items.forEach((item: UserActivityItem) => addItem(item));
      }
    }
  } catch {}

  // 3. Aggregate from live Cloudflare D1 endpoints in parallel
  await Promise.allSettled([
    // A. Trek Registrations, Private Trek Requests & Voucher Uploads
    (async () => {
      const res = await apiFetch('registrations', { forceFresh });
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json) ? json : json?.data;
      if (!Array.isArray(list)) return;

      list.slice(0, 80).forEach((r: any) => {
        const regId = String(r.id || r.timestamp || Math.random());
        const fullName = r.full_name || r.hikerName || r.name || 'Hiker';
        const phone = r.phone || r.whatsapp || '';
        const trekName = r.trek_name || r.trekTitle || r.list_name || 'Himalayan Trek';
        const pax = Number(r.pax || r.paxCount) || 1;
        const createdAt = r.joined_at || r.timestamp || r.created_at || new Date().toISOString();
        const isPrivate =
          String(r.recent_hikes || '').toLowerCase().includes('private') ||
          String(r.guide_mode || '').toLowerCase().includes('private') ||
          String(r.hike_number || '').toUpperCase().startsWith('PVT');

        if (isPrivate) {
          addItem({
            id: `d1_pvt_${regId}`,
            type: 'private_trek_request',
            title: 'Private Trek Request Submitted',
            actorName: fullName,
            actorContact: phone || r.email_address || r.email,
            targetName: trekName,
            summary: `${fullName} requested a private trek to ${trekName} for ${pax} Pax.`,
            details: {
              Destination: trekName,
              'Group Size': `${pax} Pax`,
              Phone: phone || 'N/A',
              Notes: r.person_remarks || r.admin_notes || r.suggestions || undefined,
            },
            createdAt,
          });
        } else {
          addItem({
            id: `d1_reg_${regId}`,
            type: 'trek_registration',
            title: 'Trek Registration Submitted',
            actorName: fullName,
            actorContact: phone || r.email_address || r.email,
            targetName: trekName,
            summary: `${fullName} registered for ${trekName} (${pax} Pax).`,
            details: {
              Hiker: fullName,
              Phone: phone || 'N/A',
              Trek: trekName,
              'Group Size': `${pax} Pax`,
              Pickup: r.pickup_point || r.roster_pickup_point || undefined,
            },
            createdAt,
          });
        }

        // Check if this registration also has an uploaded payment voucher
        const voucherUrl = r.payment_voucher_url || r.voucher_url || '';
        if (voucherUrl) {
          const firstUrl = String(voucherUrl).split(',')[0].trim();
          const voucherTime = r.payment_voucher_submitted_at || createdAt;
          addItem({
            id: `d1_voucher_${regId}`,
            type: 'voucher_uploaded',
            title: 'Payment Voucher Uploaded',
            actorName: fullName,
            actorContact: phone || r.email_address || r.email,
            targetName: trekName,
            summary: `${fullName} uploaded a payment receipt voucher for ${trekName}.`,
            details: {
              Hiker: fullName,
              Phone: phone || 'N/A',
              Trek: trekName,
              Status: r.payment_status || r.roster_payment_status || 'Voucher Uploaded',
            },
            linkUrl: firstUrl,
            imageUrl: firstUrl,
            createdAt: voucherTime,
          });
        }
      });
    })(),

    // B. Hiker Reviews & Feedback
    (async () => {
      const res = await apiFetch('feedback', { forceFresh });
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json) ? json : json?.data;
      if (!Array.isArray(list)) return;

      list.slice(0, 50).forEach((f: any, idx: number) => {
        const revId = String(f.id || idx);
        const reviewer = f.full_name || f.name || 'Verified Hiker';
        const trekName = f.trek_name || f.recentWalk || 'Himalayan Trek';
        const stars = Number(f.overall_rating || f.overallRating) || 5;
        const reviewText = f.overall_feedback || f.overallFeedback || f.team_feedback || f.teamFeedback || '';
        const createdAt = f.submitted_at || f.created_at || new Date().toISOString();

        addItem({
          id: `d1_feedback_${revId}`,
          type: 'feedback_submitted',
          title: 'Hiker Review / Feedback Submitted',
          actorName: reviewer,
          actorContact: f.email || undefined,
          targetName: trekName,
          summary: `${reviewer} rated ${trekName} ${stars}★: "${reviewText.slice(0, 120)}${reviewText.length > 120 ? '...' : ''}"`,
          details: {
            Reviewer: reviewer,
            Trek: trekName,
            'Overall Rating': `${'⭐'.repeat(Math.min(5, Math.max(1, stars)))} (${stars}/5)`,
            'Team Rating': f.team_rating || f.teamRating ? `${f.team_rating || f.teamRating}/5` : undefined,
            Review: reviewText || undefined,
          },
          createdAt,
        });
      });
    })(),

    // C. MapMiners GPX Trails Uploaded
    (async () => {
      const res = await apiFetch('mapminers/trails', { forceFresh });
      if (!res.ok) return;
      const json = await res.json();
      const rawData = json?.data;
      if (!rawData) return;
      const list = Array.isArray(rawData) ? rawData : Object.values(rawData);

      list.slice(0, 50).forEach((t: any, idx: number) => {
        const trailId = String(t.id || t.fileName || idx);
        const trailName = t.name || t.fileName || 'Community Trail';
        const uploader = t.contributorName || (t.contributorEmail ? t.contributorEmail.split('@')[0] : 'Map Miner');
        const dist = Number(t.distance || t.stats?.distance || 0);
        const createdAt = t.uploadedAt || t.uploaded_at || new Date().toISOString();

        addItem({
          id: `d1_gpx_${trailId}`,
          type: 'mapminers_gpx_uploaded',
          title: 'MapMiners GPX Trail Uploaded',
          actorName: uploader,
          actorContact: t.contributorEmail || undefined,
          targetName: trailName,
          summary: `${uploader} uploaded GPX trail "${trailName}" (${dist ? `${dist.toFixed(1)} km` : 'GPX route'}).`,
          details: {
            'Trail Name': trailName,
            Uploader: uploader,
            Distance: dist ? `${dist.toFixed(2)} km` : 'N/A',
            Status: (t.status || 'pending').toUpperCase(),
          },
          createdAt,
        });
      });
    })(),

    // D. MapMiners Global Trail Chat / Condition Reports
    (async () => {
      const res = await apiFetch('mapminers/comments?trailId=global_trail_chat', { forceFresh });
      if (!res.ok) return;
      const json = await res.json();
      if (!Array.isArray(json?.comments)) return;

      json.comments.slice(-30).forEach((c: any) => {
        const cid = String(c.id || c.timestamp);
        if (cid.startsWith('seed-')) return;
        const author = c.authorName || c.author_name || 'Hiker';
        const text = String(c.text || '');
        const ts = Number(c.timestamp) ? new Date(Number(c.timestamp)).toISOString() : new Date().toISOString();

        addItem({
          id: `d1_mapchat_${cid}`,
          type: 'mapminers_comment_posted',
          title: 'MapMiners Trail Chat / Condition Report',
          actorName: author,
          actorContact: c.authorEmail || c.author_email || undefined,
          targetName: 'Global Trail Chat',
          summary: `${author} posted in MapChat: "${text.slice(0, 120)}${text.length > 120 ? '...' : ''}"`,
          details: {
            Author: author,
            Channel: 'MapMiners Trail Chat',
            Comment: text,
          },
          createdAt: ts,
        });
      });
    })(),

    // E. Gallery Photos Uploaded
    (async () => {
      const res = await apiFetch('trek_photos', { forceFresh });
      if (!res.ok) return;
      const json = await res.json();
      if (!Array.isArray(json?.data)) return;

      json.data.slice(0, 50).forEach((p: any) => {
        const pid = String(p.id || p.uploadedAt);
        const uploader = p.uploadedBy || 'Hiker';
        const trekName = p.trekName || (p.hikeNumber ? `Hike #${p.hikeNumber}` : 'Community Gallery');
        const createdAt = p.uploadedAt || new Date().toISOString();

        addItem({
          id: `d1_photo_${pid}`,
          type: 'gallery_photo_uploaded',
          title: 'Gallery Photo Uploaded',
          actorName: uploader,
          targetName: trekName,
          summary: `${uploader} shared a photo in ${trekName}${p.caption ? `: "${p.caption}"` : '.'}`,
          details: {
            Uploader: uploader,
            Trek: trekName,
            Caption: p.caption || undefined,
          },
          imageUrl: p.url,
          linkUrl: p.url,
          createdAt,
        });
      });
    })(),
  ]);

  const allItems = Array.from(activityMap.values());
  allItems.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || 0).getTime() || 0;
    return timeB - timeA;
  });

  return allItems;
}
