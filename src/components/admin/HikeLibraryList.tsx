import React, { useState } from 'react';
import {
  SavedHikeRecord,
  TrekItineraryData
} from '../../data/defaultItineraryTemplate';
import {
  Plus,
  Search,
  Filter,
  Copy,
  Edit3,
  Share2,
  Eye,
  Trash2,
  Calendar,
  MapPin,
  TrendingUp,
  Clock,
  DollarSign,
  Tag,
  CheckCircle2,
  Clock3,
  Layers,
  Archive,
  RefreshCw,
  CloudUpload,
  LayoutGrid,
  List,
  ArrowUpDown
} from 'lucide-react';
import { ShareHikeModal } from './ShareHikeModal';
import { apiFetch } from '../../services/api';

interface HikeLibraryListProps {
  hikes: SavedHikeRecord[];
  loading?: boolean;
  onSelectEdit: (hike: SavedHikeRecord) => void;
  onSelectPreview: (hike: SavedHikeRecord) => void;
  onCreateNew: () => void;
  onCloneHike: (hikeId: string) => void;
  onDeleteHike: (hikeId: string) => void;
  onToggleStatus: (hikeId: string, newStatus: 'draft' | 'published' | 'archived') => void;
  onRefresh?: () => void;
  onUploadToDatabase?: () => void;
  isSyncingDatabase?: boolean;
  unsyncedCount?: number;
}

export const HikeLibraryList: React.FC<HikeLibraryListProps> = ({
  hikes,
  loading = false,
  onSelectEdit,
  onSelectPreview,
  onCreateNew,
  onCloneHike,
  onDeleteHike,
  onToggleStatus,
  onRefresh,
  onUploadToDatabase,
  isSyncingDatabase = false,
  unsyncedCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sharingHike, setSharingHike] = useState<SavedHikeRecord | null>(null);
  const [deletingHike, setDeletingHike] = useState<SavedHikeRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Helper to extract numeric hike number from string (e.g., "253", "Hike 192", "#108")
  const parseHikeNum = (h: SavedHikeRecord): number => {
    const raw = String(h.hikeNumber || h.data?.hikeNumber || '').trim();
    const match = raw.match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  };

  // Filter and sort hikes: highest hike number at top, lowest at bottom by default
  const filteredHikes = hikes
    .filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        h.title?.toLowerCase().includes(q) ||
        h.hikeNumber?.toLowerCase().includes(q) ||
        h.data?.hikeNumber?.toLowerCase().includes(q) ||
        h.data?.overview?.meetingPoint?.toLowerCase().includes(q) ||
        h.data?.overview?.endingPoint?.toLowerCase().includes(q);

      const matchCategory =
        selectedCategory === 'all' || h.category === selectedCategory;

      const matchStatus =
        selectedStatus === 'all' || h.status === selectedStatus;

      return matchQuery && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      const numA = parseHikeNum(a);
      const numB = parseHikeNum(b);

      if (numA !== numB) {
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      }

      // Secondary sort: recent dates first
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const publishedCount = hikes.filter((h) => h.status === 'published').length;
  const draftCount = hikes.filter((h) => h.status === 'draft').length;

  const handleClone = (hike: SavedHikeRecord) => {
    onCloneHike(hike.id);
    showToast(`Cloned "${hike.title}" as a new draft!`);
  };

  const handleDelete = (hike: SavedHikeRecord) => {
    setDeletingHike(hike);
  };

  const confirmDelete = () => {
    if (deletingHike) {
      onDeleteHike(deletingHike.id);
      showToast(`Deleted "${deletingHike.title}"`);
      setDeletingHike(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1F1F] text-white px-4.5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#7ABA42]" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-white rounded-3xl border border-[#E5E1DB] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E08828]/10 text-[#E08828]">
                Master Catalog
              </span>
              <span className="text-xs text-[#8B8680]">
                {hikes.length} Total Itineraries Saved
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#1F1F1F] tracking-tight">
              Hike & Itinerary Library
            </h1>
            <p className="text-xs text-[#5A5551] mt-1 max-w-2xl">
              Create, edit, duplicate, and publish complete 8-section trek itineraries. Click <b>Share</b> to generate instant WhatsApp broadcast summaries and web links.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {onUploadToDatabase && (
              <button
                id="btn-upload-to-database"
                type="button"
                onClick={onUploadToDatabase}
                disabled={isSyncingDatabase}
                title="Upload and sync all itineraries to database"
                className="flex items-center gap-2 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] hover:border-[#E08828] hover:text-[#E08828] text-[#5A5551] rounded-2xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <CloudUpload className={`w-4 h-4 ${isSyncingDatabase ? 'animate-bounce text-[#E08828]' : ''}`} />
                <span>
                  {isSyncingDatabase
                    ? 'Uploading...'
                    : unsyncedCount && unsyncedCount > 0
                    ? `Upload to Database (${unsyncedCount} unsynced)`
                    : 'Upload to Database'}
                </span>
              </button>
            )}

            {onRefresh && (
              <button
                id="btn-refresh-library"
                type="button"
                onClick={onRefresh}
                title="Refresh from server"
                className="p-2.5 bg-[#FAF8F5] border border-[#E5E1DB] hover:bg-[#F0EBE5] text-[#5A5551] rounded-2xl transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              id="btn-create-new-hike"
              type="button"
              onClick={onCreateNew}
              className="flex items-center gap-2 px-5 py-3 bg-[#E08828] hover:bg-[#c9741c] text-white rounded-2xl font-black text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Itinerary</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#F0EBE5]">
          <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#EFEAE4]">
            <div className="text-[11px] font-bold text-[#8B8680]">Total Itineraries</div>
            <div className="text-xl font-black text-[#1F1F1F] mt-0.5">{hikes.length}</div>
          </div>
          <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#EFEAE4]">
            <div className="text-[11px] font-bold text-emerald-700">Published Live</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">{publishedCount}</div>
          </div>
          <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#EFEAE4]">
            <div className="text-[11px] font-bold text-amber-700">Drafts In-Progress</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">{draftCount}</div>
          </div>
          <div className="bg-[#FAF8F5] rounded-2xl p-3 border border-[#EFEAE4]">
            <div className="text-[11px] font-bold text-[#8B8680]">Categories</div>
            <div className="text-xl font-black text-[#1F1F1F] mt-0.5">4 Types</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E1DB] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B8680] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-itineraries"
              type="text"
              placeholder="Search by hike number, trek name, meeting point..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-[#1F1F1F] placeholder-[#8B8680] focus:outline-none focus:border-[#E08828]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['all', 'published', 'draft'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedStatus === st
                    ? 'bg-[#1F1F1F] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-[#5A5551] border border-[#EFEAE4] hover:bg-[#F0EBE5]'
                }`}
              >
                {st === 'all' ? 'All Status' : st === 'published' ? 'Published' : 'Drafts'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills & View Mode Toggle */}
        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'Day Hikes', label: 'Day Hikes' },
              { id: 'Overnight Bus Hikes', label: 'Overnight Bus Hikes' },
              { id: 'Multi Day Treks', label: 'Multi Day Treks' },
              { id: 'Subscription Hikes', label: 'Subscription Hikes' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#E08828] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-[#5A5551] border border-[#EFEAE4] hover:bg-[#F0EBE5]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort & View Mode Switcher: Table vs Cards Grid */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Hike # Sort Order Indicator / Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-3 py-1.5 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] hover:bg-[#F0EBE5] text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Toggle sorting between highest and lowest hike numbers"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#E08828]" />
              <span>Hike # {sortOrder === 'desc' ? '(Highest First)' : '(Lowest First)'}</span>
            </button>

            {/* View Mode Switcher: Table vs Cards Grid */}
            <div className="flex items-center gap-1 border border-[#E5E1DB] bg-[#FAF8F5] p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#1F1F1F] shadow-2xs border border-[#E5E1DB]'
                    : 'text-[#8B8680] hover:text-[#1F1F1F]'
                }`}
                title="Quick Tabular Roster View"
              >
                <List className="w-3.5 h-3.5 text-[#E08828]" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#1F1F1F] shadow-2xs border border-[#E5E1DB]'
                    : 'text-[#8B8680] hover:text-[#1F1F1F]'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#E08828]" />
                <span>Grid View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hike Cards Grid OR Table View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#E5E1DB]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E08828]"></div>
          <p className="text-xs text-[#8B8680] mt-3 font-semibold">Loading itinerary library...</p>
        </div>
      ) : filteredHikes.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-[#D5D0C9]">
          <Layers className="w-10 h-10 text-[#8B8680] mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-[#1F1F1F]">No itineraries found</h3>
          <p className="text-xs text-[#8B8680] mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? 'Try changing your search keywords or filter options.'
              : 'Start by creating your first complete trek itinerary.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-4 px-4 py-2 bg-[#E08828] text-white rounded-xl text-xs font-bold hover:bg-[#c9741c] cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Itinerary</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABULAR VIEW FOR ITINERARY LIBRARY */
        <div className="bg-white rounded-2xl border border-[#E5E1DB] shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#F0EBE5] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#1F1F1F] tracking-tight">Itinerary Catalog Table</h3>
              <p className="text-[11px] text-[#8B8680] mt-0.5">
                Showing {filteredHikes.length} itinerary record(s) • Sorted by Hike # ({sortOrder === 'desc' ? 'Highest at Top' : 'Lowest at Top'})
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#F0EBE5] text-[10px] font-extrabold uppercase text-[#5A5551] tracking-wider">
                  <th
                    onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="py-3 px-4 min-w-[240px] cursor-pointer hover:bg-[#F5EFE6] transition-colors select-none"
                    title="Click to toggle sorting (highest/lowest hike #)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Hike # &amp; Title</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E08828]/15 text-[#E08828] font-black normal-case tracking-normal">
                        {sortOrder === 'desc' ? '↓ Highest First' : '↑ Lowest First'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-[140px]">Category</th>
                  <th className="py-3 px-3 min-w-[170px]">Date &amp; Meeting</th>
                  <th className="py-3 px-3 min-w-[150px]">Stats &amp; Leader</th>
                  <th className="py-3 px-3 w-[130px]">Price (NPR)</th>
                  <th className="py-3 px-3 w-[110px]">Status</th>
                  <th className="py-3 px-4 w-[190px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE5]">
                {filteredHikes.map((hike) => {
                  const priceTiers = hike.data?.priceTiers || [];
                  const minPrice =
                    priceTiers.length > 0
                      ? Math.min(...priceTiers.map((t) => t.price))
                      : null;
                  const maxPrice =
                    priceTiers.length > 0
                      ? Math.max(...priceTiers.map((t) => t.price))
                      : null;

                  const coverImg =
                    hike.data?.coverImageUrl ||
                    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';

                  return (
                    <tr key={hike.id} className="hover:bg-[#FAF8F5] transition-colors">
                      {/* Hike # & Title */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <img
                            src={coverImg}
                            alt={hike.title}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#E5E1DB]"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-black text-[#E08828] uppercase tracking-wider block">
                              Hike #{hike.data?.hikeNumber || hike.hikeNumber || 'TBA'}
                            </span>
                            <span className="font-extrabold text-xs text-[#1F1F1F] block truncate max-w-[220px]" title={hike.title}>
                              {hike.title}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 align-middle">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB] inline-block whitespace-nowrap">
                          {hike.category}
                        </span>
                      </td>

                      {/* Date & Meeting Location */}
                      <td className="py-3 px-3 align-middle">
                        <div className="space-y-1 text-xs text-[#5A5551]">
                          <div className="flex items-center gap-1.5 font-semibold text-[#1F1F1F]">
                            <Calendar className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                            <span className="truncate">{hike.data?.hikeDate || 'TBD Date'}</span>
                          </div>
                          {hike.data?.overview?.meetingPoint && (
                            <div className="flex items-center gap-1.5 text-[11px] text-[#8B8680]">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[150px]">{hike.data.overview.meetingPoint}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Stats & Leader */}
                      <td className="py-3 px-3 align-middle">
                        <div className="space-[#0.5] text-xs">
                          <div className="font-bold text-[#1F1F1F] truncate">
                            {hike.data?.overview?.approxDistance || 'N/A'} • {hike.data?.overview?.difficulty || 'Moderate'}
                          </div>
                          <div className="text-[11px] text-[#8B8680] truncate">
                            Leader: {hike.data?.teamLeader || 'TBD'} ({hike.data?.maxCapacity || 'TBD'} pax)
                          </div>
                        </div>
                      </td>

                      {/* Price Tier */}
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <span className="text-xs font-black text-[#1F1F1F] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#E5E1DB]">
                          {minPrice !== null
                            ? `${hike.data?.currency || 'NPR'} ${minPrice.toLocaleString()}${
                                maxPrice && maxPrice !== minPrice ? '+' : ''
                              }`
                            : 'Price TBD'}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleStatus(
                              hike.id,
                              hike.status === 'published' ? 'draft' : 'published'
                            )
                          }
                          title="Click to toggle status"
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full cursor-pointer transition-all ${
                            hike.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                          }`}
                        >
                          {hike.status === 'published' ? '● Published' : '● Draft'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectEdit(hike)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white text-[#1F1F1F] border border-[#E5E1DB] rounded-xl transition-all cursor-pointer"
                            title="Edit itinerary"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleClone(hike)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 text-[#5A5551] border border-[#E5E1DB] rounded-xl transition-all cursor-pointer"
                            title="Duplicate itinerary"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectPreview(hike)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-[#5A5551] border border-[#E5E1DB] rounded-xl transition-all cursor-pointer"
                            title="Preview public page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSharingHike(hike)}
                            className="p-1.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366] hover:text-white border border-[#25D366]/30 rounded-xl transition-all cursor-pointer"
                            title="Share & WhatsApp broadcast"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(hike)}
                            className="p-1.5 text-[#8B8680] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete itinerary"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {filteredHikes.map((hike) => {
            const priceTiers = hike.data?.priceTiers || [];
            const minPrice =
              priceTiers.length > 0
                ? Math.min(...priceTiers.map((t) => t.price))
                : null;
            const maxPrice =
              priceTiers.length > 0
                ? Math.max(...priceTiers.map((t) => t.price))
                : null;

            const coverImg =
              hike.data?.coverImageUrl ||
              'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';

            return (
              <div
                key={hike.id}
                id={`hike-card-${hike.id}`}
                className="group bg-white rounded-3xl border border-[#E5E1DB] hover:border-[#D5D0C9] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Option 1: Top Header Cover Image Banner */}
                <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-neutral-900 shrink-0">
                  <img
                    src={coverImg}
                    alt={hike.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />

                  {/* Top Floating Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-xs">
                        Hike #{hike.data?.hikeNumber || hike.hikeNumber || 'TBA'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/20 backdrop-blur-md text-white border border-white/20 truncate max-w-[120px]">
                        {hike.category}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(
                          hike.id,
                          hike.status === 'published' ? 'draft' : 'published'
                        );
                      }}
                      title="Click to toggle status"
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full cursor-pointer transition-all backdrop-blur-md shadow-xs ${
                        hike.status === 'published'
                          ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white border border-emerald-300/40'
                          : 'bg-amber-500/90 hover:bg-amber-500 text-white border border-amber-300/40'
                      }`}
                    >
                      {hike.status === 'published' ? '● Published' : '● Draft'}
                    </button>
                  </div>

                  {/* Price Tag Floating on Bottom Right of Banner */}
                  <div className="absolute bottom-2.5 right-3">
                    <span className="text-xs font-black text-white bg-[#E08828] px-2.5 py-1 rounded-lg shadow-sm">
                      {minPrice !== null
                        ? `${hike.data?.currency || 'NPR'} ${minPrice.toLocaleString()}${
                            maxPrice && maxPrice !== minPrice ? `+` : ''
                          }`
                        : 'Price TBD'}
                    </span>
                  </div>
                </div>

                {/* Card Lower Content Section */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Hike Title */}
                    <h3 className="text-base font-black text-[#1F1F1F] leading-snug line-clamp-2 group-hover:text-[#E08828] transition-colors">
                      {hike.title}
                    </h3>

                    {/* Date & Meeting */}
                    <div className="mt-3 space-y-1.5 text-xs text-[#5A5551]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#E08828] shrink-0" />
                        <span className="font-semibold text-[#1F1F1F]">
                          {hike.data?.hikeDate || 'Date to be announced'}
                        </span>
                      </div>

                      {hike.data?.overview?.meetingPoint && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#8B8680] shrink-0" />
                          <span className="truncate">{hike.data.overview.meetingPoint}</span>
                        </div>
                      )}
                    </div>

                    {/* Route Quick Stats */}
                    <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4] text-[11px]">
                      <div>
                        <span className="text-[#8B8680] block text-[10px]">Distance & Difficulty</span>
                        <span className="font-bold text-[#1F1F1F] truncate block">
                          {hike.data?.overview?.approxDistance || 'N/A'} • {hike.data?.overview?.difficulty || 'Moderate'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8B8680] block text-[10px]">Leader & Capacity</span>
                        <span className="font-bold text-[#3D3A37] truncate block">
                          {hike.data?.teamLeader || 'TBD'} • {hike.data?.maxCapacity || 'TBD'} pax
                        </span>
                      </div>
                    </div>

                    {/* Meta items badge row */}
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-[#8B8680]">
                      <span>{hike.data?.itineraryDays?.length || 1}-Day Plan</span>
                      <span>•</span>
                      <span>{hike.data?.costIncludes?.length || 0} Inclusions</span>
                      <span>•</span>
                      <span>{hike.data?.addOns?.length || 0} Add-ons</span>
                    </div>
                  </div>

                  {/* Card Action Row */}
                  <div className="pt-4 mt-4 border-t border-[#F0EBE5] flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        id={`btn-edit-${hike.id}`}
                        type="button"
                        onClick={() => onSelectEdit(hike)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#E08828] hover:text-white text-[#1F1F1F] border border-[#E5E1DB] rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Edit this itinerary"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* Duplicate / Clone Button */}
                      <button
                        id={`btn-clone-${hike.id}`}
                        type="button"
                        onClick={() => handleClone(hike)}
                        className="p-1.5 bg-[#FAF8F5] hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 text-[#5A5551] border border-[#E5E1DB] rounded-xl transition-all cursor-pointer"
                        title="Duplicate / Copy as new hike"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Preview Button */}
                      <button
                        id={`btn-preview-${hike.id}`}
                        type="button"
                        onClick={() => onSelectPreview(hike)}
                        className="p-1.5 bg-[#FAF8F5] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-[#5A5551] border border-[#E5E1DB] rounded-xl transition-all cursor-pointer"
                        title="Preview public full-page itinerary"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Share Modal Trigger */}
                      <button
                        id={`btn-share-${hike.id}`}
                        type="button"
                        onClick={() => setSharingHike(hike)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366] hover:text-white border border-[#25D366]/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Share link & WhatsApp broadcast"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      id={`btn-delete-${hike.id}`}
                      type="button"
                      onClick={() => handleDelete(hike)}
                      className="p-1.5 text-[#8B8680] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete hike"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal */}
      {sharingHike && (
        <ShareHikeModal
          hike={sharingHike}
          onClose={() => setSharingHike(null)}
          onStatusChange={(newStatus) => {
            onToggleStatus(sharingHike.id, newStatus);
            setSharingHike({ ...sharingHike, status: newStatus });
          }}
          onPreview={() => {
            const h = sharingHike;
            setSharingHike(null);
            onSelectPreview(h);
          }}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingHike && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#E5E1DB] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-[#1F1F1F]">Delete Itinerary?</h3>
            <p className="text-xs text-[#5A5551] mt-2 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-[#1F1F1F]">"{deletingHike.title}" (Hike #{deletingHike.hikeNumber || deletingHike.data?.hikeNumber || 'TBA'})</strong>? 
              This will remove it from your itinerary library.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeletingHike(null)}
                className="px-4 py-2.5 bg-[#FAF8F5] border border-[#E5E1DB] hover:bg-[#F0EBE5] text-[#5A5551] rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
