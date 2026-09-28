import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Download, MapPin, Share2, Check, ChevronUp, ChevronDown, MessageSquare, Trash2, Send, Bookmark } from 'lucide-react';
import ElevationChart from './ElevationChart';
import { routeToGPX } from './kmlParser';
import { apiFetch } from '../../services/api';

interface RouteDetailProps {
  route: any;
  onClose: () => void;
  isMobile: boolean;
  currentUserEmail?: string;
  isSaved?: boolean;
  onToggleSave?: (id: string, forceSave?: boolean) => void;
}

interface TrailComment {
  id: string;
  trailId: string;
  text: string;
  authorName: string;
  authorEmail: string;
  guestSessionId?: string | null;
  timestamp: number;
}

function getLocalComments(trailId: string): TrailComment[] {
  try {
    const raw = localStorage.getItem(`wnw_comments_${trailId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

function saveLocalComments(trailId: string, list: TrailComment[]) {
  try {
    localStorage.setItem(`wnw_comments_${trailId}`, JSON.stringify(list));
  } catch (_) {}
}

function mergeComments(existing: TrailComment[], incoming: TrailComment[]): TrailComment[] {
  const map = new Map<string, TrailComment>();
  existing.forEach(c => map.set(c.id, c));
  incoming.forEach(c => map.set(c.id, c));
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function formatEstimatedTime(hours: number): string {
  if (typeof hours !== 'number' || Number.isNaN(hours)) return '-';
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `~${h}h`;
  return `~${h}h ${m}m`;
}

export default function RouteDetail({ route, onClose, currentUserEmail, isSaved = false, onToggleSave }: RouteDetailProps) {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'PROFILE' | 'COMMENTS'>('SUMMARY');
  const [shareCopied, setShareCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const handleDownloadOffline = async () => {
    if (!route || typeof caches === 'undefined') return;

    let coordinatesList: any[] = [];
    if (route.coordinates?.length) {
      coordinatesList = route.coordinates;
    } else if (route.lineSegments) {
      coordinatesList = route.lineSegments.flat();
    }

    if (coordinatesList.length === 0) return;

    setDownloadProgress(0);

    const latLngToTile = (lat: number, lng: number, zoom: number) => {
      const latRad = (lat * Math.PI) / 180;
      const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
      const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
      );
      return { x, y };
    };

    try {
      const zooms = [12, 13, 14, 15];
      const tileUrls = new Set<string>();

      const samplingStep = Math.max(1, Math.floor(coordinatesList.length / 40));
      const sampledCoords: any[] = [];
      for (let i = 0; i < coordinatesList.length; i += samplingStep) {
        sampledCoords.push(coordinatesList[i]);
      }
      sampledCoords.push(coordinatesList[coordinatesList.length - 1]);

      sampledCoords.forEach((pt) => {
        if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
          zooms.forEach((zoom) => {
            const { x, y } = latLngToTile(pt.lat, pt.lng, zoom);
            tileUrls.add(`https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
            tileUrls.add(`https://b.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
            tileUrls.add(`https://c.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
            tileUrls.add(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`);
          });
        }
      });

      const urls = Array.from(tileUrls);
      const total = Math.max(1, urls.length);
      let completed = 0;

      const cache = await caches.open('wnw-offline-map-tiles');
      const batchSize = 6;

      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (url) => {
            try {
              const cached = await cache.match(url);
              if (!cached) {
                const res = await fetch(url, { mode: 'cors' });
                if (res.ok) {
                  await cache.put(url, res);
                }
              }
            } catch (_) {}
            completed++;
          })
        );
        setDownloadProgress(Math.round((completed / total) * 100));
      }

      setDownloadProgress(100);
      if (route?.id && onToggleSave) {
        onToggleSave(String(route.id), true);
      }
      setTimeout(() => setDownloadProgress(null), 3000);
    } catch (err) {
      console.warn('Failed offline cache download:', err);
      setDownloadProgress(null);
    }
  };

  // Initialize comments from localStorage cache so UI is instantaneous and resilient
  const [comments, setComments] = useState<TrailComment[]>(() => {
    return route?.id ? getLocalComments(String(route.id)) : [];
  });
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Sync comments from local cache when route changes
  useEffect(() => {
    if (route?.id) {
      setComments(getLocalComments(String(route.id)));
    }
  }, [route.id]);

  // Persist unique guest session ID for comment deletion validations
  const [currentSessionId] = useState(() => {
    let id = localStorage.getItem('chat_guest_session_id');
    if (!id) {
      id = 'gs_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('chat_guest_session_id', id);
    }
    return id;
  });

  // Keep expanded state synchronized with route switches
  useEffect(() => {
    setIsExpanded(false);
    setDownloadProgress(null);
  }, [route.id]);

  // Lazy-load comments ONLY when the COMMENTS tab is selected
  useEffect(() => {
    if (activeTab !== 'COMMENTS' || !route?.id) return;

    let isMounted = true;
    const trailIdStr = String(route.id);
    setLoadingComments(true);

    // 1. Fetch from Cloudflare Worker first
    apiFetch(`mapminers/comments?trailId=${encodeURIComponent(trailIdStr)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (data?.success && Array.isArray(data.comments) && isMounted) {
          setComments((prev) => {
            const merged = mergeComments(prev, data.comments);
            saveLocalComments(trailIdStr, merged);
            return merged;
          });
          setLoadingComments(false);
        }
      })
      .catch((cfErr) => {
        console.info('[MapMiners] Cloudflare comments query notice:', cfErr?.message || cfErr);
      });

    // 2. Resilient sync listener (Cloudflare only now)
    setLoadingComments(false);

    return () => {
      isMounted = false;
    };
  }, [activeTab, route.id]);

  const handleDownloadGPX = (e: React.MouseEvent) => {
    e.stopPropagation();
    const gpxString = routeToGPX(route);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${route.name.toLowerCase().replace(/\s+/g, '-')}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodeURIComponent(route.fileName)}`;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !route?.id) return;

    let authorName = 'Guest Hiker';
    if (currentUserEmail) {
      authorName = currentUserEmail.split('@')[0];
    } else {
      const localGuest = localStorage.getItem('chat_guest_name');
      if (localGuest && localGuest.trim()) {
        authorName = localGuest.trim();
      }
    }

    const trailIdStr = String(route.id);
    const commentId = `tc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newComment: TrailComment = {
      id: commentId,
      trailId: trailIdStr,
      text: commentInput.trim(),
      authorName,
      authorEmail: currentUserEmail || 'guest@walknepal.com',
      guestSessionId: currentUserEmail ? null : currentSessionId,
      timestamp: Date.now()
    };

    // 1. Optimistically display and store in local cache immediately
    setComments((prev) => {
      const updated = [...prev, newComment];
      saveLocalComments(trailIdStr, updated);
      return updated;
    });
    setCommentInput('');

    // 2. Post to Cloudflare Worker backend
    try {
      await apiFetch('mapminers/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment)
      });
    } catch (cfErr) {
      console.info('[MapMiners] Cloudflare comment post notice:', cfErr);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const trailIdStr = String(route.id);

    // 1. Instantly remove from local state and cache
    setComments((prev) => {
      const updated = prev.filter((c) => c.id !== commentId);
      saveLocalComments(trailIdStr, updated);
      return updated;
    });

    // 2. Delete from Cloudflare Worker
    try {
      await apiFetch(`mapminers/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE'
      });
    } catch (_) {}
  };

  // Fallback scenic nature banner image
  const headerBgImage = route?.heroImage || route?.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden flex flex-col w-full max-w-[380px] mx-auto transition-all duration-300">
      
      {/* Top Header Area - Trail Identity & Primary Actions */}
      <div className="p-2.5 px-3 bg-white flex items-center justify-between gap-2 border-b border-neutral-100 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img 
            src={headerBgImage} 
            alt={route.name} 
            className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shadow-3xs shrink-0" 
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-[13px] font-black text-neutral-800 leading-tight truncate">
              {route.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[8.5px] font-black uppercase text-white px-1.5 py-0.5 rounded shrink-0 ${
                route.difficulty === 'Easy' ? 'bg-emerald-500' :
                route.difficulty === 'Moderate' ? 'bg-amber-500' :
                route.difficulty === 'Hard' ? 'bg-red-500' : 'bg-rose-700'
              }`}>
                {route.difficulty}
              </span>

              {route.nearbyCity && (
                <span className="text-[9px] text-neutral-500 font-semibold truncate">
                  • {route.nearbyCity}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Row & Close Button in expected Top-Right position */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(String(route.id));
              }}
              className={`flex items-center gap-1 px-2 py-1.5 min-h-[32px] border font-bold text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer shadow-3xs ${
                isSaved
                  ? 'bg-[#7ABA42]/15 hover:bg-[#7ABA42]/25 border-[#7ABA42]/40 text-[#5C942D]'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
              }`}
              title={isSaved ? 'Saved to My Maps (Click to remove)' : 'Save to My Maps'}
            >
              <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadGPX}
            className="flex items-center gap-1 px-2 py-1.5 min-h-[32px] bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer shadow-3xs"
            title="Export GPS file"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={handleShareRoute}
            className={`flex items-center gap-1 px-2 py-1.5 min-h-[32px] border font-bold text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer shadow-3xs ${
              shareCopied 
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700' 
                : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
            }`}
            title="Copy trail link to share"
          >
            {shareCopied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Share2 className="w-3.5 h-3.5 shrink-0" />}
            <span className="hidden sm:inline">{shareCopied ? 'Copied' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-500 hover:text-neutral-800 transition-all active:scale-95 cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Menu - Placed cleanly below Header */}
      <div className="flex items-center gap-1.5 bg-neutral-50/80 border-b border-neutral-200 px-3 py-1.5 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
        {(['SUMMARY', 'PROFILE', 'COMMENTS'] as const).map((tab) => {
          const isCurrent = activeTab === tab;
          return (
            <button
              type="button"
              key={tab}
              onClick={() => {
                if (isCurrent) {
                  setIsExpanded(!isExpanded);
                } else {
                  setActiveTab(tab);
                  setIsExpanded(true);
                }
              }}
              className={`px-3 py-1.5 min-h-[30px] text-[9.5px] font-black tracking-wider transition-all active:scale-95 rounded-full border uppercase shrink-0 cursor-pointer flex items-center gap-1 ${
                isCurrent && isExpanded
                  ? 'bg-[#7ABA42] border-[#7ABA42] text-white shadow-3xs'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <span>{tab === 'COMMENTS' ? `Comments (${comments.length})` : tab}</span>
              {isCurrent && (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3 shrink-0" />
                ) : (
                  <ChevronUp className="w-3 h-3 shrink-0" />
                )
              )}
            </button>
          );
        })}
      </div>

      {/* Smooth Expandable Content Box */}
      <div 
        className={`transition-all duration-300 ease-in-out bg-neutral-50/50 overflow-hidden ${
          isExpanded ? 'max-h-[180px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="p-3 overflow-y-auto no-scrollbar max-h-[180px] flex flex-col h-full text-neutral-800">
          
          {activeTab === 'SUMMARY' && (
            <div className="space-y-2 animate-in fade-in duration-150 max-h-[160px] overflow-y-auto no-scrollbar">
              {/* Elegant single-row 4-column divider grid */}
              <div className="grid grid-cols-4 bg-white border border-neutral-200 rounded-lg overflow-hidden divide-x divide-neutral-200 text-center shadow-3xs shrink-0">
                {/* Distance */}
                <div className="p-1.5">
                  <span className="text-[7px] uppercase font-black tracking-wider text-neutral-400 block">
                    DIST
                  </span>
                  <span className="text-[11px] font-black text-neutral-800 block mt-0.5">
                    {route.stats.distance}km
                  </span>
                </div>

                {/* Gain */}
                <div className="p-1.5">
                  <span className="text-[7px] uppercase font-black tracking-wider text-neutral-400 block">
                    GAIN
                  </span>
                  <span className="text-[11px] font-black text-emerald-600 block mt-0.5">
                    +{route.stats.elevationGain}m
                  </span>
                </div>

                {/* Loss */}
                <div className="p-1.5">
                  <span className="text-[7px] uppercase font-black tracking-wider text-neutral-400 block">
                    LOSS
                  </span>
                  <span className="text-[11px] font-black text-blue-600 block mt-0.5">
                    -{route.stats.elevationLoss}m
                  </span>
                </div>

                {/* Duration / Time */}
                <div className="p-1.5">
                  <span className="text-[7px] uppercase font-black tracking-wider text-neutral-400 block">
                    TIME
                  </span>
                  <span className="text-[11px] font-black text-[#7ABA42] block mt-0.5">
                    {formatEstimatedTime(route.stats.estimatedHours)}
                  </span>
                </div>
              </div>

              {/* Description/About inline preview */}
              {route.description && (
                <div className="px-1 text-[9px] leading-tight text-neutral-500 line-clamp-2 shrink-0">
                  {route.description}
                </div>
              )}

              {/* Location and Download inside vertical stack */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {(route.district || route.province) && (
                  <div className="flex items-center gap-1.5 text-[8.5px] text-neutral-600 px-2 py-1 bg-white rounded-md border border-neutral-150 shadow-3xs">
                    <MapPin className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                    <span className="truncate font-bold">
                      {route.district && route.district} • {route.province && route.province} region
                    </span>
                  </div>
                )}

                {/* Download Offline Trail Corridor Map */}
                <button
                  type="button"
                  onClick={handleDownloadOffline}
                  disabled={downloadProgress !== null || (!route.isLazyLoaded && !route.isDemo)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 min-h-[34px] border border-[#7ABA42]/30 bg-[#7ABA42]/10 hover:bg-[#7ABA42]/15 active:scale-[0.99] rounded-lg text-[#5C942D] text-[10px] font-black tracking-wide transition-all cursor-pointer shadow-3xs select-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloadProgress === null ? (
                    <>
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {!route.isLazyLoaded && !route.isDemo
                          ? 'Loading Trail Coordinates...'
                          : 'Download Trail Offline Map'}
                      </span>
                    </>
                  ) : downloadProgress === 100 ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700 font-extrabold">Offline Map Saved!</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 border-2 border-[#7ABA42] border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>Downloading Tiles... {downloadProgress}%</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'PROFILE' && (
            <div className="space-y-1 animate-in fade-in duration-150">
              <div className="h-[75px] w-full relative bg-white rounded-lg p-1 border border-neutral-150 shadow-3xs">
                {route.loadError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 text-center px-4">
                    <span className="text-[8px] font-bold">Failed to load route file</span>
                    <span className="text-[7.5px] text-neutral-400 mt-0.5">{route.loadError}</span>
                  </div>
                ) : !route.isLazyLoaded ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-1">
                    <div className="w-4 h-4 border-2 border-[#7ABA42] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[8px]">Loading coordinates...</span>
                  </div>
                ) : (
                  <ElevationChart route={route} />
                )}
              </div>
              
              <div className="flex justify-between items-center text-[7.5px] font-bold text-neutral-500 px-1 pt-0.5 gap-1 shrink-0">
                <span className="truncate">Start: {route.stats.startElevation}m</span>
                <span className="truncate">End: {route.stats.endElevation}m</span>
                <span className="text-emerald-600 truncate flex items-center gap-0.5 font-extrabold"><TrendingUp className="w-2.5 h-2.5" /> Peak: {route.stats.maxElevation}m</span>
                <span className="text-blue-600 truncate flex items-center gap-0.5 font-extrabold"><TrendingDown className="w-2.5 h-2.5" /> Min: {route.stats.minElevation}m</span>
              </div>
            </div>
          )}

          {activeTab === 'COMMENTS' && (
            <div className="flex flex-col h-full space-y-1.5 text-[9px] animate-in fade-in duration-150">
              {/* Comments Stream Viewport with custom thin scrollbar */}
              <div className="flex-1 overflow-y-auto space-y-1.5 p-0.5 max-h-[90px] scrollbar-thin">
                {loadingComments ? (
                  <div className="text-center py-2 text-neutral-400 text-[8px] font-bold">
                    Syncing trail comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-3 text-neutral-400 text-[8px] font-bold flex flex-col items-center justify-center gap-0.5">
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-300" />
                    <span>No Comments Yet</span>
                  </div>
                ) : (
                  comments.map((comm) => {
                    const isMyComment = (currentUserEmail && comm.authorEmail === currentUserEmail) ||
                                        (!currentUserEmail && comm.guestSessionId === currentSessionId);
                    const isAdmin = currentUserEmail === 'walknepalwalk@gmail.com';
                    return (
                      <div key={comm.id} className="p-1.5 bg-white border border-neutral-150 rounded-lg flex items-start justify-between gap-1.5 shadow-3xs">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[7.5px] mb-0.5">
                            <span className="font-extrabold text-neutral-700 truncate max-w-[80px]">
                              {comm.authorName}
                            </span>
                            <span className="text-neutral-400">
                              {new Date(comm.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[8.5px] text-neutral-600 leading-tight break-words">
                            {comm.text}
                          </p>
                        </div>
                        {(isMyComment || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comm.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 active:scale-90 cursor-pointer transition-all shrink-0 self-start"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Post Comment Input */}
              <form onSubmit={handlePostComment} className="flex gap-1.5 pt-1.5 border-t border-neutral-150 shrink-0">
                <input
                  type="text"
                  placeholder="Share notes..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-[10px] font-semibold focus:outline-none focus:border-[#7ABA42] text-neutral-800"
                  maxLength={250}
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#7ABA42] hover:bg-[#6CA838] active:scale-95 text-white rounded-lg transition-all cursor-pointer shadow-3xs shrink-0 flex items-center justify-center min-h-[28px]"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
