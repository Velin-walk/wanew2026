import React, { useState } from 'react';
import { TrekTipsContent } from './TrekTipsContent';
import {
  X,
  CreditCard,
  ShieldCheck,
  Compass,
  Mail,
  Send,
  HelpCircle,
  Phone,
  CheckCircle2,
  Lock,
  QrCode,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  FileText
} from 'lucide-react';

export type SubPageType = 'payment' | 'trek_tips' | 'safety_policy' | 'request_private_trek' | 'contact' | 'about';

interface InfoPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPage?: SubPageType;
}

export const InfoPagesModal: React.FC<InfoPagesModalProps> = ({
  isOpen,
  onClose,
  initialPage = 'payment',
}) => {
  const [activeTab, setActiveTab] = useState<SubPageType>(initialPage);

  // Sync initial tab when reopened
  React.useEffect(() => {
    if (isOpen && initialPage) {
      setActiveTab(initialPage);
    }
  }, [isOpen, initialPage]);

  // Private Trek Form State
  const [privateForm, setPrivateForm] = useState({
    name: '',
    email: '',
    phone: '',
    destination: '',
    groupSize: '4-8',
    preferredDate: '',
    budget: '',
    notes: '',
  });
  const [privateSubmitted, setPrivateSubmitted] = useState(false);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#E5E1DB]">
        
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
          
          {/* Navigation Drawer / Sub-Tabs */}
          <nav className="w-full md:w-60 bg-[#F9F7F5] border-b md:border-b-0 md:border-r border-[#E5E1DB] p-2 sm:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('payment')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
              onClick={() => setActiveTab('request_private_trek')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                activeTab === 'contact'
                  ? 'bg-white text-[#1F1F1F] shadow-xs border border-[#E5E1DB]'
                  : 'text-[#5A5551] hover:bg-[#F0ECE7] hover:text-[#1F1F1F]'
              }`}
            >
              <Mail className={`w-4 h-4 shrink-0 ${activeTab === 'contact' ? 'text-[#7ABA42]' : 'text-[#8B8680]'}`} />
              <span>Contact & Support</span>
            </button>
          </nav>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white text-neutral-800">
            
            {/* 1. PAYMENT & PRICING */}
            {activeTab === 'payment' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b border-[#F0EBE5] pb-3">
                  <h3 className="text-lg font-extrabold text-[#1F1F1F]">Payment Methods & Transparent Pricing</h3>
                  <p className="text-xs text-[#8B8680] mt-0.5">Secure, community-backed transparent payment guidelines for all Himalayan treks.</p>
                </div>

                <img src="/paymentqr.png" alt="Payment QR Codes" className="w-full h-auto rounded-2xl" />
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

                <form className="space-y-0">
                  {/* 1. TREKKER DETAILS */}
                  <fieldset className="trek-fieldset">
                    <div className="trek-section-head">
                      <span className="trek-section-index">01</span>
                      <legend className="trek-section-title">Trekker Details</legend>
                    </div>

                    <div className="trek-field">
                      <label className="trek-label">Full name<span className="trek-req">*</span></label>
                      <input type="text" required placeholder="e.g. Priya Sharma" className="trek-input" />
                    </div>
                    <div className="trek-field-row">
                      <div className="trek-field">
                        <label className="trek-label">Email<span className="trek-req">*</span></label>
                        <input type="email" required placeholder="you@example.com" className="trek-input" />
                      </div>
                      <div className="trek-field">
                        <label className="trek-label">Phone / WhatsApp<span className="trek-req">*</span></label>
                        <input type="tel" required placeholder="+977 98XXXXXXXX" className="trek-input" />
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
                      <input type="text" required placeholder="Type a region, a specific route, or 'not sure — suggest one'" list="destinationList" className="trek-input" />
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
                        <input type="number" min="1" required placeholder="e.g. 2" className="trek-input" />
                      </div>
                      <div className="trek-field">
                        <label className="trek-label">Trip duration (days)<span className="trek-req">*</span></label>
                        <input type="number" min="1" required placeholder="e.g. 7" className="trek-input" />
                      </div>
                    </div>

                    <div className="trek-field">
                      <label className="trek-label">Preferred month or date window<span className="trek-req">*</span></label>
                      <input type="month" required className="trek-input" />
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
                          <input type="radio" name="fitness" value="1" required />
                          <div className="trek-card-title">Beginner</div>
                          <div className="trek-card-desc">First multi-day trek, comfortable on gentle trails.</div>
                        </label>
                        <label className="trek-card">
                          <input type="radio" name="fitness" value="2" />
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
                              <input type="radio" name="q_experience" value="yes" style={{ marginRight: '4px' }} />
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
                              <input type="radio" name="q_stamina" value="yes" style={{ marginRight: '4px' }} />
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
                      <input type="range" min="200" max="5000" step="50" defaultValue="1000" className="trek-range" onChange={(e) => { const val = document.getElementById('budgetDisplay'); if (val) val.textContent = '$' + Number(e.target.value).toLocaleString(); }} />
                      <p className="trek-hint">Up to <span className="trek-range-value" id="budgetDisplay">$1,000</span></p>
                    </div>

                    <div className="trek-field">
                      <label className="trek-label">Accommodation preference<span className="trek-req">*</span></label>
                      <div className="trek-chip-group">
                        <span className="trek-chip"><input type="checkbox" id="acc1" name="accommodation" value="teahouse" /><label htmlFor="acc1" style={{ margin: 0 }}>Teahouse / lodge</label></span>
                        <span className="trek-chip"><input type="checkbox" id="acc2" name="accommodation" value="camping" /><label htmlFor="acc2" style={{ margin: 0 }}>Camping</label></span>
                        <span className="trek-chip"><input type="checkbox" id="acc3" name="accommodation" value="homestay" /><label htmlFor="acc3" style={{ margin: 0 }}>Homestay</label></span>
                        <span className="trek-chip"><input type="checkbox" id="acc4" name="accommodation" value="mix" /><label htmlFor="acc4" style={{ margin: 0 }}>A mix / flexible</label></span>
                      </div>
                    </div>

                    <div className="trek-field">
                      <label className="trek-label">Transport preference<span className="trek-req">*</span></label>
                      <div className="trek-chip-group">
                        <span className="trek-chip"><input type="checkbox" id="tr1" name="transport" value="aeroplane" /><label htmlFor="tr1" style={{ margin: 0 }}>Aeroplane</label></span>
                        <span className="trek-chip"><input type="checkbox" id="tr2" name="transport" value="helicopter" /><label htmlFor="tr2" style={{ margin: 0 }}>Helicopter</label></span>
                        <span className="trek-chip"><input type="checkbox" id="tr3" name="transport" value="private_jeep" /><label htmlFor="tr3" style={{ margin: 0 }}>Private jeep</label></span>
                        <span className="trek-chip"><input type="checkbox" id="tr4" name="transport" value="public_bus" /><label htmlFor="tr4" style={{ margin: 0 }}>Public bus</label></span>
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
                        <input type="text" placeholder="e.g. 28–45, or includes two kids (8, 11)" className="trek-input" />
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Medical conditions or dietary restrictions</label>
                        <textarea placeholder="Anything we should plan meals or pacing around" className="trek-textarea"></textarea>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Interests</label>
                        <div className="trek-chip-group">
                          <span className="trek-chip"><input type="checkbox" id="int1" name="interests" value="culture" /><label htmlFor="int1" style={{ margin: 0 }}>Culture & villages</label></span>
                          <span className="trek-chip"><input type="checkbox" id="int2" name="interests" value="wildlife" /><label htmlFor="int2" style={{ margin: 0 }}>Wildlife</label></span>
                          <span className="trek-chip"><input type="checkbox" id="int3" name="interests" value="photography" /><label htmlFor="int3" style={{ margin: 0 }}>Photography</label></span>
                          <span className="trek-chip"><input type="checkbox" id="int4" name="interests" value="offbeat" /><label htmlFor="int4" style={{ margin: 0 }}>Off-beat routes</label></span>
                          <span className="trek-chip"><input type="checkbox" id="int5" name="interests" value="summit" /><label htmlFor="int5" style={{ margin: 0 }}>Summit climbs</label></span>
                        </div>
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Starting city / pickup point</label>
                        <input type="text" placeholder="e.g. Kathmandu" className="trek-input" />
                      </div>

                      <div className="trek-field">
                        <label className="trek-label">Special requests</label>
                        <input type="text" placeholder="Private guide, existing permits, dietary chef, etc." className="trek-input" />
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
                      <textarea placeholder="Open field — write freely" className="trek-textarea"></textarea>
                    </div>
                  </fieldset>

                  <button type="submit" className="trek-submit-btn">Send Trek Request</button>
                  <p className="trek-submit-note">We typically reply within 48 hours with a first route draft.</p>
                </form>
              </div>
            )}

            {/* 5. CONTACT & SUPPORT */}
            {activeTab === 'contact' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b border-[#F0EBE5] pb-3">
                  <h3 className="text-lg font-extrabold text-[#1F1F1F]">Contact & Support</h3>
                  <p className="text-xs text-[#8B8680] mt-0.5">Sales, operations, and support contacts for bookings, logistics, and trail coordination.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#1F1F1F]">Biraj Thing</h4>
                      <p className="text-[11px] font-bold text-[#7ABA42]">Sales & Operations Director</p>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs font-semibold text-[#1F1F1F]">
                      <Phone className="w-3.5 h-3.5 text-[#7ABA42] mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <a href="tel:+9779860071064" className="block hover:text-[#7ABA42] hover:underline">+977 986-0071064</a>
                        <a href="tel:+9779803568612" className="block hover:text-[#7ABA42] hover:underline">+977 980-3568612</a>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#8B8680] leading-relaxed">Sales Head • Bookings • Operations • Logistics • Team Coordination • Trek Coordinator</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#1F1F1F]">Salina Tamang</h4>
                      <p className="text-[11px] font-bold text-[#E08828]">Sales & Marketing, Office Operations</p>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs font-semibold text-[#1F1F1F]">
                      <Phone className="w-3.5 h-3.5 text-[#E08828] mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <a href="tel:+9779803568612" className="block hover:text-[#E08828] hover:underline">+977 980-3568612</a>
                        <a href="tel:+9779705735061" className="block hover:text-[#E08828] hover:underline">+977 970-5735061</a>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#8B8680] leading-relaxed">Customer Support • Content Planning • Partnerships • Marketing • Accounts Payments</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#1F1F1F]">Sundar Gurung</h4>
                      <p className="text-[11px] font-bold text-[#7ABA42]">Operations Advisor</p>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs font-semibold text-[#1F1F1F]">
                      <Phone className="w-3.5 h-3.5 text-[#7ABA42] mt-0.5 shrink-0" />
                      <a href="tel:+9779813844865" className="hover:text-[#7ABA42] hover:underline">+977 981-3844865</a>
                    </div>
                    <p className="text-[11px] text-[#8B8680] leading-relaxed">Operational Guidance • Quality Assurance • Trek Coordinator</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F9F7F5] border border-[#E5E1DB] space-y-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#1F1F1F]">Velin Rai</h4>
                      <p className="text-[11px] font-bold text-[#E08828]">Strategic Advisor</p>
                    </div>
                    <p className="text-[11px] text-[#8B8680] leading-relaxed">Business • Finance • IT Systems</p>
                  </div>
                </div>

                {contactSubmitted ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-6 h-6 text-[#7ABA42] mx-auto" />
                    <p className="text-xs font-bold text-emerald-900">Message sent successfully! We will get back to you shortly.</p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setContactSubmitted(true);
                    }}
                    className="space-y-3 pt-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Your Name"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E1DB] bg-[#FDFBF9] focus:outline-none focus:border-[#7ABA42]"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Your Email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E1DB] bg-[#FDFBF9] focus:outline-none focus:border-[#7ABA42]"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Subject (e.g. Booking inquiry, Trail conditions)"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E1DB] bg-[#FDFBF9] focus:outline-none focus:border-[#7ABA42]"
                    />
                    <textarea
                      rows={3}
                      required
                      placeholder="Your message..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5E1DB] bg-[#FDFBF9] focus:outline-none focus:border-[#7ABA42]"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};