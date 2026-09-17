import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trek, Booking, TeamMember, BookingFormData } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { TrekListScreen } from './screens/TrekListScreen';
import { MyBookingsScreen } from './screens/MyBookingsScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { RegistrationModal } from './components/RegistrationModal';
import { InviteModal } from './components/InviteModal';
import { ItineraryModal } from './components/ItineraryModal';
import { TrekFeedbackModal } from './components/TrekFeedbackModal';
import { InfoPagesModal, SubPageType } from './components/InfoPagesModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FALLBACK_TREKS } from './data/fallbackTreks';
import { CheckCircle2, AlertCircle, Mountain, Heart, RefreshCw } from 'lucide-react';
import MapMinersDashboard from './components/mapminers/MapMinersDashboard';
import {
  apiFetch,
  normalizeTrek,
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

function MainApp() {
  const { user, userEmail, isAdmin, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<'treks' | 'bookings' | 'saved' | 'mapminers' | 'gallery' | 'admin'>('treks');
  const [treks, setTreks] = useState<Trek[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
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

  const activeUserEmail = userEmail || 'walknepalwalk@gmail.com';

  // Look up the most recent booking/registration made by the user to prefill future forms
  const latestUserBooking = React.useMemo(() => {
    if (!activeUserEmail) return null;
    const userEmailLower = activeUserEmail.toLowerCase().trim();
    const userBookings = bookings.filter(
      (b: any) => (b.email_address || b.user_email || b.email || '').toLowerCase().trim() === userEmailLower
    );
    return userBookings[0] || null;
  }, [bookings, activeUserEmail]);

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
      // 1. Fetch treks (uses persistent 10-minute session/memory cache if not forced)
      let baseTreks: Trek[] = [];
      try {
        const res = await apiFetch('/treks', { forceFresh: isForce });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          const trekItems = Array.isArray(data) ? data : data?.data;
          if (Array.isArray(trekItems) && trekItems.length > 0) {
            baseTreks = trekItems.map(normalizeTrek);
          }
        }
      } catch (err) {
        console.warn('Network issue fetching treks:', err);
      }

      if (baseTreks.length === 0) {
        baseTreks = FALLBACK_TREKS;
      }

      setTreks(baseTreks);

      // 2. Targeted User Bookings: Only fetch personal bookings if user is logged in
      // Notice: Public visitors never fetch the full registrations table
      if (activeUserEmail) {
        try {
          const userRegs = await fetchUserBookings(activeUserEmail);
          // Enrich bookings with trek is_cancelled and cancellation_reason if matched
          const enrichedBookings = userRegs.map((b: any) => {
            const matchedTrek = baseTreks.find(
              (t) =>
                (t.id && (t.id === b.trek_id || t.id === b.hike_id)) ||
                (t.hike_number && (t.hike_number === b.hike_number || t.hike_number === b.trek_id)) ||
                (t.name && b.trek_name && t.name.toLowerCase().trim() === b.trek_name.toLowerCase().trim())
            );
            return {
              ...b,
              is_cancelled: Boolean(b.is_cancelled || matchedTrek?.is_cancelled),
              cancellation_reason: b.cancellation_reason || matchedTrek?.cancellation_reason || '',
            };
          });
          setBookings(enrichedBookings);
        } catch (err) {
          console.warn('Could not fetch user personal bookings:', err);
        }
      } else {
        setBookings([]);
      }

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
  }, [activeUserEmail]);

  const fetchTreks = refreshData;
  const fetchBookings = refreshData;

  // On mount: Check if URL targets a specific shared trek (?trek=..., ?hike=..., or #itinerary-...)
  // Option 4: Immediately load ONLY that single itinerary row and its roster in <150ms!
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
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

  // When user visits Bookings tab, fetch their targeted bookings if logged in
  useEffect(() => {
    if (currentTab === 'bookings' && activeUserEmail) {
      setLoadingBookings(true);
      fetchUserBookings(activeUserEmail).then((userRegs) => {
        setBookings(userRegs);
        setLoadingBookings(false);
      });
    }
  }, [currentTab, activeUserEmail]);

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

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
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

    const res = await apiFetch('/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(primaryPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit booking');
    }

    // Submit team members separately to D1 just like server.ts did
    if (formData.team_members && formData.team_members.length > 0) {
      for (const tm of formData.team_members) {
        if (tm.full_name) {
          await apiFetch('/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
            })
          });
        }
      }
    }

    const toastMsg = data.message || 'Successfully registered & saved to Cloudflare D1!';
    showToast(toastMsg, 'success');
    await refreshData({ force: true });
    setCurrentTab('bookings');
  };

  const handleCancelBooking = async (bookingId: number) => {
    const res = await apiFetch(`/registrations/${bookingId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errText = await res.text();
      let errMsg = 'Failed to cancel booking';
      try {
        const errObj = JSON.parse(errText);
        errMsg = errObj.error || errMsg;
      } catch (e) {
        errMsg = errText || errMsg;
      }
      throw new Error(errMsg);
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

          {currentTab === 'admin' && (isAdmin || isAdminEmail(activeUserEmail)) && (
            <AdminDashboard currentUserEmail={activeUserEmail} />
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
