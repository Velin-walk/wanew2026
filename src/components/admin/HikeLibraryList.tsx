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
  CloudUpload
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
  const [sharingHike, setSharingHike] = useState<SavedHikeRecord | null>(null);
  const [deletingHike, setDeletingHike] = useState<SavedHikeRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Filter hikes
  const filteredHikes = hikes.filter((h) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      h.title.toLowerCase().includes(q) ||
      h.hikeNumber.toLowerCase().includes(q) ||
      h.data.overview.meetingPoint.toLowerCase().includes(q) ||
      h.data.overview.endingPoint.toLowerCase().includes(q);

    const matchCategory =
      selectedCategory === 'all' || h.category === selectedCategory;

    const matchStatus =
      selectedStatus === 'all' || h.status === selectedStatus;

    return matchQuery && matchCategory && matchStatus;
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

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
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
      </div>

      {/* Hike Cards Grid */}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredHikes.map((hike) => {
            const minPrice =
              hike.data.priceTiers && hike.data.priceTiers.length > 0
                ? Math.min(...hike.data.priceTiers.map((t) => t.price))
                : null;
            const maxPrice =
              hike.data.priceTiers && hike.data.priceTiers.length > 0
                ? Math.max(...hike.data.priceTiers.map((t) => t.price))
                : null;

            const coverImg =
              hike.data.coverImageUrl ||
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
                        Hike #{hike.data.hikeNumber || hike.hikeNumber || 'TBA'}
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
                        ? `${hike.data.currency} ${minPrice.toLocaleString()}${
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
                          {hike.data.hikeDate || 'Date to be announced'}
                        </span>
                      </div>

                      {hike.data.overview.meetingPoint && (
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
                          {hike.data.overview.approxDistance || 'N/A'} • {hike.data.overview.difficulty || 'Moderate'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8B8680] block text-[10px]">Leader & Capacity</span>
                        <span className="font-bold text-[#3D3A37] truncate block">
                          {hike.data.teamLeader || 'TBD'} • {hike.data.maxCapacity || 'TBD'} pax
                        </span>
                      </div>
                    </div>

                    {/* Meta items badge row */}
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-[#8B8680]">
                      <span>{hike.data.itineraryDays?.length || 1}-Day Plan</span>
                      <span>•</span>
                      <span>{hike.data.costIncludes?.length || 0} Inclusions</span>
                      <span>•</span>
                      <span>{hike.data.addOns?.length || 0} Add-ons</span>
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
