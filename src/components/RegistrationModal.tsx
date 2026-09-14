import React, { useState, useEffect } from 'react';
import { Trek, TeamMember, BookingFormData } from '../types';
import {
  X,
  MapPin,
  User,
  Users,
  Heart,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  Calendar,
  Sparkles,
  Phone,
  Mail,
  Briefcase,
  ChevronRight,
  HelpCircle,
  Clock,
  Compass,
} from 'lucide-react';

interface RegistrationModalProps {
  trek: Trek | null;
  allTreks?: Trek[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: BookingFormData) => Promise<void>;
  userEmail?: string;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  trek,
  allTreks = [],
  isOpen,
  onClose,
  onSubmit,
  userEmail = 'velinrai.VR@gmail.com',
}) => {
  // Helper to accurately parse trek date
  const parseTrekDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  };

  // Filter to only upcoming events for registration selection
  const availableTreks = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sourceTreks = allTreks.length > 0 ? allTreks : trek ? [trek] : [];
    const upcoming = sourceTreks.filter((t) => {
      // If this is the specific trek the user clicked "Register" on, always ensure it's in the list
      if (trek && t.id === trek.id) return true;
      const dt = parseTrekDate(t.date);
      return !dt || dt.getTime() >= today.getTime();
    });

    // Sort ascending (nearest date first)
    upcoming.sort((a, b) => {
      const da = parseTrekDate(a.date)?.getTime() || 0;
      const db = parseTrekDate(b.date)?.getTime() || 0;
      return da - db;
    });

    return upcoming.length > 0 ? upcoming : sourceTreks;
  }, [allTreks, trek]);

  const [selectedTrekId, setSelectedTrekId] = useState<string>(trek?.id || availableTreks[0]?.id || '');
  const activeTrek = availableTreks.find((t) => t.id === selectedTrekId) || trek;

  const [selectedDate, setSelectedDate] = useState<string>(trek?.date || activeTrek?.date || '');

  // Your Information (Primary Contact)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [profession, setProfession] = useState('');

  // Group & About You
  const [isGroup, setIsGroup] = useState<'Solo' | 'Group'>('Solo');
  const [ageGroup, setAgeGroup] = useState('20-30');
  const [gender, setGender] = useState('Female');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Health
  const [hasMedical, setHasMedical] = useState<'Yes' | 'No'>('No');
  const [specifyMedical, setSpecifyMedical] = useState('');
  const [recentHikes, setRecentHikes] = useState('');

  // Safety & Preferences
  const [agreeRules, setAgreeRules] = useState<'Yes' | 'No'>('Yes');
  const [guidePreference, setGuidePreference] = useState<'Guided' | 'Unguided'>('Guided');
  const [transportPreference, setTransportPreference] = useState<'Jeep' | 'Bus'>('Bus');
  const [showGuideDetail, setShowGuideDetail] = useState(false);
  const [showTransportDetail, setShowTransportDetail] = useState(false);

  // Additional Notes
  const [suggestions, setSuggestions] = useState('');

  // UI state
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset or pre-fill when active trek or email changes
  useEffect(() => {
    if (trek) {
      setSelectedTrekId(trek.id);
      setSelectedDate(trek.date);
    }
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [trek, userEmail]);

  const handleTrekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedTrekId(newId);
    const matched = availableTreks.find((t) => t.id === newId);
    if (matched) {
      setSelectedDate(matched.date);
    }
  };

  const handleAddTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      {
        full_name: '',
        phone: '',
        age_group: '20-30',
        gender: 'Female',
      },
    ]);
    setIsGroup('Group');
  };

  const handleUpdateTeamMember = (index: number, field: keyof TeamMember, val: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: val };
    setTeamMembers(updated);
  };

  const handleRemoveTeamMember = (index: number) => {
    const updated = teamMembers.filter((_, i) => i !== index);
    setTeamMembers(updated);
    if (updated.length === 0) {
      setIsGroup('Solo');
    }
  };

  const validateForm = () => {
    setError(null);
    if (!selectedTrekId) {
      setError('Please select a trek.');
      return false;
    }
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return false;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return false;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!gender) {
      setError('Please select your gender.');
      return false;
    }
    if (agreeRules !== 'Yes') {
      setError('You must agree to the safety rules to proceed.');
      return false;
    }

    // Validate any team members
    for (let i = 0; i < teamMembers.length; i++) {
      const tm = teamMembers[i];
      if (!tm.full_name.trim() || !tm.phone?.trim()) {
        setError(`Please fill in both name and phone for Team Member ${i + 1}.`);
        return false;
      }
    }

    return true;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsReviewMode(true);
    }
  };

  const handleFinalSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setError(null);

    const payload: BookingFormData = {
      trek_id: selectedTrekId,
      trek_name: activeTrek?.name || 'Trek Expedition',
      trek_date: selectedDate,
      full_name: fullName.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      emergency_contact: emergencyContact.trim(),
      email: email.trim(),
      profession: profession.trim(),
      is_group: isGroup,
      age_group: ageGroup,
      gender,
      team_members: teamMembers,
      has_medical: hasMedical,
      specify_medical: hasMedical === 'Yes' ? specifyMedical.trim() : '',
      recent_hikes: recentHikes.trim(),
      agree_rules: agreeRules,
      guide_preference: guidePreference,
      transport_preference: transportPreference,
      suggestions: suggestions.trim(),
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  const ageOptions = ['Under 20', '20-30', '31-40', '41-50', 'Over 50'];
  const genderOptions = ['Female', 'Male', 'Non-Binary', 'Prefer not to say'];

  if (!isOpen) return null;

  return (
    <div
      id="modal-registration-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-all"
    >
      <div
        id="modal-registration-sheet"
        className="bg-[#FAFAF9] rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 border border-[#E5E1DB]"
      >
        {/* Mobile drag bar */}
        <div className="w-10 h-1 rounded-full bg-[#D6D3CD] mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#EBE7E1] bg-white shrink-0">
          <div className="min-w-0 flex-1 mr-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#7ABA42]/15 text-[#5C942D] text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5" /> Hike Registration
              </span>
              {activeTrek?.hike_number && (
                <span className="text-[10px] font-bold text-[#8B8680]">
                  #{activeTrek.hike_number}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F] truncate mt-0.5">
              {activeTrek ? activeTrek.name : 'Adventure Registration'}
            </h2>
            <p className="text-[11px] text-[#78716C] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#E08828]" />
              <span>{selectedDate || 'Upcoming Schedule'}</span>
              <span className="text-[#D6D3CD]">•</span>
              <span className="text-[#7ABA42] font-semibold">{activeTrek?.days || 'Trail Event'}</span>
            </p>
          </div>
          <button
            type="button"
            id="close-registration-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#78716C] hover:text-[#1F1F1F] rounded-lg hover:bg-[#F3EFEA] transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-3.5 text-xs text-[#1F1F1F]">
          {!isReviewMode ? (
            /* ===== COMPACT FORM VIEW ===== */
            <form onSubmit={handleProceedToReview} className="space-y-3.5">
              {/* 1. Trek Selector Banner */}
              <div className="bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#78716C] font-semibold border-b border-[#F5F2EC] pb-1.5">
                  <span className="flex items-center gap-1 text-[#2B6CB0]">
                    <Compass className="w-3.5 h-3.5" /> Event Selection
                  </span>
                  {activeTrek?.price && (
                    <span className="text-[#E08828] font-bold">{activeTrek.price}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Trek / Route *
                    </label>
                    <select
                      id="trekSelect"
                      value={selectedTrekId}
                      onChange={handleTrekChange}
                      required
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-medium focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    >
                      {availableTreks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.hike_number ? `#${t.hike_number} - ` : ''}{t.name} {t.date ? `(${t.date})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Date *
                    </label>
                    <input
                      type="text"
                      id="dateSelect"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      required
                      placeholder="e.g. 28 March 2026"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-medium focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Primary Hiker Information */}
              <div className="bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#2B6CB0] border-b border-[#F5F2EC] pb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Primary Hiker Details
                  </span>
                  <span className="text-[10px] text-[#A8A29E] font-normal">* Required</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Arjun Koirala"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 98XXXXXXXX"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="emailAddress"
                      name="emailAddress"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="arjun@example.com"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Emergency Contact
                    </label>
                    <input
                      type="tel"
                      id="emergencyContact"
                      name="emergencyContact"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="Backup Phone (Family/Friend)"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      WhatsApp (if different)
                    </label>
                    <input
                      type="tel"
                      id="whatsappNumber"
                      name="whatsappNumber"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Same as phone if blank"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Profession / Field
                    </label>
                    <input
                      type="text"
                      id="profession"
                      name="profession"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g. Student, Engineer"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Demographics & Solo/Group Compact Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F5F2EC]">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Type
                    </label>
                    <div className="flex bg-[#FAF9F6] p-0.5 rounded-lg border border-[#D6D3CD]">
                      <button
                        type="button"
                        onClick={() => setIsGroup('Solo')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          isGroup === 'Solo' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Solo
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsGroup('Group')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          isGroup === 'Group' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Group
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Age
                    </label>
                    <select
                      id="ageGroup"
                      name="ageGroup"
                      value={ageGroup}
                      onChange={(e) => setAgeGroup(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                    >
                      {ageOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Gender *
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      required
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                    >
                      {genderOptions.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Team Members Expansion */}
                <div className="pt-2 border-t border-[#F5F2EC]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1F1F1F] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#5C942D]" />
                      Group Companions {teamMembers.length > 0 && `(${teamMembers.length})`}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddTeamMember}
                      className="px-2 py-1 text-[11px] font-bold text-[#E08828] bg-[#FFF8EE] border border-[#FCD399] rounded-lg hover:bg-[#E08828] hover:text-white transition-all cursor-pointer"
                    >
                      + Add Hiker
                    </button>
                  </div>

                  {teamMembers.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {teamMembers.map((tm, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-[#FAF9F6] border border-[#EBE7E1] rounded-lg space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#78716C]">
                            <span>Companion #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTeamMember(idx)}
                              className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <input
                              type="text"
                              placeholder="Name *"
                              required
                              value={tm.full_name}
                              onChange={(e) => handleUpdateTeamMember(idx, 'full_name', e.target.value)}
                              className="px-2 py-1 text-xs border border-[#D6D3CD] rounded bg-white"
                            />
                            <input
                              type="tel"
                              placeholder="Phone *"
                              required
                              value={tm.phone || ''}
                              onChange={(e) => handleUpdateTeamMember(idx, 'phone', e.target.value)}
                              className="px-2 py-1 text-xs border border-[#D6D3CD] rounded bg-white"
                            />
                            <select
                              value={tm.age_group || '20-30'}
                              onChange={(e) => handleUpdateTeamMember(idx, 'age_group', e.target.value)}
                              className="px-1.5 py-1 text-xs border border-[#D6D3CD] rounded bg-white"
                            >
                              {ageOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <select
                              value={tm.gender}
                              onChange={(e) => handleUpdateTeamMember(idx, 'gender', e.target.value)}
                              className="px-1.5 py-1 text-xs border border-[#D6D3CD] rounded bg-white"
                            >
                              {genderOptions.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Health & Fitness */}
              <div className="bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#2B6CB0] border-b border-[#F5F2EC] pb-1.5">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Health & Fitness
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Any Medical Conditions?
                    </label>
                    <div className="flex bg-[#FAF9F6] p-0.5 rounded-lg border border-[#D6D3CD] w-36">
                      <button
                        type="button"
                        onClick={() => setHasMedical('No')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          hasMedical === 'No' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasMedical('Yes')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          hasMedical === 'Yes' ? 'bg-rose-500 text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {hasMedical === 'Yes' ? (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                        Condition Details *
                      </label>
                      <input
                        type="text"
                        id="specifyMedical"
                        name="specifyMedical"
                        value={specifyMedical}
                        onChange={(e) => setSpecifyMedical(e.target.value)}
                        placeholder="e.g. Asthma, Knee pain, Allergy"
                        className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                        Recent Treks / Hikes
                      </label>
                      <input
                        type="text"
                        id="recentHikes"
                        name="recentHikes"
                        value={recentHikes}
                        onChange={(e) => setRecentHikes(e.target.value)}
                        placeholder="e.g. Nagarkot, Poon Hill"
                        className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Safety Agreement & Preferences */}
              <div className="bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#2B6CB0] border-b border-[#F5F2EC] pb-1.5">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-[#5C942D]" /> Trail Preferences & Safety
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Guide Mode
                    </label>
                    <div className="flex bg-[#FAF9F6] p-0.5 rounded-lg border border-[#D6D3CD]">
                      <button
                        type="button"
                        onClick={() => setGuidePreference('Guided')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          guidePreference === 'Guided' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Guided
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuidePreference('Unguided')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          guidePreference === 'Unguided' ? 'bg-[#78716C] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Unguided
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                      Transport
                    </label>
                    <div className="flex bg-[#FAF9F6] p-0.5 rounded-lg border border-[#D6D3CD]">
                      <button
                        type="button"
                        onClick={() => setTransportPreference('Bus')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          transportPreference === 'Bus' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Bus
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransportPreference('Jeep')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          transportPreference === 'Jeep' ? 'bg-[#7ABA42] text-white shadow-2xs' : 'text-[#78716C]'
                        }`}
                      >
                        Jeep
                      </button>
                    </div>
                  </div>
                </div>

                {/* Safety Rules Check */}
                <div className="pt-2 border-t border-[#F5F2EC] flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeRules === 'Yes'}
                      onChange={(e) => setAgreeRules(e.target.checked ? 'Yes' : 'No')}
                      required
                      className="w-4 h-4 rounded text-[#7ABA42] focus:ring-[#7ABA42] border-[#D6D3CD] cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-[#1F1F1F]">
                      I accept safety guidelines & club rules *
                    </span>
                  </label>
                  <a
                    href="https://www.walknepalwalk.com.np/faq-safety-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2B6CB0] hover:underline text-[10px] font-bold"
                  >
                    Rules Policy ↗
                  </a>
                </div>

                {/* Optional Note */}
                <input
                  type="text"
                  id="suggestions"
                  name="suggestions"
                  value={suggestions}
                  onChange={(e) => setSuggestions(e.target.value)}
                  placeholder="Notes / Dietary requests (optional)"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#EBE7E1] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-1 space-y-1.5">
                <button
                  type="submit"
                  id="reviewBtn"
                  className="w-full min-h-[44px] py-2.5 px-6 bg-[#7ABA42] hover:bg-[#6AA437] text-white font-bold rounded-xl text-sm transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Review & Confirm Registration</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <p className="text-[10px] text-[#A8A29E] text-center">
                  Instant registration linked with WhatsApp coordination group.
                </p>
              </div>
            </form>
          ) : (
            /* ===== CLEAN REVIEW VIEW ===== */
            <div className="space-y-3.5">
              <div className="bg-white border border-[#EBE7E1] rounded-xl p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#F5F2EC] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#1F1F1F]">
                    <CheckCircle2 className="w-4 h-4 text-[#7ABA42]" />
                    <span>Verify Registration Details</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#7ABA42]/10 text-[#5C942D] text-[10px] font-bold">
                    {isGroup === 'Group' ? `Group (${teamMembers.length + 1})` : 'Solo Hiker'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs divide-y-0">
                  {/* Event & Date */}
                  <div className="col-span-2 bg-[#FAF9F6] p-2.5 rounded-lg border border-[#EBE7E1]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
                      Trek / Route & Date
                    </span>
                    <span className="font-bold text-[#1F1F1F] text-sm block">
                      {activeTrek?.hike_number ? `#${activeTrek.hike_number} - ` : ''}
                      {activeTrek?.name || 'Selected Trek'}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="text-[#5C942D] font-semibold">{selectedDate || 'Date not specified'}</span>
                      {activeTrek?.days && (
                        <>
                          <span className="text-[#D6D3CD]">•</span>
                          <span className="text-[#78716C] font-medium">{activeTrek.days}</span>
                        </>
                      )}
                      {activeTrek?.price && (
                        <>
                          <span className="text-[#D6D3CD]">•</span>
                          <span className="text-[#E08828] font-bold">{activeTrek.price}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Primary Hiker */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Primary Hiker
                    </span>
                    <span className="font-semibold text-[#1F1F1F]">{fullName || '(Not Provided)'}</span>
                  </div>

                  {/* Phone */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Phone Number
                    </span>
                    <span className="font-semibold text-[#1F1F1F]">{phone || '(Not Provided)'}</span>
                  </div>

                  {/* Email */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Email Address
                    </span>
                    <span className="font-medium text-[#1F1F1F] truncate block">{email || '(Not Provided)'}</span>
                  </div>

                  {/* WhatsApp */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      WhatsApp Number
                    </span>
                    <span className="font-medium text-[#1F1F1F]">
                      {whatsapp.trim() ? whatsapp : phone.trim() ? `${phone} (Same as Phone)` : '(Not Provided)'}
                    </span>
                  </div>

                  {/* Emergency Contact */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Emergency Backup Contact
                    </span>
                    <span className={`font-medium ${emergencyContact.trim() ? 'text-[#1F1F1F]' : 'text-[#A8A29E] italic'}`}>
                      {emergencyContact.trim() || 'None provided'}
                    </span>
                  </div>

                  {/* Profession */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Profession / Field
                    </span>
                    <span className={`font-medium ${profession.trim() ? 'text-[#1F1F1F]' : 'text-[#A8A29E] italic'}`}>
                      {profession.trim() || 'None specified'}
                    </span>
                  </div>

                  {/* Demographics & Group Type */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Demographics & Type
                    </span>
                    <span className="font-medium text-[#1F1F1F]">
                      {gender || 'Not specified'} • {ageGroup || 'Not specified'} • {isGroup}
                    </span>
                  </div>

                  {/* Guide & Transport Mode */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Guide & Transport Mode
                    </span>
                    <span className="font-medium text-[#1F1F1F]">
                      {guidePreference} Mode • {transportPreference}
                    </span>
                  </div>

                  {/* Medical Condition & Past Hikes */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Medical Conditions
                    </span>
                    <span className="font-medium text-[#1F1F1F]">
                      {hasMedical === 'Yes'
                        ? `Yes: ${specifyMedical.trim() || 'Condition details not specified'}`
                        : 'No known conditions'}
                    </span>
                  </div>

                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Recent Hikes / Experience
                    </span>
                    <span className={`font-medium ${recentHikes.trim() ? 'text-[#1F1F1F]' : 'text-[#A8A29E] italic'}`}>
                      {recentHikes.trim() || 'First time / None listed'}
                    </span>
                  </div>

                  {/* Safety Agreement */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Safety Rules Agreement
                    </span>
                    <span className={`font-semibold ${agreeRules === 'Yes' ? 'text-[#5C942D]' : 'text-rose-600'}`}>
                      {agreeRules === 'Yes' ? '✓ Accepted Safety Rules' : '✗ Not Accepted'}
                    </span>
                  </div>

                  {/* Suggestions / Notes */}
                  <div className="py-1">
                    <span className="text-[10px] text-[#78716C] block font-bold uppercase tracking-wider">
                      Notes & Special Requests
                    </span>
                    <span className={`font-medium ${suggestions.trim() ? 'text-[#1F1F1F]' : 'text-[#A8A29E] italic'}`}>
                      {suggestions.trim() || 'None'}
                    </span>
                  </div>

                  {/* Team Members List if Group */}
                  {teamMembers.length > 0 && (
                    <div className="col-span-2 py-1.5 border-t border-[#F5F2EC]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block mb-1">
                        Group Companions ({teamMembers.length})
                      </span>
                      <div className="space-y-1">
                        {teamMembers.map((m, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-[#FAF9F6] px-2.5 py-1.5 rounded-lg border border-[#EBE7E1]">
                            <div>
                              <span className="font-semibold text-[#1F1F1F] block">{m.full_name || `Companion #${idx + 1}`}</span>
                              <span className="text-[#78716C] text-[11px]">
                                {m.phone ? `Phone: ${m.phone}` : 'No phone'}
                              </span>
                            </div>
                            <span className="text-[#5C942D] text-[11px] font-semibold bg-[#7ABA42]/10 px-2 py-0.5 rounded">
                              {m.gender || 'Female'} • {m.age_group || '20-30'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  id="backBtn"
                  onClick={() => setIsReviewMode(false)}
                  className="flex-1 min-h-[42px] py-2 px-3 bg-white border border-[#D6D3CD] hover:bg-[#FAF9F6] text-[#1F1F1F] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  id="finalSubmitBtn"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="flex-2 min-h-[42px] py-2 px-4 bg-[#7ABA42] hover:bg-[#6AA437] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 active:scale-[0.99] cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Register</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
