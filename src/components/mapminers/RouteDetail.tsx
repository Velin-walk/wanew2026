import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Download, MapPin, Flag, Share2, Check, ChevronUp, ChevronDown, MessageSquare, Trash2, Send } from 'lucide-react';
import ElevationChart from './ElevationChart';
import { routeToGPX } from './kmlParser';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { apiFetch } from '../../services/api';

interface RouteDetailProps {
  route: any;
  onClose: () => void;
  isMobile: boolean;
  currentUserEmail?: string;
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

function buildAboutParagraphs(text: string): string[] {
  if (!text) return [];
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?/g) || [text.trim()];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length && paragraphs.length < 3; i += 2) {
    paragraphs.push(`${(sentences[i] || '').trim()} ${(sentences[i + 1] || '').trim()}`.trim());
  }
  return paragraphs.filter(Boolean);
}

function getHighlights(route: any): string[] {
  const chips: string[] = [];
  const difficulty = String(route?.difficulty || '').toLowerCase();
  const text = `${route?.description || ''} ${route?.highlights || ''}`.toLowerCase();

  if (difficulty === 'easy' || difficulty === 'moderate') chips.push('Beginner Friendly');
  if (text.includes('family') || text.includes('kids')) chips.push('Family Friendly');
  if (text.includes('transport') || text.includes('bus') || text.includes('jeep')) {
    chips.push('Transit available');
  }
  if (chips.length === 0 && (route?.stats?.distance || 0) <= 15) chips.push('Great Half-day Hike');

  return chips.slice(0, 3);
}

function maskEmail(email: string): string {
  if (!email) return '';
  const [localPart, domainPart] = String(email).split('@');
  if (!domainPart) return email;

  const visibleChars = localPart.length > 2 ? localPart.slice(0, 2) : localPart.slice(0);
  const maskedChars = '*'.repeat(Math.max(4, localPart.length - visibleChars.length));
  return `${visibleChars}${maskedChars}@${domainPart}`;
}

export default function RouteDetail({ route, onClose, isMobile, currentUserEmail }: RouteDetailProps) {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'PROFILE' | 'MORE' | 'COMMENTS'>('SUMMARY');
  const [shareCopied, setShareCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const highlightChips = getHighlights(route);
  const aboutParagraphs = buildAboutParagraphs(route?.description || '');

  // Keep expanded state synchronized with route switches
  useEffect(() => {
    setIsExpanded(false);
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

    // 2. Resilient Firestore sync listener (gracefully handles free tier quota limits)
    let unsubscribe: (() => void) | null = null;
    try {
      const q = query(
        collection(db, 'trail_comments'),
        where('trailId', '==', trailIdStr)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const list: TrailComment[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              trailId: data.trailId || '',
              text: data.text || '',
              authorName: data.authorName || 'Anonymous',
              authorEmail: data.authorEmail || '',
              guestSessionId: data.guestSessionId || null,
              timestamp: data.timestamp || Date.now()
            });
          });
          setComments((prev) => {
            const merged = mergeComments(prev, list);
            saveLocalComments(trailIdStr, merged);
            return merged;
          });
          setLoadingComments(false);
        },
        (err) => {
          // Gracefully absorb Firestore quota / offline limits without throwing console.error
          const isQuota = err?.code === 'resource-exhausted' || String(err?.message || '').toLowerCase().includes('quota');
          if (isQuota) {
            console.info('[MapMiners] Firestore comment read quota reached; using Cloudflare & local storage cache.');
          } else {
            console.info('[MapMiners] Firestore comments listener notice:', err?.message || err);
          }
          if (isMounted) setLoadingComments(false);
        }
      );
    } catch (fsInitErr) {
      console.info('[MapMiners] Firestore comments listener init notice:', fsInitErr);
      if (isMounted) setLoadingComments(false);
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
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

  const handleTabClick = (tab: 'SUMMARY' | 'PROFILE' | 'MORE' | 'COMMENTS') => {
    setActiveTab(tab);
    setIsExpanded(true); // Auto expand when user clicks any tab
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
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

    // 3. Resiliently sync to Firestore if quota permits, ignoring quota errors
    try {
      await addDoc(collection(db, 'trail_comments'), {
        trailId: newComment.trailId,
        text: newComment.text,
        authorName: newComment.authorName,
        authorEmail: newComment.authorEmail,
        guestSessionId: newComment.guestSessionId,
        timestamp: newComment.timestamp
      });
    } catch (fsErr: any) {
      console.info('[MapMiners] Note: Comment saved locally; Firestore sync was deferred (quota/offline).');
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

    // 3. Resiliently delete from Firestore
    try {
      await deleteDoc(doc(db, 'trail_comments', commentId));
    } catch (err) {
      console.info('[MapMiners] Firestore delete notice:', err);
    }
  };

  // Fallback scenic nature banner image
  const headerBgImage = route?.heroImage || route?.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="bg-white border border-neutral-200 rounded-t-xl md:rounded-xl shadow-xl overflow-hidden flex flex-col w-full max-w-[410px] mx-auto transition-all duration-300">
      
      {/* Tap/Click to expand top handle area */}
      <div 
        onClick={toggleExpand}
        className="flex flex-col justify-center items-center py-1 cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors shrink-0"
        title={isExpanded ? "Click to collapse" : "Click to expand details"}
      >
        <div className="w-8 h-1 bg-neutral-200 rounded-full mb-0.5" />
        <div className="text-[8px] text-neutral-400 font-bold tracking-wider flex items-center gap-0.5">
          {isExpanded ? (
            <>
              <span>COLLAPSE</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#7ABA42]" />
            </>
          ) : (
            <>
              <span>EXPAND TRAIL INFORMATION</span>
              <ChevronUp className="w-2.5 h-2.5 text-[#7ABA42]" />
            </>
          )}
        </div>
      </div>

      {/* Hero Header Area */}
      <div 
        className="h-[75px] bg-cover bg-center relative shrink-0"
        style={{ backgroundImage: `url(${headerBgImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />
        
        <div className="absolute bottom-2.5 left-3.5 right-3.5 flex justify-between items-end gap-3 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-black text-white leading-tight tracking-tight drop-shadow-sm truncate">
              {route.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[8px] font-black uppercase text-white px-1.5 py-0.2 rounded ${
                route.difficulty === 'Easy' ? 'bg-emerald-500' :
                route.difficulty === 'Moderate' ? 'bg-amber-500' :
                route.difficulty === 'Hard' ? 'bg-red-500' : 'bg-rose-700'
              }`}>
                {route.difficulty}
              </span>

              {route.nearbyCity && (
                <span className="text-[8px] text-neutral-300 font-semibold truncate">
                  • {route.nearbyCity}
                </span>
              )}
            </div>
          </div>

          {/* Action Row & Close */}
          <div className="flex items-center gap-1 shrink-0 self-start">
            <button
              onClick={handleDownloadGPX}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-500 hover:bg-sky-600 border border-sky-400 text-white font-bold text-[8px] rounded shadow-xs cursor-pointer"
              title="Export GPS file"
            >
              <Download className="w-2 h-2" />
              <span>Export</span>
            </button>

            <button
              onClick={handleShareRoute}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 border font-bold text-[8px] rounded shadow-xs cursor-pointer text-white ${
                shareCopied 
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500'
              }`}
              title="Copy trail link to share"
            >
              {shareCopied ? <Check className="w-2 h-2" /> : <Share2 className="w-2 h-2" />}
              <span>{shareCopied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 bg-black/60 hover:bg-black/80 border border-white/10 rounded text-white transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex justify-center items-center gap-5 border-b border-neutral-100 bg-white px-3 pt-2 shrink-0">
        {(['SUMMARY', 'PROFILE', 'MORE', 'COMMENTS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`pb-1.5 text-[8.5px] font-bold tracking-wider transition-all border-b-2 uppercase ${
              activeTab === tab 
                ? 'border-[#7ABA42] text-[#7ABA42]' 
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {tab === 'COMMENTS' ? `Comments (${comments.length})` : tab}
          </button>
        ))}
      </div>

      {/* Smooth Expandable Content Box */}
      <div 
        className={`transition-all duration-300 ease-in-out bg-white overflow-hidden ${
          isExpanded ? 'max-h-[250px] opacity-100 border-t border-neutral-50' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="p-2 overflow-y-auto no-scrollbar max-h-[250px] flex flex-col h-full">
          
          {activeTab === 'SUMMARY' && (
            <div className="space-y-2">
              {/* Divider grid perfectly matching references */}
              <div className="grid grid-cols-2 bg-white border border-neutral-200 rounded-lg overflow-hidden divide-x divide-y divide-neutral-200">
                
                {/* Distance */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    DISTANCE
                  </span>
                  <span className="text-xs font-bold text-neutral-800 block mt-0.5">
                    {route.stats.distance}km
                  </span>
                </div>

                {/* Gain */}
                <div className="p-2 !border-t-0">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    GAIN
                  </span>
                  <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                    +{route.stats.elevationGain}m
                  </span>
                </div>

                {/* Loss */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    LOSS
                  </span>
                  <span className="text-xs font-bold text-blue-600 block mt-0.5">
                    -{route.stats.elevationLoss}m
                  </span>
                </div>

                {/* Duration / Time */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    TIME
                  </span>
                  <span className="text-xs font-bold text-[#7ABA42] block mt-0.5">
                    {formatEstimatedTime(route.stats.estimatedHours)}
                  </span>
                </div>

              </div>

              {/* Region location details bar */}
              {(route.district || route.province) && (
                <div className="flex items-center gap-1.5 text-[8.5px] text-neutral-500 px-1 bg-neutral-50 py-1 rounded-lg border border-neutral-100">
                  <MapPin className="w-2.5 h-2.5 text-neutral-400 shrink-0 ml-0.5" />
                  <span className="truncate font-semibold text-[8.5px]">
                    {route.district && route.district} • {route.province && route.province} region
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'PROFILE' && (
            <div className="space-y-1.5">
              <div className="h-[90px] w-full relative">
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
              
              <div className="flex justify-between text-[8px] font-bold text-neutral-500 px-1 pt-1 border-t border-neutral-100">
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                  <span>Peak: {route.stats.maxElevation}m</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <TrendingDown className="w-2.5 h-2.5 text-blue-500" />
                  <span>Min: {route.stats.minElevation}m</span>
                </span>
              </div>
            </div>
          )}

          {activeTab === 'MORE' && (
            <div className="space-y-2 text-[10px]">
              {/* Elevation range */}
              <div className="grid grid-cols-2 gap-1">
                <div className="p-1 bg-neutral-50 rounded border border-neutral-100 text-center">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block">Start Elev</span>
                  <span className="text-[10px] font-bold text-neutral-700 font-mono mt-0.5 block">{route.stats.startElevation}m</span>
                </div>
                <div className="p-1 bg-neutral-50 rounded border border-neutral-100 text-center">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block">End Elev</span>
                  <span className="text-[10px] font-bold text-neutral-700 font-mono mt-0.5 block">{route.stats.endElevation}m</span>
                </div>
              </div>

              {/* Google Maps trailhead navigator */}
              {route.isLazyLoaded && route.waypoints && route.waypoints.length >= 2 && (
                <div className="grid grid-cols-2 gap-1 shrink-0">
                  <a
                    href={`https://www.google.com/maps?q=${route.waypoints[0].lat},${route.waypoints[0].lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-0.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8px] font-bold rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <MapPin size={9} />
                    <span>Start GPS</span>
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${route.waypoints[route.waypoints.length - 1].lat},${route.waypoints[route.waypoints.length - 1].lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-0.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-bold rounded hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <Flag size={9} />
                    <span>End GPS</span>
                  </a>
                </div>
              )}

              {/* Description/About */}
              {route.description && (
                <div className="p-1.5 bg-neutral-50 rounded-lg border border-neutral-150">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">About Trail</span>
                  {highlightChips.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mb-1">
                      {highlightChips.map((chip) => (
                        <span key={chip} className="text-[7.5px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-full px-1 py-0.2">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                  {aboutParagraphs.map((p, idx) => (
                    <p key={idx} className="text-[9px] text-neutral-600 leading-relaxed mb-0.5 last:mb-0">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {/* Contributor credentials block */}
              {route.contributorName && (
                <div className="p-1.5 bg-amber-50/40 border border-amber-200/40 rounded-lg flex items-center justify-between text-[9px]">
                  <div>
                    <span className="text-[7.5px] text-amber-600 font-bold uppercase tracking-wider block">CONTRIBUTOR</span>
                    <span className="font-bold text-neutral-700 mt-0.5 block">{route.contributorName}</span>
                  </div>
                  {route.contributorEmail && (
                    <span className="text-[8px] font-mono text-neutral-500 bg-white/60 border border-amber-200/30 px-1 py-0.2 rounded">
                      {maskEmail(route.contributorEmail)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'COMMENTS' && (
            <div className="flex flex-col h-full space-y-2 text-[10px]">
              {/* Comments Stream Viewport */}
              <div className="flex-1 overflow-y-auto space-y-2 p-1 max-h-[145px] scrollbar-thin">
                {loadingComments ? (
                  <div className="text-center py-4 text-neutral-400 text-[9px] font-bold">
                    Syncing trail comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-[9px] font-bold flex flex-col items-center justify-center gap-1">
                    <MessageSquare className="w-5 h-5 text-neutral-300" />
                    <span>No Comments Yet</span>
                    <span className="text-[8px] text-neutral-400">Be the first to share your notes!</span>
                  </div>
                ) : (
                  comments.map((comm) => {
                    const isMyComment = (currentUserEmail && comm.authorEmail === currentUserEmail) ||
                                        (!currentUserEmail && comm.guestSessionId === currentSessionId);
                    const isAdmin = currentUserEmail === 'walknepalwalk@gmail.com';
                    return (
                      <div key={comm.id} className="p-2 bg-neutral-50 border border-neutral-150 rounded-xl flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 text-[8.5px]">
                            <span className="font-extrabold text-neutral-700 truncate max-w-[100px]">
                              {comm.authorName}
                            </span>
                            <span className="text-neutral-400">
                              {new Date(comm.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-neutral-600 leading-relaxed break-words">
                            {comm.text}
                          </p>
                        </div>
                        {(isMyComment || isAdmin) && (
                          <button
                            onClick={() => handleDeleteComment(comm.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer transition-colors shrink-0 self-start"
                            title="Delete comment"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Post Comment Input */}
              <form onSubmit={handlePostComment} className="flex gap-1.5 pt-1.5 border-t border-neutral-100 shrink-0">
                <input
                  type="text"
                  placeholder="Share notes, tips, coordinates..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  className="flex-1 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[9px] font-semibold focus:bg-white focus:outline-none focus:border-[#7ABA42] text-neutral-800"
                  maxLength={250}
                  required
                />
                <button
                  type="submit"
                  className="p-2 bg-[#7ABA42] hover:bg-[#6CA838] text-white rounded-lg transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center min-h-[28px]"
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


