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

type TimeFilter = 'all' | 'today' | 'week' | 'month';

export const UserActivityNotificationsPanel: React.FC<UserActivityNotificationsPanelProps> = ({
  onNavigateTab,
  onUnreadCountChange,
}) => {
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
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
  }, [categoryFilter, searchQuery, timeFilter]);

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

      if (timeFilter !== 'all') {
        const trimmed = String(item.createdAt || '').trim();
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)
          ? `${trimmed.replace(' ', 'T')}Z`
          : trimmed;
        const itemTime = new Date(normalized).getTime() || 0;
        const now = new Date();

        if (timeFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (itemTime < startOfToday) return false;
        } else if (timeFilter === 'week') {
          const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (itemTime < sevenDaysAgo) return false;
        } else if (timeFilter === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          if (itemTime < startOfMonth) return false;
        }
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
  }, [activities, categoryFilter, timeFilter, searchQuery]);

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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hiker name, phone, trek, trail, or comment..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#1F1F1F] placeholder:text-[#8B8680] focus:outline-none focus:border-[#7ABA42]"
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

          {/* Time Filter Buttons: Today, This Week, This Month, All Time */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setTimeFilter(btn.id as TimeFilter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  timeFilter === btn.id
                    ? 'bg-[#1F1F1F] text-white shadow-2xs'
                    : 'bg-white border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0ECE7]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed Table */}
      <div className="overflow-x-auto">
        {loading && filteredActivities.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-4 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] animate-pulse space-y-2">
                <div className="h-4 bg-stone-200 rounded w-1/4" />
                <div className="h-3 bg-stone-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-12 px-4 text-center bg-[#FAF8F5] m-4 rounded-2xl border border-dashed border-[#E5E1DB] space-y-2">
            <p className="text-sm font-bold text-[#1F1F1F]">No matching user activities found</p>
            <p className="text-xs text-[#8B8680]">
              New trek registrations, vouchers, reviews, GPX uploads/downloads, trail comments, and gallery posts will appear here automatically.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E5E1DB] text-[10px] font-semibold text-[#6B6560] uppercase tracking-wider">
                <th className="py-1.5 px-2.5 whitespace-nowrap">Activity Type</th>
                <th className="py-1.5 px-2 whitespace-nowrap text-center">Status</th>
                <th className="py-1.5 px-2.5 whitespace-nowrap">Date &amp; Time</th>
                <th className="py-1.5 px-2.5 whitespace-nowrap">Hiker</th>
                <th className="py-1.5 px-2.5 whitespace-nowrap">Trek</th>
                <th className="py-1.5 px-2 whitespace-nowrap text-center">Group Size</th>
                <th className="py-1.5 px-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEAE4]">
              {filteredActivities.slice(0, visibleCount).map((item) => {
                const style = getTypeStyle(item.type);
                const itemTime = new Date(item.createdAt || 0).getTime() || 0;
                const isNew = !lastSeenAt || itemTime > lastSeenAt;

                const hikerName = String(
                  item.details?.Hiker ||
                  item.details?.User ||
                  item.details?.Contributor ||
                  item.actorName ||
                  '-'
                );

                const trekVal = String(
                  item.details?.Trek ||
                  item.details?.Destination ||
                  item.targetName ||
                  '-'
                );

                const groupSizeVal = String(
                  item.details?.['Group Size'] ||
                  (item.details?.Pax ? `${item.details.Pax} Pax` : '') ||
                  (item.summary.match(/\((\d+\s*Pax)\)/i)?.[1]) ||
                  '-'
                );

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-[#FAF8F5] ${
                      isNew ? 'bg-[#FFFDF9]' : 'bg-white'
                    }`}
                  >
                    {/* Activity Type */}
                    <td className="py-1.5 px-2.5 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E5E1DB] flex items-center justify-center shrink-0">
                          {React.cloneElement(style.icon, { className: 'w-2.5 h-2.5' })}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-1.5 px-2 align-middle text-center whitespace-nowrap">
                      {isNew ? (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#E08828] text-white text-[8px] font-medium tracking-wide">
                          New
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8B8680] font-normal">
                          Seen
                        </span>
                      )}
                    </td>

                    {/* Date & Time */}
                    <td className="py-1.5 px-2.5 align-middle whitespace-nowrap text-[#6B6560] font-normal text-[10px]">
                      {formatDateTime(item.createdAt)}
                    </td>

                    {/* Hiker */}
                    <td className="py-1.5 px-2.5 align-middle font-medium text-[#1F1F1F] whitespace-nowrap">
                      {hikerName}
                    </td>

                    {/* Trek */}
                    <td className="py-1.5 px-2.5 align-middle font-normal text-[#1F1F1F] whitespace-nowrap">
                      {trekVal}
                    </td>

                    {/* Group Size */}
                    <td className="py-1.5 px-2 align-middle text-center whitespace-nowrap">
                      {groupSizeVal !== '-' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E5E1DB] text-[10px] font-normal text-[#4A4541]">
                          {groupSizeVal}
                        </span>
                      ) : (
                        <span className="text-[#8B8680] font-normal">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-1.5 px-2.5 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {item.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(item.imageUrl!)}
                            className="group relative w-5 h-5 rounded overflow-hidden border border-[#E5E1DB] shadow-2xs shrink-0 cursor-pointer"
                            title="Preview Attachment / Voucher"
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
                            className="px-1.5 py-0.5 rounded bg-[#FAF8F5] hover:bg-[#F0ECE7] border border-[#E5E1DB] text-[9px] font-normal text-[#1F1F1F] flex items-center gap-0.5 transition-colors"
                            title="Open external link"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>Link</span>
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
                                className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[9px] font-medium text-blue-800 transition-colors cursor-pointer"
                              >
                                View Roster
                              </button>
                            )}
                            {item.type === 'mapminers_gpx_uploaded' && (
                              <button
                                type="button"
                                onClick={() => onNavigateTab('maps')}
                                className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[9px] font-medium text-purple-800 transition-colors cursor-pointer"
                              >
                                Moderate Map
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {visibleCount < filteredActivities.length && (
        <div className="p-4 border-t border-[#EFEAE4] bg-[#FAF8F5] text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 20)}
            className="w-full sm:w-auto px-6 py-2 bg-white hover:bg-[#F3F0EC] border-2 border-dashed border-[#7ABA42] text-[#1F1F1F] font-extrabold text-xs rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            Show Next 20 Activities ({Math.min(visibleCount, filteredActivities.length)} of {filteredActivities.length} shown) ⬇
          </button>
        </div>
      )}

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
