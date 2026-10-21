import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Save,
  Camera,
  CreditCard,
  Compass,
  Trophy,
  Heart,
  Sparkles,
  Mountain,
  History,
  FileText,
  Star,
  Users,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  SiteVisibilitySettings,
  DEFAULT_VISIBILITY_SETTINGS,
  fetchSiteVisibilitySettings,
  saveSiteVisibilitySettings,
} from '../../services/siteVisibilityService';
import { apiFetch } from '../../services/api';

interface SiteVisibilityManagerProps {
  currentUserEmail?: string;
}

export const SiteVisibilityManager: React.FC<SiteVisibilityManagerProps> = ({
  currentUserEmail = 'walknepalwalk@gmail.com',
}) => {
  const [settings, setSettings] = useState<SiteVisibilitySettings>(DEFAULT_VISIBILITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clearingPhotos, setClearingPhotos] = useState(false);

  const handleClearOldPhotos = async () => {
    if (!window.confirm('Are you sure you want to remove all old Cloudinary photo links from the database? Non-Cloudinary R2 photos will be preserved.')) {
      return;
    }
    setClearingPhotos(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch('admin/clear-trek-photos', {
        method: 'POST',
        forceFresh: true,
      });
      if (res.ok) {
        setSuccessMsg('All old Cloudinary photo links were successfully removed from the database.');
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        throw new Error('Failed to clear photos from server.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clear old photos.');
    } finally {
      setClearingPhotos(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const data = await fetchSiteVisibilitySettings();
        setSettings(data);
      } catch (err) {
        console.warn('Failed to load visibility settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleToggle = (key: keyof SiteVisibilitySettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const saved = await saveSiteVisibilitySettings(settings, currentUserEmail);
      setSettings(saved);
      setSuccessMsg('Visibility settings updated successfully! Public display will reflect instantly.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings. Please check network connection.');
    } finally {
      setSaving(false);
    }
  };

  // Quick Preset: Cloudinary Outage Mode (Hide broken media immediately)
  const applyCloudinaryIncidentPreset = () => {
    setSettings((prev) => ({
      ...prev,
      gallery: false,
      vouchers: false,
      maintenanceNoticeTitle: 'Media Server Upgrades in Progress',
      maintenanceNoticeMessage:
        'We are currently migrating our photo and media storage. Gallery and direct voucher uploads will return shortly. Thank you for your patience!',
    }));
    setSuccessMsg('Preset applied: Gallery and Voucher uploads set to Hidden. Tap "Save Settings" below to publish.');
  };

  // Quick Preset: Restore Everything Public
  const applyRestoreAllPreset = () => {
    setSettings({
      ...DEFAULT_VISIBILITY_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    setSuccessMsg('Preset applied: All sections set to Publicly Visible. Tap "Save Settings" below to publish.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="w-8 h-8 text-[#E08828] animate-spin" />
        <p className="text-xs text-[#8B8680] font-semibold">Loading visibility configuration...</p>
      </div>
    );
  }

  const renderToggleRow = (
    key: keyof SiteVisibilitySettings,
    title: string,
    description: string,
    icon: React.ReactNode,
    warningTag?: string
  ) => {
    const isVisible = Boolean(settings[key]);
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white hover:bg-[#FAF8F5]/60 rounded-2xl border border-[#EFEAE4] transition-all gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isVisible ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {icon}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-[#1F1F1F]">{title}</h4>
              {warningTag && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md uppercase tracking-wider">
                  {warningTag}
                </span>
              )}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isVisible
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isVisible ? 'Public' : 'Hidden (Maintenance)'}
              </span>
            </div>
            <p className="text-xs text-[#8B8680] leading-relaxed max-w-lg">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleToggle(key)}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none active:scale-95 shrink-0 sm:self-center ${
            isVisible
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
          }`}
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{isVisible ? 'Visible to Public' : 'Hidden from Public'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Banner / Explainer */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E1DB] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <EyeOff className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F]">Page & Section Visibility Controls</h2>
              <p className="text-xs sm:text-sm text-[#8B8680] font-medium">
                Hide or show public features during maintenance. When hidden, public visitors see a polite maintenance notice, while Admins retain full preview access.
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={applyCloudinaryIncidentPreset}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
              title="One-click hide gallery and voucher upload during Cloudinary outage"
            >
              ⚠️ Cloudinary Incident Preset
            </button>
            <button
              type="button"
              onClick={applyRestoreAllPreset}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
              title="Restore all sections to public"
            >
              ✓ Restore All to Public
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Group 1: High Priority / Media Outage Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
              1. Media & Sensitive Upload Features
            </h3>
          </div>
          <div className="space-y-2">
            {renderToggleRow(
              'gallery',
              'Community Gallery (Trek Photos)',
              'Public photo wall displaying attendee trek photos. Hide this while migrating photos away from Cloudinary to avoid broken image displays.',
              <Camera className="w-5 h-5" />,
              'Cloudinary Critical'
            )}
            {renderToggleRow(
              'vouchers',
              'Payment Voucher Upload Form',
              'Payment voucher receipt uploader during trek booking. When hidden, users are directed to verify payments via WhatsApp or bank confirmation instead of broken Cloudinary uploads.',
              <CreditCard className="w-5 h-5" />,
              'Cloudinary Critical'
            )}

            {/* Clear Old Gallery Photos Action */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 mt-3">
              <div className="space-y-0.5 text-left">
                <h4 className="text-sm font-bold text-rose-900">Remove All Old Gallery Photo Links</h4>
                <p className="text-xs text-rose-700">Clear all legacy Cloudinary photo links from the database to prepare for fresh reuploads.</p>
              </div>
              <button
                type="button"
                onClick={handleClearOldPhotos}
                disabled={clearingPhotos}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                {clearingPhotos ? 'Clearing...' : '🗑️ Remove Old Cloudinary Links Only'}
              </button>
            </div>
          </div>
        </div>

        {/* Group 2: Main Exploration Tabs */}
        <div className="space-y-3 pt-4 border-t border-[#EFEAE4]">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#7ABA42]" />
            <h3 className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
              2. Main Navigation Tabs
            </h3>
          </div>
          <div className="space-y-2">
            {renderToggleRow(
              'mapminers',
              'MapMiners GPS Trails Tab',
              'Community trail maps, elevation graphs, and GPS trace uploader.',
              <Compass className="w-5 h-5" />
            )}
            {renderToggleRow(
              'leaderboard',
              'Community Leaderboard Tab',
              'Hiker rankings, total distance, and verified participant leaderboard.',
              <Trophy className="w-5 h-5" />
            )}
            {renderToggleRow(
              'saved',
              'Saved Hikes Screen',
              'User bookmarked treks for fast booking.',
              <Heart className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Group 3: Homepage Sections */}
        <div className="space-y-3 pt-4 border-t border-[#EFEAE4]">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-[#E08828]" />
            <h3 className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
              3. Homepage Sections
            </h3>
          </div>
          <div className="space-y-2">
            {renderToggleRow(
              'heroBanner',
              'Rotating Homepage Hero Banner',
              'Hourly rotating Himalayan cover photo with live upcoming & completed count chips.',
              <Sparkles className="w-5 h-5" />
            )}
            {renderToggleRow(
              'upcomingHikes',
              'Upcoming Hikes Grid',
              'Primary schedule cards for upcoming weekend and multi-day treks.',
              <Mountain className="w-5 h-5" />
            )}
            {renderToggleRow(
              'pastEvents',
              'Past Events Archive',
              'Completed past treks and historical rosters.',
              <History className="w-5 h-5" />
            )}
            {renderToggleRow(
              'prayerFlags',
              'Nepali Lungta Prayer Flags Strip',
              'Decorative traditional Himalayan prayer flags garland.',
              <Sparkles className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Group 4: Modals & Sub-pages */}
        <div className="space-y-3 pt-4 border-t border-[#EFEAE4]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
              4. Info Pages & Sub-modals
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {renderToggleRow(
              'paymentInfo',
              'Payment QR & Guidelines',
              'Bank QR and payment instruction modal.',
              <CreditCard className="w-5 h-5" />
            )}
            {renderToggleRow(
              'reviews',
              'Community Reviews Board',
              'Historic ratings and community testimonials.',
              <Star className="w-5 h-5" />
            )}
            {renderToggleRow(
              'blogs',
              'Community Hiking Blogs',
              'Trail stories, advice, and hiker blog posts.',
              <FileText className="w-5 h-5" />
            )}
            {renderToggleRow(
              'trekTips',
              'Trek Tips & Gear Guide',
              'Packing list and Himalayan preparation guide.',
              <Compass className="w-5 h-5" />
            )}
            {renderToggleRow(
              'safetyPolicy',
              'Safety & Refund Policy',
              'Medical policies, guidelines, and refund terms.',
              <ShieldAlert className="w-5 h-5" />
            )}
            {renderToggleRow(
              'privateTrek',
              'Request Private Trek Form',
              'Custom booking intake form for private groups.',
              <Users className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Maintenance Copy Customizer */}
        <div className="pt-4 border-t border-[#EFEAE4] space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#E08828]" />
            <h3 className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
              5. Maintenance Notice Customizer
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F5] p-5 rounded-2xl border border-[#EFEAE4]">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
                Maintenance Notice Title
              </label>
              <input
                type="text"
                value={settings.maintenanceNoticeTitle || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, maintenanceNoticeTitle: e.target.value }))
                }
                placeholder="Under Scheduled Maintenance"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#7ABA42]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#6A645D] uppercase tracking-wider">
                Maintenance Message for Visitors
              </label>
              <textarea
                rows={2}
                value={settings.maintenanceNoticeMessage || ''}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, maintenanceNoticeMessage: e.target.value }))
                }
                placeholder="This section is currently undergoing maintenance and upgrades. Please check back soon!"
                className="w-full px-3.5 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#7ABA42] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sticky Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-[#EFEAE4] gap-4">
          <div className="text-[11px] text-[#8B8680]">
            {settings.updatedAt ? (
              <span>Last modified: {new Date(settings.updatedAt).toLocaleString()} by {settings.updatedBy || 'admin'}</span>
            ) : (
              <span>Ready to save configuration</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#E08828] hover:bg-[#c97922] disabled:bg-stone-300 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Publishing Changes...' : 'Save Visibility Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
