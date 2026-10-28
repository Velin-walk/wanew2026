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

interface GuidesManagerProps {
  currentUserEmail?: string;
  treks?: any[];
}

export const GuidesManager: React.FC<GuidesManagerProps> = ({ treks = [] }) => {
  const [settings, setSettings] = useState<GuidesSettings>(getGuidesSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [editingGuide, setEditingGuide] = useState<CustomGuideData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New guide form state
  const [newGuide, setNewGuide] = useState<{
    name: string;
    role: string;
    bio: string;
    gender: 'Male' | 'Female';
    specialty: string;
    badge: string;
    experienceKm: string;
  }>({
    name: '',
    role: 'Trek Leader & Mountain Guide',
    bio: '',
    gender: 'Male',
    specialty: '',
    badge: 'Trek Leader',
    experienceKm: '',
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
    if (treks && treks.length > 0) {
      setSettings((prev) => {
        let updated = false;
        const currentGuides = [...prev.custom_guides];
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
          const newSettings = { ...prev, custom_guides: currentGuides };
          saveGuidesSettings(newSettings);
          return newSettings;
        }
        return prev;
      });
    }
  }, [treks]);

  const handleToggleMasterTab = () => {
    const updated: GuidesSettings = {
      ...settings,
      show_trek_leaders_tab: !settings.show_trek_leaders_tab,
    };
    setSettings(updated);
    saveGuidesSettings(updated);
    triggerSuccessBanner();
  };

  const handleToggleGuideVisibility = (id: string, name?: string) => {
    const targetId = (id || '').trim().toLowerCase();
    const targetName = (name || '').trim().toLowerCase();

    const updatedGuides = settings.custom_guides.map((g) => {
      const gId = (g.id || '').trim().toLowerCase();
      const gName = (g.name || '').trim().toLowerCase();
      if ((targetId && gId === targetId) || (targetName && gName === targetName)) {
        return { ...g, is_visible: !g.is_visible };
      }
      return g;
    });

    const updated: GuidesSettings = { ...settings, custom_guides: deduplicateGuides(updatedGuides) };
    setSettings(updated);
    saveGuidesSettings(updated);
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
      is_visible: true,
    };

    const updated: GuidesSettings = {
      ...settings,
      custom_guides: [created, ...settings.custom_guides],
    };
    setSettings(updated);
    saveGuidesSettings(updated);
    setShowAddModal(false);
    setNewGuide({
      name: '',
      role: 'Trek Leader & Mountain Guide',
      bio: '',
      gender: 'Male',
      specialty: '',
      badge: 'Trek Leader',
      experienceKm: '',
    });
    triggerSuccessBanner();
  };

  const handleDeleteGuide = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the guides list?`)) return;
    const updatedGuides = settings.custom_guides.filter((g) => g.id !== id);
    const updated: GuidesSettings = { ...settings, custom_guides: updatedGuides };
    setSettings(updated);
    saveGuidesSettings(updated);
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
    triggerSuccessBanner();
  };

  const triggerSuccessBanner = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const filteredGuides = useMemo(() => {
    const unique = deduplicateGuides(settings.custom_guides || []);
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
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#1F1F1F] via-[#2D2D2D] to-[#141414] text-white shadow-md border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#7ABA42] text-xs font-bold uppercase tracking-wider mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Guide Management &amp; Intros</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Trek Leaders Intros &amp; Display Toggles
          </h2>
          <p className="text-xs text-neutral-300 mt-1 max-w-2xl leading-relaxed">
            Customize guide roles, bios, and specialties, and toggle individual guide visibility or the entire Trek Leaders Resources tab on the public website.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#E08828] hover:bg-[#c9741d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Guide</span>
          </button>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Guide intro changes &amp; display toggles saved successfully! Updates are live on the public site.</span>
        </div>
      )}

      {/* Master Tab Visibility Toggle Card */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E1DB] shadow-2xs flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-extrabold text-[#1F1F1F] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E08828]" />
            <span>Site-Wide "Trek Leaders" Resources Tab</span>
          </h4>
          <p className="text-xs text-[#8B8680] mt-0.5">
            {settings.show_trek_leaders_tab
              ? 'The "Trek Leaders" tab is currently VISIBLE under Resources on the public website.'
              : 'The "Trek Leaders" tab is currently HIDDEN from Resources on the public website.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleMasterTab}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 shrink-0 ${
            settings.show_trek_leaders_tab
              ? 'bg-[#7ABA42] text-white hover:bg-[#6ba637]'
              : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5E1DB]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter guides by name, role, specialty, or bio..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterGender('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'all'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] hover:bg-[#F3F0EC] border border-[#E5E1DB]'
            }`}
          >
            All ({settings.custom_guides.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterGender('Male')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'Male'
                ? 'bg-sky-600 text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] hover:bg-[#F3F0EC] border border-[#E5E1DB]'
            }`}
          >
            Male
          </button>
          <button
            type="button"
            onClick={() => setFilterGender('Female')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterGender === 'Female'
                ? 'bg-rose-600 text-white'
                : 'bg-[#FAF8F5] text-[#5A5551] hover:bg-[#F3F0EC] border border-[#E5E1DB]'
            }`}
          >
            Female
          </button>
        </div>
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGuides.map((guide, idx) => {
          const isFemale = guide.gender === 'Female';
          return (
            <div
              key={`${guide.id || guide.name || 'guide'}_${idx}`}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                guide.is_visible
                  ? 'bg-white border-[#E5E1DB] shadow-2xs hover:border-[#E08828]/50'
                  : 'bg-neutral-50/80 border-neutral-200 opacity-75 grayscale-30'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white shrink-0 shadow-xs ${
                        isFemale
                          ? 'bg-gradient-to-br from-rose-500 to-pink-600'
                          : 'bg-gradient-to-br from-[#E08828] to-[#9E4700]'
                      }`}
                    >
                      {guide.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-extrabold text-[#1F1F1F] leading-snug">
                          {guide.name}
                        </h3>
                        {guide.badge && (
                          <span className="text-[9px] font-bold text-[#E08828] bg-[#FFF4E8] border border-[#E08828]/20 px-2 py-0.5 rounded-full">
                            {guide.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[#8B8680] mt-0.5">
                        {guide.role}
                      </p>
                    </div>
                  </div>

                  {/* Visibility Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleGuideVisibility(guide.id, guide.name)}
                    className={`p-2 rounded-xl transition-all cursor-pointer border ${
                      guide.is_visible
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
                    }`}
                    title={guide.is_visible ? 'Visible on public site (Click to hide)' : 'Hidden from public site (Click to show)'}
                  >
                    {guide.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-xs text-[#5A5551] mt-3 leading-relaxed">
                  {guide.bio}
                </p>

                {guide.specialty && (
                  <div className="mt-2.5 pt-2 border-t border-[#F0EBE5] text-[11px] text-[#8B8680]">
                    <span className="font-bold text-[#1F1F1F]">Specialty:</span> {guide.specialty}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[#F0EBE5] flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  guide.is_visible
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                }`}>
                  {guide.is_visible ? 'Publicly Displayed' : 'Hidden from Directory'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingGuide(guide)}
                    className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white border border-[#E5E1DB] rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Intro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGuide(guide.id, guide.name)}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Guide"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Guide Intro Modal */}
      {editingGuide && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-[#E5E1DB] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#E08828]" />
                <h3 className="text-base font-extrabold text-[#1F1F1F]">
                  Edit Intro for {editingGuide.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingGuide(null)}
                className="p-1.5 text-neutral-400 hover:text-black rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedGuide} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Guide Full Name</label>
                <input
                  type="text"
                  required
                  value={editingGuide.name}
                  onChange={(e) => setEditingGuide({ ...editingGuide, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] font-semibold text-[#1F1F1F]"
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
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Gender</label>
                  <select
                    value={editingGuide.gender}
                    onChange={(e) => setEditingGuide({ ...editingGuide, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Bio / Introduction Story</label>
                <textarea
                  rows={3}
                  required
                  value={editingGuide.bio}
                  onChange={(e) => setEditingGuide({ ...editingGuide, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F] leading-relaxed"
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
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Specialty</label>
                  <input
                    type="text"
                    value={editingGuide.specialty || ''}
                    onChange={(e) => setEditingGuide({ ...editingGuide, specialty: e.target.value })}
                    placeholder="e.g. High-altitude passes"
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0EBE5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGuide(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E1DB] text-neutral-700 hover:bg-neutral-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E08828] hover:bg-[#c9741d] text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-[#E5E1DB] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#E08828]" />
                <h3 className="text-base font-extrabold text-[#1F1F1F]">
                  Add New Trek Leader or Coordinator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-neutral-400 hover:text-black rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewGuide} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pasang Sherpa"
                  value={newGuide.name}
                  onChange={(e) => setNewGuide({ ...newGuide, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Role Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Mountain Guide"
                    value={newGuide.role}
                    onChange={(e) => setNewGuide({ ...newGuide, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Gender</label>
                  <select
                    value={newGuide.gender}
                    onChange={(e) => setNewGuide({ ...newGuide, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F1F1F] mb-1">Bio / Intro</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Short introductory bio about mountain experience and trail expertise..."
                  value={newGuide.bio}
                  onChange={(e) => setNewGuide({ ...newGuide, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
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
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F1F1F] mb-1">Specialty</label>
                  <input
                    type="text"
                    placeholder="e.g. High altitude ridges"
                    value={newGuide.specialty}
                    onChange={(e) => setNewGuide({ ...newGuide, specialty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#E08828] text-[#1F1F1F]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#F0EBE5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E1DB] text-neutral-700 hover:bg-neutral-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E08828] hover:bg-[#c9741d] text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
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
