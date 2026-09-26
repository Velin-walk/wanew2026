import React, { useState, useEffect, useMemo } from 'react';
import { TrekTipsContent } from './TrekTipsContent';
import { apiFetch } from '../services/api';
import {
  X,
  CreditCard,
  ShieldCheck,
  Compass,
  Mail,
  MessageSquare,
  HelpCircle,
  Phone,
  CheckCircle2,
  Lock,
  QrCode,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  FileText,
  AlertCircle,
  Star,
  Quote,
  RefreshCw,
  Award,
  ArrowRight,
  Filter,
  Search,
  UploadCloud,
} from 'lucide-react';
import { HISTORIC_COMMUNITY_REVIEWS } from '../data/historicReviews';
import { ReviewsAnalyticsBoard } from './ReviewsAnalyticsBoard';

export type SubPageType = 'payment' | 'trek_tips' | 'safety_policy' | 'reviews' | 'request_private_trek' | 'contact' | 'about';

interface InfoPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPage?: SubPageType;
  onSuccessSubmitted?: () => void;
  onNavigateToBookings?: () => void;
  onOpenVoucherUpload?: () => void;
}

export const InfoPagesModal: React.FC<InfoPagesModalProps> = ({
  isOpen,
  onClose,
  initialPage = 'payment',
  onSuccessSubmitted,
  onNavigateToBookings,
  onOpenVoucherUpload,
}) => {
  const [activeTab, setActiveTab] = useState<SubPageType>(initialPage);

  // Sync initial tab when reopened
  useEffect(() => {
    if (isOpen && initialPage) {
      setActiveTab(initialPage);
    }
  }, [isOpen, initialPage]);

  // Private Trek Form State
  const [budgetValue, setBudgetValue] = useState<number>(1000);
  const [isSubmittingPrivate, setIsSubmittingPrivate] = useState<boolean>(false);
  const [privateSubmitError, setPrivateSubmitError] = useState<string | null>(null);
  const [lastSubmittedInfo, setLastSubmittedInfo] = useState<{
    destination: string;
    fullName: string;
    groupSize: number;
    preferredDate: string;
    phone: string;
  } | null>(null);
  const [privateSubmitted, setPrivateSubmitted] = useState<boolean>(false);

  // Reviews & Feedback State (Static baseline + local client cache for zero Cloudflare read/write overhead)
  const [liveReviews, setLiveReviews] = useState<any[]>(() => {
    try {
      const local = localStorage.getItem('wnw_user_feedbacks');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | '5star' | 'team'>('all');
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [selectedTrekPill, setSelectedTrekPill] = useState<string>('');
  const [starRatingFilter, setStarRatingFilter] = useState<number | 'all'>('all');

  // Manual refresh from Cloudflare D1 only when user explicitly requests
  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await apiFetch('/feedback', { forceFresh: true });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data) && json.data.length > 0) {
          setLiveReviews((prev) => {
            const merged = [...prev];
            for (const item of json.data) {
              if (!merged.some(m => m.id === item.id || (m.full_name === item.full_name && m.submitted_at === item.submitted_at && m.overall_feedback === item.overall_feedback))) {
                merged.unshift(item);
              }
            }
            try {
              localStorage.setItem('wnw_user_feedbacks', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load feedback from D1:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const allReviewsCombined = useMemo(() => {
    const normalizedLive = (liveReviews || []).map((r: any) => ({
      id: r.id ? `live-${r.id}` : `live-${r.uid || Math.random()}`,
      full_name: r.full_name || r.name || 'Verified Hiker',
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

    // Sort descending by submission date so the most recent reviews appear first
    return combined.sort((a, b) => {
      const dateA = a.submitted_at || '';
      const dateB = b.submitted_at || '';
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
      if (a.id.startsWith('live') && !b.id.startsWith('live')) return -1;
      if (!a.id.startsWith('live') && b.id.startsWith('live')) return 1;
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });
  }, [liveReviews]);

  const reviewStats = useMemo(() => {
    const total = allReviewsCombined.length;
    if (total === 0) return { avgOverall: '4.9', avgTeam: '4.9', count: 0 };
    const sumOverall = allReviewsCombined.reduce((acc, r) => acc + (r.overall_rating || 5), 0);
    const sumTeam = allReviewsCombined.reduce((acc, r) => acc + (r.team_rating || 5), 0);
    return {
      avgOverall: (sumOverall / total).toFixed(1),
      avgTeam: (sumTeam / total).toFixed(1),
      count: total,
    };
  }, [allReviewsCombined]);

  const displayReviews = useMemo(() => {
    return allReviewsCombined.filter((item) => {
      if (reviewFilter === '5star' && (item.overall_rating < 5 || item.team_rating < 5)) {
        return false;
      }
      if (reviewFilter === 'team' && !item.team_feedback) {
        return false;
      }
      if (starRatingFilter !== 'all' && Math.round(item.overall_rating) !== starRatingFilter) {
        return false;
      }
      if (selectedTrekPill) {
        if (!item.trek_name.toLowerCase().includes(selectedTrekPill.toLowerCase())) {
          return false;
        }
      }
      if (reviewSearch.trim()) {
        const query = reviewSearch.toLowerCase();
        const matchesName = item.full_name.toLowerCase().includes(query);
        const matchesTrek = item.trek_name.toLowerCase().includes(query);
        const matchesHikeNum = String(item.hike_number || '').toLowerCase().includes(query);
        const matchesFeedback = item.overall_feedback.toLowerCase().includes(query);
        const matchesTeamFeedback = (item.team_feedback || '').toLowerCase().includes(query);
        if (!matchesName && !matchesTrek && !matchesHikeNum && !matchesFeedback && !matchesTeamFeedback) {
          return false;
        }
      }
      return true;
    });
  }, [allReviewsCombined, reviewFilter, reviewSearch, starRatingFilter, selectedTrekPill]);

  // Submit Private Trek to Cloudflare Worker
  const handlePrivateTrekSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingPrivate(true);
    setPrivateSubmitError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const fullName = ((formData.get('fullName') as string) || '').trim();
    const email = ((formData.get('email') as string) || '').trim();
    const phone = ((formData.get('phone') as string) || '').trim();
    const destination = ((formData.get('destination') as string) || 'Custom Himalayan Route').trim();
    const groupSize = parseInt((formData.get('groupSize') as string) || '1', 10) || 1;
    const durationDays = ((formData.get('durationDays') as string) || '').trim();
    const preferredDate = ((formData.get('preferredDate') as string) || '').trim();
    const fitnessLevel = (formData.get('fitness') as string) === '3' ? 'Advanced' : (formData.get('fitness') as string) === '1' ? 'Beginner' : 'Intermediate';
    const qExperience = formData.get('q_experience') === 'yes' ? 'Yes (Has trek experience)' : 'No prior multi-day trek';
    const qStamina = formData.get('q_stamina') === 'yes' ? 'Yes (Can walk 6+ hrs)' : 'Prefers shorter pacing';
    const accommodations = formData.getAll('accommodation').join(', ');
    const transports = formData.getAll('transport').join(', ');
    const ageRange = ((formData.get('ageRange') as string) || '').trim();
    const medicalDietary = ((formData.get('medicalDietary') as string) || '').trim();
    const interests = formData.getAll('interests').join(', ');
    const pickupCity = ((formData.get('pickupCity') as string) || 'Kathmandu').trim();
    const specialRequests = ((formData.get('specialRequests') as string) || '').trim();
    const anythingElse = ((formData.get('anythingElse') as string) || '').trim();

    // Compile comprehensive private enquiry remarks
    const remarks = [
      `[PRIVATE TREK REQUEST]`,
      `• Destination: ${destination}`,
      `• Group Size: ${groupSize} pax`,
      durationDays ? `• Planned Duration: ${durationDays} Days` : '',
      preferredDate ? `• Date Window: ${preferredDate}` : '',
      `• Estimated Budget: USD $${budgetValue.toLocaleString()}/person`,
      accommodations ? `• Accommodation: ${accommodations}` : '',
      transports ? `• Transport: ${transports}` : '',
      pickupCity ? `• Starting/Pickup City: ${pickupCity}` : '',
      `• Fitness & Prior Trek Experience: ${fitnessLevel} (${qExperience}, ${qStamina})`,
      ageRange ? `• Group Ages: ${ageRange}` : '',
      medicalDietary ? `• Medical / Dietary Needs: ${medicalDietary}` : '',
      interests ? `• Trail Interests: ${interests}` : '',
      specialRequests ? `• Special Requests: ${specialRequests}` : '',
      anythingElse ? `• Additional Notes: ${anythingElse}` : '',
    ].filter(Boolean).join('\n');

    const payload = {
      hike_number: 'PRIVATE',
      trek_name: `Private: ${destination}`,
      full_name: fullName,
      pax: groupSize,
      phone: phone,
      whatsapp: phone,
      whatsapp_number: phone,
      email_address: email,
      emergency_backup_contact: phone,
      profession: 'Private Explorer',
      part_of_group: groupSize > 1 ? 'Group' : 'Solo',
      list_name: `Private - ${destination} (${preferredDate || 'Custom'})`,
      age_group: ageRange || 'Adult',
      gender: 'Custom',
      fitness: fitnessLevel,
      medical_condition: medicalDietary || 'No',
      recent_hikes: 'Private Request',
      agreement: 'Yes',
      suggestions: anythingElse || specialRequests || '',
      guide_mode: 'Private Guide',
      transport_mode: transports || 'Private Transport',
      person_remarks: remarks,
      status: 'Pending',
      payment_status: 'Unpaid',
      paid_amount: 0,
      due_amount: 0,
      admin_notes: `Private trek inquiry for ${destination} (${groupSize} pax, budget ~$${budgetValue})`,
      pickup_point: pickupCity,
    };

    try {
      const res = await apiFetch('registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errMsg = 'Failed to submit private trek request';
        try {
          const errObj = JSON.parse(errorText);
          errMsg = errObj.error || errObj.message || errMsg;
        } catch {
          errMsg = errorText || errMsg;
        }
        throw new Error(errMsg);
      }

      setLastSubmittedInfo({
        destination,
        fullName,
        groupSize,
        preferredDate: preferredDate || 'Flexible',
        phone,
      });
      setPrivateSubmitted(true);
      onSuccessSubmitted?.();
    } catch (err: any) {
      console.error('Error submitting private trek:', err);
      setPrivateSubmitError(err?.message || 'Failed to submit request. Please check your network.');
    } finally {
      setIsSubmittingPrivate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 md:p-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl md:rounded-none w-full max-w-4xl md:max-w-none md:w-screen md:h-screen md:max-h-screen max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#E5E1DB] md:border-0">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-[#F0EBE5] flex items-center justify-between bg-[#FDFBF9] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center text-[#7ABA42] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F1F1F]">Walk Nepal Walk Resources & Services</h2>
              <p className="text-xs text-[#8B8680]">Guides, Policies, Private Treks & Direct Support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-[#F3F0EC] rounded-xl transition-all cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar + Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Navigation Drawer / Sub-Tabs with Scrollbar hiding and visual fade mask on mobile */}
          <div className="relative w-full md:w-60 bg-[#F9F7F5] border-b md:border-b-0 md:border-r border-[#E5E1DB] shrink-0">
            <style dangerouslySetInnerHTML={{__html: `
              .no-scrollbar-x {
                -ms-overflow-style: none; /* IE/Edge */
                scrollbar-width: none; /* Firefox */
              }
              .no-scrollbar-x::-webkit-scrollbar {
                display: none; /* Chrome/Safari */
              }
            `}} />
            
            <nav className="no-scrollbar-x w-full p-2.5 sm:p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible items-center md:items-stretch relative z-10">
              <button
                type="button"
                onClick={() => setActiveTab('payment')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'payment'
                    ? 'bg-white text-[#1F1F1F] shadow-xs border border-[#E5E1DB]'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === 'payment' ? 'text-[#7ABA42]' : 'text-[#8B8680]'}`} />
                <span>Payment & Pricing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('trek_tips')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'trek_tips'
                    ? 'bg-white text-[#1F1F1F] shadow-xs border border-[#E5E1DB]'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <Compass className={`w-4 h-4 shrink-0 ${activeTab === 'trek_tips' ? 'text-[#7ABA42]' : 'text-[#8B8680]'}`} />
                <span>Trek Tips & Packing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('safety_policy')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'safety_policy'
                    ? 'bg-white text-[#1F1F1F] shadow-xs border border-[#E5E1DB]'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'safety_policy' ? 'text-[#7ABA42]' : 'text-[#8B8680]'}`} />
                <span>Safety & Refund Policy</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'reviews'
                    ? 'bg-white text-amber-700 shadow-xs border border-amber-200'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <Star className={`w-4 h-4 shrink-0 ${activeTab === 'reviews' ? 'text-amber-500 fill-amber-500' : 'text-[#8B8680]'}`} />
                <span>Hiker Reviews</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('request_private_trek')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'request_private_trek'
                    ? 'bg-white text-[#E08828] shadow-xs border border-[#E08828]/30'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeTab === 'request_private_trek' ? 'text-[#E08828]' : 'text-[#8B8680]'}`} />
                <span>Request Private Trek</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contact')}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeTab === 'contact'
                    ? 'bg-white text-[#1F1F1F] shadow-xs border border-[#E5E1DB]'
                    : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
                }`}
              >
                <Mail className={`w-4 h-4 shrink-0 ${activeTab === 'contact' ? 'text-[#7ABA42]' : 'text-[#8B8680]'}`} />
                <span>Contact & Support</span>
              </button>
            </nav>

            {/* Fading left & right swipe indicators for premium visual polish on mobile */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#F9F7F5] to-transparent pointer-events-none md:hidden z-20" />
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#F9F7F5] to-transparent pointer-events-none md:hidden z-20" />
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white text-neutral-800">
            
            {/* 1. PAYMENT & PRICING */}
            {activeTab === 'payment' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b border-[#F0EBE5] pb-3">
                  <h3 className="text-lg font-extrabold text-[#1F1F1F]">Payment Methods & Transparent Pricing</h3>
                  <p className="text-xs text-[#8B8680] mt-0.5">Secure, community-backed transparent payment guidelines for all Himalayan treks.</p>
                </div>

                <div className="flex justify-center bg-[#FAF8F5] p-3 rounded-2xl border border-[#E5E1DB]">
                  <img src="/paymentqr.png" alt="Payment QR Codes" className="max-w-sm w-full h-auto rounded-xl object-contain shadow-2xs" />
                </div>

                {/* Forward Voucher Button at the end of Payment & Pricing page */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1DB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#1F1F1F] flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#E08828]" />
                      Already Made A Payment Transfer?
                    </h4>
                    <p className="text-[11px] text-[#8B8680] mt-0.5 leading-relaxed">
                      Forward your payment receipt screenshot or transaction voucher so our coordinators can verify and update your booking roster immediately.
                    </p>
                  </div>
                  {onOpenVoucherUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenVoucherUpload();
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#E08828] hover:bg-[#cc781f] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Forward Voucher</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 2. TREK TIPS & PACKING */}
            {activeTab === 'trek_tips' && (
              <TrekTipsContent />
            )}

            {/* 3. SAFETY & REFUND POLICY */}
            {activeTab === 'safety_policy' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b border-[#F0EBE5] pb-3">
                  <h3 className="text-lg font-extrabold text-[#1F1F1F]">Safety & Refund Policy</h3>
                  <p className="text-xs text-[#8B8680] mt-0.5">Frequently asked questions (FAQ) on health, payment, cancellation, and trail rules.</p>
                </div>

                <div className="space-y-3 text-xs text-[#5A5551] leading-relaxed">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#7ABA42]" />
                      Fitness acknowledgement
                    </h4>
                    <p className="text-emerald-950">
                      I am physically and medically fit to participate in hiking/trekking. I acknowledge that hiking/trekking involve real risks, including altitude and changing conditions, and I willingly choose to participate, taking responsibility for my own safety and decisions.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Health, First Aid and Insurance policy</h4>
                    <p className="font-bold text-[#1F1F1F]">Safety first</p>
                    <p>Safety is our top priority. We provide information on any challenges that could possibly impact your health and safety before the event.</p>
                    <p>Your health is your responsibility, but we make sure you receive health support when needed, when available.</p>
                    <p>Any injury is your responsibility, but we make sure you receive support when needed, when available.</p>
                    <p>We provide available support at the area with utmost sincerity and dedication. However, any rescue operation expenses or medical expenses incurred shall be borne by the participant themselves.</p>
                    <p>Basic first aid is available with the Trail Coordinator.</p>
                    <p><strong className="text-[#1F1F1F]">Insurance:</strong> We do not provide any insurance. You shall facilitate your own insurance if any is needed.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#E08828]" />
                      Payment, cancellation and refund policy
                    </h4>
                    <p className="font-bold text-[#1F1F1F]">Payment</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>50% advance payment is required for the booking.</li>
                      <li>The remaining 50% shall be paid at the place and time fixed during the hike/trek.</li>
                      <li>Online payment is preferred.</li>
                    </ul>
                    <p className="font-bold text-[#1F1F1F]">Cancellation</p>
                    <p>Can be cancelled anytime by both parties by giving pre-notice.</p>
                    <p className="font-bold text-[#1F1F1F]">Refund</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>If cancelled by the organizer: 100% refund.</li>
                      <li>If cancelled by a participant before 48 hours of the event: 10% of the package shall be charged as admin fee. The balance shall be refunded.</li>
                      <li>If cancelled by a participant when only 48 hours or less remain for the event: no refund.</li>
                    </ul>
                    <p className="font-bold text-[#1F1F1F]">Transfer or replacement</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Another person can come instead of a pre-informed person.</li>
                      <li>Booking of one event is not transferable to another event.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Natural calamity, road blockage or unforeseen events</h4>
                    <p>We shall attempt to complete the event with optimum safety. However, continuing the event by compromising safety shall not happen.</p>
                    <p>All extra costs incurred for other than promised services shall be borne by the participant themselves.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Alcohol, drugs, or sense-numbing substances</h4>
                    <p>Any sense-numbing substances are discouraged. You might slip and hurt yourself. You might behave unconsciously and regret later. We might lose the essence of hiking. Please drink at your own risk.</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Drinking is allowed on overnight hikes and customized hikes where participants are familiar with the group.</li>
                      <li>Not allowed for school and college hikes and day hikes.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Slow vs fast pacer</h4>
                    <p>We appreciate your pace and fitness. However, we want to make sure no one is left behind or far ahead. Every 30 minutes or so we request everyone to wait for fellow hikers.</p>
                    <p>Pace of every person is different. We are happy to assist, but we expect you to be able to walk at least 1 km within 20 minutes. We provide information on level of difficulty, distance, elevation, and duration of the hike. It will help you estimate whether you can complete that specific hike or not.</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Event postpone or cancellation</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>The organizer can postpone and cancel the event at the convenience of the organizer.</li>
                      <li>The organizer can accept or reject participation applications at will for management.</li>
                      <li>The organizer can take actions at will for the safety and management of the team.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <h4 className="font-bold text-sm text-[#1F1F1F]">Mandatory rules for all hikes</h4>
                    <p>We know all our participants are rational beings who love nature. These are precautionary rules and are only intended for the well-being of participants. These rules are to establish average behaviour and are flexible to conscious actions.</p>
                    <ul className="list-disc pl-4 space-y-1.5">
                      <li>Do not hamper agriculture and culture of anyone on the trail.</li>
                      <li>Do not harm nature in any way. Breaking branches, plucking flowers, uprooting plants, throwing garbage is strictly prohibited. However, seasonal wild fruits like Chutro, Kafal, Aiselu can be eaten without breaking branches.</li>
                      <li>Do not play music while walking. Music is only allowed nearby tea house / breakfast breaks. Strictly prohibited on jungle trails.</li>
                      <li>Drinking, smoking or taking any intoxicating substances are not allowed. Hikers causing and influencing others to participate in such activity shall be immediately dropped. However, responsible and private consumption without hampering the essence of the hike is allowed.</li>
                      <li>We believe in creating a safe and secure environment for every participant, regardless of gender identity. Any form of abuse will not be tolerated. If you have specific concerns or need to report something, please feel free to share, and we will do our best to address it.</li>
                      <li>False information, spam, manipulation, hate speech, harassment, abuse, nudity or any unethical, immoral, illegal messages/activity shall be forwarded to relevant authority.</li>
                      <li>By default, taking photos and videos is allowed by/of everyone. If anyone does not want their photo/video taken, pre-inform the organizer.</li>
                      <li>By default, every participant is assumed to be able to walk a minimum of 15 km distance and 1 km climb within 8 hours. You are responsible to complete the trail on your own, on time. We are happy to assist.</li>
                      <li>Organisers shall not be obligated to take hikers who fail to reach the mentioned destination on time.</li>
                      <li>Any injury or health issue is your own responsibility. We are happy to assist.</li>
                      <li>By default, everyone shall stick to the group. However, leaving the group is allowed by informing the organizer if needed.</li>
                      <li>For any unforeseen situations, judgement of the organiser shall be final.</li>
                    </ul>
                    <p>
                      For any dissatisfaction email{' '}
                      <a href="mailto:walknepalwalk@gmail.com" className="font-bold text-[#7ABA42] hover:underline">
                        walknepalwalk@gmail.com
                      </a>{' '}
                      or any Admin Panel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. REQUEST PRIVATE TREK */}
            {activeTab === 'request_private_trek' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <style>{`
                  .trek-fieldset { border-bottom: 1px solid #E5E1DB; margin-bottom: 0; padding: 24px 0; }
                  .trek-fieldset:first-of-type { padding-top: 0; }
                  .trek-fieldset:last-of-type { border-bottom: none; }
                  .trek-section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; }
                  .trek-section-index { font-family: 'Courier New', monospace; font-size: 12px; color: #F0A93D; border: 1px solid #E5E1DB; padding: 2px 6px; border-radius: 3px; }
                  .trek-section-title { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin: 0; }
                  .trek-field { margin-bottom: 18px; }
                  .trek-field:last-child { margin-bottom: 0; }
                  .trek-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                  @media (max-width: 640px) { .trek-field-row { grid-template-columns: 1fr; } }
                  .trek-field-row-3 { grid-template-columns: repeat(3, 1fr); }
                  @media (max-width: 640px) { .trek-field-row-3 { grid-template-columns: 1fr; } }
                  .trek-label { display: block; font-size: 13px; color: #5C7267; margin-bottom: 6px; font-weight: 500; }
                  .trek-req { color: #E2703A; margin-left: 3px; }
                  .trek-opt { font-family: 'Courier New', monospace; font-size: 10px; color: #8FA398; text-transform: uppercase; letter-spacing: 0.08em; margin-left: 6px; }
                  .trek-input, .trek-select, .trek-textarea { width: 100%; background: #F6FAF3; border: 1px solid #E7F1EA; color: #223229; font-family: 'Work Sans', sans-serif; font-size: 14px; padding: 10px 12px; border-radius: 3px; outline: none; transition: border-color 0.15s ease; }
                  .trek-input:focus, .trek-select:focus, .trek-textarea:focus { border-color: #2FA79E; box-shadow: 0 0 0 3px rgba(47,167,158,0.22); }
                  .trek-input::placeholder, .trek-textarea::placeholder { color: #8FA398; }
                  .trek-textarea { min-height: 80px; resize: vertical; }
                  .trek-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C7267' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
                  .trek-hint { font-size: 12px; color: #8FA398; margin-top: 5px; }
                  .trek-card-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                  @media (max-width: 640px) { .trek-card-group { grid-template-columns: 1fr; } }
                  .trek-card { border: 1px solid #E7F1EA; background: #F6FAF3; border-radius: 3px; padding: 12px; cursor: pointer; display: block; }
                  .trek-card input { position: absolute; opacity: 0; pointer-events: none; }
                  .trek-card-title { font-size: 15px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
                  .trek-card-desc { font-size: 12px; color: #5C7267; }
                  .trek-card:has(input:checked) { border-color: #F0A93D; background: rgba(240,169,61,0.12); }
                  .trek-card:has(input:checked) .trek-card-title { color: #F0A93D; }
                  .trek-chip-group { display: flex; flex-wrap: wrap; gap: 8px; }
                  .trek-chip { position: relative; }
                  .trek-chip input { position: absolute; opacity: 0; pointer-events: none; }
                  .trek-chip label { margin: 0; font-size: 13px; padding: 7px 13px; border: 1px solid #E7F1EA; border-radius: 999px; cursor: pointer; color: #5C7267; display: inline-block; }
                  .trek-chip:has(input:checked) label { border-color: #F0A93D; color: #223229; background: rgba(240,169,61,0.14); }
                  .trek-range { width: 100%; accent-color: #F0A93D; }
                  .trek-range-value { font-family: 'Courier New', monospace; color: #F0A93D; font-size: 14px; }
                  .trek-details { border: 1px dashed #E7F1EA; border-radius: 3px; padding: 12px 14px; }
                  .trek-details[open] { padding-bottom: 18px; }
                  .trek-details summary { cursor: pointer; font-size: 14px; color: #2FA79E; list-style: none; display: flex; align-items: center; gap: 8px; }
                  .trek-details summary::-webkit-details-marker { display: none; }
                  .trek-details summary::before { content: "+"; font-family: 'Courier New', monospace; border: 1px solid #2FA79E; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
                  .trek-details[open] summary::before { content: "–"; }
                  .trek-details .trek-field { margin-top: 16px; }
                  .trek-details .trek-field:first-of-type { margin-top: 18px; }
                  .trek-submit-btn { width: 100%; background: #F0A93D; color: #16231F; border: none; font-family: 'Big Shoulders Display', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; font-size: 16px; font-weight: 700; padding: 12px; border-radius: 3px; cursor: pointer; transition: background 0.15s ease; margin-top: 24px; }
                  .trek-submit-btn:hover { background: #DBAE55; }
                  .trek-submit-btn:active { transform: translateY(1px); }
                  .trek-submit-note { text-align: center; font-size: 11px; color: #8FA398; margin-top: 10px; }
                `}</style>

                {privateSubmitted ? (
                  <div className="py-10 px-6 text-center space-y-4 max-w-lg mx-auto animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-[#7ABA42] flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-[#1F1F1F]">Private Trek Request Submitted!</h3>
                      <p className="text-xs text-[#5A5551] mt-2 leading-relaxed">
                        Thank you! We have securely received your custom expedition inquiry. Our planning team will verify trail conditions, guide availability, and permits, then contact you via WhatsApp/Email within 24–48 hours with a customized itinerary draft and quote.
                      </p>
                    </div>

                    <div className="bg-[#FAF8F5] border border-[#E5E1DB] rounded-2xl p-4 text-left text-xs space-y-2 shadow-2xs">
                      <div className="flex justify-between items-center py-1 border-b border-[#F0EBE5]">
                        <span className="text-[#8B8680]">Destination:</span>
                        <span className="font-bold text-[#1F1F1F]">{lastSubmittedInfo?.destination || 'Custom Route'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#F0EBE5]">
                        <span className="text-[#8B8680]">Group Size:</span>
                        <span className="font-bold text-[#1F1F1F]">{lastSubmittedInfo?.groupSize} Pax</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#F0EBE5]">
                        <span className="text-[#8B8680]">Date Window:</span>
                        <span className="font-bold text-[#1F1F1F]">{lastSubmittedInfo?.preferredDate}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#8B8680]">Lead Trekker:</span>
                        <span className="font-bold text-[#1F1F1F]">{lastSubmittedInfo?.fullName}</span>
                      </div>
                    </div>

                    <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPrivateSubmitted(false);
                          onClose();
                        }}
                        className="w-full sm:w-auto px-6 py-2.5 bg-[#7ABA42] hover:bg-[#689f38] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                      >
                        Done &amp; Explore Treks
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrivateSubmitted(false)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-[#F9F7F5] hover:bg-[#EFEAE4] border border-[#E5E1DB] text-[#5A5551] rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Submit Another Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePrivateTrekSubmit} className="space-y-0">
                    {privateSubmitError && (
                      <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{privateSubmitError}</span>
                      </div>
                    )}

                    {/* 1. TREKKER DETAILS */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">01</span>
                        <legend className="trek-section-title">Trekker Details</legend>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Full name<span className="trek-req">*</span></label>
                        <input type="text" name="fullName" required placeholder="e.g. Priya Sharma" className="trek-input" />
                      </div>
                      <div className="trek-field-row">
                        <div className="trek-field">
                          <label className="trek-label">Email<span className="trek-req">*</span></label>
                          <input type="email" name="email" required placeholder="you@example.com" className="trek-input" />
                        </div>
                        <div className="trek-field">
                          <label className="trek-label">Phone / WhatsApp<span className="trek-req">*</span></label>
                          <input type="tel" name="phone" required placeholder="+977 98XXXXXXXX" className="trek-input" />
                        </div>
                      </div>
                    </fieldset>

                    {/* 2. ROUTE & TIMING */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">02</span>
                        <legend className="trek-section-title">Route & Timing</legend>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Preferred destination or region<span className="trek-req">*</span></label>
                        <input type="text" name="destination" required placeholder="Type a region, a specific route, or 'not sure — suggest one'" list="destinationList" className="trek-input" />
                        <datalist id="destinationList">
                          <option value="Everest Region" />
                          <option value="Annapurna Region" />
                          <option value="Langtang Region" />
                          <option value="Manaslu Region" />
                          <option value="Upper Mustang" />
                          <option value="Not sure — suggest one" />
                        </datalist>
                        <p className="trek-hint">Pick a suggestion or type your own route — custom requests welcome.</p>
                      </div>

                      <div className="trek-field-row">
                        <div className="trek-field">
                          <label className="trek-label">Group size<span className="trek-req">*</span></label>
                          <input type="number" name="groupSize" min="1" defaultValue="2" required placeholder="e.g. 2" className="trek-input" />
                        </div>
                        <div className="trek-field">
                          <label className="trek-label">Trip duration (days)<span className="trek-req">*</span></label>
                          <input type="number" name="durationDays" min="1" defaultValue="7" required placeholder="e.g. 7" className="trek-input" />
                        </div>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Preferred month or date window<span className="trek-req">*</span></label>
                        <input type="month" name="preferredDate" required className="trek-input" />
                        <p className="trek-hint">Rough is fine — helps us check permits and season conditions.</p>
                      </div>
                    </fieldset>

                    {/* 3. FITNESS & READINESS */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">03</span>
                        <legend className="trek-section-title">Fitness & Readiness</legend>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Experience level<span className="trek-req">*</span></label>
                        <div className="trek-card-group">
                          <label className="trek-card">
                            <input type="radio" name="fitness" value="1" />
                            <div className="trek-card-title">Beginner</div>
                            <div className="trek-card-desc">First multi-day trek, comfortable on gentle trails.</div>
                          </label>
                          <label className="trek-card">
                            <input type="radio" name="fitness" value="2" defaultChecked />
                            <div className="trek-card-title">Intermediate</div>
                            <div className="trek-card-desc">Done a few treks, fine with long days and altitude.</div>
                          </label>
                          <label className="trek-card">
                            <input type="radio" name="fitness" value="3" />
                            <div className="trek-card-title">Advanced</div>
                            <div className="trek-card-desc">Seeking steep, remote, or high-altitude routes.</div>
                          </label>
                        </div>
                      </div>

                      <div className="trek-field" style={{ marginTop: '18px' }}>
                        <label className="trek-label" style={{ marginBottom: 0 }}>Quick check <span className="trek-opt">optional — sharpens your route profile above</span></label>
                        <div style={{ borderTop: '1px solid #E7F1EA', paddingTop: '10px', marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #E7F1EA' }}>
                            <p style={{ margin: 0, fontSize: '14px' }}>Have you done a multi-day trek before?</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <label style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E7F1EA', borderRadius: '3px', cursor: 'pointer', color: '#5C7267' }}>
                                <input type="radio" name="q_experience" value="yes" defaultChecked style={{ marginRight: '4px' }} />
                                Yes
                              </label>
                              <label style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E7F1EA', borderRadius: '3px', cursor: 'pointer', color: '#5C7267' }}>
                                <input type="radio" name="q_experience" value="no" style={{ marginRight: '4px' }} />
                                No
                              </label>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #E7F1EA' }}>
                            <p style={{ margin: 0, fontSize: '14px' }}>Comfortable walking 6+ hours a day?</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <label style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E7F1EA', borderRadius: '3px', cursor: 'pointer', color: '#5C7267' }}>
                                <input type="radio" name="q_stamina" value="yes" defaultChecked style={{ marginRight: '4px' }} />
                                Yes
                              </label>
                              <label style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #E7F1EA', borderRadius: '3px', cursor: 'pointer', color: '#5C7267' }}>
                                <input type="radio" name="q_stamina" value="no" style={{ marginRight: '4px' }} />
                                No
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </fieldset>

                    {/* 4. BUDGET & STAY */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">04</span>
                        <legend className="trek-section-title">Budget & Stay</legend>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Approx. budget per person (USD)<span className="trek-req">*</span></label>
                        <input
                          type="range"
                          name="budgetUSD"
                          min="200"
                          max="5000"
                          step="50"
                          value={budgetValue}
                          className="trek-range"
                          onChange={(e) => setBudgetValue(Number(e.target.value))}
                        />
                        <p className="trek-hint">Target approx: <span className="trek-range-value">${budgetValue.toLocaleString()}</span> USD / person</p>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Accommodation preference</label>
                        <div className="trek-chip-group">
                          <span className="trek-chip"><input type="checkbox" id="acc1" name="accommodation" value="teahouse" defaultChecked /><label htmlFor="acc1">Teahouse / lodge</label></span>
                          <span className="trek-chip"><input type="checkbox" id="acc2" name="accommodation" value="camping" /><label htmlFor="acc2">Camping</label></span>
                          <span className="trek-chip"><input type="checkbox" id="acc3" name="accommodation" value="homestay" /><label htmlFor="acc3">Homestay</label></span>
                          <span className="trek-chip"><input type="checkbox" id="acc4" name="accommodation" value="mix" /><label htmlFor="acc4">A mix / flexible</label></span>
                        </div>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Transport preference</label>
                        <div className="trek-chip-group">
                          <span className="trek-chip"><input type="checkbox" id="tr1" name="transport" value="aeroplane" /><label htmlFor="tr1">Aeroplane</label></span>
                          <span className="trek-chip"><input type="checkbox" id="tr2" name="transport" value="helicopter" /><label htmlFor="tr2">Helicopter</label></span>
                          <span className="trek-chip"><input type="checkbox" id="tr3" name="transport" value="private_jeep" defaultChecked /><label htmlFor="tr3">Private jeep</label></span>
                          <span className="trek-chip"><input type="checkbox" id="tr4" name="transport" value="public_bus" /><label htmlFor="tr4">Public bus</label></span>
                        </div>
                      </div>
                    </fieldset>

                    {/* 5. MORE DETAILS */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">05</span>
                        <legend className="trek-section-title">More Details</legend>
                      </div>

                      <details className="trek-details">
                        <summary>Add ages, dietary needs, interests & more (optional)</summary>

                        <div className="trek-field">
                          <label className="trek-label">Age range of group members</label>
                          <input type="text" name="ageRange" placeholder="e.g. 28–45, or includes two kids (8, 11)" className="trek-input" />
                        </div>

                        <div className="trek-field">
                          <label className="trek-label">Medical conditions or dietary restrictions</label>
                          <textarea name="medicalDietary" placeholder="Anything we should plan meals or pacing around" className="trek-textarea"></textarea>
                        </div>

                        <div className="trek-field">
                          <label className="trek-label">Interests</label>
                          <div className="trek-chip-group">
                            <span className="trek-chip"><input type="checkbox" id="int1" name="interests" value="culture" defaultChecked /><label htmlFor="int1">Culture & villages</label></span>
                            <span className="trek-chip"><input type="checkbox" id="int2" name="interests" value="wildlife" /><label htmlFor="int2">Wildlife</label></span>
                            <span className="trek-chip"><input type="checkbox" id="int3" name="interests" value="photography" defaultChecked /><label htmlFor="int3">Photography</label></span>
                            <span className="trek-chip"><input type="checkbox" id="int4" name="interests" value="offbeat" /><label htmlFor="int4">Off-beat routes</label></span>
                            <span className="trek-chip"><input type="checkbox" id="int5" name="interests" value="summit" /><label htmlFor="int5">Summit climbs</label></span>
                          </div>
                        </div>

                        <div className="trek-field">
                          <label className="trek-label">Starting city / pickup point</label>
                          <input type="text" name="pickupCity" placeholder="e.g. Kathmandu or Pokhara" className="trek-input" />
                        </div>

                        <div className="trek-field">
                          <label className="trek-label">Special requests</label>
                          <input type="text" name="specialRequests" placeholder="Private guide, existing permits, dietary chef, etc." className="trek-input" />
                        </div>
                      </details>
                    </fieldset>

                    {/* 6. ANYTHING ELSE */}
                    <fieldset className="trek-fieldset">
                      <div className="trek-section-head">
                        <span className="trek-section-index">06</span>
                        <legend className="trek-section-title">Anything Else</legend>
                      </div>
                      <div className="trek-field">
                        <label className="trek-label">Tell us anything else that would help us plan</label>
                        <textarea name="anythingElse" placeholder="Open field — write freely (e.g. pace preference, milestone anniversary, gear rentals)" className="trek-textarea"></textarea>
                      </div>
                    </fieldset>

                    <button
                      type="submit"
                      disabled={isSubmittingPrivate}
                      className="trek-submit-btn flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingPrivate ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Submitting to Expedition Team...</span>
                        </>
                      ) : (
                        <span>Send Trek Request</span>
                      )}
                    </button>
                    <p className="trek-submit-note">We typically reply within 24–48 hours with a first route draft &amp; quote.</p>
                  </form>
                )}
              </div>
            )}

            {/* 5. CONTACT & SUPPORT */}
            {activeTab === 'contact' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b border-[#F0EBE5] pb-3">
                  <h3 className="text-lg font-extrabold text-[#1F1F1F]">Contact &amp; Support</h3>
                  <p className="text-xs text-[#8B8680] mt-0.5">
                    Connect directly with our expedition team, coordinators, and logistics leads via WhatsApp, phone, or email.
                  </p>
                </div>

                {/* Primary Quick Contact Channels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* WhatsApp Direct */}
                  <a
                    href="https://wa.me/9779803568612?text=Hello%20Walk%20Nepal%20Walk!%20I%20have%20an%20inquiry%20regarding%20upcoming%20treks."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/15 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1F1F1F] group-hover:text-[#25D366] transition-colors">
                          WhatsApp Quick Chat
                        </div>
                        <div className="text-[11px] font-semibold text-[#5A5551]">
                          +977 980-3568612 / +977 986-0071064
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-[#25D366] bg-white px-2.5 py-1 rounded-full border border-[#25D366]/30 shrink-0">
                      Chat Now →
                    </span>
                  </a>

                  {/* Email Direct */}
                  <a
                    href="mailto:walknepalwalk@gmail.com?subject=Trek%20Inquiry%20-%20Walk%20Nepal%20Walk"
                    className="p-4 rounded-2xl bg-[#E08828]/10 border border-[#E08828]/30 hover:bg-[#E08828]/15 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#E08828] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-[#1F1F1F] group-hover:text-[#E08828] transition-colors">
                          Official Email
                        </div>
                        <div className="text-[11px] font-semibold text-[#5A5551]">
                          walknepalwalk@gmail.com
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-[#E08828] bg-white px-2.5 py-1 rounded-full border border-[#E08828]/30 shrink-0">
                      Write Email →
                    </span>
                  </a>
                </div>

                {/* Team Coordinators Roster with Instant Actions */}
                <div>
                  <h4 className="text-xs font-extrabold text-[#8B8680] uppercase tracking-wider mb-2.5">
                    Expedition Leads &amp; Operations Desk
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Biraj Thing */}
                    <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#1F1F1F]">Biraj Thing</h4>
                          <p className="text-[11px] font-bold text-[#7ABA42]">Sales &amp; Operations Director</p>
                        </div>
                        <a
                          href="https://wa.me/9779860071064?text=Hello%20Biraj,%20I%20have%20an%20inquiry%20about%20Walk%20Nepal%20Walk%20treks."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#1b8e44] border border-[#25D366]/20 hover:bg-[#25D366]/20"
                          title="Chat with Biraj on WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                      <div className="space-y-1 text-xs font-semibold text-[#1F1F1F]">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                          <a href="tel:+9779860071064" className="hover:text-[#7ABA42] hover:underline">+977 986-0071064</a>
                          <span className="text-[#8B8680] text-[11px]">(Primary)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                          <a href="tel:+9779803568612" className="hover:text-[#7ABA42] hover:underline">+977 980-3568612</a>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8B8680] leading-relaxed">Sales Head • Bookings • Operations • Logistics • Team Coordination</p>
                    </div>

                    {/* Salina Tamang */}
                    <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#1F1F1F]">Salina Tamang</h4>
                          <p className="text-[11px] font-bold text-[#E08828]">Sales &amp; Marketing, Office Operations</p>
                        </div>
                        <a
                          href="https://wa.me/9779803568612?text=Hello%20Salina,%20I%20have%20an%20inquiry%20about%20Walk%20Nepal%20Walk."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#1b8e44] border border-[#25D366]/20 hover:bg-[#25D366]/20"
                          title="Chat with Salina on WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                      <div className="space-y-1 text-xs font-semibold text-[#1F1F1F]">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                          <a href="tel:+9779803568612" className="hover:text-[#E08828] hover:underline">+977 980-3568612</a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                          <a href="tel:+9779705735061" className="hover:text-[#E08828] hover:underline">+977 970-5735061</a>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8B8680] leading-relaxed">Customer Support • Content Planning • Partnerships • Accounts &amp; Payments</p>
                    </div>

                    {/* Sundar Gurung */}
                    <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#1F1F1F]">Sundar Gurung</h4>
                          <p className="text-[11px] font-bold text-[#7ABA42]">Operations Advisor</p>
                        </div>
                        <a
                          href="https://wa.me/9779813844865?text=Hello%20Sundar,%20I%20have%20an%20inquiry%20regarding%20trail%20operations."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#1b8e44] border border-[#25D366]/20 hover:bg-[#25D366]/20"
                          title="Chat with Sundar on WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1F1F]">
                        <Phone className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
                        <a href="tel:+9779813844865" className="hover:text-[#7ABA42] hover:underline">+977 981-3844865</a>
                      </div>
                      <p className="text-[11px] text-[#8B8680] leading-relaxed">Operational Guidance • Quality Assurance • Trek Coordinator</p>
                    </div>

                    {/* Velin Rai */}
                    <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#1F1F1F]">Velin Rai</h4>
                          <p className="text-[11px] font-bold text-[#E08828]">Strategic Advisor</p>
                        </div>
                        <a
                          href="mailto:walknepalwalk@gmail.com?subject=Attn:%20Velin%20Rai%20-%20Walk%20Nepal%20Walk"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Contact</span>
                        </a>
                      </div>
                      <div className="text-xs font-semibold text-[#1F1F1F]">
                        Business Strategy • Finance &amp; IT Systems
                      </div>
                      <p className="text-[11px] text-[#8B8680] leading-relaxed">Infrastructure • Digital Systems • Strategy</p>
                    </div>
                  </div>
                </div>

                {/* Physical Hub & Working Hours */}
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E1DB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-[#1F1F1F]">
                    <MapPin className="w-4 h-4 text-[#E08828] shrink-0" />
                    <div>
                      <span className="font-bold">Base Location:</span> Kathmandu Valley &amp; Pokhara, Nepal
                    </div>
                  </div>
                  <div className="text-[#8B8680] text-[11px] font-medium">
                    Response time: Instant on WhatsApp (08:00 – 20:00 NPT)
                  </div>
                </div>
              </div>
            )}

            {/* 6. HIKER REVIEWS & STORIES */}
            {activeTab === 'reviews' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Header & Refresh */}
                <div className="border-b border-[#F0EBE5] pb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#1F1F1F] flex items-center gap-2">
                      <span>Hiker Reviews &amp; Community Stories</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Verified
                      </span>
                    </h3>

                  </div>
                  <button
                    type="button"
                    onClick={fetchReviews}
                    disabled={loadingReviews}
                    className="p-2 rounded-xl border border-[#E5E1DB] bg-white hover:bg-[#F9F7F5] text-[#5A5551] text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Reload latest reviews"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingReviews ? 'animate-spin text-amber-600' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>

                {/* Analytics Dashboard Board (Global Satisfaction, Recent 30 Treks, Rating Momentum) */}
                <ReviewsAnalyticsBoard
                  reviews={allReviewsCombined}
                  selectedTrek={selectedTrekPill}
                  onSelectTrek={(trek) => setSelectedTrekPill(trek)}
                  selectedRating={starRatingFilter}
                  onSelectRating={(star) => setStarRatingFilter(star)}
                />

                {/* Active Filter Indicators */}
                {(selectedTrekPill || starRatingFilter !== 'all') && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs">
                    <span className="font-bold text-amber-900 text-[11px]">Active Board Filter:</span>
                    {selectedTrekPill && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-stone-800 font-bold border border-amber-300 shadow-2xs">
                        Trek: {selectedTrekPill}
                        <button
                          type="button"
                          onClick={() => setSelectedTrekPill('')}
                          className="hover:text-red-500 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {starRatingFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-stone-800 font-bold border border-amber-300 shadow-2xs">
                        Rating: {starRatingFilter} Stars
                        <button
                          type="button"
                          onClick={() => setStarRatingFilter('all')}
                          className="hover:text-red-500 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrekPill('');
                        setStarRatingFilter('all');
                      }}
                      className="text-[11px] font-bold text-amber-800 hover:underline cursor-pointer ml-auto"
                    >
                      Clear all board filters
                    </button>
                  </div>
                )}

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setReviewFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        reviewFilter === 'all'
                          ? 'bg-[#1F1F1F] text-white shadow-2xs'
                          : 'bg-[#F9F7F5] border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0ECE7]'
                      }`}
                    >
                      All ({displayReviews.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('5star')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                        reviewFilter === '5star'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-[#F9F7F5] border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0ECE7]'
                      }`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      <span>5-Star Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewFilter('team')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                        reviewFilter === 'team'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-[#F9F7F5] border border-[#E5E1DB] text-[#5A5551] hover:bg-[#F0ECE7]'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>Team Notes</span>
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="Search hike or reviewer..."
                      className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs text-[#1F1F1F] placeholder:text-[#8B8680] focus:outline-none focus:border-[#7ABA42] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Reviews List */}
                <div className="space-y-3.5">
                  {loadingReviews && displayReviews.length === 0 ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="p-4 rounded-2xl border border-[#E5E1DB] bg-[#F9F7F5] animate-pulse space-y-2.5">
                          <div className="h-4 bg-neutral-200 rounded w-1/3" />
                          <div className="h-3 bg-neutral-200 rounded w-3/4" />
                          <div className="h-3 bg-neutral-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : displayReviews.length === 0 ? (
                    <div className="p-8 text-center bg-[#F9F7F5] rounded-2xl border border-dashed border-[#E5E1DB] space-y-2">
                      <p className="text-sm font-bold text-[#1F1F1F]">No reviews match this filter</p>
                      <p className="text-xs text-[#8B8680]">Try clearing the search term or switching to "All Reviews".</p>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewFilter('all');
                          setReviewSearch('');
                          setSelectedTrekPill('');
                          setStarRatingFilter('all');
                        }}
                        className="mt-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5E1DB] text-xs font-bold text-[#1F1F1F] hover:bg-[#F3F0EC] transition-all cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    displayReviews.map((rev) => {
                      const initials = (rev.full_name || 'Hiker')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={rev.id}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E1DB] shadow-2xs hover:border-[#D5CFC9] transition-all space-y-3"
                        >
                          {/* Reviewer Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 flex items-center justify-center text-emerald-900 font-extrabold text-xs shrink-0 shadow-xs">
                                {initials || 'H'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-[#1F1F1F] leading-tight">
                                    {rev.full_name}
                                  </h4>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Verified Hiker</span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#8B8680] mt-0.5">
                                  {rev.hike_number && (
                                    <span className="font-semibold text-[#E08828]">
                                      Hike #{rev.hike_number}
                                    </span>
                                  )}
                                  {rev.hike_number && rev.trek_name && <span>•</span>}
                                  {rev.trek_name && (
                                    <span className="truncate max-w-[200px] sm:max-w-xs">{rev.trek_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Date */}
                            {rev.submitted_at && (
                              <span className="text-[10px] text-[#8B8680] shrink-0 font-medium">
                                {rev.submitted_at}
                              </span>
                            )}
                          </div>

                          {/* Ratings Row */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                            {/* Trip Rating */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80">
                              <span className="text-[10px] font-bold text-amber-900">Experience:</span>
                              <div className="flex items-center text-amber-500">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${
                                      s <= rev.overall_rating ? 'fill-amber-500 text-amber-500' : 'text-neutral-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Team Rating */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80">
                              <span className="text-[10px] font-bold text-emerald-900">Guide &amp; Team:</span>
                              <div className="flex items-center text-emerald-600">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${
                                      s <= rev.team_rating ? 'fill-emerald-600 text-emerald-600' : 'text-neutral-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Overall Feedback Quote */}
                          {rev.overall_feedback && (
                            <div className="relative pl-3.5 border-l-2 border-amber-400">
                              <p className="text-xs text-[#2A2725] leading-relaxed italic">
                                "{rev.overall_feedback}"
                              </p>
                            </div>
                          )}

                          {/* Team Feedback Note */}
                          {rev.team_feedback && (
                            <div className="p-2.5 sm:p-3 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] text-xs flex items-start gap-2 text-[#5A5551]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#7ABA42] shrink-0 mt-0.5" />
                              <div className="leading-snug">
                                <span className="font-bold text-[#1F1F1F]">Leadership &amp; Pacing: </span>
                                <span>{rev.team_feedback}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Call to Action: Invite Hikers to Rate */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h5 className="font-bold text-sm text-[#1F1F1F]">Hiked with Walk Nepal Walk recently?</h5>
                    <p className="text-[11px] text-[#8B8680] mt-0.5">
                      Your feedback helps our community flourish. Head to <strong>My Bookings</strong> to rate your completed trek.
                    </p>
                  </div>
                  {onNavigateToBookings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToBookings();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#7ABA42] hover:bg-[#6AA836] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                    >
                      <span>Go to My Bookings</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};