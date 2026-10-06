import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  Calendar,
  Wrench,
  Save,
  RefreshCw,
  Eye,
  CheckCircle2,
  Sparkles,
  Link,
  Clock,
  Send,
  Power,
} from 'lucide-react';
import {
  SiteNotice,
  NoticeType,
  fetchSiteNotice,
  saveSiteNotice,
  DEFAULT_NOTICE,
} from '../../services/noticeService';
import { NoticeBoardModal } from '../NoticeBoardModal';

export const NoticeBoardManager: React.FC = () => {
  const [notice, setNotice] = useState<SiteNotice>(DEFAULT_NOTICE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const loadNotice = async () => {
      setLoading(true);
      try {
        const remote = await fetchSiteNotice(true);
        if (remote) {
          setNotice(remote);
        }
      } catch (err) {
        console.warn('Failed to load notice in admin:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNotice();
  }, []);

  const handleSave = async (forcePop = false) => {
    setSaving(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload: Partial<SiteNotice> = {
        ...notice,
        enabled: notice.enabled,
      };

      const result = await saveSiteNotice(payload);
      setNotice(result);

      if (forcePop || result.enabled) {
        setSaveSuccessMsg('Notice updated! The pop-up is now live and will appear for visitors.');
      } else {
        setSaveSuccessMsg('Notice saved (currently inactive).');
      }

      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save notice. Please check connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    const nextState = !notice.enabled;
    const updated = { ...notice, enabled: nextState };
    setNotice(updated);

    setSaving(true);
    try {
      const result = await saveSiteNotice(updated);
      setNotice(result);
      setSaveSuccessMsg(
        nextState
          ? 'Notice Board activated! It will pop up for all hikers.'
          : 'Notice Board deactivated.'
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-[#E5E1DB] flex flex-col items-center justify-center min-h-[300px]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#E08828]" />
        <span className="text-xs font-semibold text-[#8B8680] mt-3">Loading Notice Board state...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle Banner */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E1DB] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              notice.enabled
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-stone-100 text-stone-400 border border-stone-200'
            }`}
          >
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[#1F1F1F]">Notice Board Pop-up</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  notice.enabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-500'
                }`}
              >
                {notice.enabled ? 'ACTIVE & POPPING' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-[#8B8680] mt-0.5">
              When active, visitors will automatically see this notice modal pop-up once.
              Whenever you update this notice, it will pop up again for all users.
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleEnabled}
          disabled={saving}
          className={`px-5 py-2.5 text-xs flex items-center gap-2 ${
            notice.enabled ? 'btn-danger' : 'btn-primary'
          }`}
        >
          <Power className="w-4 h-4" />
          <span>{notice.enabled ? 'Turn Notice OFF' : 'Turn Notice ON'}</span>
        </button>
      </div>

      {/* Notice Settings Form */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E1DB] shadow-2xs space-y-6">
        <div className="border-b border-[#E5E1DB] pb-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-[#1F1F1F]">Notice Content &amp; Settings</h4>
            <p className="text-xs text-[#8B8680]">Craft announcement title, severity, message, and call-to-action button.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn-secondary px-3.5 py-2 text-xs"
            >
              <Eye className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Preview Pop-up</span>
            </button>
          </div>
        </div>

        {/* Title & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-[#4A4541]">Notice Title *</label>
            <input
              type="text"
              value={notice.title}
              onChange={(e) => setNotice({ ...notice, title: e.target.value })}
              placeholder="e.g. Schedule Change for Hike #205"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#4A4541]">Notice Type</label>
            <select
              value={notice.type}
              onChange={(e) => setNotice({ ...notice, type: e.target.value as NoticeType })}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828]"
            >
              <option value="info">🔵 Information (General)</option>
              <option value="event">🟠 Trek &amp; Event Alert</option>
              <option value="urgent">🔴 Urgent / Weather Warning</option>
              <option value="maintenance">🟣 Service / Logistics Update</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#4A4541]">Notice Message *</label>
          <textarea
            rows={4}
            value={notice.message}
            onChange={(e) => setNotice({ ...notice, message: e.target.value })}
            placeholder="Write the full notice details here. Line breaks are preserved in the pop-up."
            className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-medium text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828] leading-relaxed"
          />
        </div>

        {/* Call to Action & Expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#4A4541]">Action Button Label (Optional)</label>
            <input
              type="text"
              value={notice.ctaText || ''}
              onChange={(e) => setNotice({ ...notice, ctaText: e.target.value })}
              placeholder="e.g. View Hike Itinerary"
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#4A4541]">Button Destination Link (Optional)</label>
            <input
              type="text"
              value={notice.ctaLink || ''}
              onChange={(e) => setNotice({ ...notice, ctaLink: e.target.value })}
              placeholder="e.g. #treks or https://chat.whatsapp.com/..."
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#4A4541]">Auto-Expiry Date (Optional)</label>
            <input
              type="date"
              value={notice.expiresAt ? notice.expiresAt.slice(0, 10) : ''}
              onChange={(e) => setNotice({ ...notice, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs font-semibold text-[#1F1F1F] focus:bg-white focus:outline-none focus:border-[#E08828]"
            />
          </div>
        </div>

        {/* Feedback Alerts */}
        {saveSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Save & Publish Controls */}
        <div className="pt-4 border-t border-[#E5E1DB] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#8B8680]">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last updated: {notice.updatedAt ? new Date(notice.updatedAt).toLocaleString() : 'Never'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-secondary w-full sm:w-auto px-4 py-2.5 text-xs"
              title="Forces the notice to pop again for all users even if they previously dismissed it"
            >
              <Send className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Republish to All (Force Pop)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-primary w-full sm:w-auto px-5 py-2.5 text-xs"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save &amp; Update Notice</span>
            </button>
          </div>
        </div>
      </div>

      {/* In-Admin Pop-up Modal Preview */}
      {previewOpen && (
        <NoticeBoardModal
          manualOpen={previewOpen}
          onCloseManual={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};
