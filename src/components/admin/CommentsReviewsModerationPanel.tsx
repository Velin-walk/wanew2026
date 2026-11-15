import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  MessageSquare,
  Star,
  Camera,
  MapPin,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, recordAdminAuditLog } from '../../services/api';
import { HISTORIC_COMMUNITY_REVIEWS } from '../../data/historicReviews';
import {
  useContentModeration,
  fetchContentModeration,
  isPhotoCommentHidden,
  isTrailCommentHidden,
  isReviewHidden,
  setPhotoCommentHidden,
  setTrailCommentHidden,
  setReviewHidden,
} from '../../services/contentModerationService';

interface CommentsReviewsModerationPanelProps {
  currentUserEmail: string;
  trails?: any[];
}

type ModerationCategory = 'all' | 'reviews' | 'photo_comments' | 'trail_comments';
type VisibilityFilter = 'all' | 'visible' | 'hidden';

interface UnifiedModerationItem {
  uidKey: string;
  kind: 'review' | 'photo_comment' | 'trail_comment';
  subLabel: string;
  authorName: string;
  authorContact?: string;
  targetTitle: string;
  bodyText: string;
  secondaryText?: string;
  rating?: number;
  teamRating?: number;
  createdAtMs: number;
  displayDate: string;
  isHidden: boolean;
  isHistoric?: boolean;
  rawItem: any;
}

function parseDateMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return Date.parse(s.replace(' ', 'T') + 'Z') || 0;
  }
  return Date.parse(s) || 0;
}

function formatDisplayDate(ms: number, fallback?: string): string {
  if (!ms) return fallback || 'Unknown date';
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback || 'Unknown date';
  }
}

export const CommentsReviewsModerationPanel: React.FC<CommentsReviewsModerationPanelProps> = ({
  currentUserEmail,
  trails = [],
}) => {
  const moderation = useContentModeration();

  const [category, setCategory] = useState<ModerationCategory>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);

  const [liveReviews, setLiveReviews] = useState<any[]>([]);
  const [photoComments, setPhotoComments] = useState<any[]>([]);
  const [trailComments, setTrailComments] = useState<any[]>([]);

  const trailNameById = useMemo(() => {
    const map = new Map<string, string>();
    map.set('global_trail_chat', 'MapMiners Live Trail Chat');
    for (const t of trails || []) {
      if (t?.id) map.set(String(t.id), t.name || t.fileName || String(t.id));
    }
    return map;
  }, [trails]);

  const loadAllContent = useCallback(async () => {
    setLoading(true);
    try {
      await fetchContentModeration();

      const [feedbackRes, photoCommentsRes, trailCommentsRes] = await Promise.all([
        apiFetch('feedback', { forceFresh: true }).catch(() => null),
        apiFetch('photo_comments', { forceFresh: true }).catch(() => null),
        apiFetch('mapminers/comments', { forceFresh: true }).catch(() => null),
      ]);

      // 1. Reviews (D1 /feedback + local wnw_user_feedbacks)
      let remoteFeedback: any[] = [];
      if (feedbackRes && feedbackRes.ok) {
        const json = await feedbackRes.json().catch(() => null);
        const list = Array.isArray(json) ? json : json?.data;
        if (Array.isArray(list)) remoteFeedback = list;
      }

      let localFeedback: any[] = [];
      try {
        const raw = localStorage.getItem('wnw_user_feedbacks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) localFeedback = parsed;
        }
      } catch {}

      const mergedReviews: any[] = [...remoteFeedback];
      for (const loc of localFeedback) {
        if (!loc) continue;
        const locName = String(loc.full_name || loc.name || '').trim().toLowerCase();
        const locOverall = String(loc.overall_feedback || loc.overallFeedback || '').trim().toLowerCase();
        const locDate = String(loc.submitted_at || '').slice(0, 10);
        const exists = mergedReviews.some((r) => {
          const rName = String(r.full_name || r.name || '').trim().toLowerCase();
          const rOverall = String(r.overall_feedback || r.overallFeedback || '').trim().toLowerCase();
          const rDate = String(r.submitted_at || '').slice(0, 10);
          return (r.id && loc.id && String(r.id) === String(loc.id).replace(/^(live-)+/, '')) ||
            (rName === locName && rOverall === locOverall && rDate === locDate);
        });
        if (!exists) mergedReviews.push(loc);
      }
      setLiveReviews(mergedReviews);

      // 2. Gallery Photo Comments
      if (photoCommentsRes && photoCommentsRes.ok) {
        const json = await photoCommentsRes.json().catch(() => null);
        if (json && Array.isArray(json.data)) {
          setPhotoComments(json.data);
        }
      }

      // 3. MapMiners Trail Comments & Trail Chat
      if (trailCommentsRes && trailCommentsRes.ok) {
        const json = await trailCommentsRes.json().catch(() => null);
        if (json && Array.isArray(json.comments)) {
          setTrailComments(json.comments);
        }
      }
    } catch (err) {
      console.warn('[CommentsReviewsModerationPanel] Error loading content:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllContent();
  }, [loadAllContent]);

  useEffect(() => {
    setVisibleLimit(30);
  }, [category, visibilityFilter, searchQuery]);

  const allUnifiedItems: UnifiedModerationItem[] = useMemo(() => {
    const items: UnifiedModerationItem[] = [];

    // 1. Live reviews + Historic reviews
    const seenReviewSigs = new Set<string>();
    const addReview = (r: any, isHistoric: boolean) => {
      if (!r) return;
      const authorName = String(r.full_name || r.name || 'Verified Hiker').trim();
      const trekName = String(r.trek_name || r.recentWalk || 'Himalayan Trek').trim();
      const overallText = String(r.overall_feedback || r.overallFeedback || '').trim();
      const teamText = String(r.team_feedback || r.teamFeedback || '').trim();
      const dateStr = String(r.submitted_at || '').slice(0, 10);
      const sig = `${authorName.toLowerCase()}|${trekName.toLowerCase()}|${dateStr}|${overallText.toLowerCase()}|${teamText.toLowerCase()}`;
      if (seenReviewSigs.has(sig)) return;
      seenReviewSigs.add(sig);

      const isGuide = trekName.toUpperCase().startsWith('GUIDE_REVIEW:');
      const cleanTarget = isGuide ? trekName.replace(/^GUIDE_REVIEW:/i, '').trim() : trekName;
      const hikeNo = String(r.hike_number || r.hikeNumber || '').replace(/^#/, '').trim();
      const displayTarget = hikeNo && hikeNo !== 'GUIDE' ? `#${hikeNo} · ${cleanTarget}` : cleanTarget;

      items.push({
        uidKey: `rev_${isHistoric ? 'hist' : 'live'}_${r.id ?? sig}`,
        kind: 'review',
        subLabel: isGuide ? 'Guide Review' : isHistoric ? 'Trek Review (Archive)' : 'Trek Review',
        authorName,
        authorContact: r.email_address || r.email || undefined,
        targetTitle: displayTarget,
        bodyText: overallText || teamText || '(Rating only, no written text)',
        secondaryText: overallText && teamText ? `Coordinator note: ${teamText}` : undefined,
        rating: Number(r.overall_rating || r.overallRating) || 5,
        teamRating: Number(r.team_rating || r.teamRating) || 5,
        createdAtMs: parseDateMs(r.submitted_at),
        displayDate: dateStr || 'Recent',
        isHidden: isReviewHidden(r, moderation),
        isHistoric,
        rawItem: r,
      });
    };

    liveReviews.forEach((r) => addReview(r, false));
    HISTORIC_COMMUNITY_REVIEWS.forEach((r) => addReview(r, true));

    // 2. Gallery Photo Comments
    for (const c of photoComments) {
      if (!c || !c.id) continue;
      const ms = parseDateMs(c.createdAt || c.created_at);
      items.push({
        uidKey: `photo_${c.id}`,
        kind: 'photo_comment',
        subLabel: 'Gallery Photo Comment',
        authorName: String(c.userName || c.user_name || 'Verified Hiker'),
        targetTitle: `Photo #${String(c.photoId || c.photo_id || '').slice(-8)}`,
        bodyText: String(c.commentText || c.comment_text || ''),
        createdAtMs: ms,
        displayDate: formatDisplayDate(ms, c.createdAt),
        isHidden: isPhotoCommentHidden(c.id, moderation),
        rawItem: c,
      });
    }

    // 3. MapMiners Trail Comments & Trail Chat
    for (const tc of trailComments) {
      if (!tc || !tc.id) continue;
      const tId = String(tc.trailId || tc.trail_id || '');
      const isGlobalChat = tId === 'global_trail_chat';
      const ms = Number(tc.timestamp) || parseDateMs(tc.created_at);
      items.push({
        uidKey: `trail_${tc.id}`,
        kind: 'trail_comment',
        subLabel: isGlobalChat ? 'MapMiners Trail Chat' : 'Map Trail Comment',
        authorName: String(tc.authorName || tc.author_name || 'Hiker'),
        authorContact: tc.authorEmail || tc.author_email || undefined,
        targetTitle: trailNameById.get(tId) || `Trail ${tId}`,
        bodyText: String(tc.text || ''),
        createdAtMs: ms,
        displayDate: formatDisplayDate(ms),
        isHidden: isTrailCommentHidden(tc.id, moderation),
        rawItem: tc,
      });
    }

    // Sort newest first; prioritize live items over static archive on equal timestamps
    items.sort((a, b) => {
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      if (Boolean(a.isHistoric) !== Boolean(b.isHistoric)) return a.isHistoric ? 1 : -1;
      return b.uidKey.localeCompare(a.uidKey);
    });

    return items;
  }, [liveReviews, photoComments, trailComments, moderation, trailNameById]);

  const counts = useMemo(() => {
    const reviews = allUnifiedItems.filter((i) => i.kind === 'review');
    const photos = allUnifiedItems.filter((i) => i.kind === 'photo_comment');
    const trailsList = allUnifiedItems.filter((i) => i.kind === 'trail_comment');
    return {
      total: allUnifiedItems.length,
      hiddenTotal: allUnifiedItems.filter((i) => i.isHidden).length,
      reviews: reviews.length,
      photoComments: photos.length,
      trailComments: trailsList.length,
    };
  }, [allUnifiedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUnifiedItems.filter((item) => {
      if (category === 'reviews' && item.kind !== 'review') return false;
      if (category === 'photo_comments' && item.kind !== 'photo_comment') return false;
      if (category === 'trail_comments' && item.kind !== 'trail_comment') return false;

      if (visibilityFilter === 'visible' && item.isHidden) return false;
      if (visibilityFilter === 'hidden' && !item.isHidden) return false;

      if (q) {
        const hay = [
          item.authorName,
          item.authorContact || '',
          item.targetTitle,
          item.bodyText,
          item.secondaryText || '',
          item.subLabel,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allUnifiedItems, category, visibilityFilter, searchQuery]);

  const handleToggleVisibility = async (item: UnifiedModerationItem) => {
    const nextHidden = !item.isHidden;
    setTogglingKey(item.uidKey);
    setStatusBanner(null);

    try {
      if (item.kind === 'photo_comment') {
        await setPhotoCommentHidden(String(item.rawItem.id), nextHidden, currentUserEmail);
      } else if (item.kind === 'trail_comment') {
        await setTrailCommentHidden(String(item.rawItem.id), nextHidden, currentUserEmail);
      } else {
        await setReviewHidden(item.rawItem, nextHidden, currentUserEmail);
      }

      recordAdminAuditLog({
        actionType: nextHidden ? 'HIDE_PUBLIC_COMMENT_OR_REVIEW' : 'UNHIDE_PUBLIC_COMMENT_OR_REVIEW',
        description: `${nextHidden ? 'Hid' : 'Restored'} ${item.subLabel} by ${item.authorName} (${item.targetTitle})`,
        metadata: {
          kind: item.kind,
          target: item.targetTitle,
          author: item.authorName,
          hidden: nextHidden,
        },
        adminEmail: currentUserEmail,
      });

      setStatusBanner({
        text: nextHidden
          ? `${item.subLabel} by ${item.authorName} is now hidden from public view.`
          : `${item.subLabel} by ${item.authorName} is now visible to the public.`,
        type: 'success',
      });
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err: any) {
      setStatusBanner({
        text: err?.message || 'Could not update visibility status.',
        type: 'error',
      });
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#7ABA42] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5A5551] leading-relaxed">
            <span className="font-bold text-[#1F1F1F]">Public by default:</span> New user comments and reviews appear publicly immediately. Use <span className="font-bold">Hide from Public</span> below to hide any review, gallery comment, or trail comment from public visitors without deleting the underlying record.
          </div>
        </div>
        <button
          type="button"
          onClick={loadAllContent}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F3EFEA] border border-[#E5E1DB] text-[#1F1F1F] rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {statusBanner && (
        <div
          className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              category === 'all'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3EFEA]'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setCategory('reviews')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'reviews'
                ? 'bg-amber-600 text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3EFEA]'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Reviews ({counts.reviews})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategory('photo_comments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'photo_comments'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3EFEA]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Gallery Comments ({counts.photoComments})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategory('trail_comments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              category === 'trail_comments'
                ? 'bg-purple-600 text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB] hover:bg-[#F3EFEA]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Map Comments ({counts.trailComments})</span>
          </button>
        </div>

        {/* Status Filter + Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E5E1DB]">
            {(['all', 'visible', 'hidden'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setVisibilityFilter(status)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  visibilityFilter === status
                    ? status === 'hidden'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-[#1F1F1F] shadow-2xs'
                    : 'text-[#6A645D] hover:text-[#1F1F1F]'
                }`}
              >
                {status === 'all'
                  ? 'All Status'
                  : status === 'visible'
                  ? 'Public'
                  : `Hidden (${counts.hiddenTotal})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, trail, text..."
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-lg text-xs text-[#1F1F1F] placeholder:text-[#8B8680] focus:outline-none focus:border-purple-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Items List */}
      {loading && allUnifiedItems.length === 0 ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E1DB] text-[#8B8680] space-y-1">
          <MessageSquare className="w-6 h-6 mx-auto opacity-40" />
          <p className="text-xs font-bold text-[#5A5551]">No matching comments or reviews found</p>
          <p className="text-[11px]">Try adjusting your filter or search query.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.slice(0, visibleLimit).map((item) => {
            const isToggling = togglingKey === item.uidKey;
            return (
              <div
                key={item.uidKey}
                className={`flex flex-col sm:flex-row gap-3 justify-between items-start p-4 rounded-xl border transition-all ${
                  item.isHidden
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-[#F9F7F5] border-[#E5E1DB]'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Top Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.kind === 'review'
                          ? 'bg-amber-100 text-amber-800'
                          : item.kind === 'photo_comment'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {item.subLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.isHidden
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {item.isHidden ? 'Hidden from Public' : 'Publicly Visible'}
                    </span>
                    <span className="text-[11px] font-bold text-[#1F1F1F] truncate max-w-[260px]">
                      {item.targetTitle}
                    </span>
                    <span className="text-[10px] text-[#8B8680]">• {item.displayDate}</span>
                  </div>

                  {/* Author & Ratings */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-[#1F1F1F]">{item.authorName}</span>
                    {item.authorContact && (
                      <span className="text-[11px] text-[#8B8680]">({item.authorContact})</span>
                    )}
                    {item.kind === 'review' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        <span>
                          {item.rating}/5 Exp · {item.teamRating}/5 Team
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Comment / Review Text */}
                  <p
                    className={`text-xs leading-relaxed break-words ${
                      item.isHidden ? 'text-[#8B8680] line-through' : 'text-[#2A2725]'
                    }`}
                  >
                    {item.bodyText}
                  </p>

                  {item.secondaryText && (
                    <p
                      className={`text-[11px] leading-snug break-words ${
                        item.isHidden ? 'text-[#A09890] line-through' : 'text-[#5A5551]'
                      }`}
                    >
                      {item.secondaryText}
                    </p>
                  )}
                </div>

                {/* Action Toggle Button */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleVisibility(item)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                      item.isHidden
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {item.isHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isToggling ? 'Updating...' : 'Show to Public'}</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{isToggling ? 'Updating...' : 'Hide from Public'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {visibleLimit < filteredItems.length && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 30)}
                className="px-5 py-2 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E5E1DB] text-[#1F1F1F] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Load More ({filteredItems.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
