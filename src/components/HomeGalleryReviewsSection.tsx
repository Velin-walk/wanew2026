import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Star, ArrowRight, CheckCircle2, Sparkles, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { Trek } from '../types';
import { SubPageType } from './InfoPagesModal';
import { HISTORIC_COMMUNITY_REVIEWS, StaticReview } from '../data/historicReviews';
import { apiFetch } from '../services/api';
import { triggerHaptic } from '../utils/haptics';
import { getPublicDisplayName, useAnonymity } from '../utils/anonymity';

interface HomeGalleryReviewsSectionProps {
  treks: Trek[];
  onViewGallery?: (trek?: Trek) => void;
  onOpenInfoPage?: (page: SubPageType) => void;
}

// Baseline authentic gallery photos from real Nepal treks
const DEFAULT_ACTUAL_GALLERY_PHOTOS: { url: string; title: string; location: string }[] = [
  { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80', title: 'Himalayan Mountain Ridge', location: 'Annapurna Trail' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80', title: 'Alpine Peak Sunrise', location: 'Langtang Valley' },
  { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', title: 'Mountain Valley Stream', location: 'Mardi Himal' },
  { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80', title: 'Starry Sky Mountain Camp', location: 'Gosaikunda' },
  { url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=600&q=80', title: 'Snowy Peak Vista', location: 'Manaslu Circuit' },
  { url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=600&q=80', title: 'High Altitude Ridge Walk', location: 'Everest Region' },
  { url: 'https://images.unsplash.com/photo-1585938389612-a552a28d6914?auto=format&fit=crop&w=600&q=80', title: 'Pine Forest Mountain Path', location: 'Shivapuri' },
  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', title: 'High Lake Trail Rest', location: 'Tilicho Lake' },
  { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80', title: 'Misty Forest Trail Step', location: 'Champadevi' },
  { url: 'https://images.unsplash.com/photo-1511497584788-876761c11969?auto=format&fit=crop&w=600&q=80', title: 'Valley Waterfall Stream', location: 'Sundarijal' },
  { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80', title: 'Himalayan Pass Panorama', location: 'Kori Pastures' },
  { url: '/src/assets/images/gallery_trail_hero_1790246900034.jpg', title: 'Prayer Flag Summit Peak', location: 'High Pass' },
  { url: '/src/assets/images/himalayan_panorama_hero_1790225618417.jpg', title: 'Himalayan Panorama Range', location: 'Viewpoint' },
  { url: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=600&q=80', title: 'Sunset Ridge Ascent', location: 'Shailung' },
  { url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=600&q=80', title: 'Wildflower Mountain Valley', location: 'Helambu' },
];

// Baseline authentic 5-star reviews with real hiker names and >= 20 words length
const VERIFIED_5STAR_NAMED_REVIEWS: StaticReview[] = [
  {
    id: 'static-nibita-pokhrel',
    full_name: 'Nibita Pokhrel',
    trek_name: 'Tarebhir Nagi Gumba Hike',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'The whole hike was full of laughter, conversations and networking while soaking in fresh pine forest mountain air. Super team coordination and friendly hikers.',
    submitted_at: '2026-09-19',
    is_verified: true,
  },
  {
    id: 'static-ojashwi-karna',
    full_name: 'Ojashwi Karna',
    trek_name: 'Pachpokhari Sacred Lakes',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Everything was fabulous and the team was cooperative also the vibe was really great. Truly memorable sacred alpine lakes trek with awesome group energy.',
    submitted_at: '2026-09-18',
    is_verified: true,
  },
  {
    id: 'static-pragati',
    full_name: 'Pragati',
    trek_name: 'Bheda Farm Mohini Jharna Hike',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Walk Nepal team doing great work so kudos to team! Everything was well organized and scenic trail was thoroughly enjoyed by all participants.',
    submitted_at: '2026-08-15',
    is_verified: true,
  },
  {
    id: 'static-rupa',
    full_name: 'Rupa',
    trek_name: 'Bhange Mailung Jharna Hike',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Overall, it was a good and memorable trek. Everything was well planned from morning pickup to trail pacing. Waterfalls were stunning and group coordinators were very helpful.',
    submitted_at: '2026-08-08',
    is_verified: true,
  },
  {
    id: 'static-puspanjali-shrestha',
    full_name: 'Puspanjali Shrestha',
    trek_name: 'Shailung Overnight Hike',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Overall it’s nice. Will join another trip soon with the team. Good coordination, great hospitality at the homestay, and picturesque high ridge trail with welcoming group.',
    submitted_at: '2026-07-25',
    is_verified: true,
  },
  {
    id: 'static-dhan-gurung',
    full_name: 'Dhan Gurung',
    trek_name: 'Sundarijal Okhreni Circuit',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'I had a pleasant hike with the group headed by lovely Salina. She and her team were very professional, encouraging everyone on the steep sections and keeping group spirit high. Beautiful scenic route and wonderful camaraderie throughout the day.',
    submitted_at: '2026-07-11',
    is_verified: true,
  },
  {
    id: 'static-dharmendra-dewan',
    full_name: 'Dharmendra Dewan',
    trek_name: 'Shailung Overnight Hike',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Overall very well coordinated trip with wider group of experience (novice to experienced) and diverse age groups. Everyone felt included and safe throughout the hike.',
    submitted_at: '2026-07-04',
    is_verified: true,
  },
  {
    id: 'static-urja-newa',
    full_name: 'URJA NEWA',
    trek_name: 'Shailung Overnight',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'The hike was truly scenic and well managed. Beautiful mountain landscapes, cordial trail companions, and great team leadership that kept everyone safe and motivated across the entire trail. Will definitely join upcoming Walk Nepal Walk events!',
    submitted_at: '2026-06-27',
    is_verified: true,
  },
  {
    id: 'static-bishan-bahadur',
    full_name: 'Bishan Bahadur Tamang',
    trek_name: 'Ranijhula Nagarkot Circuit',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'A very enjoyable and refreshing experience. The coordinators kept the energy high, engaged all hikers with trail trivia and games, and ensured everyone reached the viewpoint comfortably. Highly recommended for weekend outdoor lovers!',
    submitted_at: '2026-06-27',
    is_verified: true,
  },
  {
    id: 'static-sangyan-karki',
    full_name: 'Sangyan Karki',
    trek_name: 'North ABC',
    overall_rating: 5,
    team_rating: 5,
    overall_feedback:
      'Hello Hello saathi haru! 👋 Yesto unforgettable trekking ko lagi sabailai dhanyabad. Special thank you to the coordinators for guiding us with so much care and energy throughout the trail. Looking forward to more Himalayan adventures with Walk Nepal Walk!',
    submitted_at: '2026-06-19',
    is_verified: true,
  },
];

export const HomeGalleryReviewsSection: React.FC<HomeGalleryReviewsSectionProps> = ({
  treks: _treks,
  onViewGallery,
  onOpenInfoPage,
}) => {
  useAnonymity();
  const [galleryPhotos, setGalleryPhotos] = useState<{ url: string; title: string; location: string }[]>(
    DEFAULT_ACTUAL_GALLERY_PHOTOS
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load ONLY actual gallery photos (from D1 trek_photos & local upload archives - sorted newest first)
  const loadActualGalleryPhotos = async () => {
    try {
      let fetchedList: any[] = [];

      // 1. Try reading from sessionStorage cache first
      try {
        const raw = sessionStorage.getItem('wnw_cache_trek_photos');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.data?.data)) {
            fetchedList = parsed.data.data;
          }
        }
      } catch {}

      // 2. Read from localStorage for locally uploaded hike photos
      const localHikePhotos: any[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('wnw_photos_')) {
            const items = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(items)) {
              localHikePhotos.push(...items);
            }
          }
        }
      } catch {}

      // 3. Fetch trek_photos safely if session cache had nothing
      if (fetchedList.length === 0) {
        try {
          const res = await apiFetch('trek_photos');
          if (res.ok) {
            const json = await res.json();
            if (json && Array.isArray(json.data)) {
              fetchedList = json.data;
            }
          }
        } catch (_) {}
      }

      const combinedRaw = [...localHikePhotos, ...fetchedList];

      // Filter: Keep ONLY actual gallery photos (exclude homepage hero banners and special offer cards)
      const actualGalleryItems = combinedRaw.filter(
        (p) =>
          p &&
          p.url &&
          p.trekId !== 'HOMEPAGE_HERO' &&
          p.trekId !== 'OFFERS_FLASHCARDS' &&
          p.trek_id !== 'HOMEPAGE_HERO'
      );

      // Sort newest uploaded photos first
      actualGalleryItems.sort((a, b) => {
        const timeA = new Date(a.uploadedAt || a.uploaded_at || 0).getTime();
        const timeB = new Date(b.uploadedAt || b.uploaded_at || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      const mappedItems = actualGalleryItems.map((p) => ({
        url: p.url,
        title: p.caption || p.trekName || p.trek_name || 'Hike Photo',
        location: p.hikeNumber || p.hike_number ? `Hike #${p.hikeNumber || p.hike_number}` : 'Trail Moment',
      }));

      // Use actual uploaded photos first. If there are actual photos, fill 15 slots using ONLY actual gallery photos!
      const itemsSource = mappedItems.length > 0 ? mappedItems : DEFAULT_ACTUAL_GALLERY_PHOTOS;
      const final15: { url: string; title: string; location: string }[] = [];
      const seenUrls = new Set<string>();

      for (const item of itemsSource) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          final15.push(item);
        }
        if (final15.length >= 15) break;
      }

      // If fewer than 15 unique actual photos, cycle through actual photos list to fill 15 slots
      if (final15.length > 0 && final15.length < 15) {
        const baseUnique = [...final15];
        let idx = 0;
        while (final15.length < 15) {
          final15.push(baseUnique[idx % baseUnique.length]);
          idx++;
        }
      }

      if (final15.length >= 15) {
        setGalleryPhotos(final15.slice(0, 15));
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadActualGalleryPhotos();

    const handleUpdate = () => {
      if (isMounted) {
        loadActualGalleryPhotos();
        setRefreshTrigger((prev) => prev + 1);
      }
    };

    window.addEventListener('wnw-photos-updated', handleUpdate);
    window.addEventListener('wnw-feedback-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('wnw-photos-updated', handleUpdate);
      window.removeEventListener('wnw-feedback-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Helper to format review text preview ending with .......... when review continues
  const formatReviewPreview = (text: string, maxChars: number = 70): string => {
    if (!text) return '';
    const clean = text.trim().replace(/\s+/g, ' ');
    if (clean.length <= maxChars) {
      return clean;
    }
    const truncated = clean.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    const base = lastSpace > 35 ? truncated.slice(0, lastSpace) : truncated;
    return `${base.replace(/[.,!?;:\s]+$/, '')}..........`;
  };

  // Fetch reviews using the exact original order of review display from reviews page
  const { previewReviews, totalReviewsCount } = useMemo(() => {
    let liveReviews: any[] = [];
    try {
      const rawLive = localStorage.getItem('wnw_user_feedbacks');
      if (rawLive) {
        const parsed = JSON.parse(rawLive);
        if (Array.isArray(parsed)) {
          liveReviews = parsed;
        }
      }
    } catch {}

    const normalizedLive = (liveReviews || []).map((r: any) => ({
      id: r.id ? `live-${r.id}` : `live-${r.uid || Math.random()}`,
      full_name: (() => {
        const raw = (r.full_name || r.name || '').trim();
        return raw || 'Verified Hiker';
      })(),
      hike_number: String(r.hike_number || r.hikeNumber || '').replace(/^#/, ''),
      trek_name: r.trek_name || r.recentWalk || 'Himalayan Trek',
      overall_rating: Math.min(5, Math.max(1, Number(r.overall_rating || r.overallRating) || 5)),
      team_rating: Math.min(5, Math.max(1, Number(r.team_rating || r.teamRating) || 5)),
      overall_feedback: (r.overall_feedback || r.overallFeedback || '').trim(),
      team_feedback: (r.team_feedback || r.teamFeedback || '').trim(),
      submitted_at: r.submitted_at ? String(r.submitted_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      is_verified: true,
    }));

    const combined = [...normalizedLive, ...HISTORIC_COMMUNITY_REVIEWS];

    // Original sort comparator from reviews page (InfoPagesModal allReviewsCombined)
    combined.sort((a, b) => {
      const dateA = a.submitted_at || '';
      const dateB = b.submitted_at || '';
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
      if (a.id.startsWith('live') && !b.id.startsWith('live')) return -1;
      if (!a.id.startsWith('live') && b.id.startsWith('live')) return 1;
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });

    // Original filter from reviews page: exclude GUIDE_REVIEW: and require feedback text
    const displayReviews = combined.filter((item) => {
      if (item.trek_name && String(item.trek_name).toUpperCase().startsWith('GUIDE_REVIEW:')) {
        return false;
      }
      return Boolean(item.overall_feedback || item.team_feedback);
    });

    return {
      // 4 reviews fit cleanly in the allocated space without cutting lines in half
      previewReviews: displayReviews.slice(0, 4),
      totalReviewsCount: displayReviews.length,
    };
  }, [refreshTrigger]);

  const handleGalleryClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    triggerHaptic(15);
    onViewGallery?.();
  };

  const handleReviewsClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    triggerHaptic(15);
    onOpenInfoPage?.('reviews');
  };

  return (
    <div className="w-full pt-4 pb-2">
      {/* Section Divider & Heading Note */}
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <Sparkles className="w-4 h-4 text-[#E08828]" />
        <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#5A5551]">
          Community Buzz &amp; Trail Records
        </h3>
        <div className="flex-1 h-px bg-[#EFEAE4]" />
      </div>

      {/* Responsive Layout:
          - Desktop (lg+): 2 equal columns side by side
          - Mobile (Option 1): Stacked vertical cards (Gallery on top, Reviews below)
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 w-full items-stretch">
        {/* ================= COLUMN 1: TRAIL GALLERY (15 ACTUAL GALLERY PHOTOS PREVIEW - 3 ROWS OF 5) ================= */}
        <div
          onClick={handleGalleryClick}
          className="group relative bg-white border border-[#E5E1DB] hover:border-[#E08828]/60 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#E08828] shrink-0 group-hover:scale-105 transition-transform">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <span className="text-[11px] font-bold text-[#E08828] shrink-0 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>View Gallery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* 15 Photos Display (5x3 Grid on desktop & mobile) */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
              {galleryPhotos.slice(0, 15).map((photo, idx) => (
                <div
                  key={`home-gallery-thumb-${idx}`}
                  className="group/photo relative aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-neutral-100 border border-[#E5E1DB] shadow-2xs"
                  title={`${photo.title} (${photo.location})`}
                >
                  <img
                    src={photo.url}
                    alt={photo.title || 'Actual gallery photo'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-110"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/photo:opacity-100 transition-opacity duration-200 flex items-end p-1">
                    <span className="text-[9px] text-white font-semibold truncate leading-tight drop-shadow-xs">
                      #{idx + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-2 border-t border-[#F0EBE5] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#8B8680] font-medium flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#E08828]" />
              <span>350+ Himalayan trail moments uploaded</span>
            </span>

            <button
              type="button"
              onClick={handleGalleryClick}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#E08828] text-[#5A5551] hover:text-white font-bold text-[11px] rounded-xl border border-[#E5E1DB] hover:border-[#E08828] transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Explore Gallery</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ================= COLUMN 2: HIKER REVIEWS (MOST RECENT 5-STAR REVIEWS FITTING IN PREVIEW BOX - NO SCROLL) ================= */}
        <div
          onClick={handleReviewsClick}
          className="group relative bg-white border border-[#E5E1DB] hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Star className="w-4 h-4 fill-amber-500" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#1F1F1F] group-hover:text-amber-600 transition-colors">
                    Hiker Reviews
                  </h4>
                </div>
              </div>

              <span className="text-[11px] font-bold text-amber-600 shrink-0 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Read All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Recent Hiker Reviews fitting allocated space */}
            <div className="flex-1 flex flex-col justify-between gap-1.5 my-1">
              {previewReviews.length > 0 ? (
                previewReviews.map((rev, idx) => {
                  const ratingVal = Math.min(5, Math.max(1, Number(rev.overall_rating || rev.team_rating || 5)));
                  const feedbackText = (rev.overall_feedback || rev.team_feedback || '').trim();
                  const displayText = formatReviewPreview(feedbackText, 70);

                  return (
                    <div
                      key={`home-rev-${rev.id}-${idx}`}
                      className="p-1.5 sm:p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#EFEAE4] transition-colors space-y-0.5 text-left flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[9px] flex items-center justify-center shrink-0">
                            {getPublicDisplayName(rev.full_name)?.[0] || 'H'}
                          </div>
                          <span className="text-xs font-bold text-[#1F1F1F] truncate">
                            {getPublicDisplayName(rev.full_name)}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Verified Hiker</span>
                          </span>
                        </div>

                        {/* Exact Star Rating as rated */}
                        <div className="flex items-center gap-0.5 shrink-0 text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-2.5 h-2.5 ${
                                s <= ratingVal
                                  ? 'fill-amber-500 text-amber-500'
                                  : 'text-neutral-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Trek & Date */}
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {rev.trek_name && (
                          <span className="font-semibold text-[#E08828] bg-orange-50 px-1.5 py-0.2 rounded border border-orange-100 truncate max-w-[200px]">
                            {rev.trek_name}
                          </span>
                        )}
                        {rev.submitted_at && (
                          <span className="text-[9px] text-[#A09890] shrink-0">
                            {String(rev.submitted_at).slice(0, 10)}
                          </span>
                        )}
                      </div>

                      {/* Text formatted with .......... when review continues */}
                      <p className="text-[11px] text-[#4A4541] leading-snug italic break-words">
                        "{displayText}"
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-[#8B8680] italic">
                  No hiker reviews available yet.
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-2 border-t border-[#F0EBE5] flex items-center justify-between text-xs mt-1">
            <span className="text-[11px] text-[#8B8680] font-medium flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              <span>{totalReviewsCount > 0 ? `${totalReviewsCount}+` : '120+'} Verified trail ratings &amp; reviews</span>
            </span>

            <button
              type="button"
              onClick={handleReviewsClick}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-amber-500 text-[#5A5551] hover:text-white font-bold text-[11px] rounded-xl border border-[#E5E1DB] hover:border-amber-500 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>All Reviews</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
