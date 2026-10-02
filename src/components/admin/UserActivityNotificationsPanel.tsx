import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAllUserActivities,
  getAdminLastSeenTimestamp,
  markAllActivitiesSeen,
  UserActivityItem,
  UserActivityType,
} from '../../services/userActivityNotifier';
import {
  Bell,
  Users,
  CreditCard,
  Compass,
  Star,
  UploadCloud,
  Download,
  MessageSquare,
  Camera,
  RefreshCw,
  Search,
  CheckCheck,
  ExternalLink,
  X,
  Phone,
  Calendar,
} from 'lucide-react';

interface UserActivityNotificationsPanelProps {
  onNavigateTab?: (
    tab: 'bookings' | 'execution' | 'coordinator' | 'sales' | 'library' | 'editor' | 'maps' | 'system'
  ) => void;
  onUnreadCountChange?: (count: number) => void;
}

type CategoryFilter =
  | 'all'
  | 'trek_registration'
  | 'voucher_uploaded'
  | 'private_trek_request'
  | 'feedback_submitted'
  | 'mapminers_gpx_uploaded'
  | 'mapminers_map_downloaded'
  | 'mapminers_comment_posted'
  | 'gallery';

export const UserActivityNotificationsPanel: React.FC<UserActivityNotificationsPanelProps> = ({
  onNavigateTab,
  onUnreadCountChange,
}) => {
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [lastSeenAt, setLastSeenAt] = useState<number>(() => getAdminLastSeenTimestamp());
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const loadActivities = async (force = false) => {
    setLoading(true);
    try {
      const items = await fetchAllUserActivities(force);
      setActivities(items);
    } catch (err) {
      console.error('Error loading user activity notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities(false);

    const handleLiveActivity = () => {
      loadActivities(false);
    };
    const handleSeen = () => {
      setLastSeenAt(getAdminLastSeenTimestamp());
    };

    window.addEventListener('wnw-user-activity-logged', handleLiveActivity);
    window.addEventListener('wnw-user-activity-seen', handleSeen);
    return () => {
      window.removeEventListener('wnw-user-activity-logged', handleLiveActivity);
      window.removeEventListener('wnw-user-activity-seen', handleSeen);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [categoryFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return activities.length;
    return activities.filter((a) => {
      const t = new Date(a.createdAt || 0).getTime() || 0;
      return t > lastSeenAt;
    }).length;
  }, [activities, lastSeenAt]);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const handleMarkAllRead = () => {
    markAllActivitiesSeen();
    setLastSeenAt(Date.now());
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      if (categoryFilter === 'gallery') {
        if (item.type !== 'gallery_photo_uploaded' && item.type !== 'gallery_comment_posted') {
          return false;
        }
      } else if (categoryFilter !== 'all' && item.type !== categoryFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [
          item.title,
          item.actorName,
          item.actorContact,
          item.targetName,
          item.summary,
          ...Object.values(item.details || {}).map((v) => String(v || '')),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [activities, categoryFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: activities.length,
      trek_registration: 0,
      voucher_uploaded: 0,
      private_trek_request: 0,
      feedback_submitted: 0,
      mapminers_gpx_uploaded: 0,
      mapminers_map_downloaded: 0,
      mapminers_comment_posted: 0,
      gallery: 0,
    };
    for (const a of activities) {
      counts[a.type] = (counts[a.type] || 0) + 1;
      if (a.type === 'gallery_photo_uploaded' || a.type === 'gallery_comment_posted') {
        counts.gallery++;
      }
    }
    return counts;
  }, [activities]);

  const getTypeStyle = (type: UserActivityType) => {
    switch (type) {
      case 'trek_registration':
        return {
          icon: <Users className="w-4 h-4 text-blue-600" />,
          badge: 'bg-blue-50 text-blue-800 border-blue-200',
          label: 'Trek Registration',
        };
      case 'voucher_uploaded':
        return {
          icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: 'Payment Voucher',
        };
      case 'private_trek_request':
        return {
          icon: <Compass className="w-4 h-4 text-amber-600" />,
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Private Trek Request',
        };
      case 'feedback_submitted':
        return {
          icon: <Star className="w-4 h-4 text-yellow-600 fill-yellow-500" />,
          badge: 'bg-yellow-50 text-yellow-900 border-yellow-200',
          label: 'Hiker Review / Feedback',
        };
      case 'mapminers_gpx_uploaded':
        return {
          icon: <UploadCloud className="w-4 h-4 text-purple-600" />,
          badge: 'bg-purple-50 text-purple-800 border-purple-200',
          label: 'MapMiners GPX Upload',
        };
      case 'mapminers_map_downloaded':
        return {
          icon: <Download className="w-4 h-4 text-sky-600" />,
          badge: 'bg-sky-50 text-sky-800 border-sky-200',
          label: 'MapMiners Download',
        };
      case 'mapminers_comment_posted':
        return {
          icon: <MessageSquare className="w-4 h-4 text-teal-600" />,
          badge: 'bg-teal-50 text-teal-800 border-teal-200',
          label: 'Trail Comment / Condition',
        };
      case 'gallery_photo_uploaded':
        return {
          icon: <Camera className="w-4 h-4 text-rose-600" />,
          badge: 'bg-rose-50 text-rose-800 border-rose-200',
          label: 'Gallery Photo Shared',
        };
      case 'gallery_comment_posted':
        return {
          icon: <MessageSquare className="w-4 h-4 text-pink-600" />,
          badge: 'bg-pink-50 text-pink-800 border-pink-200',
          label: 'Gallery Comment',
        };
    }
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return '';
    try {
      const trimmed = String(iso).trim();
      const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)
        ? `${trimmed.replace(' ', 'T')}Z`
        : trimmed;
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return iso;
      return `${d.toLocaleString('en-US', {
        timeZone: 'Asia/Kathmandu',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })} NPT`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xs border border-[#EFEAE4] overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#F5F2EE] bg-[#FCFAF7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#E08828]/10 border border-[#E08828]/25 flex items-center justify-center rounded-xl shrink-0">
            <Bell className="w-5 h-5 text-[#E08828]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                User Activity &amp; Notifications Feed
              </h2>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E08828] text-white text-[11px] font-black">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              All trek registrations, payment vouchers, private trek requests, hiker reviews, MapMiners GPX uploads/downloads/comments, and gallery updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => loadActivities(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E08828]' : ''}`} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="p-4 bg-[#FAF8F5] border-b border-[#EFEAE4] space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All (${categoryCounts.all || 0})` },
            { id: 'trek_registration', label: `Registrations (${categoryCounts.trek_registration || 0})` },
            { id: 'voucher_uploaded', label: `Vouchers (${categoryCounts.voucher_uploaded || 0})` },
            { id: 'private_trek_request', label: `Private Treks (${categoryCounts.private_trek_request || 0})` },
            { id: 'feedback_submitted', label: `Reviews (${categoryCounts.feedback_submitted || 0})` },
            { id: 'mapminers_gpx_uploaded', label: `GPX Uploads (${categoryCounts.mapminers_gpx_uploaded || 0})` },
            { id: 'mapminers_map_downloaded', label: `Map Downloads (${categoryCounts.mapminers_map_downloaded || 0})` },
            { id: 'mapminers_comment_posted', label: `Trail Comments (${categoryCounts.mapminers_comment_posted || 0})` },
            { id: 'gallery', label: `Gallery (${categoryCounts.gallery || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id as CategoryFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-[#1F1F1F] text-white shadow-2xs'
                  : 'bg-white border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0ECE7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by hiker name, phone, trek, trail, or comment..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#1F1F1F] placeholder:text-[#8B8680] focus:outline-none focus:border-[#7ABA42]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B8680] hover:text-[#1F1F1F] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Activity Feed List */}
      <div className="p-4 sm:p-6 space-y-3">
        {loading && filteredActivities.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-4 rounded-2xl border border-[#E5E1DB] bg-[#FAF8F5] animate-pulse space-y-2">
                <div className="h-4 bg-stone-200 rounded w-1/3" />
                <div className="h-3 bg-stone-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-12 text-center bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E1DB] space-y-2">
            <p className="text-sm font-bold text-[#1F1F1F]">No matching user activities found</p>
            <p className="text-xs text-[#8B8680]">
              New trek registrations, vouchers, reviews, GPX uploads/downloads, trail comments, and gallery posts will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {filteredActivities.slice(0, visibleCount).map((item) => {
              const style = getTypeStyle(item.type);
              const itemTime = new Date(item.createdAt || 0).getTime() || 0;
              const isNew = !lastSeenAt || itemTime > lastSeenAt;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                    isNew
                      ? 'bg-[#FFFDF9] border-[#E08828]/40 shadow-xs'
                      : 'bg-white border-[#E5E1DB] hover:border-[#D5CFC9]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#E5E1DB] flex items-center justify-center shrink-0 mt-0.5">
                      {style.icon}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${style.badge}`}>
                          {style.label}
                        </span>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E08828] text-white text-[9px] font-black uppercase tracking-wider">
                            New
                          </span>
                        )}
                        <span className="text-[11px] text-[#8B8680] font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-[#1F1F1F] leading-snug break-words">
                        {item.summary}
                      </p>

                      {/* Structured Key-Value Details */}
                      {item.details && Object.keys(item.details).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-[#5A5551]">
                          {Object.entries(item.details).map(([k, v]) => {
                            if (v === undefined || v === null || v === '') return null;
                            return (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 bg-[#FAF8F5] border border-[#EFEAE4] px-2 py-0.5 rounded-lg"
                              >
                                <strong className="text-[#1F1F1F]">{k}:</strong>
                                <span className="truncate max-w-[260px]">{String(v)}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions / Thumbnail */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(item.imageUrl!)}
                        className="group relative w-12 h-12 rounded-xl overflow-hidden border border-[#E5E1DB] shadow-2xs shrink-0 cursor-pointer"
                        title="Click to preview image / voucher"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    )}

                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0ECE7] border border-[#E5E1DB] text-[11px] font-bold text-[#1F1F1F] flex items-center gap-1 transition-colors"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {item.actorContact && /^\+?[0-9\s-]{7,}$/.test(item.actorContact) && (
                      <a
                        href={`tel:${item.actorContact}`}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    )}

                    {onNavigateTab && (
                      <>
                        {(item.type === 'trek_registration' ||
                          item.type === 'voucher_uploaded' ||
                          item.type === 'private_trek_request') && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('bookings')}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold text-blue-800 transition-colors cursor-pointer"
                          >
                            View Roster
                          </button>
                        )}
                        {item.type === 'mapminers_gpx_uploaded' && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('maps')}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold text-purple-800 transition-colors cursor-pointer"
                          >
                            Moderate Map
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleCount < filteredActivities.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#FAF8F5] hover:bg-[#F3F0EC] border-2 border-dashed border-[#7ABA42] text-[#1F1F1F] font-extrabold text-xs rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  Show Next 20 Activities ({Math.min(visibleCount, filteredActivities.length)} of {filteredActivities.length} shown) ⬇
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox Modal for Voucher / Gallery Image Preview */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#E5E1DB]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFEAE4] bg-[#FCFAF7]">
              <span className="text-xs font-extrabold text-[#1F1F1F]">Attachment Preview</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E5E1DB] text-[11px] font-bold text-[#1F1F1F] flex items-center gap-1"
                >
                  <span>Full Size</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-stone-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewImageUrl}
                alt="Attachment Preview"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
