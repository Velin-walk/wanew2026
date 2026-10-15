import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sparkles, History, Star, Heart } from 'lucide-react';
import { apiFetch } from '../services/api';
import { HISTORIC_COMMUNITY_REVIEWS } from '../data/historicReviews';
import { MiniPrayerFlags } from './NepaliPrayerFlags';
import defaultHeroImg from '../assets/images/gallery_trail_hero_1790246900034.jpg';

export interface HeroBannerItem {
  id: string;
  trekId: string;
  url: string;
  caption?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface HomepageHeroBannerProps {
  upcomingCount: number;
  completedCount: number;
  onOpenReviews?: () => void;
}

export const HERO_TREK_ID = 'HOMEPAGE_HERO';
export const HERO_STORAGE_KEY = 'wnw_homepage_hero_images';

export const HomepageHeroBanner: React.FC<HomepageHeroBannerProps> = ({
  upcomingCount,
  completedCount,
  onOpenReviews,
}) => {
  const [images, setImages] = useState<HeroBannerItem[]>(() => {
    try {
      const cached = localStorage.getItem(HERO_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  const [liveReviews, setLiveReviews] = useState<any[]>(() => {
    try {
      const local = localStorage.getItem('wnw_user_feedbacks');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncLocalFeedbacks = () => {
      try {
        const local = localStorage.getItem('wnw_user_feedbacks');
        if (local) {
          setLiveReviews(JSON.parse(local));
        }
      } catch {}
    };
    window.addEventListener('wnw-feedback-updated', syncLocalFeedbacks);
    return () => window.removeEventListener('wnw-feedback-updated', syncLocalFeedbacks);
  }, []);

  const { avgRating, totalReviews } = useMemo(() => {
    const combined = [...(liveReviews || []), ...HISTORIC_COMMUNITY_REVIEWS];
    if (combined.length === 0) {
      return { avgRating: '5.0', totalReviews: 0 };
    }
    let sum = 0;
    combined.forEach((r: any) => {
      const rating = Math.min(5, Math.max(1, Number(r.overall_rating || r.overallRating) || 5));
      sum += rating;
    });
    return {
      avgRating: (sum / combined.length).toFixed(1),
      totalReviews: combined.length,
    };
  }, [liveReviews]);

  // Hero image rotation interval: 15 minutes (15 * 60 * 1000 ms)
  const ROTATION_INTERVAL_MS = 15 * 60 * 1000;

  const [slotIndex, setSlotIndex] = useState<number>(() =>
    Math.floor(Date.now() / ROTATION_INTERVAL_MS)
  );

  const loadHeroImages = useCallback(async (forceFresh = false) => {
    try {
      const res = await apiFetch(
        `trek_photos?trekId=${encodeURIComponent(HERO_TREK_ID)}`,
        { forceFresh }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          const valid = (json.data as HeroBannerItem[])
            .filter((item) => item && item.id && item.url)
            .sort((a, b) => {
              const tA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
              const tB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
              return tA - tB;
            });
          setImages(valid);
          try {
            localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(valid));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Could not fetch homepage hero images:', err);
    }
  }, []);

  useEffect(() => {
    loadHeroImages(false);

    const handleUpdated = () => {
      try {
        const cached = localStorage.getItem(HERO_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setImages(parsed);
          }
        }
      } catch {}
      loadHeroImages(true);
    };

    window.addEventListener('wnw-hero-images-updated', handleUpdated);
    return () => window.removeEventListener('wnw-hero-images-updated', handleUpdated);
  }, [loadHeroImages]);

  // Check every 15s if the clock crossed into a new 15-minute slot
  useEffect(() => {
    const timer = setInterval(() => {
      const nextSlot = Math.floor(Date.now() / ROTATION_INTERVAL_MS);
      setSlotIndex((prev) => (prev !== nextSlot ? nextSlot : prev));
    }, 15000);
    return () => clearInterval(timer);
  }, [ROTATION_INTERVAL_MS]);

  const displayImages: HeroBannerItem[] =
    images.length > 0
      ? images
      : [
          {
            id: 'default-hero',
            trekId: HERO_TREK_ID,
            url: defaultHeroImg,
            uploadedAt: '',
          },
        ];

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    const idx = displayImages.length > 0 ? slotIndex % displayImages.length : 0;
    setCurrentIndex(idx);
    const el = scrollerRef.current;
    if (el && el.clientWidth > 0) {
      el.scrollTo({
        left: idx * el.clientWidth,
        behavior: 'smooth',
      });
    }
  }, [slotIndex, displayImages.length]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx >= 0 && idx < displayImages.length && idx !== currentIndex) {
      setCurrentIndex(idx);
    }
  };

  const handlePhotoClick = () => {
    if (displayImages.length <= 1) return;
    const nextIdx = (currentIndex + 1) % displayImages.length;
    setCurrentIndex(nextIdx);
    const el = scrollerRef.current;
    if (el && el.clientWidth > 0) {
      el.scrollTo({
        left: nextIdx * el.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const activeItem: HeroBannerItem = displayImages[currentIndex] || displayImages[0];
  const currentHeroId = activeItem.id || 'hero-main';

  const [likesMap, setLikesMap] = useState<Record<string, { count: number; liked: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('wnw_photo_likes_data');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const heroLikesData = likesMap[currentHeroId] || {
    count: 28,
    liked: false,
  };

  const handleToggleHeroLike = () => {
    setLikesMap((prev) => {
      const cur = prev[currentHeroId] || { count: 28, liked: false };
      const nextLiked = !cur.liked;
      const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
      const updated = {
        ...prev,
        [currentHeroId]: { count: nextCount, liked: nextLiked },
      };
      try {
        localStorage.setItem('wnw_photo_likes_data', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('wnw-likes-updated', { detail: updated }));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    const handleLikesSync = (e: any) => {
      if (e.detail) {
        setLikesMap(e.detail);
      }
    };
    window.addEventListener('wnw-likes-updated', handleLikesSync);
    return () => window.removeEventListener('wnw-likes-updated', handleLikesSync);
  }, []);

  return (
    <div className="relative w-full aspect-[2/1] rounded-xl sm:rounded-2xl overflow-hidden border border-[#E5E1DB] shadow-xs bg-stone-900 select-none">
      {/* Floating Hero Like Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleToggleHeroLike();
        }}
        className={`absolute top-2 sm:top-2.5 right-2 sm:right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full backdrop-blur-md border transition-all duration-200 cursor-pointer shadow-md active:scale-95 opacity-60 hover:opacity-100 ${
          heroLikesData.liked
            ? 'bg-rose-600/60 border-rose-400/60 text-white shadow-rose-900/30'
            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white hover:text-rose-300'
        }`}
        title={heroLikesData.liked ? 'Unlike this photo' : 'Like this photo'}
      >
        <Heart
          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 ${
            heroLikesData.liked ? 'fill-current scale-110 text-rose-200' : 'text-white'
          }`}
        />
        <span className="text-[10px] sm:text-[11px] font-black tracking-tight">{heroLikesData.count}</span>
      </button>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onClick={handlePhotoClick}
        className={`flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          displayImages.length > 1 ? 'cursor-pointer' : ''
        }`}
      >
        {displayImages.map((item) => (
          <div
            key={item.id || item.url}
            className="w-full h-full shrink-0 snap-center relative"
          >
            <img
              src={item.url}
              alt={item.caption || 'Walk Nepal Walk Himalayan Trail'}
              className="w-full h-full object-cover object-center block"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

      {/* Bottom Overlay: Optional Caption + Roster & Reviews Stats Bar */}
      <div className="absolute bottom-2 sm:bottom-3.5 left-2 sm:left-4 right-2 sm:right-4 z-10 flex flex-col gap-1.5 sm:gap-2">
        {activeItem.caption && (
          <div className="flex items-end justify-between pointer-events-none">
            <span className="inline-block px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-xs border border-white/15 text-white text-[10px] sm:text-xs font-bold tracking-wide truncate max-w-full shadow-2xs">
              {activeItem.caption}
            </span>
          </div>
        )}

        <div className="relative grid grid-cols-3 gap-1 sm:gap-2 bg-white/35 backdrop-blur-md rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 border border-[#E5E1DB] shadow-sm overflow-hidden">
          <div className="absolute -top-1 right-2 sm:right-6 w-24 xs:w-32 sm:w-36 pointer-events-none z-10 opacity-80 hidden xs:block">
            <MiniPrayerFlags variant="draped" count={5} />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-[#E08828]/10 text-[#E08828] shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-medium whitespace-nowrap leading-none">
              <strong className="text-[#1F1F1F] font-black text-[10.5px] xs:text-xs sm:text-sm">
                {upcomingCount}
              </strong>{' '}
              Upcoming
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-[#7ABA42]/10 text-[#7ABA42] shrink-0">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-medium whitespace-nowrap leading-none">
              <strong className="text-[#1F1F1F] font-black text-[10.5px] xs:text-xs sm:text-sm">
                {completedCount}
              </strong>{' '}
              Completed
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenReviews}
            className="flex items-center gap-1 sm:gap-1.5 min-w-0 text-left cursor-pointer group"
            title={`Rating ${avgRating}/5.0 from ${totalReviews} verified reviews`}
          >
            <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-amber-50 text-amber-500 shrink-0 group-hover:bg-amber-100 transition-colors">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-500 shrink-0" />
            </div>
            <span className="text-[9.5px] xs:text-[10.5px] sm:text-xs text-stone-600 font-medium whitespace-nowrap leading-none group-hover:text-[#1F1F1F] transition-colors">
              <strong className="text-[#1F1F1F] font-black text-[10.5px] xs:text-xs sm:text-sm">
                {avgRating} ★
              </strong>{' '}
              Reviews
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
