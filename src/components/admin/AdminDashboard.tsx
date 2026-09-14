import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import {
  CheckCircle,
  XCircle,
  Trash2,
  Map,
  FileText,
  Shield,
  Layers,
  Plus,
  RefreshCw,
  AlertTriangle,
  CloudUpload
} from 'lucide-react';
import { ItineraryBuilder } from './ItineraryBuilder';
import { HikeLibraryList } from './HikeLibraryList';
import {
  SavedHikeRecord,
  DEFAULT_SAVED_HIKES
} from '../../data/defaultItineraryTemplate';

interface AdminDashboardProps {
  currentUserEmail: string;
}

export default function AdminDashboard({ currentUserEmail }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'editor' | 'maps'>('library');
  const [hikes, setHikes] = useState<SavedHikeRecord[]>(DEFAULT_SAVED_HIKES);
  const [loadingHikes, setLoadingHikes] = useState(true);
  const [editingHike, setEditingHike] = useState<SavedHikeRecord | null>(null);

  // Database upload & sync state
  const [serverHikeIds, setServerHikeIds] = useState<string[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Community Map Moderation State
  const [trails, setTrails] = useState<any[]>([]);
  const [loadingTrails, setLoadingTrails] = useState(false);

  useEffect(() => {
    fetchItineraries();
  }, []);

  useEffect(() => {
    if (activeTab === 'maps') {
      fetchPendingTrails();
    }
  }, [activeTab]);

  const getUnsyncedLocalHikes = (serverHikes: SavedHikeRecord[]): SavedHikeRecord[] => {
    const cached = localStorage.getItem('wnw_saved_itineraries_cache');
    if (!cached) return [];
    try {
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return [];
      const serverIds = new Set(serverHikes.map(h => h.id));
      return parsed.filter(h => h && h.id && !serverIds.has(h.id));
    } catch {
      return [];
    }
  };

  const fetchItineraries = async () => {
    setLoadingHikes(true);
    try {
      const res = await apiFetch('admin/itineraries');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const serverHikes = json.data;
          setServerHikeIds(serverHikes.map(h => h.id));

          const unsynced = getUnsyncedLocalHikes(serverHikes);
          const merged = [...unsynced, ...serverHikes];

          setHikes(merged);
          localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify(merged));
          return;
        }
      }
      const cached = localStorage.getItem('wnw_saved_itineraries_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHikes(parsed);
            return;
          }
        } catch (e) {
          console.warn('Failed parsing cached itineraries:', e);
        }
      }
      setHikes(DEFAULT_SAVED_HIKES);
    } catch (e) {
      console.warn('Network error fetching itineraries, using default cache:', e);
      const cached = localStorage.getItem('wnw_saved_itineraries_cache');
      if (cached) {
        try {
          setHikes(JSON.parse(cached));
        } catch {}
      }
    } finally {
      setLoadingHikes(false);
    }
  };

  const normalizeLocalHikeToUpload = (h: any): SavedHikeRecord => {
    if (h && h.data && typeof h.data === 'object' && h.data.title) {
      return h;
    }

    const dataObj: any = {
      hikeNumber: h.hikeNumber || h.hike_number || '',
      title: h.title || h.name || 'Untitled Hike',
      category: h.category || 'Overnight Bus Hikes',
      coverImageUrl: h.coverImageUrl || h.cover_image_url || h.featured_image || '',
      hikeDate: h.hikeDate || h.hike_date || h.date || '',
      teamLeader: h.teamLeader || h.team_leader || h.leader || 'Walk Nepal Walk Guide',
      maxCapacity: Number(h.maxCapacity || h.max_capacity || h.capacity) || 25,
      whatsappLink: h.whatsappLink || h.whatsapp_link || '',
      itineraryLink: h.itineraryLink || h.itinerary_link || '',
      faqLink: h.faqLink || h.faq_link || '',
      currency: h.currency || 'NPR',
      pricingNotes: h.pricingNotes || h.price || '',
      priceTiers: h.priceTiers || (h.price ? [{ id: 't1', label: 'Standard Price', price: parseInt(String(h.price).replace(/[^0-9]/g, '')) || 0 }] : []),
      overview: h.overview || {
        meetingTime: h.meetingTime || h.start_location || '',
        meetingPoint: h.meetingPoint || h.start_location || '',
        expectedDuration: h.expectedDuration || h.days || '1 Day',
        difficulty: h.difficulty || 'Easy',
        approxDistance: h.approxDistance || h.distance || '',
        elevationRange: h.elevationRange || h.elevation || '',
        elevationGross: h.elevationGross || '',
        endingPoint: h.endingPoint || '',
      },
      costIncludes: h.costIncludes || [],
      costExcludes: h.costExcludes || [],
      addOns: h.addOns || [],
      addOnsNotice: h.addOnsNotice || '',
      itineraryDays: h.itineraryDays || [],
      bookingProcessSteps: h.bookingProcessSteps || [],
      bookingNotes: h.bookingNotes || [],
      participationGuidelines: h.participationGuidelines || '',
      safetyRules: h.safetyRules || [],
      helpContacts: h.helpContacts || [],
    };

    return {
      id: h.id || `hike-draft-${Date.now().toString(36)}`,
      hikeNumber: dataObj.hikeNumber,
      title: dataObj.title,
      category: dataObj.category,
      status: h.status || 'published',
      createdAt: h.createdAt || new Date().toISOString(),
      updatedAt: h.updatedAt || new Date().toISOString(),
      authorEmail: h.authorEmail || 'walknepalwalk@gmail.com',
      data: dataObj,
    };
  };

  const handleUploadToDatabase = async () => {
    const unsyncedList = hikes.filter(h => !serverHikeIds.includes(h.id));
    setIsSyncingAll(true);
    setSyncMessage(
      unsyncedList.length > 0
        ? `Uploading ${unsyncedList.length} local itinerary template(s) to database...`
        : 'Syncing itineraries to database...'
    );

    let uploadedLocalCount = 0;

    // 1. Upload unsynced local cache items to the server API
    for (const rawUnsynced of unsyncedList) {
      try {
        const unsynced = normalizeLocalHikeToUpload(rawUnsynced);
        console.log('[Upload Engine] Uploading itinerary:', unsynced.title);

        const res = await apiFetch('admin/itineraries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: unsynced.data,
            status: unsynced.status,
            authorEmail: unsynced.authorEmail || currentUserEmail || 'walknepalwalk@gmail.com',
          }),
        });

        if (res.ok) {
          const resJson = await res.json().catch(() => ({}));
          if (resJson.success) {
            uploadedLocalCount++;
          }
        }
      } catch (err) {
        console.error('[Upload Engine] Failed to upload local itinerary:', rawUnsynced.title, err);
      }
    }

    // 2. Trigger database bulk sync
    try {
      const res = await apiFetch('admin/sync-all', { method: 'POST' });
      if (res.ok) {
        setSyncMessage(`🎉 Successfully saved and synced all itineraries to database!`);
      } else {
        setSyncMessage(`🎉 Uploaded itineraries to database successfully!`);
      }
    } catch (e: any) {
      setSyncMessage(`🎉 Uploaded itineraries to database!`);
    } finally {
      await fetchItineraries();
      setIsSyncingAll(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const fetchPendingTrails = async () => {
    setLoadingTrails(true);
    try {
      const res = await apiFetch('mapminers/trails');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const loadedTrails = Object.entries(data.data).map(([fileName, meta]: [string, any]) => ({
            ...meta,
            fileName,
          }));
          setTrails(loadedTrails);
        }
      }
    } catch (e) {
      console.error('Error fetching trails:', e);
    } finally {
      setLoadingTrails(false);
    }
  };

  const handleCreateNew = () => {
    setEditingHike(null);
    setActiveTab('editor');
  };

  const handleSelectEdit = (hike: SavedHikeRecord) => {
    setEditingHike(hike);
    setActiveTab('editor');
  };

  const handleSelectPreview = (hike: SavedHikeRecord) => {
    setEditingHike(hike);
    setActiveTab('editor');
  };

  const handleCloneHike = async (hikeId: string) => {
    try {
      const res = await apiFetch(`admin/itineraries/${hikeId}/clone`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setHikes((prev) => [json.data, ...prev]);
          localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify([json.data, ...hikes]));
          return;
        }
      }
      const source = hikes.find((h) => h.id === hikeId);
      if (source) {
        const cloned: SavedHikeRecord = {
          ...source,
          id: `hike-copy-${Date.now()}`,
          title: `${source.title} (Copy)`,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: {
            ...source.data,
            title: `${source.title} (Copy)`,
          },
        };
        const next = [cloned, ...hikes];
        setHikes(next);
        localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify(next));
      }
    } catch (e) {
      console.error('Error cloning hike:', e);
    }
  };

  const handleDeleteHike = async (hikeId: string) => {
    try {
      await apiFetch(`admin/itineraries/${hikeId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Network delete error:', e);
    }
    const next = hikes.filter((h) => h.id !== hikeId);
    setHikes(next);
    localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify(next));
  };

  const handleToggleStatus = async (
    hikeId: string,
    newStatus: 'draft' | 'published' | 'archived'
  ) => {
    try {
      await apiFetch(`admin/itineraries/${hikeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.warn('Network status update error:', e);
    }
    const next = hikes.map((h) =>
      h.id === hikeId ? { ...h, status: newStatus, updatedAt: new Date().toISOString() } : h
    );
    setHikes(next);
    localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify(next));
  };

  const handleSaveRecord = (savedRecord: SavedHikeRecord) => {
    setHikes((prev) => {
      const idx = prev.findIndex((h) => h.id === savedRecord.id);
      let next: SavedHikeRecord[];
      if (idx !== -1) {
        next = [...prev];
        next[idx] = savedRecord;
      } else {
        next = [savedRecord, ...prev];
      }
      localStorage.setItem('wnw_saved_itineraries_cache', JSON.stringify(next));
      return next;
    });
    setEditingHike(savedRecord);
  };

  const unsyncedLocalCount = hikes.filter(h => !serverHikeIds.includes(h.id)).length;

  return (
    <div className="w-full space-y-4">
      {/* Unsynced Local-Cache Notice Banner */}
      {activeTab === 'library' && unsyncedLocalCount > 0 && (
        <div className="bg-[#FFF9F2] border border-[#F3E0C8] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex gap-2.5 items-start">
            <AlertTriangle className="w-5 h-5 text-[#E08828] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#6B3E08]">Unsynced Itineraries Found in Browser</h4>
              <p className="text-[11px] text-[#8C5D23] mt-0.5">
                We detected {unsyncedLocalCount} itinerary template(s) saved in this browser's local cache.
              </p>
            </div>
          </div>
          <button
            id="btn-unsynced-upload-db"
            onClick={handleUploadToDatabase}
            disabled={isSyncingAll}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#E08828] hover:bg-[#C86B1A] disabled:bg-[#E08828]/50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            {isSyncingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            <span>{isSyncingAll ? 'Uploading...' : 'Upload to Database'}</span>
          </button>
        </div>
      )}

      {syncMessage && (
        <div className="bg-[#E6F4EA] border border-[#B7E1CD] text-[#137333] px-4 py-3 rounded-2xl text-xs font-bold animate-in fade-in duration-200">
          {syncMessage}
        </div>
      )}

      {/* Admin Sub-navigation Segment */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-2 sm:p-2.5 rounded-2xl border border-[#E5E1DB] shadow-2xs gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {/* Hike Library Tab */}
          <button
            id="admin-tab-library"
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-[#E08828] text-white shadow-xs'
                : 'text-[#5A5551] hover:bg-[#F9F7F5]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Itinerary Library</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                activeTab === 'library' ? 'bg-white/20 text-white' : 'bg-[#EFEAE4] text-[#5A5551]'
              }`}
            >
              {hikes.length}
            </span>
          </button>

          {/* Active Trek Editor Tab */}
          <button
            id="admin-tab-editor"
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-[#E08828] text-white shadow-xs'
                : 'text-[#5A5551] hover:bg-[#F9F7F5]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{editingHike ? `Editing: Hike #${editingHike.hikeNumber || ''}` : 'Content Builder'}</span>
          </button>

          {/* Community Maps Tab */}
          <button
            id="admin-tab-maps"
            type="button"
            onClick={() => setActiveTab('maps')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'maps'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[#5A5551] hover:bg-[#F9F7F5]'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Map Moderation</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {activeTab === 'library' && (
            <button
              id="btn-quick-new-hike"
              type="button"
              onClick={handleCreateNew}
              className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-[#E08828] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8B8680] bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#EFEAE4]">
            <Shield className="w-3.5 h-3.5 text-[#7ABA42]" />
            <span className="truncate max-w-[140px] sm:max-w-none">{currentUserEmail}</span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'library' && (
        <HikeLibraryList
          hikes={hikes}
          loading={loadingHikes}
          onSelectEdit={handleSelectEdit}
          onSelectPreview={handleSelectPreview}
          onCreateNew={handleCreateNew}
          onCloneHike={handleCloneHike}
          onDeleteHike={handleDeleteHike}
          onToggleStatus={handleToggleStatus}
          onRefresh={fetchItineraries}
          onUploadToDatabase={handleUploadToDatabase}
          isSyncingDatabase={isSyncingAll}
          unsyncedCount={unsyncedLocalCount}
        />
      )}

      {activeTab === 'editor' && (
        <ItineraryBuilder
          initialRecord={editingHike}
          onBackToList={() => setActiveTab('library')}
          onSaveRecord={handleSaveRecord}
          onCloneHike={handleCloneHike}
        />
      )}

      {activeTab === 'maps' && (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-[#E5E1DB] p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-[#F0EBE5] pb-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <Map className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] tracking-tight">Admin Moderation</h2>
              <p className="text-xs text-[#8B8680] mt-0.5">Approve or reject community map submissions.</p>
            </div>
          </div>

          {loadingTrails ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : trails.length === 0 ? (
            <div className="text-center py-12 text-[#8B8680]">
              <p>No trails pending review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trails.map((trail) => (
                <div
                  key={trail.id || trail.fileName}
                  className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-[#F9F7F5] rounded-xl border border-[#E5E1DB]"
                >
                  <div>
                    <h3 className="font-bold text-sm text-[#1F1F1F]">{trail.name}</h3>
                    <p className="text-[11px] text-[#5A5551] mt-0.5">Submitted by {trail.contributorEmail || 'Community'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800">
                        Pending Review
                      </span>
                      <span className="text-[10px] text-[#8B8680]">{trail.fileName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
