import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Eye,
  EyeOff,
  Plus,
  Save,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  Trash2,
  Search,
  Sparkles,
  X,
  AlertCircle,
  Award,
} from 'lucide-react';
import {
  CustomGuideData,
  GuidesSettings,
  DEFAULT_GUIDES,
  getGuidesSettings,
  saveGuidesSettings,
  deduplicateGuides,
} from '../../services/guidesService';
import { buildAuditChanges, recordAdminAuditLog } from '../../services/api';
import { getGenderTextColorClass } from '../../adminUtils';

interface GuidesManagerProps {
  currentUserEmail?: string;
  treks?: any[];
}

export const GuidesManager: React.FC<GuidesManagerProps> = ({
  currentUserEmail = 'walknepalwalk@gmail.com',
  treks = [],
}) => {
  const [settings, setSettings] = useState<GuidesSettings>(getGuidesSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [editingGuide, setEditingGuide] = useState<CustomGuideData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rowDrafts, setRowDrafts] = useState<Record<string, Partial<CustomGuideData>>>({});

  const handleRowChange = (id: string, field: keyof CustomGuideData, value: any) => {
    setRowDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSaveRow = (id: string) => {
    const draft = rowDrafts[id];
    if (!draft) return;
    const targetGuide = settings.custom_guides.find((g) => g.id === id);
    const updatedGuides = settings.custom_guides.map(g => g.id === id ? { ...g, ...draft } : g);
    const updated: GuidesSettings = { ...settings, custom_guides: deduplicateGuides(updatedGuides) };
    setSettings(updated);
    saveGuidesSettings(updated);

    const rowBefore: Record<string, any> = {};
    for (const k of Object.keys(draft)) {
      rowBefore[k] = targetGuide ? (targetGuide as any)[k] : null;
    }
    const rowChanges = buildAuditChanges(rowBefore, draft);

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `Updated guide profile details for "${targetGuide?.name || id}"`,
      metadata: {
        guide_id: id,
        name: targetGuide?.name,
        changed_fields: draft,
        ...(Object.keys(rowChanges).length > 0 ? { changes: rowChanges } : {}),
      },
      adminEmail: currentUserEmail,
    });

    setRowDrafts(prev => {
        const next = {...prev};
        delete next[id];
        return next;
    });
    triggerSuccessBanner();
  };


  // New guide form state
  const [newGuide, setNewGuide] = useState<{
    name: string;
    role: string;
    bio: string;
    gender: 'Male' | 'Female';
    specialty: string;
    badge: string;
    experienceKm: string;
    phone: string;
  }>({
    name: '',
    role: 'Trek Leader & Mountain Guide',
    bio: '',
    gender: 'Male',
    specialty: '',
    badge: 'Trek Leader',
    experienceKm: '',
    phone: '',
  });

  useEffect(() => {
    const handleSync = () => {
      setSettings(getGuidesSettings());
    };
    window.addEventListener('wnw-guide-settings-updated', handleSync);
    return () => window.removeEventListener('wnw-guide-settings-updated', handleSync);
  }, []);

  // Sync any additional trek leaders from scheduled/library treks if not present
  useEffect(() => {
    if (!treks || treks.length === 0) return;
    const latest = getGuidesSettings();
    let updated = false;
    const currentGuides = [...latest.custom_guides];
    const existingNames = new Set(currentGuides.map((g) => (g.name || '').toLowerCase().trim()));

    treks.forEach((t) => {
      const leader = (t.leader || t.team_leader || '').trim();
      if (leader && !existingNames.has(leader.toLowerCase())) {
        const cleanId = leader.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        currentGuides.push({
          id: cleanId,
          name: leader,
          role: 'Trek Leader & Coordinator',
          bio: 'Certified route guide leading scheduled Himalayan hikes with Walk Nepal Walk.',
          gender: leader.toLowerCase().includes('salina') || leader.toLowerCase().includes('saraswoti') || leader.toLowerCase().includes('laxmi') ? 'Female' : 'Male',
          badge: 'Trek Leader',
          is_visible: true,
        });
        existingNames.add(leader.toLowerCase());
        updated = true;
      }
    });

    if (updated) {
      const newSettings: GuidesSettings = { ...latest, custom_guides: deduplicateGuides(currentGuides) };
      setSettings(newSettings);
      saveGuidesSettings(newSettings, currentUserEmail);
    }
  }, [treks, currentUserEmail]);

  const handleToggleMasterTab = () => {
    const nextState = !settings.show_trek_leaders_tab;
    const updated: GuidesSettings = {
      ...settings,
      show_trek_leaders_tab: nextState,
    };
    setSettings(updated);
    saveGuidesSettings(updated);

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `${nextState ? 'Enabled' : 'Disabled'} public Trek Leaders tab`,
      metadata: {
        show_trek_leaders_tab: nextState,
        changes: {
          show_trek_leaders_tab: { before: !nextState, after: nextState },
        },
      },
      adminEmail: currentUserEmail,
    });

    triggerSuccessBanner();
  };

  const handleToggleGuideVisibility = (id: string, name?: string) => {
    const targetId = (id || '').trim().toLowerCase();
    const targetName = (name || '').trim().toLowerCase();
    let nextVis = true;

    const updatedGuides = settings.custom_guides.map((g) => {
      const gId = (g.id || '').trim().toLowerCase();
      const gName = (g.name || '').trim().toLowerCase();
      if ((targetId && gId === targetId) || (targetName && gName === targetName)) {
        nextVis = !g.is_visible;
        return { ...g, is_visible: !g.is_visible };
      }
      return g;
    });

    const updated: GuidesSettings = { ...settings, custom_guides: deduplicateGuides(updatedGuides) };
    setSettings(updated);
    saveGuidesSettings(updated);

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `Set guide "${name || id}" visibility to ${nextVis ? 'Visible' : 'Hidden'}`,
      metadata: {
        guide_id: id,
        name,
        is_visible: nextVis,
        changes: {
          is_visible: { before: !nextVis, after: nextVis },
        },
      },
      adminEmail: currentUserEmail,
    });

    triggerSuccessBanner();
  };

  const handleSaveEditedGuide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuide) return;

    const updatedGuides = settings.custom_guides.map((g) =>
      g.id === editingGuide.id ? editingGuide : g
    );
    const updated: GuidesSettings = { ...settings, custom_guides: updatedGuides };
    setSettings(updated);
    saveGuidesSettings(updated);

    const prevGuide = settings.custom_guides.find((g) => g.id === editingGuide.id);
    const guideChanges = prevGuide
      ? buildAuditChanges(
          {
            name: prevGuide.name,
            role: prevGuide.role,
            gender: prevGuide.gender,
            specialty: prevGuide.specialty || '',
            badge: prevGuide.badge || '',
            is_visible: prevGuide.is_visible,
          },
          {
            name: editingGuide.name,
            role: editingGuide.role,
            gender: editingGuide.gender,
            specialty: editingGuide.specialty || '',
            badge: editingGuide.badge || '',
            is_visible: editingGuide.is_visible,
          }
        )
      : {};

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `Updated guide intro profile: "${editingGuide.name}" (${editingGuide.role})`,
      metadata: {
        guide_id: editingGuide.id,
        name: editingGuide.name,
        role: editingGuide.role,
        gender: editingGuide.gender,
        specialty: editingGuide.specialty,
        badge: editingGuide.badge,
        is_visible: editingGuide.is_visible,
        ...(Object.keys(guideChanges).length > 0 ? { changes: guideChanges } : {}),
      },
      adminEmail: currentUserEmail,
    });

    setEditingGuide(null);
    triggerSuccessBanner();
  };

  const handleCreateNewGuide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuide.name.trim()) return;

    const created: CustomGuideData = {
      id: `custom-guide-${Date.now()}`,
      name: newGuide.name.trim(),
      role: newGuide.role.trim() || 'Trek Leader & Coordinator',
      bio: newGuide.bio.trim() || 'Certified Himalayan route guide with Walk Nepal Walk.',
      gender: newGuide.gender,
      specialty: newGuide.specialty.trim(),
      badge: newGuide.badge.trim() || 'Trek Leader',
      experienceKm: newGuide.experienceKm.trim(),
      phone: newGuide.phone.trim(),
      is_visible: true,
    };

    const current = getGuidesSettings();
    const baseGuides = current.custom_guides.length >= settings.custom_guides.length
      ? current.custom_guides
      : settings.custom_guides;

    const updated: GuidesSettings = {
      ...settings,
      custom_guides: deduplicateGuides([created, ...baseGuides]),
    };
    setSettings(updated);
    saveGuidesSettings(updated, currentUserEmail);

    if (filterGender !== 'all' && filterGender !== created.gender) {
      setFilterGender('all');
    }
    if (searchQuery.trim()) {
      setSearchQuery('');
    }

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `Added new guide profile: "${created.name}" (${created.role})`,
      metadata: {
        guide_id: created.id,
        name: created.name,
        role: created.role,
        gender: created.gender,
        experience_km: created.experienceKm,
        specialty: created.specialty,
        changes: {
          name: { before: null, after: created.name },
          role: { before: null, after: created.role },
        },
      },
      adminEmail: currentUserEmail,
    });

    setShowAddModal(false);
    setNewGuide({
      name: '',
      role: 'Trek Leader & Mountain Guide',
      bio: '',
      gender: 'Male',
      specialty: '',
      badge: 'Trek Leader',
      experienceKm: '',
      phone: '',
    });
    triggerSuccessBanner();
  };

  const handleDeleteGuide = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the guides list?`)) return;
    const updatedGuides = settings.custom_guides.filter((g) => g.id !== id);
    const updated: GuidesSettings = { ...settings, custom_guides: updatedGuides };
    setSettings(updated);
    saveGuidesSettings(updated);

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: `Removed guide profile: "${name}" (#${id})`,
      metadata: {
        guide_id: id,
        name,
        action: 'delete',
        changes: {
          name: { before: name, after: null },
        },
      },
      adminEmail: currentUserEmail,
    });

    triggerSuccessBanner();
  };

  const handleResetToDefaults = () => {
    if (!window.confirm('Reset all guide profiles and display settings back to default system settings?')) return;
    const defaultSettings: GuidesSettings = {
      show_trek_leaders_tab: true,
      custom_guides: DEFAULT_GUIDES,
    };
    setSettings(defaultSettings);
    saveGuidesSettings(defaultSettings);

    // Record in Admin Audit Trail
    recordAdminAuditLog({
      actionType: 'UPDATE_GUIDES',
      description: 'Reset all guide profiles and settings to system defaults',
      metadata: {
        action: 'reset_defaults',
      },
      adminEmail: currentUserEmail,
    });

    triggerSuccessBanner();
  };

  const triggerSuccessBanner = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const filteredGuides = useMemo(() => {
    const unique = deduplicateGuides(settings.custom_guides || []);
    
    // Sort so visible (true) comes before hidden (false)
    unique.sort((a, b) => (a.is_visible === b.is_visible ? 0 : a.is_visible ? -1 : 1));

    return unique.filter((g) => {
      if (filterGender !== 'all' && g.gender !== filterGender) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.name.toLowerCase().includes(q);
        const matchesRole = g.role.toLowerCase().includes(q);
        const matchesBio = g.bio.toLowerCase().includes(q);
        const matchesSpecialty = (g.specialty || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesBio && !matchesSpecialty) return false;
      }
      return true;
    });
  }, [settings.custom_guides, filterGender, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 text-white shadow-lg border border-teal-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-1/3 w-44 h-44 rounded-full bg-sky-300/15 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 text-amber-200 text-[11px] font-extrabold uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>Guide Management &amp; Intros</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Trek Leaders Intros &amp; Display Toggles
          </h2>
          <p className="text-xs text-teal-50/90 mt-1 max-w-2xl leading-relaxed">
            Customize guide roles, bios, and specialties, and toggle individual guide visibility or the entire Trek Leaders Resources tab on the public website.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Guide</span>
          </button>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 backdrop-blur-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>Guide intro changes &amp; display toggles saved successfully! Updates are live on the public site.</span>
        </div>
      )}

      {/* Master Tab Visibility Toggle Card */}
      <div
        className={`p-4 rounded-2xl border-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          settings.show_trek_leaders_tab
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/80 to-sky-50 border-emerald-300'
            : 'bg-gradient-to-r from-rose-50 via-amber-50/80 to-orange-50 border-rose-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              settings.show_trek_leaders_tab
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                : 'bg-gradient-to-br from-rose-500 to-amber-500 text-white'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#1F1F1F] flex items-center gap-2">
              <span>Site-Wide "Trek Leaders" Resources Tab</span>
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {settings.show_trek_leaders_tab
                ? 'The "Trek Leaders" tab is currently VISIBLE under Resources on the public website.'
                : 'The "Trek Leaders" tab is currently HIDDEN from Resources on the public website.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMasterTab}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0 ${
            settings.show_trek_leaders_tab
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
              : 'bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600'
          }`}
        >
          {settings.show_trek_leaders_tab ? (
            <>
              <Eye className="w-4 h-4" />
              <span>Visible on Site</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" />
              <span>Hidden on Site</span>
            </>
          )}
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-r from-sky-50/80 via-white to-violet-50/80 p-3.5 rounded-2xl border border-sky-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter guides by name, role, specialty, or bio..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 text-[#1F1F1F]"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterGender('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterGender === 'all'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            All ({settings.custom_guides.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterGender('Male')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterGender === 'Male'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            Male
          </button>
          <button
            type="button"
            onClick={() => setFilterGender('Female')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              filterGender === 'Female'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            Female
          </button>
        </div>
      </div>

      {/* Guides Table */}
      <div className="bg-white rounded-2xl border-2 border-indigo-200/80 overflow-x-auto shadow-md">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white font-extrabold uppercase tracking-wider">
              <th className="p-3 text-center w-12">SN</th>
              <th className="p-3 w-[12%]">Name</th>
              <th className="p-3 w-[11%]">Phone Number</th>
              <th className="p-3">Role</th>
              <th className="p-3">Badge</th>
              <th className="p-3 w-[36%]">Intro</th>
              <th className="p-3 text-center">Visible</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-100/80">
            {filteredGuides.map((guide, idx) => {
              const draft = rowDrafts[guide.id] || {};
              const isDirty = Object.keys(draft).length > 0;
              const isFemale = guide.gender === 'Female';

              return (
                <tr
                  key={`${guide.id || guide.name}_${idx}`}
                  className={`transition-colors border-l-4 ${
                    isDirty
                      ? 'bg-amber-50/70 border-l-amber-500 text-[#1F1F1F]'
                      : !guide.is_visible
                      ? 'bg-rose-50/35 border-l-neutral-300 text-neutral-500'
                      : idx % 2 === 0
                      ? `bg-white hover:bg-amber-50/50 text-[#1F1F1F] ${isFemale ? 'border-l-purple-400' : 'border-l-blue-400'}`
                      : `bg-sky-50/35 hover:bg-amber-50/50 text-[#1F1F1F] ${isFemale ? 'border-l-purple-400' : 'border-l-blue-500'}`
                  }`}
                >
                  <td className="p-3 text-center align-middle">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black shadow-2xs ${
                        !guide.is_visible
                          ? 'bg-neutral-200 text-neutral-600'
                          : isFemale
                          ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3 w-[12%]">
                    <input
                      type="text"
                      value={draft.name ?? guide.name}
                      onChange={(e) => handleRowChange(guide.id, 'name', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg font-bold transition-colors focus:outline-none ${
                        draft.name !== undefined
                          ? 'border-amber-400 bg-amber-50 text-[#1F1F1F]'
                          : 'border-indigo-200/80 bg-white/80 focus:border-indigo-500 focus:bg-white'
                      }`}
                    />
                  </td>
                  <td className="p-3 w-[11%]">
                    <input
                      type="tel"
                      value={draft.phone ?? (guide.phone || '')}
                      onChange={(e) => handleRowChange(guide.id, 'phone', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg transition-colors focus:outline-none ${
                        draft.phone !== undefined
                          ? 'border-amber-400 bg-amber-50 text-[#1F1F1F]'
                          : 'border-sky-200/80 bg-white/80 focus:border-sky-500 focus:bg-white'
                      }`}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={draft.role ?? guide.role}
                      onChange={(e) => handleRowChange(guide.id, 'role', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg transition-colors focus:outline-none ${
                        draft.role !== undefined
                          ? 'border-amber-400 bg-amber-50 text-[#1F1F1F]'
                          : 'border-teal-200/80 bg-white/80 focus:border-teal-500 focus:bg-white'
                      }`}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={draft.badge ?? (guide.badge || '')}
                      onChange={(e) => handleRowChange(guide.id, 'badge', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg font-semibold transition-colors focus:outline-none ${
                        draft.badge !== undefined
                          ? 'border-amber-400 bg-amber-50 text-[#1F1F1F]'
                          : 'border-violet-200 bg-violet-50/70 text-violet-800 focus:border-violet-500 focus:bg-white'
                      }`}
                    />
                  </td>
                  <td className="p-3 w-[36%]">
                    <textarea
                      value={draft.bio ?? guide.bio}
                      onChange={(e) => handleRowChange(guide.id, 'bio', e.target.value)}
                      className={`w-full px-2 py-1.5 border rounded-lg text-[11px] leading-relaxed transition-colors focus:outline-none ${
                        draft.bio !== undefined
                          ? 'border-amber-400 bg-amber-50 text-[#1F1F1F]'
                          : 'border-slate-200 bg-white/80 focus:border-teal-500 focus:bg-white'
                      }`}
                      rows={2}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleGuideVisibility(guide.id, guide.name)}
                      className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1 text-[11px] font-extrabold cursor-pointer transition-all active:scale-95 ${
                        guide.is_visible
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xs hover:from-emerald-600 hover:to-teal-600'
                          : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                      }`}
                      title={guide.is_visible ? 'Click to hide' : 'Click to show'}
                    >
                      {guide.is_visible ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>On</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Off</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isDirty && (
                        <button
                          type="button"
                          onClick={() => handleSaveRow(guide.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-[11px] shadow-xs inline-flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteGuide(guide.id, guide.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-500 font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Guide Intro Modal */}
      {editingGuide && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-amber-200">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-white" />
                <h3 className="text-base font-extrabold text-white">
                  Edit Intro for {editingGuide.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingGuide(null)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedGuide} className="p-5 sm:p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Guide Full Name</label>
                <input
                  type="text"
                  required
                  value={editingGuide.name}
                  onChange={(e) => setEditingGuide({ ...editingGuide, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/30 focus:bg-white focus:outline-none focus:border-indigo-500 font-semibold text-[#1F1F1F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Role Title</label>
                  <input
                    type="text"
                    required
                    value={editingGuide.role}
                    onChange={(e) => setEditingGuide({ ...editingGuide, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-teal-50/30 focus:bg-white focus:outline-none focus:border-teal-500 text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Gender</label>
                  <select
                    value={editingGuide.gender}
                    onChange={(e) => setEditingGuide({ ...editingGuide, gender: e.target.value as 'Male' | 'Female' })}
                    className={`w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/30 focus:bg-white focus:outline-none focus:border-sky-500 font-bold ${getGenderTextColorClass(
                      editingGuide.gender,
                      'text-[#1F1F1F]'
                    )}`}
                  >
                    <option value="Male" className="text-blue-700 font-bold">Male</option>
                    <option value="Female" className="text-purple-700 font-bold">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editingGuide.phone || ''}
                  onChange={(e) => setEditingGuide({ ...editingGuide, phone: e.target.value })}
                  placeholder="e.g. +977 98xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/30 focus:bg-white focus:outline-none focus:border-sky-500 text-[#1F1F1F]"
                />
              </div>


              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Bio / Introduction Story</label>
                <textarea
                  rows={3}
                  required
                  value={editingGuide.bio}
                  onChange={(e) => setEditingGuide({ ...editingGuide, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-none focus:border-amber-500 text-[#1F1F1F] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Badge / Tag</label>
                  <input
                    type="text"
                    value={editingGuide.badge || ''}
                    onChange={(e) => setEditingGuide({ ...editingGuide, badge: e.target.value })}
                    placeholder="e.g. Senior Guide"
                    className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-violet-50/30 focus:bg-white focus:outline-none focus:border-violet-500 text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Specialty</label>
                  <input
                    type="text"
                    value={editingGuide.specialty || ''}
                    onChange={(e) => setEditingGuide({ ...editingGuide, specialty: e.target.value })}
                    placeholder="e.g. High-altitude passes"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/30 focus:bg-white focus:outline-none focus:border-emerald-500 text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0EBE5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGuide(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-neutral-700 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Intro Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Guide Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-teal-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 text-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-extrabold text-white">
                  Add New Trek Leader or Coordinator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewGuide} className="p-5 sm:p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pasang Sherpa"
                  value={newGuide.name}
                  onChange={(e) => setNewGuide({ ...newGuide, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/30 focus:bg-white focus:outline-none focus:border-indigo-500 text-[#1F1F1F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Role Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Mountain Guide"
                    value={newGuide.role}
                    onChange={(e) => setNewGuide({ ...newGuide, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-teal-50/30 focus:bg-white focus:outline-none focus:border-teal-500 text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Gender</label>
                  <select
                    value={newGuide.gender}
                    onChange={(e) => setNewGuide({ ...newGuide, gender: e.target.value as 'Male' | 'Female' })}
                    className={`w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/30 focus:bg-white focus:outline-none focus:border-sky-500 font-bold ${getGenderTextColorClass(
                      newGuide.gender,
                      'text-[#1F1F1F]'
                    )}`}
                  >
                    <option value="Male" className="text-blue-700 font-bold">Male</option>
                    <option value="Female" className="text-purple-700 font-bold">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newGuide.phone}
                  onChange={(e) => setNewGuide({ ...newGuide, phone: e.target.value })}
                  placeholder="e.g. +977 98xxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/30 focus:bg-white focus:outline-none focus:border-sky-500 text-[#1F1F1F]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Bio / Intro</label>
                <textarea
                  rows={3}
                  placeholder="Short introductory bio about mountain experience and trail expertise..."
                  value={newGuide.bio}
                  onChange={(e) => setNewGuide({ ...newGuide, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-none focus:border-teal-500 text-[#1F1F1F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Badge / Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Trek Leader"
                    value={newGuide.badge}
                    onChange={(e) => setNewGuide({ ...newGuide, badge: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-violet-50/30 focus:bg-white focus:outline-none focus:border-violet-500 text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Specialty</label>
                  <input
                    type="text"
                    placeholder="e.g. High altitude ridges"
                    value={newGuide.specialty}
                    onChange={(e) => setNewGuide({ ...newGuide, specialty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/30 focus:bg-white focus:outline-none focus:border-emerald-500 text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0EBE5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-neutral-700 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Trek Leader</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
