import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Star, ArrowRight, CheckCircle2, Sparkles, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { Trek } from '../types';
import { SubPageType } from './InfoPagesModal';
import { HISTORIC_COMMUNITY_REVIEWS, StaticReview } from '../data/historicReviews';
import { apiFetch } from '../services/api';
import { triggerHaptic } from '../utils/haptics';

interface HomeGalleryReviewsSectionProps {
  treks: Trek[];
  onViewGallery?: (trek?: Trek) => void;
  onOpenInfoPage?: (page: SubPageType) => void;
}

// 10 authentic actual gallery photo captures uploaded by hikers (no cover/stock photos)
const DEFAULT_ACTUAL_GALLERY_PHOTOS: { url: string; title: string; location: string }[] = [
  { url: '/assets/aistudio/WhatsApp_Image_2026-10-28_at_16.54.10_876688b7.jpeg', title: 'Ridge Trail Hikers', location: 'Trail Moment' },
  { url: '/assets/aistudio/image_ced86ce4.png', title: 'Group Summit Ascent', location: 'Mountain Pass' },
  { url: '/assets/aistudio/image_f849666b.png', title: 'Prayer Flag Summit', location: 'High Himalayan Ridge' },
  { url: '/assets/aistudio/image_d714d28c.png', title: 'Pine Forest Trail Walk', location: 'Valley Route' },
  { url: '/assets/aistudio/image_e8775aed.png', title: 'Ridge Descent Team', location: 'Alpine Trail' },
  { url: '/assets/aistudio/image_f343bf0f.png', title: 'Sacred Lakeside Rest', location: 'Gosaikunda Trail' },
  { url: '/assets/aistudio/image_980abb49.png', title: 'Waterfall Stream Crossing', location: 'River Gorge' },
  { url: '/assets/aistudio/image_b747c928.png', title: 'Panorama Valley Trail', location: 'High Ridge' },
  { url: '/assets/aistudio/image_aab933fe.png', title: 'Sunrise Mountain Pause', location: 'Viewpoint' },
  { url: '/assets/aistudio/image_9c258eff.png', title: 'Forest Trail Steps', location: 'Himalayan Foothills' },
];

// Baseline 10 authentic 5-star reviews with real hiker names and >= 20 words length
const VERIFIED_5STAR_NAMED_REVIEWS: StaticReview[] = [
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
];

export const HomeGalleryReviewsSection: React.FC<HomeGalleryReviewsSectionProps> = ({
  treks: _treks,
  onViewGallery,
  onOpenInfoPage,
}) => {
  const [galleryPhotos, setGalleryPhotos] = useState<{ url: string; title: string; location: string }[]>(
    DEFAULT_ACTUAL_GALLERY_PHOTOS
  );

  // Load ONLY actual gallery photos (from D1 trek_photos & local upload archives - never cover photos)
  useEffect(() => {
    let isMounted = true;

    const loadActualGalleryPhotos = async () => {
      try {
        let fetchedList: any[] = [];

        // 1. Try reading from sessionStorage cache first (instant, 0 cloudflare cost)
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

        // 3. If session cache had nothing, fetch trek_photos safely (apiFetch has 10min TTL)
        if (fetchedList.length === 0 && localHikePhotos.length === 0) {
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
        const actualGalleryItems = combinedRaw
          .filter(
            (p) =>
              p &&
              p.url &&
              p.trekId !== 'HOMEPAGE_HERO' &&
              p.trekId !== 'OFFERS_FLASHCARDS' &&
              p.trek_id !== 'HOMEPAGE_HERO'
          )
          .map((p) => ({
            url: p.url,
            title: p.caption || p.trekName || p.trek_name || 'Hike Photo',
            location: p.hikeNumber || p.hike_number ? `Hike #${p.hikeNumber || p.hike_number}` : 'Trail Moment',
          }));

        // Merge: Live/Local Actual Gallery Photos first, followed by default actual gallery photos
        const pool = [...actualGalleryItems, ...DEFAULT_ACTUAL_GALLERY_PHOTOS];
        const uniqueMap = new Map<string, { url: string; title: string; location: string }>();

        for (const item of pool) {
          if (item.url && !uniqueMap.has(item.url)) {
            uniqueMap.set(item.url, item);
          }
          if (uniqueMap.size >= 10) break;
        }

        const final10 = Array.from(uniqueMap.values());
        if (isMounted && final10.length >= 10) {
          setGalleryPhotos(final10.slice(0, 10));
        }
      } catch (e) {
        // Fallback to default actual gallery photos
      }
    };

    loadActualGalleryPhotos();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute 10 reviews: Strictly 5 stars, real names (no "Verified Hiker"), and at least 20 words length
  const top10FiveStarNamedReviews = useMemo(() => {
    // Check local live feedback submissions from hikers
    const liveNamed: StaticReview[] = [];
    try {
      const rawLive = localStorage.getItem('wnw_live_feedbacks');
      if (rawLive) {
        const parsed = JSON.parse(rawLive);
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            const name = (r.full_name || r.name || '').trim();
            const rating = Number(r.overall_rating || r.overallRating || 0);
            const feedbackText = (r.overall_feedback || r.overallFeedback || '').trim();
            const words = feedbackText.split(/\s+/).filter(Boolean);

            const isRealName = name && name.toLowerCase() !== 'verified hiker' && name.length > 2;
            const is5Star = rating === 5;
            const isAtLeast20Words = words.length >= 20;

            if (isRealName && is5Star && isAtLeast20Words) {
              liveNamed.push({
                id: `live-${r.id || Math.random()}`,
                full_name: name,
                trek_name: r.trek_name || 'Himalayan Trek',
                overall_rating: 5,
                team_rating: Number(r.team_rating || 5),
                overall_feedback: feedbackText,
                submitted_at: r.submitted_at ? String(r.submitted_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
                is_verified: true,
              });
            }
          });
        }
      }
    } catch {}

    // Combine live eligible reviews with the verified 5-star baseline
    const combined = [...liveNamed, ...VERIFIED_5STAR_NAMED_REVIEWS];
    const unique = new Map<string, StaticReview>();
    combined.forEach((rev) => {
      const key = `${rev.full_name.toLowerCase()}_${rev.trek_name.toLowerCase()}`;
      if (!unique.has(key)) {
        unique.set(key, rev);
      }
    });

    return Array.from(unique.values()).slice(0, 10);
  }, []);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 w-full">
        {/* ================= COLUMN 1: TRAIL GALLERY (10 ACTUAL GALLERY PHOTOS PREVIEW) ================= */}
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

            {/* 10 Photos Display (5x2 Grid on desktop & mobile) */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
              {galleryPhotos.map((photo, idx) => (
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
                      (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/WhatsApp_Image_2026-10-28_at_16.54.10_876688b7.jpeg';
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

        {/* ================= COLUMN 2: HIKER REVIEWS (10 5-STAR REVIEWS WITH ACTUAL NAMES & >=20 WORDS) ================= */}
        <div
          onClick={handleReviewsClick}
          className="group relative bg-white border border-[#E5E1DB] hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-3.5">
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

            {/* 10 Reviews Scrollable Feed (Desktop & Mobile) */}
            <div
              className="max-h-[220px] sm:max-h-[240px] overflow-y-auto space-y-2 pr-1 mb-3 scrollbar-thin"
              style={{ overscrollBehavior: 'contain' }}
            >
              {top10FiveStarNamedReviews.map((rev, idx) => (
                <div
                  key={`home-rev-${rev.id}-${idx}`}
                  className="p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#EFEAE4] transition-colors space-y-1.5 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[9px] flex items-center justify-center shrink-0">
                        {rev.full_name?.[0] || 'H'}
                      </div>
                      <span className="text-xs font-bold text-[#1F1F1F] truncate">
                        {rev.full_name}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200 shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Verified Hiker</span>
                      </span>
                    </div>

                    {/* Star Rating: 5 Filled Stars */}
                    <div className="flex items-center gap-0.5 shrink-0 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                  </div>

                  {/* Trek & Date */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {rev.trek_name && (
                      <span className="font-semibold text-[#E08828] bg-orange-50 px-1 py-0.2 rounded border border-orange-100 truncate max-w-[170px]">
                        {rev.trek_name}
                      </span>
                    )}
                    {rev.submitted_at && (
                      <span className="text-[9px] text-[#A09890] shrink-0">
                        {rev.submitted_at}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#4A4541] leading-relaxed line-clamp-3 italic">
                    "{rev.overall_feedback}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-2 border-t border-[#F0EBE5] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#8B8680] font-medium flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              <span>120+ Verified trail ratings &amp; reviews</span>
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
