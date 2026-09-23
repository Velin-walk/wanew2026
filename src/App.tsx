import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trek, Booking, TeamMember, BookingFormData } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { TrekListScreen } from './screens/TrekListScreen';
import { MyBookingsScreen } from './screens/MyBookingsScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { RegistrationModal } from './components/RegistrationModal';
import { InviteModal } from './components/InviteModal';
import { ItineraryModal } from './components/ItineraryModal';
import { TrekFeedbackModal } from './components/TrekFeedbackModal';
import { InfoPagesModal, SubPageType } from './components/InfoPagesModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FALLBACK_TREKS } from './data/fallbackTreks';
import { CheckCircle2, AlertCircle, Mountain, Heart, RefreshCw, ShieldCheck } from 'lucide-react';
import MapMinersDashboard from './components/mapminers/MapMinersDashboard';
import {
  apiFetch,
  normalizeTrek,
  deduplicateTreks,
  enrichTreksWithRegistrations,
  clearApiCache,
  fetchSingleTrek,
  fetchUserBookings,
} from './services/api';
import { isAdminEmail } from './adminUtils';
import AdminDashboard from './components/admin/AdminDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { db } from './lib/firebase';
// Firestore methods removed as app now uses Cloudflare D1 for storage

function MainApp() {
  const { user, userEmail, isAdmin, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'leaderboard' | 'admin'>('treks');
  const [treks, setTreks] = useState<Trek[]>(() => {
    try {
      const cached = localStorage.getItem('wnw_cached_cloudflare_treks');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateTreks(parsed);
        }
      }
    } catch {}
    return deduplicateTreks(FALLBACK_TREKS);
  });
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_device_bookings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loadingTreks, setLoadingTreks] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [selectedTrekForRegister, setSelectedTrekForRegister] = useState<Trek | null>(null);
  const [selectedTrekForInvite, setSelectedTrekForInvite] = useState<Trek | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [itineraryModalTrek, setItineraryModalTrek] = useState<Trek | null>(null);
  const [itineraryModalType, setItineraryModalType] = useState<'itinerary' | 'faq'>('itinerary');

  const [feedbackModalTrek, setFeedbackModalTrek] = useState<Trek | null>(null);
  const [feedbackModalBooking, setFeedbackModalBooking] = useState<Booking | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showMapMinerContribute, setShowMapMinerContribute] = useState(false);
  const [infoModalPage, setInfoModalPage] = useState<SubPageType | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeUserEmail = userEmail || '';

  // Look up the most recent booking/registration made by the user to prefill future forms
  const latestUserBooking = React.useMemo(() => {
    // 1. Try finding from user bookings in state
    if (bookings && bookings.length > 0) {
      return bookings[0];
    }

    // 2. Try localStorage saved profile
    try {
      const saved = localStorage.getItem('wnw_user_registration_profile') || localStorage.getItem('wnw_last_registration_data');
      if (saved) return JSON.parse(saved);
    } catch {}

    // 3. Try device bookings
    try {
      const devB = localStorage.getItem('wnw_device_bookings');
      if (devB) {
        const parsed = JSON.parse(devB);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch {}

    return null;
  }, [bookings]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Pull-to-refresh mobile gesture state
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPullingRef = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshData = useCallback(async (options?: { force?: boolean }) => {
    const isForce = !!options?.force;
    if (isForce) {
      setIsRefreshing(true);
      clearApiCache();
    }

    try {
      // 1. Fetch treks: Dual-Source strategy as specified in ARCHITECTURE.md
      const trekMap = new Map<string, Trek>();
      let currentSource: 'cloudflare' | 'firebase' = 'cloudflare';
      try {
        if (localStorage.getItem('wnw_trek_data_source') === 'firebase') {
          currentSource = 'firebase';
        }
      } catch {}

      // A. Populate from local saved itineraries cache (Admin Panel published/saved treks)
      try {
        const localSaved = localStorage.getItem('wnw_saved_itineraries_cache');
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((item) => {
              const norm = normalizeTrek(item);
              const key = norm.hike_number && norm.hike_number !== 'TBD' ? `num:${norm.hike_number}` : `id:${norm.id}`;
              trekMap.set(key, norm);
            });
          }
        }
      } catch {}

      // B. Fetch from Cloudflare Worker & D1 (Default / Zero-Quota Mode)
      if (currentSource !== 'firebase') {
        try {
          const res = await apiFetch('/treks', { forceFresh: isForce });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            const trekItems = Array.isArray(data) ? data : data?.data;
            if (Array.isArray(trekItems) && trekItems.length > 0) {
              trekItems.forEach((t) => {
                const norm = normalizeTrek(t);
                const key = norm.hike_number && norm.hike_number !== 'TBD' ? `num:${norm.hike_number}` : `id:${norm.id}`;
                trekMap.set(key, norm);
              });
            }
          }
        } catch (err) {
          console.warn('[Cloudflare Treks] Network issue fetching treks from Cloudflare:', err);
        }
      }

      let baseTreks = deduplicateTreks(Array.from(trekMap.values()));
      if (baseTreks.length > 0) {
        try {
          localStorage.setItem('wnw_cached_cloudflare_treks', JSON.stringify(baseTreks));
        } catch {}
      } else {
        // If live fetch returned nothing, preserve cached treks before falling back to static
        try {
          const cached = localStorage.getItem('wnw_cached_cloudflare_treks');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              baseTreks = deduplicateTreks(parsed);
            }
          }
        } catch {}
        if (baseTreks.length === 0) {
          baseTreks = deduplicateTreks(FALLBACK_TREKS);
        }
      }

      setTreks(baseTreks);

      // 2. Fetch all user bookings across local storage, D1, and Firestore
      await loadUserBookings(baseTreks);

      lastFetchTimeRef.current = Date.now();
      if (isForce) {
        showToast('Live database refreshed', 'success');
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setLoadingTreks(false);
      setLoadingBookings(false);
      setIsRefreshing(false);
    }
  }, [user, userEmail, isAdmin]);

  const treksRef = useRef<Trek[]>([]);
  useEffect(() => {
    treksRef.current = treks;
  }, [treks]);

  const lastUserBookingsFetchRef = useRef<number>(0);

  const loadUserBookings = useCallback(async (baseTreks?: Trek[], force = false) => {
    // Throttle user bookings queries to prevent hammering Cloudflare D1 (at most once every 2 minutes unless forced)
    const now = Date.now();
    if (!force && now - lastUserBookingsFetchRef.current < 2 * 60 * 1000 && bookings.length > 0) {
      return;
    }
    lastUserBookingsFetchRef.current = now;

    setLoadingBookings(true);
    try {
      const candidateEmails = new Set<string>();
      if (user?.email) candidateEmails.add(user.email.toLowerCase().trim());
      if (userEmail) candidateEmails.add(userEmail.toLowerCase().trim());

      try {
        const saved = localStorage.getItem('wnw_user_registration_profile') || localStorage.getItem('wnw_last_registration_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.email) candidateEmails.add(parsed.email.toLowerCase().trim());
          if (parsed.email_address) candidateEmails.add(parsed.email_address.toLowerCase().trim());
        }
      } catch {}

      const mergedMap = new Map<string, any>();

      // 1. Initial device local cache
      try {
        const localDeviceBookings = localStorage.getItem('wnw_device_bookings');
        if (localDeviceBookings) {
          const parsed: Booking[] = JSON.parse(localDeviceBookings);
          if (Array.isArray(parsed)) {
            parsed.forEach((b) => {
              const key = String(b.id || `${b.hike_number || b.trek_id}_${b.email || b.user_email}_${b.trek_date}`);
              mergedMap.set(key, b);
            });
          }
        }
      } catch {}

      // 2. Fetch from Cloudflare D1 for candidate emails only if we have candidate emails
      if (candidateEmails.size > 0) {
        for (const email of candidateEmails) {
          try {
            const userRegs = await fetchUserBookings(email, force);
            if (Array.isArray(userRegs)) {
              userRegs.forEach((b: any) => {
                const key = String(b.id || `${b.hike_number || b.trek_id}_${b.email_address || b.user_email}_${b.trek_date || b.timestamp}`);
                mergedMap.set(key, b);
              });
            }
          } catch (cfErr) {
            console.warn(`Could not fetch D1 bookings for ${email}:`, cfErr);
          }
        }
      }

      // 3. (Firestore registrations querying removed - now using Cloudflare D1 exclusively)

      // 4. Normalize & enrich each booking with trek details
      const cancelledIds = new Set<string>();
      try {
        const cJson = localStorage.getItem('wnw_cancelled_booking_ids');
        if (cJson) {
          const parsed = JSON.parse(cJson);
          if (Array.isArray(parsed)) parsed.forEach((id: any) => cancelledIds.add(String(id)));
        }
      } catch {}

      const rawList = Array.from(mergedMap.values()).filter((b: any) => {
        const id = String(b.id || b.registration_id || '');
        return id && !cancelledIds.has(id);
      });
      const currentTreks = (baseTreks && baseTreks.length > 0) ? baseTreks : treksRef.current;
      const enriched = rawList.map((b: any) => {
        const trekId = String(b.trek_id || b.trekId || b.hike_number || '');
        const hikeNum = String(b.hike_number || b.trek_id || b.trekId || '');
        const matchedTrek = currentTreks.find(
          (t) =>
            (t.id && (t.id === trekId || t.id === hikeNum)) ||
            (t.hike_number && (t.hike_number === hikeNum || t.hike_number === trekId)) ||
            (t.name && b.trek_name && t.name.toLowerCase().trim() === b.trek_name.toLowerCase().trim()) ||
            (t.name && b.trekTitle && t.name.toLowerCase().trim() === b.trekTitle.toLowerCase().trim())
        );

        const id = b.id || b.registration_id || `reg-${Math.random()}`;
        const phone = b.phone || b.phoneNumber || '';
        const email = b.email_address || b.email || b.user_email || '';
        const pax = Number(b.pax || b.paxCount) > 0 ? Number(b.pax || b.paxCount) : 1 + (b.team_members?.length || 0);

        return {
          ...b,
          id,
          trek_id: trekId || matchedTrek?.id || '',
          hike_number: hikeNum || matchedTrek?.hike_number || '',
          user_email: email,
          email: email,
          full_name: b.full_name || b.hikerName || b.name || 'Hiker',
          phone,
          whatsapp: b.whatsapp || b.whatsapp_number || phone,
          emergency_contact: b.emergency_contact || b.emergency_backup_contact || '',
          profession: b.profession || '',
          is_group: b.is_group || b.part_of_group || (pax > 1 ? 'Group' : 'Solo'),
          age_group: b.age_group || b.ageGroup || '20-30',
          gender: b.gender || 'Not specified',
          joined_at: b.joined_at || b.registeredAt || b.timestamp || new Date().toISOString(),
          trek_name: b.trek_name || b.trekTitle || matchedTrek?.name || 'Himalayan Trek',
          trek_date: b.trek_date || matchedTrek?.date || b.timestamp || '',
          trek_difficulty: b.trek_difficulty || matchedTrek?.difficulty || 'moderate',
          trek_days: b.trek_days || matchedTrek?.days || 1,
          pax,
          team_members: Array.isArray(b.team_members) ? b.team_members : [],
          has_medical: b.has_medical || (b.medical_condition && b.medical_condition !== 'No' ? 'Yes' : 'No'),
          specify_medical: b.specify_medical || b.medical_condition || '',
          recent_hikes: b.recent_hikes || '',
          agree_rules: b.agree_rules || b.agreement || 'Yes',
          guide_preference: b.guide_preference || b.guide_mode || 'Guided',
          transport_preference: b.transport_preference || b.transport_mode || 'Bus',
          suggestions: b.suggestions || '',
          itinerary_link: b.itinerary_link || matchedTrek?.itinerary_link || '',
          faq_link: b.faq_link || matchedTrek?.faq_link || '',
          whatsapp_link: b.whatsapp_link || matchedTrek?.whatsapp_link || '',
          is_cancelled: Boolean(b.is_cancelled || matchedTrek?.is_cancelled),
          cancellation_reason: b.cancellation_reason || matchedTrek?.cancellation_reason || '',
          status: b.status || b.registration_status || 'Confirmed',
          payment_status: b.payment_status || 'Unpaid',
          paid_amount: Number(b.paid_amount) || 0,
          due_amount: Number(b.due_amount) || 0,
          pickup_point: b.pickup_point || b.pickupPoint || '',
          admin_notes: b.admin_notes || '',
        } as Booking;
      });

      enriched.sort((a, b) => {
        const timeA = new Date(a.joined_at || a.trek_date || 0).getTime();
        const timeB = new Date(b.joined_at || b.trek_date || 0).getTime();
        return timeB - timeA;
      });

      setBookings(enriched);
      try {
        localStorage.setItem('wnw_device_bookings', JSON.stringify(enriched));
      } catch {}
    } catch (err) {
      console.error('Error in loadUserBookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  }, [user, userEmail, isAdmin, treks]);

  const fetchTreks = refreshData;
  const fetchBookings = refreshData;

  // On mount: Check if URL targets a specific shared trek (?trek=..., ?hike=..., or #itinerary-...) or tab (?tab=admin or #admin)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';

      const tabParam = searchParams.get('tab');
      if (tabParam === 'admin' || hash === '#admin') {
        setCurrentTab('admin');
      }

      let targetTrekId = searchParams.get('trek') || searchParams.get('hike') || searchParams.get('id') || '';

      if (!targetTrekId && hash) {
        const hashMatch = hash.match(/^#(?:itinerary|trek)-(.+)$/i);
        if (hashMatch) {
          targetTrekId = decodeURIComponent(hashMatch[1]);
        }
      }

      if (targetTrekId && targetTrekId !== 'preview') {
        fetchSingleTrek(targetTrekId).then((singleTrek) => {
          if (singleTrek) {
            setItineraryModalTrek(singleTrek);
            setItineraryModalType('itinerary');
          }
        });
      }
    } catch (e) {
      console.warn('Could not parse shared trek URL parameter:', e);
    }
  }, []);

  // When user visits Bookings tab, refresh bookings if needed
  useEffect(() => {
    if (currentTab === 'bookings') {
      loadUserBookings();
    }
  }, [currentTab, loadUserBookings]);

  // Keep a stable ref to refreshData to avoid re-attaching listeners
  const refreshDataRef = useRef(refreshData);
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  useEffect(() => {
    // Initial fetch on mount
    refreshData();

    // Throttled focus listener: only re-fetch if at least 5 minutes have elapsed since last fetch
    const handleFocusOrVisibility = () => {
      const elapsed = Date.now() - lastFetchTimeRef.current;
      if (elapsed >= 5 * 60 * 1000) {
        refreshDataRef.current();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    const handleTreksUpdated = () => {
      refreshDataRef.current({ force: true });
    };
    window.addEventListener('wnw-treks-updated', handleTreksUpdated);
    window.addEventListener('wnw-data-source-changed', handleTreksUpdated);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.removeEventListener('wnw-treks-updated', handleTreksUpdated);
      window.removeEventListener('wnw-data-source-changed', handleTreksUpdated);
    };
  }, []); // Empty dependency array prevents double-fetching on auth resolution

  // Mobile pull-to-refresh touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 2 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;
    if (window.scrollY > 2) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0) {
      // Damped elastic resistance
      const damped = Math.min(diff * 0.4, 75);
      setPullDistance(damped);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistance >= 48) {
      setPullDistance(0);
      await refreshData({ force: true });
    } else {
      setPullDistance(0);
    }
  };

  const toggleFavorite = (trekId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(trekId)
        ? prev.filter((id) => id !== trekId)
        : [...prev, trekId];
      try {
        localStorage.setItem('wnw_favorites', JSON.stringify(next));
      } catch (e) {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleRegisterSubmit = async (formData: BookingFormData) => {
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const trek = treks.find(
      (t) =>
        t.id === formData.trek_id ||
        t.hike_number === formData.trek_id ||
        (t.name && formData.trek_name && norm(t.name) === norm(formData.trek_name))
    );

    if (!trek) {
      throw new Error('Trek not found');
    }

    const totalNewPeople = 1 + (Array.isArray(formData.team_members) ? formData.team_members.length : 0);
    const primaryPayload = {
      hike_number: trek.hike_number || trek.id,
      trek_name: trek.name,
      full_name: formData.full_name,
      pax: totalNewPeople,
      phone: formData.phone,
      whatsapp: formData.whatsapp || formData.phone,
      email_address: formData.email || activeUserEmail,
      emergency_backup_contact: formData.emergency_contact || '',
      profession: formData.profession || '',
      part_of_group: formData.is_group || (formData.team_members && formData.team_members.length > 0 ? 'Group' : 'Solo'),
      age_group: formData.age_group,
      gender: formData.gender,
      guide_mode: formData.guide_preference || 'Guided',
      transport_mode: formData.transport_preference || 'Bus',
      due: trek.price ? `NPR ${trek.price}` : '',
      paid: '',
      agreement: formData.agree_rules || 'Yes',
      suggestions: formData.suggestions || '',
      person_remarks: formData.team_members && formData.team_members.length > 0
        ? `Primary contact with ${formData.team_members.length} companion(s): ${formData.team_members.map(m => m.full_name).join(', ')}`
        : 'Solo registration',
      updates: '',
      pickup_point: '',
      list_name: `${trek.name} (${trek.date})`,
      fitness: trek.fitness_level || '',
      medical_condition: formData.has_medical === 'Yes' ? (formData.specify_medical || 'Yes') : 'No',
      recent_hikes: formData.recent_hikes || '',
      distance: trek.distance || '',
      difficulty: trek.difficulty || '',
      season: trek.season || '',
      type_of_trail: trek.type_of_trail || ''
    };

    let primaryId = `reg-${Date.now()}`;
    let isCloudflareDown = false;

    try {
      const res = await apiFetch('/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(primaryPayload),
      });

      if (!res.ok) {
        throw new Error('Cloudflare primary registration rejected');
      }
      const data = await res.json();
      if (data.id) {
        primaryId = String(data.id);
      }
    } catch (err) {
      console.warn('[Registration Engine] Cloudflare registration error:', err);
    }

    // Submit team members separately to D1 / Firestore
    if (formData.team_members && formData.team_members.length > 0) {
      for (const tm of formData.team_members) {
        if (tm.full_name) {
          const companionPayload = {
            hike_number: trek.hike_number || trek.id,
            trek_name: trek.name,
            full_name: tm.full_name,
            pax: 1,
            phone: tm.phone || '',
            whatsapp: tm.phone || '',
            email_address: formData.email || activeUserEmail,
            emergency_backup_contact: formData.phone,
            profession: '',
            part_of_group: 'Group',
            age_group: tm.age_group || '20-30',
            gender: tm.gender || 'Female',
            guide_mode: formData.guide_preference || 'Guided',
            transport_mode: formData.transport_preference || 'Bus',
            due: '',
            paid: '',
            agreement: 'Yes',
            suggestions: '',
            person_remarks: `Companion of ${formData.full_name}`,
            updates: '',
            pickup_point: '',
            list_name: `${trek.name} (${trek.date})`,
            fitness: trek.fitness_level || '',
            medical_condition: 'No',
            recent_hikes: '',
            distance: trek.distance || '',
            difficulty: trek.difficulty || '',
            season: trek.season || '',
            type_of_trail: trek.type_of_trail || ''
          };

          let companionId = `reg-companion-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          let isCompCloudflareDown = isCloudflareDown;

          if (!isCloudflareDown) {
            try {
              const compRes = await apiFetch('/registrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(companionPayload)
              });
              if (compRes.ok) {
                const compData = await compRes.json().catch(() => ({}));
                if (compData.id) {
                  companionId = String(compData.id);
                }
              } else {
                isCompCloudflareDown = true;
              }
            } catch (cErr) {
              console.warn('Companion registration error:', cErr);
            }
          }
        }
      }
    }

    // Construct full client booking record for instantaneous UI reactivity
    const newBooking: Booking = {
      id: primaryId,
      trek_id: String(trek.id || trek.hike_number || ''),
      hike_number: String(trek.hike_number || trek.id || ''),
      user_email: formData.email || activeUserEmail || '',
      email: formData.email || activeUserEmail || '',
      full_name: formData.full_name,
      phone: formData.phone,
      whatsapp: formData.whatsapp || formData.phone,
      emergency_contact: formData.emergency_contact,
      profession: formData.profession,
      is_group: formData.is_group,
      age_group: formData.age_group,
      gender: formData.gender,
      joined_at: new Date().toISOString(),
      trek_name: trek.name,
      trek_date: trek.date,
      trek_difficulty: trek.difficulty,
      trek_days: trek.days,
      pax: totalNewPeople,
      team_members: formData.team_members || [],
      has_medical: formData.has_medical,
      specify_medical: formData.specify_medical,
      recent_hikes: formData.recent_hikes,
      agree_rules: formData.agree_rules,
      guide_preference: formData.guide_preference,
      transport_preference: formData.transport_preference,
      suggestions: formData.suggestions,
      itinerary_link: trek.itinerary_link,
      faq_link: trek.faq_link,
      whatsapp_link: trek.whatsapp_link,
      is_cancelled: Boolean(trek.is_cancelled),
      cancellation_reason: trek.cancellation_reason || '',
      status: 'Confirmed',
      payment_status: 'Unpaid',
      paid_amount: 0,
      due_amount: 0,
      pickup_point: '',
      admin_notes: '',
    };

    // Save to localStorage for seamless auto-prefill on next registration & instant bookings view
    try {
      const profileToSave = {
        fullName: formData.full_name,
        full_name: formData.full_name,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        whatsapp_number: formData.whatsapp,
        emergencyContact: formData.emergency_contact,
        emergency_backup_contact: formData.emergency_contact,
        email: formData.email,
        email_address: formData.email,
        profession: formData.profession,
        ageGroup: formData.age_group,
        age_group: formData.age_group,
        gender: formData.gender,
        medicalCondition: formData.specify_medical,
        medical_condition: formData.specify_medical,
        recentHikes: formData.recent_hikes,
        recent_hikes: formData.recent_hikes,
        guidePreference: formData.guide_preference,
        transportPreference: formData.transport_preference,
      };
      localStorage.setItem('wnw_user_registration_profile', JSON.stringify(profileToSave));
      localStorage.setItem('wnw_last_registration_data', JSON.stringify(profileToSave));

      const existingDevJson = localStorage.getItem('wnw_device_bookings');
      let devBookings: Booking[] = [];
      if (existingDevJson) {
        try { devBookings = JSON.parse(existingDevJson); } catch (_) {}
      }
      const updatedDevBookings = [newBooking, ...devBookings.filter(b => String(b.id) !== String(primaryId))];
      localStorage.setItem('wnw_device_bookings', JSON.stringify(updatedDevBookings));
    } catch (e) {
      console.warn('Could not save registration profile/bookings to localStorage:', e);
    }

    setBookings((prev) => [newBooking, ...prev.filter(b => String(b.id) !== String(primaryId))]);

    const toastMsg = isCloudflareDown
      ? `✓ Booking recorded for ${trek.name}! (Backup mode)`
      : `🎉 Registered for ${trek.name}! See you on the trail!`;
    showToast(toastMsg, 'success');
    setSelectedTrekForRegister(null);
    // Background refresh
    refreshData({ force: true });
  };

  const handleCancelBooking = async (bookingId: number | string) => {
    // 1. Remove from local memory and device localStorage immediately for instant feedback
    const idStr = String(bookingId);
    setBookings((prev) => prev.filter((b) => String(b.id) !== idStr));
    try {
      const existingDevJson = localStorage.getItem('wnw_device_bookings');
      if (existingDevJson) {
        const parsed: Booking[] = JSON.parse(existingDevJson);
        const filtered = parsed.filter((b) => String(b.id) !== idStr);
        localStorage.setItem('wnw_device_bookings', JSON.stringify(filtered));
      }

      const cJson = localStorage.getItem('wnw_cancelled_booking_ids');
      const list = cJson ? JSON.parse(cJson) : [];
      if (!list.includes(idStr)) {
        list.push(idStr);
        localStorage.setItem('wnw_cancelled_booking_ids', JSON.stringify(list));
      }
    } catch (_) {}

    // 2. Dual-delete from Cloudflare and Firestore
    let cfDeleted = false;
    try {
      const res = await apiFetch(`/registrations/${bookingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        cfDeleted = true;
      }
    } catch (e) {
      console.warn('Cloudflare delete failed:', e);
    }

    showToast('Registration cancelled successfully', 'success');
    await refreshData({ force: true });
  };

  return (
    <div
      className="min-h-screen bg-[#F0EBE5] md:bg-[#F2ECE5] flex flex-col items-center justify-start w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* PWA Install and Connectivity Indicators */}
      <PWAInstallPrompt />
      <OfflineIndicator />

      {/* Mobile Pull-to-Refresh Floating Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          id="pull-to-refresh-indicator"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50 transition-all duration-150 pointer-events-none flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-[#E5E1DB] text-xs font-bold text-[#1F1F1F]"
          style={{
            transform: `translate(-50%, ${pullDistance > 0 ? Math.min(pullDistance - 12, 28) : (isRefreshing ? 6 : -60)}px)`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 40, 1),
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#E08828] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>
            {isRefreshing
              ? 'Refreshing live data...'
              : pullDistance >= 48
              ? 'Release to refresh'
              : 'Pull down to refresh'}
          </span>
        </div>
      )}

      {/* Viewport Container: Full screen width layout */}
      <div className="w-full bg-[#F0EBE5] md:bg-[#F2ECE5] min-h-screen flex flex-col relative">
        {/* Mobile Toast notifications (centered, responsive) */}
        {toast && (
          <div
            id="mobile-toast"
            className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm p-3.5 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        )}

        {/* Top Header */}
        <Navbar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          bookingCount={bookings.length}
          savedCount={favorites.length}
          onOpenContribute={() => setShowMapMinerContribute(true)}
          onOpenInfoPage={(page) => setInfoModalPage(page)}
          userEmail={activeUserEmail}
          onOpenProfile={() => setProfileModalOpen(true)}
        />

        {/* Content Area - Full width responsive screen */}
        <main className={`flex-1 w-full ${currentTab === 'mapminers' ? 'p-0 max-w-none' : 'w-full px-3.5 sm:px-6 lg:px-8 py-3 sm:py-6 pb-28 md:pb-12'}`}>
          {currentTab === 'treks' && (
            <TrekListScreen
              treks={treks}
              loading={loadingTreks}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onRegister={(trek) => setSelectedTrekForRegister(trek)}
              onShare={(trek) => {
                setSelectedTrekForInvite(trek);
                setShowInviteModal(true);
              }}
              onViewItinerary={(trek) => {
                setItineraryModalTrek(trek);
                setItineraryModalType('itinerary');
              }}
              onViewFaq={(trek) => {
                setItineraryModalTrek(trek);
                setItineraryModalType('faq');
              }}
              onLeaveFeedback={(trek) => {
                setFeedbackModalTrek(trek);
                setFeedbackModalBooking(null);
                setShowFeedbackModal(true);
              }}
            />
          )}

          {currentTab === 'saved' && (
            <TrekListScreen
              treks={treks}
              loading={loadingTreks}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onRegister={(trek) => setSelectedTrekForRegister(trek)}
              onShare={(trek) => {
                setSelectedTrekForInvite(trek);
                setShowInviteModal(true);
              }}
              onViewItinerary={(trek) => {
                setItineraryModalTrek(trek);
                setItineraryModalType('itinerary');
              }}
              onViewFaq={(trek) => {
                setItineraryModalTrek(trek);
                setItineraryModalType('faq');
              }}
              savedOnly={true}
              onExploreAll={() => setCurrentTab('treks')}
              onLeaveFeedback={(trek) => {
                setFeedbackModalTrek(trek);
                setFeedbackModalBooking(null);
                setShowFeedbackModal(true);
              }}
            />
          )}

          {currentTab === 'bookings' && (
            <MyBookingsScreen
              bookings={bookings}
              loading={loadingBookings}
              onCancelBooking={handleCancelBooking}
              onExploreTreks={() => setCurrentTab('treks')}
              onShare={(booking) => {
                const matchedTrek = treks.find((t) => t.id === booking.trek_id || t.hike_number === booking.hike_number);
                setSelectedTrekForInvite(matchedTrek || null);
                setShowInviteModal(true);
              }}
              onLeaveFeedback={(booking) => {
                setFeedbackModalBooking(booking);
                const matchedTrek = treks.find((t) => t.id === booking.trek_id || t.hike_number === booking.hike_number);
                setFeedbackModalTrek(matchedTrek || null);
                setShowFeedbackModal(true);
              }}
              onViewItinerary={(booking) => {
                const matchedTrek = treks.find((t) => t.id === booking.trek_id || t.hike_number === booking.hike_number || t.name === booking.trek_name);
                if (matchedTrek) {
                  setItineraryModalTrek(matchedTrek);
                  setItineraryModalType('itinerary');
                }
              }}
            />
          )}

          {currentTab === 'admin' && (
            isAdmin || isAdminEmail(activeUserEmail) ? (
              <AdminDashboard currentUserEmail={activeUserEmail} />
            ) : (
              <div className="max-w-md mx-auto my-12 p-8 bg-white border border-[#E5E1DB] rounded-3xl shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FFF3E6] border border-[#FFE0BA] flex items-center justify-center text-[#E08828] shadow-xs">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-[#1F1F1F] tracking-tight">
                    Admin Operations Portal
                  </h2>
                  <p className="text-xs text-[#8B8680] leading-relaxed max-w-sm mx-auto">
                    This area is restricted to authorized Walk Nepal Walk hike coordinators. Please authenticate with an authorized administrator account (<span className="font-semibold text-[#1F1F1F]">walknepalwalk@gmail.com</span>).
                  </p>
                </div>
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={() => openAuthModal('Sign in with Admin email (walknepalwalk@gmail.com) to access the Admin Panel', () => setCurrentTab('admin'))}
                    className="w-full py-3 px-5 bg-[#E08828] hover:bg-[#cc781f] text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In to Admin Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('treks')}
                    className="w-full py-2.5 px-4 bg-[#F9F7F5] hover:bg-[#EFEAE4] text-[#5A5551] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Return to Treks Home
                  </button>
                </div>
              </div>
            )
          )}

          {currentTab === 'mapminers' && (
            <MapMinersDashboard
              currentUserEmail={activeUserEmail}
              isContributionOpen={showMapMinerContribute}
              onOpenContribution={() => setShowMapMinerContribute(true)}
              onCloseContribution={() => setShowMapMinerContribute(false)}
            />
          )}

          {currentTab === 'gallery' && (
            <GalleryScreen
              treks={treks}
              onOpenAuthModal={openAuthModal}
            />
          )}

          {currentTab === 'leaderboard' && (
            <LeaderboardScreen />
          )}

          {/* Micro App Footer inside shell */}
          {currentTab !== 'mapminers' && (
            <div className="mt-8 pt-6 border-t border-[#EFEAE4] text-center text-[11px] text-[#8B8680] space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-bold text-[#1F1F1F]">
                <img src="/logo.png" className="w-5 h-5 object-cover rounded-md" alt="WNW Logo" referrerPolicy="no-referrer" />
                <span>Walk Nepal Walk Mobile App</span>
              </div>
              <p className="text-[10px] text-[#8B8680] flex items-center justify-center gap-1">
                Himalayan Community Roster Platform • Made for Nepal Hikers
              </p>
            </div>
          )}
        </main>

        {/* Mobile Bottom Tab Navigation */}
        <BottomNav
          userEmail={activeUserEmail}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          bookingCount={bookings.length}
          savedCount={favorites.length}
          onOpenInfoPage={(page) => setInfoModalPage(page)}
          onOpenProfile={() => setProfileModalOpen(true)}
        />

        {/* Booking Registration Modal (Mobile Bottom Sheet) */}
        {Boolean(selectedTrekForRegister) && (
          <RegistrationModal
            trek={selectedTrekForRegister}
            allTreks={treks}
            userEmail={activeUserEmail}
            latestBooking={latestUserBooking}
            isOpen={Boolean(selectedTrekForRegister)}
            onClose={() => setSelectedTrekForRegister(null)}
            onSubmit={handleRegisterSubmit}
          />
        )}

        {/* Invite & Share Modal (Mobile Bottom Sheet) */}
        {showInviteModal && (
          <InviteModal
            isOpen={showInviteModal}
            onClose={() => {
              setShowInviteModal(false);
              setSelectedTrekForInvite(null);
            }}
            selectedTrek={selectedTrekForInvite}
          />
        )}

        {/* Itinerary & FAQ Preview Modal */}
        {Boolean(itineraryModalTrek) && (
          <ItineraryModal
            isOpen={Boolean(itineraryModalTrek)}
            onClose={() => setItineraryModalTrek(null)}
            trek={itineraryModalTrek}
            type={itineraryModalType}
            onRegister={(t) => {
              setItineraryModalTrek(null);
              setSelectedTrekForRegister(t);
            }}
          />
        )}

        {/* Trek Feedback Modal */}
        {showFeedbackModal && (
          <TrekFeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => {
              setShowFeedbackModal(false);
              setFeedbackModalTrek(null);
              setFeedbackModalBooking(null);
            }}
            trek={feedbackModalTrek}
            booking={feedbackModalBooking}
            currentUser={{
              name: feedbackModalBooking?.full_name || user?.displayName || 'Nepal Hiker',
              email: activeUserEmail,
            }}
            onSubmitSuccess={() => {
              showToast('Thank you for your feedback! Review saved.', 'success');
            }}
          />
        )}

        {/* Info Pages Modal (Payment, Tips, Safety, Private Trek, Contact) */}
        {Boolean(infoModalPage) && (
          <InfoPagesModal
            isOpen={Boolean(infoModalPage)}
            onClose={() => setInfoModalPage(null)}
            initialPage={infoModalPage || 'payment'}
            onSuccessSubmitted={async () => {
              await fetchBookings();
              showToast('Private Trek Request saved to Cloudflare!', 'success');
            }}
          />
        )}

        {/* Firebase Authentication Modal */}
        <AuthModal />

        {/* Hiker Profile & Booking History Modal */}
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          userBookings={bookings}
          allTreks={treks}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenTrek={(t) => setItineraryModalTrek(t)}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
