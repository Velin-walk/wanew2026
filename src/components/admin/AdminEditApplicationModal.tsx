import React, { useState, useEffect } from 'react';
import { Trek, TeamMember } from '../../types';
import { AdminRegistration } from './BookingsManager';
import { MiniPrayerFlags } from '../NepaliPrayerFlags';
import {
  X,
  User,
  Users,
  Heart,
  Shield,
  Calendar,
  Sparkles,
  CreditCard,
  Trash2,
  Compass,
  RefreshCw,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface AdminEditApplicationModalProps {
  registration: AdminRegistration | null;
  treks: Trek[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<AdminRegistration>) => Promise<void>;
}

export const AdminEditApplicationModal: React.FC<AdminEditApplicationModalProps> = ({
  registration,
  treks,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedTrekId, setSelectedTrekId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTrekName, setSelectedTrekName] = useState<string>('');
  const [selectedHikeNumber, setSelectedHikeNumber] = useState<string>('');

  // Primary Hiker Details
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [profession, setProfession] = useState('');

  // Demographics & Group
  const [isGroup, setIsGroup] = useState<'Solo' | 'Group'>('Solo');
  const [ageGroup, setAgeGroup] = useState('20-30');
  const [gender, setGender] = useState('Female');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Health & Fitness
  const [hasMedical, setHasMedical] = useState<'Yes' | 'No'>('No');
  const [specifyMedical, setSpecifyMedical] = useState('');
  const [recentHikes, setRecentHikes] = useState('');

  // Safety & Preferences
  const [guidePreference, setGuidePreference] = useState<'Guided' | 'Unguided'>('Guided');
  const [transportPreference, setTransportPreference] = useState<'Bus' | 'Jeep'>('Bus');
  const [agreeRules, setAgreeRules] = useState<'Yes' | 'No'>('Yes');
  const [suggestions, setSuggestions] = useState('');

  // Admin & Financial Controls
  const [status, setStatus] = useState<string>('Confirmed');
  const [paymentStatus, setPaymentStatus] = useState<string>('Unpaid');
  const [paidAmount, setPaidAmount] = useState<number | string>(0);
  const [dueAmount, setDueAmount] = useState<number | string>(0);
  const [pickupPoint, setPickupPoint] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ageOptions = ['Under 20', '20-30', '31-40', '41-50', 'Over 50'];
  const genderOptions = ['Female', 'Male', 'Non-Binary', 'Prefer not to say'];

  // Populate state whenever registration changes
  useEffect(() => {
    if (registration) {
      setSelectedTrekId(registration.trek_id || registration.hike_number || '');
      setSelectedDate(registration.trek_date || '');
      setSelectedTrekName(registration.trek_name || '');
      setSelectedHikeNumber(registration.hike_number || '');

      setFullName(registration.full_name || '');
      setPhone(registration.phone || '');
      setWhatsapp(registration.whatsapp || registration.whatsapp_number || registration.phone || '');
      setEmail(registration.email || registration.email_address || '');
      setEmergencyContact(registration.emergency_contact || registration.emergency_backup_contact || '');
      setProfession(registration.profession || '');

      const isGrp =
        registration.is_group ||
        (Array.isArray(registration.team_members) && registration.team_members.length > 0) ||
        (registration.paxCount && Number(registration.paxCount) > 1);
      setIsGroup(isGrp ? 'Group' : 'Solo');
      setAgeGroup(registration.age_group || '20-30');
      setGender(registration.gender || 'Female');

      if (Array.isArray(registration.team_members) && registration.team_members.length > 0) {
        setTeamMembers(
          registration.team_members.map((m: any) => ({
            full_name: m.full_name || '',
            gender: m.gender || 'Female',
            age_group: m.age_group || '20-30',
            phone: m.phone || '',
          }))
        );
      } else {
        setTeamMembers([]);
      }

      const hasMed =
        registration.has_medical === 'Yes' ||
        (registration.specify_medical && registration.specify_medical !== 'No') ||
        (registration.medical_condition && registration.medical_condition !== 'No');
      setHasMedical(hasMed ? 'Yes' : 'No');
      setSpecifyMedical(
        registration.specify_medical && registration.specify_medical !== 'No'
          ? registration.specify_medical
          : registration.medical_condition && registration.medical_condition !== 'No'
          ? registration.medical_condition
          : ''
      );
      setRecentHikes(registration.recent_hikes || '');

      setGuidePreference((registration.guide_preference as any) || 'Guided');
      setTransportPreference((registration.transport_preference as any) || 'Bus');
      setAgreeRules('Yes');
      setSuggestions(registration.suggestions || '');

      setStatus(registration.status === 'Pending' || registration.status === 'Double Registration' ? 'Duplicate' : registration.status || 'Confirmed');
      setPaymentStatus(registration.payment_status || 'Unpaid');
      setPaidAmount(registration.paid_amount ?? 0);
      setDueAmount(registration.due_amount ?? 0);
      setPickupPoint(registration.pickup_point || '');
      setAdminNotes(registration.admin_notes || '');

      setErrorMessage(null);
      setSaveSuccess(false);
      setSaving(false);
    }
  }, [registration]);

  if (!isOpen || !registration) return null;

  const handleTrekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTrekId(val);
    const matched = treks.find((t) => t.id === val || t.hike_number === val);
    if (matched) {
      setSelectedTrekName(matched.name || matched.title || '');
      setSelectedHikeNumber(matched.hike_number || matched.id || '');
      if (matched.date) setSelectedDate(matched.date);
    }
  };

  const handleAddTeamMember = () => {
    setTeamMembers((prev) => [
      ...prev,
      { full_name: '', gender: 'Female', age_group: '20-30', phone: '' },
    ]);
  };

  const handleUpdateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    setTeamMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaving(true);

    try {
      const totalPax = 1 + (isGroup === 'Group' ? teamMembers.length : 0);
      const groupRemarks =
        isGroup === 'Group' && teamMembers.length > 0
          ? `${selectedTrekName} (${selectedDate}) • Primary contact with ${teamMembers.length} companion(s): ${teamMembers
              .map((m) => m.full_name)
              .join(', ')}`
          : `${selectedTrekName} (${selectedDate}) • Solo participant`;

      const updates: Partial<AdminRegistration> = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        whatsapp_number: whatsapp.trim() || phone.trim(),
        email: email.trim(),
        email_address: email.trim(),
        emergency_contact: emergencyContact.trim(),
        emergency_backup_contact: emergencyContact.trim(),
        profession: profession.trim(),
        is_group: isGroup === 'Group',
        age_group: ageGroup,
        gender: gender,
        paxCount: totalPax,
        team_members: isGroup === 'Group' ? teamMembers : [],
        has_medical: hasMedical,
        specify_medical: hasMedical === 'Yes' ? specifyMedical.trim() : 'No',
        medical_condition: hasMedical === 'Yes' ? specifyMedical.trim() : 'No',
        recent_hikes: recentHikes.trim(),
        guide_preference: guidePreference,
        transport_preference: transportPreference,
        suggestions: suggestions.trim(),
        person_remarks: groupRemarks,
        trek_id: selectedTrekId,
        trek_name: selectedTrekName,
        hike_number: selectedHikeNumber,
        trek_date: selectedDate,
        pickup_point: pickupPoint.trim(),
        status: status,
        payment_status: paymentStatus as any,
        paid_amount: Number(paidAmount) || 0,
        due_amount: Number(dueAmount) || 0,
        admin_notes: adminNotes.trim(),
      };

      await onSave(registration.id, updates);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Failed to save edited registration:', err);
      setErrorMessage(err?.message || 'Failed to save application changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs transition-all animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#FAFAF9] rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-[#E5E1DB]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Matching RegistrationModal) */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#EBE7E1] bg-white shrink-0">
          <div className="min-w-0 flex-1 mr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                Edit Hiker Application
              </span>
              {selectedHikeNumber && (
                <span className="text-[10px] font-bold text-[#8B8680]">
                  #{selectedHikeNumber}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F] truncate mt-0.5">
              {fullName ? `Edit: ${fullName}` : 'Edit Hiker Application'}
            </h2>
            <p className="text-[11px] text-[#78716C] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#E08828]" />
              <span>{selectedDate || 'Scheduled Event'}</span>
              <span className="text-[#D6D3CD]">•</span>
              <span className="text-[#7ABA42] font-semibold">{selectedTrekName || 'Trek'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#78716C] hover:text-[#1F1F1F] rounded-lg hover:bg-[#F3EFEA] transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Scrollable Form Body with Exact RegistrationModal Cards */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 sm:px-5 sm:py-4 space-y-3 text-xs text-[#1F1F1F]">
          <form id="edit-original-booking-form" onSubmit={handleSubmit} className="space-y-3">
            {/* 1. Trek Selector Banner with Miniature Prayer Flags */}
            <div className="relative bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2 overflow-hidden">
              <div className="absolute -top-1 right-2 sm:right-4 w-24 xs:w-28 sm:w-32 z-20 pointer-events-none drop-shadow-2xs opacity-85">
                <MiniPrayerFlags variant="draped" count={5} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#78716C] font-semibold border-b border-[#F5F2EC] pb-1.5">
                <span className="flex items-center gap-1 text-[#2B6CB0]">
                  <Compass className="w-3.5 h-3.5" /> Event Selection
                </span>
                <span className="text-[10px] text-stone-400 font-normal">Active Registration</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Trek / Route *
                  </label>
                  <select
                    value={selectedTrekId}
                    onChange={handleTrekChange}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-medium focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                  >
                    <option value="">{selectedTrekName || 'Select a trek'}</option>
                    {treks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.hike_number ? `#${t.hike_number} - ` : ''}
                        {t.name || t.title} {t.date ? `(${t.date})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Event Date *
                  </label>
                  <input
                    type="text"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    placeholder="e.g. 28 March 2026"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-medium focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. Primary Hiker Information Card */}
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
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Student, Engineer"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                  />
                </div>
              </div>

              {/* Demographics & Solo/Group Row */}
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
                    Age Group
                  </label>
                  <select
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

              {/* Group Companions Section */}
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
                            title="Remove Companion"
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
                            placeholder="Phone"
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

            {/* 3. Health & Fitness Card */}
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
                      value={recentHikes}
                      onChange={(e) => setRecentHikes(e.target.value)}
                      placeholder="e.g. Nagarkot, Poon Hill"
                      className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Safety Agreement & Preferences Card */}
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeRules === 'Yes'}
                    onChange={(e) => setAgreeRules(e.target.checked ? 'Yes' : 'No')}
                    className="w-4 h-4 rounded text-[#7ABA42] focus:ring-[#7ABA42] border-[#D6D3CD] cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-[#1F1F1F]">
                    Safety guidelines & club rules accepted
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                  Notes / Dietary Requests
                </label>
                <input
                  type="text"
                  value={suggestions}
                  onChange={(e) => setSuggestions(e.target.value)}
                  placeholder="Notes / Dietary requests (optional)"
                  className="w-full px-2.5 py-1.5 text-xs border border-[#EBE7E1] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42] focus:bg-white"
                />
              </div>
            </div>

            {/* 5. Roster Status & Financial Controls Card (Admin specific) */}
            <div className="bg-white border border-[#EBE7E1] rounded-xl p-3 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#2B6CB0] border-b border-[#F5F2EC] pb-1.5">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-[#E08828]" /> Roster Status &amp; Financials
                </span>
                <span className="text-[10px] font-mono text-stone-400">Admin Managed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Registration Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-semibold focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Duplicate">Duplicate</option>
                    <option value="Waitlisted">Waitlisted</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Cancelled by User">Cancelled by User</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] font-semibold focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Deposit Paid">Deposit Paid</option>
                    <option value="Fully Paid">Fully Paid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    Paid Amount (NPR)
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                    Due Amount (NPR)
                  </label>
                  <input
                    type="number"
                    value={dueAmount}
                    onChange={(e) => setDueAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-amber-50/50 text-amber-950 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Pickup Point
                  </label>
                  <input
                    type="text"
                    value={pickupPoint}
                    onChange={(e) => setPickupPoint(e.target.value)}
                    placeholder="e.g. Koteshwor, Kalanki"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">
                    Internal Admin Notes
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notes visible only to admins"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3CD] rounded-lg bg-[#FAF9F6] text-[#1F1F1F] focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white border-t border-[#EBE7E1] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <span className="text-[11px] text-[#78716C] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Original submission backup preserved untouched in Cloudflare D1.</span>
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2 border border-[#D6D3CD] hover:bg-[#FAF9F6] text-[#5A5551] rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-original-booking-form"
              disabled={saving}
              className="flex-1 sm:flex-none px-5 py-2 bg-[#7ABA42] hover:bg-[#6AA437] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
