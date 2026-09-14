import React, { useState, useEffect } from 'react';
import {
  TrekItineraryData,
  INITIAL_ITINERARY_TEMPLATE,
  SavedHikeRecord,
  PriceTier,
  AddOnItem,
  ItineraryDay,
  SafetyRule,
  formatSingleDate,
  formatDateRange
} from '../../data/defaultItineraryTemplate';
import { ItineraryPreview } from './ItineraryPreview';
import { ShareHikeModal } from './ShareHikeModal';
import { apiFetch } from '../../services/api';
import {
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle,
  FileText,
  DollarSign,
  Calendar,
  CalendarDays,
  Mountain,
  CheckSquare,
  XCircle,
  Layers,
  HelpCircle,
  Clock,
  MapPin,
  Save,
  ArrowLeft,
  Share2,
  Copy,
  Radio,
  Loader2,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon
} from 'lucide-react';

interface ItineraryBuilderProps {
  initialRecord?: SavedHikeRecord | null;
  onBackToList?: () => void;
  onSaveRecord?: (record: SavedHikeRecord) => void;
  onCloneHike?: (hikeId: string) => void;
}

export const ItineraryBuilder: React.FC<ItineraryBuilderProps> = ({
  initialRecord,
  onBackToList,
  onSaveRecord,
  onCloneHike,
}) => {
  const [formData, setFormData] = useState<TrekItineraryData>(() => {
    if (initialRecord?.data) {
      return initialRecord.data;
    }
    const saved = localStorage.getItem('wnw_itinerary_template_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_ITINERARY_TEMPLATE;
      }
    }
    return INITIAL_ITINERARY_TEMPLATE;
  });

  const [currentStatus, setCurrentStatus] = useState<'draft' | 'published' | 'archived'>(
    initialRecord?.status || 'draft'
  );
  const [recordId, setRecordId] = useState<string | undefined>(initialRecord?.id);

  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Hike Date Interactive Calendar States
  const [datePickerMode, setDatePickerMode] = useState<'single' | 'range' | 'custom'>('single');
  const [singleDateInput, setSingleDateInput] = useState<string>('');
  const [rangeStartInput, setRangeStartInput] = useState<string>('');
  const [rangeEndInput, setRangeEndInput] = useState<string>('');

  // Section 4, 5, 7: List format raw multiline text states
  const [includesInputText, setIncludesInputText] = useState<string>(() =>
    (initialRecord?.data || INITIAL_ITINERARY_TEMPLATE).costIncludes.join('\n')
  );
  const [excludesInputText, setExcludesInputText] = useState<string>(() =>
    (initialRecord?.data || INITIAL_ITINERARY_TEMPLATE).costExcludes.join('\n')
  );
  const [dayScheduleTexts, setDayScheduleTexts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const days = (initialRecord?.data || INITIAL_ITINERARY_TEMPLATE).itineraryDays;
    days.forEach((d) => {
      map[d.id] = d.items.map((it) => (it.time ? `${it.time} - ${it.activity}` : it.activity)).join('\n');
    });
    return map;
  });

  useEffect(() => {
    if (initialRecord) {
      setFormData(initialRecord.data);
      setCurrentStatus(initialRecord.status);
      setRecordId(initialRecord.id);
      setIncludesInputText(initialRecord.data.costIncludes.join('\n'));
      setExcludesInputText(initialRecord.data.costExcludes.join('\n'));
      const map: Record<string, string> = {};
      initialRecord.data.itineraryDays.forEach((d) => {
        map[d.id] = d.items.map((it) => (it.time ? `${it.time} - ${it.activity}` : it.activity)).join('\n');
      });
      setDayScheduleTexts(map);
      if (initialRecord.data.category === 'Multi Day Treks') {
        setDatePickerMode('range');
      }
    }
  }, [initialRecord]);

  // Helper to parse multiline schedule text to structured DayItem[]
  const parseScheduleLines = (text: string, dayId: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((line, idx) => {
      // Matches: "06:30 AM - Meeting", "6:00 AM : Departs", "08:00 AM Breakfast", "7am - Walk"
      const match = line.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:[-–—:|]\s*|\s{2,}|\s+)(.*)$/i);
      if (match && match[1] && match[2]) {
        return {
          id: `item-${idx + 1}-${dayId}`,
          time: match[1].trim().toUpperCase(),
          activity: match[2].trim(),
        };
      }
      const timeOnlyMatch = line.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s+(.*)$/i);
      if (timeOnlyMatch && timeOnlyMatch[1] && timeOnlyMatch[2]) {
        return {
          id: `item-${idx + 1}-${dayId}`,
          time: timeOnlyMatch[1].trim().toUpperCase(),
          activity: timeOnlyMatch[2].trim(),
        };
      }
      return {
        id: `item-${idx + 1}-${dayId}`,
        time: '',
        activity: line,
      };
    });
  };

  // Section 4: Cost Includes text change handler
  const handleIncludesTextChange = (text: string) => {
    setIncludesInputText(text);
    const cleaned = text
      .split('\n')
      .map((l) => l.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
      .filter(Boolean);
    updateData((prev) => ({ ...prev, costIncludes: cleaned }));
  };

  // Section 5: Cost Excludes text change handler
  const handleExcludesTextChange = (text: string) => {
    setExcludesInputText(text);
    const cleaned = text
      .split('\n')
      .map((l) => l.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
      .filter(Boolean);
    updateData((prev) => ({ ...prev, costExcludes: cleaned }));
  };

  // Section 7: Day schedule text change handler
  const handleDayScheduleTextChange = (dayId: string, text: string) => {
    setDayScheduleTexts((prev) => ({ ...prev, [dayId]: text }));
    const parsed = parseScheduleLines(text, dayId);
    updateData((prev) => ({
      ...prev,
      itineraryDays: prev.itineraryDays.map((d) =>
        d.id === dayId ? { ...d, items: parsed } : d
      ),
    }));
  };

  // Helper to compute upcoming date in YYYY-MM-DD
  const getUpcomingDayDate = (dayOfWeek: number, weeksAhead: number = 0): string => {
    // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const now = new Date();
    const result = new Date(now);
    const currentDay = now.getDay();
    let distance = dayOfWeek - currentDay;
    if (distance < 0 || (distance === 0 && weeksAhead > 0)) {
      distance += 7;
    }
    distance += weeksAhead * 7;
    result.setDate(now.getDate() + distance);
    const y = result.getFullYear();
    const m = String(result.getMonth() + 1).padStart(2, '0');
    const d = String(result.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleApplySingleDate = (isoDate: string) => {
    setSingleDateInput(isoDate);
    if (!isoDate) return;
    const formatted = formatSingleDate(isoDate);
    updateData((prev) => ({ ...prev, hikeDate: formatted }));
  };

  const handleApplyDateRange = (startIso: string, endIso: string) => {
    setRangeStartInput(startIso);
    setRangeEndInput(endIso);
    if (!startIso) return;
    const effectiveEnd = endIso && endIso >= startIso ? endIso : startIso;
    const formatted = formatDateRange(startIso, effectiveEnd);
    updateData((prev) => ({ ...prev, hikeDate: formatted }));
  };

  // Auto-save draft changes to localStorage
  const updateData = (updater: (prev: TrekItineraryData) => TrekItineraryData) => {
    setFormData((prev) => {
      const next = updater(prev);
      localStorage.setItem('wnw_itinerary_template_draft', JSON.stringify(next));
      return next;
    });
  };

  // Section 1: Price Tier Helpers
  const handleAddPriceTier = () => {
    if (formData.priceTiers.length >= 3) return;
    updateData((prev) => ({
      ...prev,
      priceTiers: [
        ...prev.priceTiers,
        { id: `tier-${Date.now()}`, label: 'Special Tier', price: 0 }
      ]
    }));
  };

  const handleUpdatePriceTier = (id: string, field: 'label' | 'price', value: any) => {
    updateData((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.map((t) =>
        t.id === id ? { ...t, [field]: field === 'price' ? Number(value) || 0 : value } : t
      )
    }));
  };

  const handleRemovePriceTier = (id: string) => {
    updateData((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((t) => t.id !== id)
    }));
  };

  // Section 4 & 5: Inclusions / Exclusions Helpers
  const handleAddInclusion = () => {
    updateData((prev) => ({
      ...prev,
      costIncludes: [...prev.costIncludes, '']
    }));
  };

  const handleUpdateInclusion = (index: number, val: string) => {
    updateData((prev) => {
      const copy = [...prev.costIncludes];
      copy[index] = val;
      return { ...prev, costIncludes: copy };
    });
  };

  const handleRemoveInclusion = (index: number) => {
    updateData((prev) => ({
      ...prev,
      costIncludes: prev.costIncludes.filter((_, i) => i !== index)
    }));
  };

  const handleAddExclusion = () => {
    updateData((prev) => ({
      ...prev,
      costExcludes: [...prev.costExcludes, '']
    }));
  };

  const handleUpdateExclusion = (index: number, val: string) => {
    updateData((prev) => {
      const copy = [...prev.costExcludes];
      copy[index] = val;
      return { ...prev, costExcludes: copy };
    });
  };

  const handleRemoveExclusion = (index: number) => {
    updateData((prev) => ({
      ...prev,
      costExcludes: prev.costExcludes.filter((_, i) => i !== index)
    }));
  };

  // Section 6: Add-Ons Helpers
  const handleAddAddOn = () => {
    updateData((prev) => ({
      ...prev,
      addOns: [
        ...prev.addOns,
        { id: `addon-${Date.now()}`, name: 'New Addon', price: 500, unit: 'per person' }
      ]
    }));
  };

  const handleUpdateAddOn = (id: string, field: keyof AddOnItem, val: any) => {
    updateData((prev) => ({
      ...prev,
      addOns: prev.addOns.map((a) =>
        a.id === id ? { ...a, [field]: field === 'price' ? Number(val) || 0 : val } : a
      )
    }));
  };

  const handleRemoveAddOn = (id: string) => {
    updateData((prev) => ({
      ...prev,
      addOns: prev.addOns.filter((a) => a.id !== id)
    }));
  };

  // Section 7: Itinerary Days Helpers
  const handleAddDay = () => {
    const nextDayNum = formData.itineraryDays.length + 1;
    const newDayId = `day-${Date.now()}`;
    const defaultText = `06:30 AM - Morning gathering & briefing\n07:00 AM - Departure towards destination\n01:00 PM - Lunch & scenic exploration\n05:00 PM - Arrive at destination / Teahouse check-in`;
    const defaultItems = parseScheduleLines(defaultText, newDayId);

    setDayScheduleTexts((prev) => ({
      ...prev,
      [newDayId]: defaultText,
    }));

    updateData((prev) => ({
      ...prev,
      itineraryDays: [
        ...prev.itineraryDays,
        {
          id: newDayId,
          dayNumber: nextDayNum,
          title: `Day ${nextDayNum}: Trek Stage`,
          items: defaultItems,
        },
      ],
    }));
  };

  const handleRemoveDay = (dayId: string) => {
    setDayScheduleTexts((prev) => {
      const copy = { ...prev };
      delete copy[dayId];
      return copy;
    });
    updateData((prev) => ({
      ...prev,
      itineraryDays: prev.itineraryDays
        .filter((d) => d.id !== dayId)
        .map((d, idx) => ({ ...d, dayNumber: idx + 1 })),
    }));
  };

  const handleResetToExample = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetToExample = () => {
    const tpl = INITIAL_ITINERARY_TEMPLATE;
    updateData(() => tpl);
    setIncludesInputText(tpl.costIncludes.join('\n'));
    setExcludesInputText(tpl.costExcludes.join('\n'));
    const map: Record<string, string> = {};
    tpl.itineraryDays.forEach((d) => {
      map[d.id] = d.items.map((it) => (it.time ? `${it.time} - ${it.activity}` : it.activity)).join('\n');
    });
    setDayScheduleTexts(map);
    setSaveStatus('Template reset to Sailung sample data');
    setTimeout(() => setSaveStatus(null), 3000);
    setIsResetConfirmOpen(false);
  };

  const handleSaveToServer = async (targetStatus?: 'draft' | 'published' | 'archived') => {
    setIsSaving(true);
    const statusToSave = targetStatus || currentStatus;

    try {
      localStorage.setItem('wnw_itinerary_template_draft', JSON.stringify(formData));

      let res;
      if (recordId) {
        // Update existing record
        res = await apiFetch(`admin/itineraries/${recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, status: statusToSave }),
        });
      } else {
        // Create new record
        res = await apiFetch('admin/itineraries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, status: statusToSave }),
        });
      }

      if (res && res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setRecordId(json.data.id);
          setCurrentStatus(json.data.status);
          if (onSaveRecord) {
            onSaveRecord(json.data);
          }

          setSaveStatus(
            statusToSave === 'published'
              ? '🎉 Itinerary published and saved to catalog!'
              : '✅ Itinerary draft saved successfully!'
          );
        } else {
          throw new Error('Server returned unsuccessful response');
        }
      } else {
        throw new Error('Network or server error');
      }
    } catch (err: any) {
      console.warn('Network save fallback to localStorage:', err);
      // Guarantee local persistence and UI sync
      const fallbackId = recordId || `hike-draft-${Date.now().toString(36)}`;
      setRecordId(fallbackId);
      setCurrentStatus(statusToSave);
      const fallbackRecord: SavedHikeRecord = {
        id: fallbackId,
        hikeNumber: formData.hikeNumber || 'TBD',
        title: formData.title || 'Untitled Hike',
        category: formData.category,
        status: statusToSave,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorEmail: 'admin@walknepalwalk.com',
        data: formData,
      };
      if (onSaveRecord) {
        onSaveRecord(fallbackRecord);
      }
      setSaveStatus(
        `⚠️ Sync Failed: Saved only in browser cache (${err?.message || 'Network error'}). Click Save/Publish again to retry.`
      );
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 8000);
    }
  };

  const currentHikeRecord: SavedHikeRecord = {
    id: recordId || 'temp-id',
    hikeNumber: formData.hikeNumber || 'TBD',
    title: formData.title,
    category: formData.category,
    status: currentStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorEmail: 'admin@walknepalwalk.com',
    data: formData,
  };

  if (viewMode === 'preview') {
    return (
      <ItineraryPreview
        data={formData}
        onBackToEdit={() => setViewMode('edit')}
        onPublishTemplate={async () => {
          await handleSaveToServer('published');
          setViewMode('edit');
        }}
      />
    );
  }

  return (
    <div className="w-full bg-[#FAF8F5] text-[#1F1F1F] p-4 sm:p-6 rounded-3xl border border-[#EFEAE4]">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col gap-4 pb-5 border-b border-[#EFEAE4]">
        {/* Navigation & Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBackToList && (
              <button
                id="btn-back-to-hike-list"
                type="button"
                onClick={onBackToList}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E1DB] hover:bg-[#F9F7F5] rounded-xl text-xs font-bold text-[#1F1F1F] transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Hike Catalog</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E08828]" />
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#1F1F1F] truncate">
                {formData.title || 'Untitled Itinerary'}
              </h2>
            </div>
          </div>

          {/* Visibility Status Badge Selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#E5E1DB] shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentStatus('draft')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentStatus === 'draft'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-[#5A5551] hover:bg-[#F9F7F5]'
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setCurrentStatus('published')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentStatus === 'published'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#5A5551] hover:bg-[#F9F7F5]'
                }`}
              >
                Published
              </button>
            </div>

            {/* Share Trigger */}
            <button
              id="btn-share-current-hike"
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/30 hover:bg-[#25D366] hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-[#8B8680]">
            Edit 8 structured sections. Save drafts or publish directly to the live catalog and WhatsApp.
          </p>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetToExample}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E1DB] hover:bg-[#F9F7F5] rounded-xl text-xs font-semibold text-[#5A5551] transition-all cursor-pointer shadow-2xs"
              title="Load Sailung sample data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Example</span>
            </button>

            {recordId && onCloneHike && (
              <button
                type="button"
                onClick={() => onCloneHike(recordId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E1DB] hover:bg-purple-50 hover:text-purple-700 text-[#5A5551] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Duplicate this itinerary as a new copy"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clone</span>
              </button>
            )}

            <button
              id="btn-save-draft"
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveToServer('draft')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#E5E1DB] hover:bg-[#F9F7F5] text-[#1F1F1F] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E08828]" />
              ) : (
                <Save className="w-3.5 h-3.5 text-[#E08828]" />
              )}
              <span>Save Draft</span>
            </button>

            <button
              id="btn-save-publish"
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveToServer('published')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>

            <button
              id="btn-preview-full-itinerary"
              type="button"
              onClick={() => setViewMode('preview')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#E08828] hover:bg-[#C86B1A] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {saveStatus && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ${
          saveStatus.includes('⚠️') || saveStatus.includes('Failed')
            ? 'bg-[#2D1418] text-rose-100 border-rose-500/30'
            : 'bg-[#1F1F1F] text-white border-white/10'
        }`}>
          {saveStatus.includes('⚠️') || saveStatus.includes('Failed') ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold">{saveStatus}</span>
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="ml-2 text-[11px] font-bold text-[#E08828] hover:underline cursor-pointer"
            >
              View Catalog →
            </button>
          )}
        </div>
      )}

      {/* Share Modal Dialog */}
      {isShareModalOpen && (
        <ShareHikeModal
          hike={currentHikeRecord}
          onClose={() => setIsShareModalOpen(false)}
          onStatusChange={(newStatus) => {
            setCurrentStatus(newStatus);
            handleSaveToServer(newStatus);
          }}
          onPreview={() => {
            setIsShareModalOpen(false);
            setViewMode('preview');
          }}
        />
      )}

      {/* Form Sections Grid */}
      <div className="mt-6 space-y-6">
        {/* ========================================================
            SECTION 1: Basic Information (Marketing & Pricing Data)
        ======================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EFEAE4] shadow-2xs">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#F5F2ED]">
            <span className="w-6 h-6 rounded-lg bg-[#E08828]/10 text-[#E08828] flex items-center justify-center text-xs font-black">
              1
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
              Section 1: Basic Information & Pricing Strategy
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hike Number */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Hike Number
              </label>
              <input
                type="text"
                value={formData.hikeNumber || ''}
                onChange={(e) => updateData((prev) => ({ ...prev, hikeNumber: e.target.value }))}
                placeholder="e.g. 108"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Trek Title */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Trek Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => updateData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Sailung Overnight Hike"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Category / Group */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Category / Group
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newCat = e.target.value as any;
                  updateData((prev) => ({ ...prev, category: newCat }));
                  if (newCat === 'Multi Day Treks' && datePickerMode !== 'range') {
                    setDatePickerMode('range');
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              >
                <option value="Day Hikes">Day Hikes</option>
                <option value="Overnight Bus Hikes">Overnight Bus Hikes</option>
                <option value="Multi Day Treks">Multi Day Treks</option>
                <option value="Subscription Hikes">Subscription Hikes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* Team Leader */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Team Leader / Guide
              </label>
              <input
                type="text"
                value={formData.teamLeader || ''}
                onChange={(e) => updateData((prev) => ({ ...prev, teamLeader: e.target.value }))}
                placeholder="e.g. Biraj Thing / Certified Guide"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Max Capacity */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Max Capacity (Hikers)
              </label>
              <input
                type="number"
                value={formData.maxCapacity || 0}
                onChange={(e) => updateData((prev) => ({ ...prev, maxCapacity: Number(e.target.value) || 0 }))}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>
          </div>

          {/* Cover Image URL / Upload Field */}
          <div className="mt-4 pt-4 border-t border-[#F5F2ED]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div>
                <label className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#E08828]" />
                  <span>Trek Cover Image (Header Banner)</span>
                </label>
                <span className="text-[11px] text-[#8B8680]">
                  Display high-resolution Nepal scenery at the top of the card and preview page.
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-[#8B8680] font-semibold">Nepal Trail Presets:</span>
                <button
                  type="button"
                  onClick={() => updateData((prev) => ({ ...prev, coverImageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80' }))}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white border border-[#E5E1DB] rounded-md transition-colors cursor-pointer"
                >
                  Sailung Ridge
                </button>
                <button
                  type="button"
                  onClick={() => updateData((prev) => ({ ...prev, coverImageUrl: 'https://images.unsplash.com/photo-1585938389612-a552a28d6914?auto=format&fit=crop&w=1200&q=80' }))}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white border border-[#E5E1DB] rounded-md transition-colors cursor-pointer"
                >
                  Gosainkunda Lake
                </button>
                <button
                  type="button"
                  onClick={() => updateData((prev) => ({ ...prev, coverImageUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=80' }))}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white border border-[#E5E1DB] rounded-md transition-colors cursor-pointer"
                >
                  Langtang Valley
                </button>
                <button
                  type="button"
                  onClick={() => updateData((prev) => ({ ...prev, coverImageUrl: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80' }))}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white border border-[#E5E1DB] rounded-md transition-colors cursor-pointer"
                >
                  Phulchowki Forest
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <LinkIcon className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={formData.coverImageUrl || ''}
                  onChange={(e) => updateData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                  placeholder="Paste direct Image URL (e.g. https://images.unsplash.com/... or Google Drive / Cloudinary)"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
                />
              </div>

              {/* Direct File Upload Simulation */}
              <label className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#F0EBE5] border border-[#E5E1DB] text-[#1F1F1F] rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5 text-[#E08828]" />
                <span>Upload Local File</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          const img = new window.Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const maxDimension = 1200;
                            if (width > maxDimension || height > maxDimension) {
                              if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                              } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedUrl = canvas.toDataURL('image/jpeg', 0.75);
                              updateData((prev) => ({
                                ...prev,
                                coverImageUrl: compressedUrl,
                              }));
                            }
                          };
                          img.src = String(event.target?.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              {formData.coverImageUrl && (
                <div className="relative w-14 h-9 rounded-lg overflow-hidden border border-[#E5E1DB] shrink-0 bg-neutral-100 group">
                  <img
                    src={formData.coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateData((prev) => ({ ...prev, coverImageUrl: '' }))}
                    className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    title="Remove cover image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* External Links Subsection */}
            <div className="mt-4 pt-4 border-t border-[#F5F2ED]">
              <div className="max-w-md">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                  WhatsApp Group Link
                </label>
                <input
                  type="url"
                  value={formData.whatsappLink || ''}
                  onChange={(e) => updateData((prev) => ({ ...prev, whatsappLink: e.target.value }))}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
                />
              </div>
            </div>
          </div>

          {/* Pricing Strategy: Multi-Price inputs (up to 3) */}
          <div className="mt-5 pt-4 border-t border-[#F5F2ED]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-bold text-[#1F1F1F] block">
                  Multi-Price Strategy (up to 3 price tiers)
                </label>
                <span className="text-[11px] text-[#8B8680]">
                  Add normal, student, or subscription rate tiers for this trek.
                </span>
              </div>

              {formData.priceTiers.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddPriceTier}
                  className="flex items-center gap-1 text-xs font-bold text-[#E08828] hover:text-[#C86B1A]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Price Tier</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {formData.priceTiers.map((tier, idx) => (
                <div
                  key={tier.id || idx}
                  className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EFEAE4] space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#8B8680]">
                      Tier #{idx + 1}
                    </span>
                    {formData.priceTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePriceTier(tier.id)}
                        className="text-neutral-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={tier.label || ''}
                    onChange={(e) => handleUpdatePriceTier(tier.id, 'label', e.target.value)}
                    placeholder="e.g. Normal Price / Student"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-lg focus:outline-[#E08828]"
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5A5551]">{formData.currency}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={tier.price || 0}
                      onChange={(e) => handleUpdatePriceTier(tier.id, 'price', e.target.value)}
                      placeholder="e.g. 5500"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-lg font-bold focus:outline-[#E08828]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {/* Currency */}
              <div>
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    updateData((prev) => ({ ...prev, currency: e.target.value as any }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
                >
                  <option value="NPR">NPR (Nepalese Rupee)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              {/* Pricing Notes */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                  Pricing Notes
                </label>
                <input
                  type="text"
                  value={formData.pricingNotes || ''}
                  onChange={(e) =>
                    updateData((prev) => ({ ...prev, pricingNotes: e.target.value }))
                  }
                  placeholder='e.g. "Normal Package price per person by Scorpio (7/8 pax)"'
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 2 & 3: Hike Date & Hike Overview
        ======================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EFEAE4] shadow-2xs">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#F5F2ED]">
            <span className="w-6 h-6 rounded-lg bg-[#E08828]/10 text-[#E08828] flex items-center justify-center text-xs font-black">
              2-3
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
              Section 2 & 3: Hike Date & Overview Metrics
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Section 2: Hike Date Calendar Module */}
            <div className="sm:col-span-2 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EFEAE4] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#E08828]" />
                  <label className="text-[11px] font-bold text-[#1F1F1F] uppercase tracking-wider">
                    Hike Date (Calendar Picker)
                  </label>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#E5E1DB]">
                  <button
                    type="button"
                    onClick={() => setDatePickerMode('single')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                      datePickerMode === 'single'
                        ? 'bg-[#E08828] text-white shadow-2xs'
                        : 'text-[#5A5551] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePickerMode('range')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                      datePickerMode === 'range'
                        ? 'bg-[#E08828] text-white shadow-2xs'
                        : 'text-[#5A5551] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    Multi-Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePickerMode('custom')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                      datePickerMode === 'custom'
                        ? 'bg-[#1F1F1F] text-white shadow-2xs'
                        : 'text-[#5A5551] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    Custom Text
                  </button>
                </div>
              </div>

              {/* Single Day Mode */}
              {datePickerMode === 'single' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="date"
                        value={singleDateInput}
                        onChange={(e) => handleApplySingleDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-[#E5E1DB] rounded-xl text-[#1F1F1F] focus:outline-[#E08828]"
                      />
                    </div>
                  </div>

                  {/* 1-Click Quick Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-[#8B8680]">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleApplySingleDate(getUpcomingDayDate(6, 0))}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      This Saturday
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySingleDate(getUpcomingDayDate(6, 1))}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      Next Saturday
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySingleDate(getUpcomingDayDate(0, 0))}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      This Sunday
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySingleDate(getUpcomingDayDate(0, 1))}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      Next Sunday
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-Day Range Mode */}
              {datePickerMode === 'range' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#5A5551] block mb-1">Start Date</span>
                      <input
                        type="date"
                        value={rangeStartInput}
                        onChange={(e) => handleApplyDateRange(e.target.value, rangeEndInput)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-[#E5E1DB] rounded-xl text-[#1F1F1F] focus:outline-[#E08828]"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#5A5551] block mb-1">End Date</span>
                      <input
                        type="date"
                        min={rangeStartInput}
                        value={rangeEndInput}
                        onChange={(e) => handleApplyDateRange(rangeStartInput, e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-[#E5E1DB] rounded-xl text-[#1F1F1F] focus:outline-[#E08828]"
                      />
                    </div>
                  </div>

                  {/* Range Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-[#8B8680]">Duration Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sat = getUpcomingDayDate(6, 0);
                        const sun = getUpcomingDayDate(0, 0);
                        handleApplyDateRange(sat, sun);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      Weekend (Sat - Sun, 2 Days)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const fri = getUpcomingDayDate(5, 0);
                        const sun = getUpcomingDayDate(0, 0);
                        handleApplyDateRange(fri, sun);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-neutral-100 border border-[#E5E1DB] rounded-md text-[10px] font-semibold text-[#5A5551] cursor-pointer transition-colors"
                    >
                      Long Weekend (Fri - Sun, 3 Days)
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Text Mode */}
              {datePickerMode === 'custom' && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={formData.hikeDate || ''}
                    onChange={(e) => updateData((prev) => ({ ...prev, hikeDate: e.target.value }))}
                    placeholder="e.g. Saturday 12 Sep 2026 or Every Saturday"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5E1DB] rounded-xl focus:outline-[#E08828]"
                  />
                  <span className="text-[10px] text-[#8B8680]">
                    Enter custom schedule phrasing or tentative dates manually.
                  </span>
                </div>
              )}

              {/* Active Formatted Date Badge */}
              <div className="pt-2 border-t border-[#EFEAE4] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase text-[#8B8680]">Live Hike Date:</span>
                  <span className="font-bold text-[#1F1F1F]">
                    {formData.hikeDate || 'Not selected yet'}
                  </span>
                </div>
                {formData.hikeDate && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Formatted
                  </span>
                )}
              </div>
            </div>

            {/* Meeting Time */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Meeting Time
              </label>
              <input
                type="text"
                value={formData.overview.meetingTime || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, meetingTime: e.target.value }
                  }))
                }
                placeholder="e.g. 8 AM"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Meeting Point */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Meeting Point
              </label>
              <input
                type="text"
                value={formData.overview.meetingPoint || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, meetingPoint: e.target.value }
                  }))
                }
                placeholder="e.g. Godawari Bus park"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Expected Duration */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Expected Duration
              </label>
              <input
                type="text"
                value={formData.overview.expectedDuration || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, expectedDuration: e.target.value }
                  }))
                }
                placeholder="e.g. 6 Hours or 2 Days"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Difficulty Level */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Difficulty Level
              </label>
              <input
                type="text"
                value={formData.overview.difficulty || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, difficulty: e.target.value }
                  }))
                }
                placeholder="e.g. Easy / Moderate / Challenging"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Distance & Altitudes */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Approx Distance
              </label>
              <input
                type="text"
                value={formData.overview.approxDistance || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, approxDistance: e.target.value }
                  }))
                }
                placeholder="e.g. 11.54km"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Elevation Range / Gross */}
            <div>
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Elevation Range & Gross
              </label>
              <input
                type="text"
                value={formData.overview.elevationRange || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, elevationRange: e.target.value }
                  }))
                }
                placeholder="e.g. Range: 1516m to 2026m"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>

            {/* Ending Point */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
                Ending Point
              </label>
              <input
                type="text"
                value={formData.overview.endingPoint || ''}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    overview: { ...prev.overview, endingPoint: e.target.value }
                  }))
                }
                placeholder="e.g. Takhel Bageshwori Temple"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 4 & 5: Cost Includes & Cost Excludes (Single List Inputs)
        ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section 4: Cost Includes */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                  4
                </span>
                <h3 className="text-sm font-bold text-[#1F1F1F]">Cost Includes</h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {formData.costIncludes.length} Items Listed
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-bold text-[#5A5551] uppercase tracking-wider">
                  List Items (1 per line)
                </label>
                <span className="text-[#8B8680] text-[10px]">Bullets & dashes automatically cleaned</span>
              </div>
              <textarea
                rows={6}
                value={includesInputText}
                onChange={(e) => handleIncludesTextChange(e.target.value)}
                placeholder={`e.g.\nRound trip Bus/EV transportation from Kathmandu\n1 Night Hotel/Lodge accommodation (Twin sharing)\nDinner & morning breakfast\nExperienced guide & medical first-aid kit\nLocal permits & club coordination`}
                className="w-full px-3.5 py-2.5 text-xs bg-[#FAF8F5] border border-emerald-200 rounded-xl focus:bg-white focus:outline-emerald-500 font-normal leading-relaxed text-[#1F1F1F]"
              />
            </div>
          </div>

          {/* Section 5: Cost Excludes */}
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center text-xs font-black">
                  5
                </span>
                <h3 className="text-sm font-bold text-[#1F1F1F]">Cost Excludes</h3>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                {formData.costExcludes.length} Items Listed
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-bold text-[#5A5551] uppercase tracking-wider">
                  List Items (1 per line)
                </label>
                <span className="text-[#8B8680] text-[10px]">Bullets & dashes automatically cleaned</span>
              </div>
              <textarea
                rows={6}
                value={excludesInputText}
                onChange={(e) => handleExcludesTextChange(e.target.value)}
                placeholder={`e.g.\nPersonal expenses, snacks & cold drinks\nBottled water & soft beverages\nPersonal travel & medical insurance\nHot shower & battery charging fees\nTips for driver & guide (optional)`}
                className="w-full px-3.5 py-2.5 text-xs bg-[#FAF8F5] border border-rose-200 rounded-xl focus:bg-white focus:outline-rose-500 font-normal leading-relaxed text-[#1F1F1F]"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 6: Additional Add Ons
        ======================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EFEAE4] shadow-2xs">
          <div className="flex items-center justify-between pb-2 mb-4 border-b border-[#F5F2ED]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#E08828]/10 text-[#E08828] flex items-center justify-center text-xs font-black">
                6
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
                Section 6: Additional Add Ons
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddAddOn}
              className="flex items-center gap-1 text-xs font-bold text-[#E08828] hover:text-[#C86B1A]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Add-on Item</span>
            </button>
          </div>

          <div className="space-y-3">
            {formData.addOns.map((addon) => (
              <div
                key={addon.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] items-center"
              >
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={addon.name || ''}
                    onChange={(e) => handleUpdateAddOn(addon.id, 'name', e.target.value)}
                    placeholder="Addon name (e.g. Couple Room)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-lg"
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    value={addon.price || 0}
                    onChange={(e) => handleUpdateAddOn(addon.id, 'price', e.target.value)}
                    placeholder="Price (e.g. 1200)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-lg font-bold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={addon.unit || ''}
                    onChange={(e) => handleUpdateAddOn(addon.id, 'unit', e.target.value)}
                    placeholder="Unit (e.g. per room extra)"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-lg"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveAddOn(addon.id)}
                    className="text-neutral-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider block mb-1">
              Add-ons Notice Note
            </label>
            <input
              type="text"
              value={formData.addOnsNotice || ''}
              onChange={(e) => updateData((prev) => ({ ...prev, addOnsNotice: e.target.value }))}
              placeholder="e.g. *Please inform us for customization so that we can book logistics in advance accordingly*"
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#E08828]"
            />
          </div>
        </div>

        {/* ========================================================
            SECTION 7: Itinerary Details (Day-by-Day Schedule)
        ======================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EFEAE4] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#F5F2ED]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#E08828]/10 text-[#E08828] flex items-center justify-center text-xs font-black">
                7
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
                  Section 7: Day-by-Day Itinerary Schedule
                </h3>
                <p className="text-[11px] text-[#8B8680]">
                  Enter timetable entries in list format: <span className="font-semibold text-[#1F1F1F]">Time - Activity</span> (one per line)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddDay}
              className="flex items-center gap-1 text-xs font-bold text-[#E08828] hover:text-[#C86B1A] bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E5E1DB] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Day</span>
            </button>
          </div>

          <div className="space-y-5">
            {formData.itineraryDays.map((day) => (
              <div
                key={day.id}
                className="p-4 sm:p-5 bg-[#FAF8F5] rounded-2xl border border-[#E5E1DB] space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="px-2.5 py-1 rounded-lg bg-[#E08828] text-white text-xs font-bold shrink-0">
                      Day {day.dayNumber}
                    </span>
                    <input
                      type="text"
                      value={day.title || ''}
                      onChange={(e) =>
                        updateData((prev) => ({
                          ...prev,
                          itineraryDays: prev.itineraryDays.map((d) =>
                            d.id === day.id ? { ...d, title: e.target.value } : d
                          )
                        }))
                      }
                      placeholder="Day Title e.g. Day 1: Kathmandu to Trailhead & Hike to Lodge"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#E5E1DB] rounded-xl font-bold text-[#1F1F1F] focus:outline-[#E08828]"
                    />
                  </div>

                  {formData.itineraryDays.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDay(day.id)}
                      className="text-neutral-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
                      title="Remove Day"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Single List Input for Day Schedule */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="font-bold text-[#5A5551] uppercase tracking-wider">
                      Schedule Timeline (List Format: Time - Activity)
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {day.items.length} Milestones Parsed
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={dayScheduleTexts[day.id] || ''}
                    onChange={(e) => handleDayScheduleTextChange(day.id, e.target.value)}
                    placeholder={`e.g.\n06:30 AM - Meeting at Sundhara & Attendance\n07:00 AM - Vehicle departs sharp for trailhead\n08:30 AM - Highway breakfast stop\n12:30 PM - Arrive at starting point & start trek\n04:30 PM - Reach ridge viewpoint & photo session\n06:30 PM - Check-in at teahouse, dinner & trail briefing`}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#E5E1DB] rounded-xl focus:outline-[#E08828] font-normal leading-relaxed text-[#1F1F1F]"
                  />
                </div>

                {/* Quick Parsed Items Preview Pill Strip */}
                {day.items.length > 0 && (
                  <div className="pt-2 border-t border-[#EFEAE4]">
                    <span className="text-[10px] font-bold uppercase text-[#8B8680] block mb-1.5">
                      Parsed Timeline Preview:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {day.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E5E1DB] rounded-lg text-[11px]"
                        >
                          {item.time && (
                            <span className="font-bold text-[#E08828]">{item.time}</span>
                          )}
                          <span className="text-[#3D3A37] truncate max-w-[200px]">{item.activity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================
            SECTION 8: Standard Booking Process & Safety Guidelines
        ======================================================== */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#EFEAE4] shadow-2xs">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#F5F2ED]">
            <span className="w-6 h-6 rounded-lg bg-[#7ABA42]/15 text-[#5B8F2D] flex items-center justify-center text-xs font-black">
              8
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">
                Section 8: Booking Process & Participation Guidelines (Standard Policies)
              </h3>
              <p className="text-[11px] text-[#8B8680]">
                Preloaded standard policies (WhatsApp payments, age criteria, safety waiver) shared across all hikes.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-[#5A5551] block mb-1">
                Participation Fitness & Age Requirements
              </label>
              <textarea
                rows={3}
                value={formData.participationGuidelines || ''}
                onChange={(e) =>
                  updateData((prev) => ({ ...prev, participationGuidelines: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white focus:outline-[#7ABA42]"
              />
            </div>

            <div>
              <label className="font-bold text-[#5A5551] block mb-1">
                Support WhatsApp Contacts
              </label>
              <input
                type="text"
                value={(formData.helpContacts || []).join(', ')}
                onChange={(e) =>
                  updateData((prev) => ({
                    ...prev,
                    helpContacts: e.target.value.split(',').map((s) => s.trim())
                  }))
                }
                placeholder="+977-9860071064, +977-9803568612"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Bottom Floating Action Bar */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-[#EFEAE4] shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#8B8680] truncate max-w-xs sm:max-w-md">
            <span className="font-bold text-[#1F1F1F]">{formData.title || 'Untitled Hike'}</span> • Hike #{formData.hikeNumber || 'TBD'} ({formData.category})
            <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {currentStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveToServer('draft')}
              className="px-3.5 py-2 bg-white border border-[#E5E1DB] hover:bg-[#F9F7F5] text-[#1F1F1F] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E08828]" /> : <Save className="w-3.5 h-3.5 text-[#E08828]" />}
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveToServer('published')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className="px-4 py-2 bg-[#E08828] hover:bg-[#C86B1A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview Full Itinerary</span>
              <span className="sm:hidden">Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#E5E1DB] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-[#1F1F1F]">Reset to Example Template?</h3>
            <p className="text-xs text-[#5A5551] mt-2 leading-relaxed">
              Are you sure you want to reset all itinerary builder fields to the standard **Sailung Hike** sample template? This will overwrite your current inputs.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] hover:bg-[#F0EBE5] text-[#5A5551] rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetToExample}
                className="px-4 py-2.5 bg-[#E08828] hover:bg-[#C86B1A] text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Reset Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
