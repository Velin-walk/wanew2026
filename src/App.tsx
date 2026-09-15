import React, { useState, useEffect, useCallback } from 'react';
import { Trek, Booking, TeamMember, BookingFormData } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { TrekListScreen } from './screens/TrekListScreen';
import { MyBookingsScreen } from './screens/MyBookingsScreen';
import { RegistrationModal } from './components/RegistrationModal';
import { InviteModal } from './components/InviteModal';
import { ItineraryModal } from './components/ItineraryModal';
import { TrekFeedbackModal } from './components/TrekFeedbackModal';
import { InfoPagesModal, SubPageType } from './components/InfoPagesModal';
import { FALLBACK_TREKS } from './data/fallbackTreks';
import { CheckCircle2, AlertCircle, Mountain, Heart } from 'lucide-react';
import MapMinersDashboard from './components/mapminers/MapMinersDashboard';
import { apiFetch, normalizeTrek, enrichTreksWithRegistrations } from './services/api';
import { isAdminEmail } from './adminUtils';
import AdminDashboard from './components/admin/AdminDashboard';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'treks' | 'bookings' | 'saved' | 'mapminers' | 'admin'>('treks');
  const [treks, setTreks] = useState<Trek[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingTreks, setLoadingTreks] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

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

  const currentUserEmail = 'velinrai.VR@gmail.com';

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshData = useCallback(async () => {
    try {
      // 1. Fetch treks (Cloudflare Worker direct or server fallback)
      let baseTreks: Trek[] = [];
      try {
        const res = await apiFetch('/treks');
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

      // 2. Fetch live registrations directly from Cloudflare Worker D1
      let allRegs: any[] = [];
      try {
        const regRes = await apiFetch('/registrations');
        const regContentType = regRes.headers.get('content-type') || '';
        if (regRes.ok && regContentType.includes('application/json')) {
          const regJson = await regRes.json();
          const items = Array.isArray(regJson) ? regJson : regJson?.data;
          if (Array.isArray(items)) {
            allRegs = items;
          }
        }
      } catch (err) {
        console.warn('Network issue fetching registrations for live roster:', err);
      }

      // 3. Enrich treks with live participant counts and roster avatars
      const enrichedTreks = enrichTreksWithRegistrations(baseTreks, allRegs);
      setTreks(enrichedTreks);

      // 4. Update user's personal bookings
      if (allRegs.length > 0) {
        const userEmailLower = currentUserEmail.toLowerCase().trim();
        const myBookings = allRegs.filter(
          (r) => (r.email_address || r.user_email || '').toLowerCase().trim() === userEmailLower
        );
        setBookings(myBookings);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setLoadingTreks(false);
      setLoadingBookings(false);
    }
  }, [currentUserEmail]);

  const fetchTreks = refreshData;
  const fetchBookings = refreshData;

  useEffect(() => {
    refreshData();

    // Refresh every 8 seconds for live roster updates
    const interval = setInterval(() => {
      refreshData();
    }, 8000);

    return () => clearInterval(interval);
  }, [refreshData]);

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
      email_address: formData.email || currentUserEmail,
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
              email_address: formData.email || currentUserEmail,
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
    await fetchTreks();
    await fetchBookings();
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
    await fetchTreks();
    await fetchBookings();
  };

  return (
    <div className="min-h-screen bg-[#F3EFEA] md:bg-[#F9F7F5] flex flex-col items-center justify-start w-full">
      {/* Viewport Container: Compact phone container on mobile, full-width responsive on desktop */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-none bg-[#F9F7F5] min-h-screen flex flex-col relative shadow-sm sm:shadow-md md:shadow-none sm:border-x md:border-none sm:border-[#E5E1DB]">
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
          userEmail={currentUserEmail}
        />

        {/* Content Area - Scrollable with safe bottom padding for Mobile Tab Bar, full width desktop */}
        <main className={`flex-1 w-full ${currentTab === 'mapminers' ? 'p-0 max-w-none' : 'max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3 sm:py-6 pb-28 md:pb-12'}`}>
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

          {currentTab === 'admin' && isAdminEmail(currentUserEmail) && (
            <AdminDashboard currentUserEmail={currentUserEmail} />
          )}

          {currentTab === 'mapminers' && (
            <MapMinersDashboard
              currentUserEmail={currentUserEmail}
              isContributionOpen={showMapMinerContribute}
              onOpenContribution={() => setShowMapMinerContribute(true)}
              onCloseContribution={() => setShowMapMinerContribute(false)}
            />
          )}

          {/* Micro App Footer inside shell */}
          {currentTab !== 'mapminers' && (
            <div className="mt-8 pt-6 border-t border-[#EFEAE4] text-center text-[11px] text-[#8B8680] space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-bold text-[#1F1F1F]">
                <img src="/logo.png" className="w-4 h-4 object-contain" alt="WNW Logo" referrerPolicy="no-referrer" />
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
            userEmail={currentUserEmail}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          bookingCount={bookings.length}
          savedCount={favorites.length}
          onOpenInfoPage={(page) => setInfoModalPage(page)}
        />

        {/* Booking Registration Modal (Mobile Bottom Sheet) */}
        {Boolean(selectedTrekForRegister) && (
          <RegistrationModal
            trek={selectedTrekForRegister}
            allTreks={treks}
            userEmail={currentUserEmail}
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
              name: feedbackModalBooking?.full_name || 'Velin Rai',
              email: currentUserEmail,
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
          />
        )}
      </div>
    </div>
  );
}
