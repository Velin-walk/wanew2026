import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Compass, X, Filter, RefreshCw, Upload, AlertTriangle, ListFilter, MapPin, Map as MapIcon, MessageSquare } from 'lucide-react';
import MapView from './MapView';
import RouteCard from './RouteCard';
import RouteDetail from './RouteDetail';
import { parseGPX, parseKML, parseRouteFile, routeToGPX, simplifyLineSegments } from './kmlParser';
import { resolveAssetUrl } from './assetUrl';
import { generateDemoRoutes } from './demoData';
import { apiFetch, clearApiCache } from '../../services/api';
import { db } from '../../lib/firebase';
// Firestore methods removed as app now uses Cloudflare D1 for storage
import MapChat from './MapChat';

interface MapMinersDashboardProps {
  currentUserEmail?: string;
  isContributionOpen?: boolean;
  onOpenContribution?: () => void;
  onCloseContribution?: () => void;
}

export default function MapMinersDashboard({
  currentUserEmail,
  isContributionOpen: controlledIsContributionOpen,
  onOpenContribution,
  onCloseContribution,
}: MapMinersDashboardProps) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showFilters, setShowFilters] = useState(false);
  const [minerTab, setMinerTab] = useState<'all' | 'my' | 'chat'>('all');
  const [loadingState, setLoadingState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; errors: string[] }>({ status: 'idle', errors: [] });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isLoading, setIsLoading] = useState(true);

  // Contribution State (handles both controlled from Navbar and local fallback)
  const [localIsContributionOpen, setLocalIsContributionOpen] = useState(false);
  const isContributionOpen = controlledIsContributionOpen !== undefined ? controlledIsContributionOpen : localIsContributionOpen;
  const setContributionModalOpen = (open: boolean) => {
    if (open) {
      if (onOpenContribution) onOpenContribution();
      else setLocalIsContributionOpen(true);
    } else {
      if (onCloseContribution) onCloseContribution();
      else setLocalIsContributionOpen(false);
    }
  };

  const [contributionName, setContributionName] = useState('');
  const [contributionFile, setContributionFile] = useState<File | null>(null);
  const [contributionError, setContributionError] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load trails directly from Cloudflare D1/R2 and Firestore (with seamless fallback/dual-load)
  const loadKMLFolder = useCallback(async () => {
    setLoadingState({ status: 'loading', errors: [] });

    try {
      const parseStartPos = (pos: any): { lat: number; lng: number } | null => {
        if (!pos) return null;
        let parsed = pos;
        if (typeof pos === 'string') {
          try {
            parsed = JSON.parse(pos);
          } catch (_) {
            return null;
          }
        }
        if (!parsed) return null;
        if (typeof parsed.lat === 'number' && !isNaN(parsed.lat) && typeof parsed.lng === 'number' && !isNaN(parsed.lng)) {
          return { lat: parsed.lat, lng: parsed.lng };
        }
        if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number' && !isNaN(parsed[0]) && !isNaN(parsed[1])) {
          return { lat: parsed[0], lng: parsed[1] };
        }
        return null;
      };

      // 1. Fetch Cloudflare Trails
      let cloudflareRoutes: any[] = [];
      try {
        const communityRes = await apiFetch('mapminers/trails');
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          if (communityData.success && communityData.data) {
            const rawItems = Array.isArray(communityData.data)
              ? communityData.data
              : Object.values(communityData.data);

            cloudflareRoutes = rawItems.map((anyMeta: any, index: number) => {
              const startPosObj = parseStartPos(anyMeta.start_pos || anyMeta.startPos);
              const realFileName = anyMeta.fileName || anyMeta.file_name || anyMeta.name || `trail_${index}.gpx`;
              const trailId = anyMeta.id || realFileName;
              const moderationStatus = (anyMeta.status || 'approved').toLowerCase();

              let parsedBounds = anyMeta.bounds;
              if (typeof anyMeta.bounds === 'string') {
                try {
                  parsedBounds = JSON.parse(anyMeta.bounds);
                } catch (_) {}
              }

              return {
                ...anyMeta,
                id: trailId,
                fileName: realFileName,
                name: anyMeta.name || realFileName,
                description: anyMeta.description || '',
                difficulty: (anyMeta.difficultyOverride && anyMeta.difficultyOverride !== 'Auto') ? anyMeta.difficultyOverride : (anyMeta.difficulty || anyMeta.calculatedDifficulty || 'Moderate'),
                stats: {
                  distance: Number(anyMeta.distance || anyMeta.stats?.distance || 0),
                  elevationGain: Number(anyMeta.elevation_gain || anyMeta.elevationGain || anyMeta.stats?.elevationGain || 0),
                  elevationLoss: Number(anyMeta.elevation_loss || anyMeta.elevationLoss || anyMeta.stats?.elevationLoss || 0),
                  minElevation: Number(anyMeta.min_elevation || anyMeta.minElevation || anyMeta.stats?.minElevation || 0),
                  maxElevation: Number(anyMeta.max_elevation || anyMeta.maxElevation || anyMeta.stats?.maxElevation || 0),
                  estimatedHours: (anyMeta.hoursOverride && anyMeta.hoursOverride !== 'Auto') ? anyMeta.hoursOverride : (anyMeta.estimated_hours || anyMeta.estimatedHours || anyMeta.stats?.estimatedHours || 0)
                },
                province: anyMeta.province || 'Bagmati',
                district: anyMeta.district || 'Kathmandu',
                nearbyCity: anyMeta.nearbyCity || 'Kathmandu',
                highlights: anyMeta.highlights || '',
                uploadedAt: anyMeta.uploadedAt || anyMeta.uploaded_at || new Date().toISOString(),
                contributorEmail: anyMeta.contributorEmail || anyMeta.contributor_email || '',
                contributorName: anyMeta.contributorName || 'Community Member',
                bounds: parsedBounds,
                coordinates: startPosObj ? [startPosObj, startPosObj] : [],
                isLazyLoaded: false,
                isCommunityTrail: true,
                moderationStatus
              };
            });
          }
        }
      } catch (cfErr) {
        console.warn('Could not load trails from Cloudflare Worker:', cfErr);
      }

      // 2. Fetch Firestore Fallback/Resilient Trails
      let firestoreRoutes: any[] = [];
      // 2. Merge and Deduplicate by trail ID
      const mergedMap = new Map<string, any>();
      
      cloudflareRoutes.forEach(r => {
        mergedMap.set(r.id, r);
      });

      const allMergedRoutes = Array.from(mergedMap.values());

      // Filter routes based on status and permissions
      const filteredRoutes = allMergedRoutes.filter((r: any) => {
        const status = (r.moderationStatus || 'approved').toLowerCase();
        
        // 1. Explicitly approved trails are always visible to everyone
        if (status === 'approved') return true;
        
        // 2. Explicitly rejected or deleted trails are hidden
        if (status === 'rejected' || status === 'deleted') return false;
        
        // 3. Pending review trails are only visible to the contributor who submitted them
        if (status === 'pending' || status === 'pending review') {
          if (currentUserEmail && r.contributorEmail && r.contributorEmail.toLowerCase() === currentUserEmail.toLowerCase()) {
            return true;
          }
          return false;
        }
        
        return true;
      });

      if (filteredRoutes.length > 0) {
        setRoutes(prev => {
          const merged = new Map<string, any>();
          prev.forEach(r => {
            if (r.id) merged.set(r.id, r);
          });
          filteredRoutes.forEach(r => {
            merged.set(r.id, r);
          });
          const mergedArray = Array.from(merged.values());
          mergedArray.sort((a, b) => {
            const timeA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const timeB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return timeB - timeA;
          });
          return mergedArray;
        });
        setLoadingState({ status: 'done', errors: [] });
      } else {
        console.warn('No community trails found in Cloudflare. Loading offline demo trails.');
        setRoutes(generateDemoRoutes());
        setLoadingState({ status: 'done', errors: [] });
      }
    } catch (e: any) {
      console.warn('Failed to load trails:', e);
      setRoutes(generateDemoRoutes());
      setLoadingState({ status: 'done', errors: [] });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserEmail]);

  useEffect(() => {
    loadKMLFolder();
  }, [loadKMLFolder]);

  const handleRouteClick = useCallback(async (route: any) => {
    // High-performance lazy loader
    if (isMobile) {
      setSidebarOpen(false);
    }

    const routeWithLoadingState = { ...route, loadError: null };
    setActiveRoute(routeWithLoadingState);
    setRoutes(prev => prev.map(r => r.id === route.id ? routeWithLoadingState : r));

    if (!route.isLazyLoaded && !route.isDemo) {
      try {
        let text = '';
        if (route.isFirestoreTrail) {
          text = route.fileContent || '';
        } else {
          // Download directly from Cloudflare Worker which pulls from R2
          const res = await apiFetch(`mapminers/download/${encodeURIComponent(route.fileName)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${route.fileName}`);
          text = await res.text();
        }

        // 350ms delay lets CSS slide-up panels animate beautifully
        await new Promise(resolve => setTimeout(resolve, 350));

        const fullParsed = parseRouteFile(text, route.fileName, route.name);
        if (!fullParsed) {
          throw new Error('File has no valid route geometry');
        }

        const updatedRoute = {
          ...fullParsed,
          id: route.id,
          name: route.name,
          description: route.description || fullParsed.description,
          difficulty: route.difficulty || fullParsed.difficulty,
          province: route.province,
          district: route.district,
          nearbyCity: route.nearbyCity,
          highlights: route.highlights,
          contributorName: route.contributorName,
          contributorEmail: route.contributorEmail,
          isLazyLoaded: true,
          loadError: null,
          isFirestoreTrail: route.isFirestoreTrail,
          fileContent: route.fileContent
        };
        if (route.stats?.estimatedHours) {
          updatedRoute.stats.estimatedHours = route.stats.estimatedHours;
        }
        
        setRoutes(prev => prev.map(r => r.id === route.id ? updatedRoute : r));
        setActiveRoute(updatedRoute);
      } catch (err: any) {
        console.error('Failed to parse route file', err);
        const failedRoute = {
          ...route,
          loadError: err?.message || 'Failed to parse map file',
          isLazyLoaded: true
        };
        setRoutes(prev => prev.map(r => r.id === route.id ? failedRoute : r));
        setActiveRoute(failedRoute);
      }
    }
  }, [isMobile]);

  // Auto-open targeted trail if ?route=... parameter is provided in the URL
  useEffect(() => {
    if (routes.length === 0) return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const routeParam = searchParams.get('route');
      if (routeParam && !activeRoute) {
        const decodedParam = decodeURIComponent(routeParam).toLowerCase();
        const matched = routes.find(
          (r) =>
              r.fileName?.toLowerCase() === decodedParam ||
              r.id?.toLowerCase() === decodedParam ||
              r.name?.toLowerCase() === decodedParam
        );
        if (matched) {
          handleRouteClick(matched);
        }
      }
    } catch (e) {
      console.warn('Could not parse route parameter:', e);
    }
  }, [routes, activeRoute, handleRouteClick]);

  const handleDeleteRoute = useCallback(async (id: string) => {
    setRoutes(prev => prev.filter(r => r.id !== id));
    setActiveRoute(null);
    
    // Attempt delete from Cloudflare
    try {
      await apiFetch(`mapminers/trails/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Could not delete trail from Cloudflare R2 / D1:', err);
    }
  }, []);

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'kmz') {
      setContributionFile(null);
      setContributionError('.KMZ is a compressed file format. Please unzip/extract the doc.kml file inside or save as .GPX/.KML.');
      return;
    }

    if (extension === 'geojson' || extension === 'json') {
      setContributionFile(null);
      setContributionError('GeoJSON format is not directly supported yet. Please convert your route file to .GPX or .KML.');
      return;
    }

    if (extension !== 'gpx' && extension !== 'kml') {
      setContributionFile(null);
      setContributionError('Please choose a valid GPX (.gpx) or KML (.kml) trail file.');
      return;
    }
    setContributionFile(file);
    setContributionError('');
  };

  const handleContributionFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleContributeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contributionFile || !contributionName.trim()) {
      setContributionError('Provide a name and choose a GPX/KML file.');
      return;
    }

    setIsContributing(true);
    setContributionError('');

    try {
      const fileText = await contributionFile.text();
      const parsedRoute = parseRouteFile(fileText, contributionFile.name, contributionName.trim());
      
      if (!parsedRoute) {
        throw new Error('No valid coordinate tracks (<trkpt>, <rtept>, <coordinates>, <wpt>) were found in this file.');
      }

      const defaultStartPos = (parsedRoute as any).startPos || (parsedRoute.coordinates?.[0] ? { lat: parsedRoute.coordinates[0].lat, lng: parsedRoute.coordinates[0].lng } : { lat: 27.7, lng: 85.3 });

      // Call the Cloudflare Worker API which stores file in R2 and metadata in D1
      const response = await apiFetch('mapminers/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: contributionFile.name,
          file_name: contributionFile.name,
          fileContent: fileText,
          name: contributionName.trim(),
          description: parsedRoute.description || '',
          difficulty: parsedRoute.difficulty || 'Moderate',
          stats: parsedRoute.stats,
          bounds: parsedRoute.bounds || [[27.6, 85.2], [27.8, 85.5]],
          startPos: defaultStartPos,
          contributorName: currentUserEmail ? currentUserEmail.split('@')[0] : 'Map Miner',
          contributorEmail: currentUserEmail || '',
          province: (parsedRoute as any).province || 'Bagmati',
          district: (parsedRoute as any).district || 'Kathmandu',
          nearbyCity: (parsedRoute as any).nearbyCity || 'Kathmandu',
          highlights: (parsedRoute as any).highlights || 'Uploaded by community'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server upload failed with status ${response.status}`);
      }

      const uploadResult = await response.json();
      if (uploadResult && uploadResult.success === false) {
        throw new Error(uploadResult.error || 'The server rejected this file.');
      }

      // Signal cache invalidation
      clearApiCache('mapminers');

      const sessionRoute = {
        ...parsedRoute,
        id: uploadResult?.id || `local-${Date.now()}`,
        fileName: uploadResult?.fileName || contributionFile.name,
        name: contributionName.trim(),
        uploadedAt: new Date().toISOString(),
        contributorName: currentUserEmail ? currentUserEmail.split('@')[0] : 'Map Miner',
        contributorEmail: currentUserEmail || '',
        isLazyLoaded: true,
        isCommunityTrail: true,
        isFirestoreTrail: false,
      };

      setRoutes(prev => {
        const filtered = prev.filter(r => r.id !== sessionRoute.id);
        return [sessionRoute, ...filtered];
      });
      setActiveRoute(sessionRoute);
      setContributionModalOpen(false);
      setContributionName('');
      setContributionFile(null);
    } catch (err: any) {
      setContributionError(err?.message || 'Could not parse or process this trail file.');
    } finally {
      setIsContributing(false);
    }
  };

  // Filter routes client-side
  const filteredRoutes = routes
    .filter(route => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = route.name.toLowerCase().includes(query) || 
        (route.description && route.description.toLowerCase().includes(query));
      const matchesDifficulty = filterDifficulty === 'All' || route.difficulty === filterDifficulty;
      const matchesMyMaps = minerTab !== 'my' || (currentUserEmail && route.contributorEmail === currentUserEmail);
      return matchesSearch && matchesDifficulty && matchesMyMaps;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'distance') return b.stats.distance - a.stats.distance;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#F9F7F5] relative text-neutral-800 pb-[62px] md:pb-0">
      
      {/* Sidebar List Pane */}
      <div className={`transition-all duration-300 shrink-0 border-r border-neutral-200 bg-white flex flex-col h-full z-10 ${
        sidebarOpen ? 'w-full md:w-[360px]' : 'w-0 overflow-hidden'
      }`}>
        <div className="p-3.5 border-b border-neutral-100 shrink-0">
          {/* View Tab Segment Selector (All Trails, My Maps, Map Chat, Map View) */}
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-2.5 shrink-0">
            <button
              onClick={() => {
                setMinerTab('all');
                setSidebarOpen(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                minerTab === 'all'
                  ? 'bg-white text-neutral-800 shadow-xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">All Trails</span>
            </button>
            <button
              onClick={() => {
                setMinerTab('my');
                setSidebarOpen(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer relative ${
                minerTab === 'my'
                  ? 'bg-white text-neutral-800 shadow-xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">My Maps</span>
            </button>
            <button
              onClick={() => {
                setMinerTab('chat');
                setSidebarOpen(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer relative ${
                minerTab === 'chat'
                  ? 'bg-white text-neutral-800 shadow-xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">MapChat</span>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex-1 flex items-center justify-center gap-1 px-1 py-1.5 bg-white/80 hover:bg-white text-neutral-700 hover:text-[#7ABA42] rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs border border-neutral-200/60"
              title="Focus full map view"
            >
              <MapIcon className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">Map View</span>
            </button>
          </div>

          {minerTab !== 'chat' && (
            /* Search Box and Filters Button Side by Side */
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search trail or region..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none text-xs focus:outline-none placeholder-neutral-400 min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-neutral-200 rounded-full cursor-pointer">
                    <X className="w-3 h-3 text-neutral-500" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                  showFilters 
                    ? 'bg-neutral-800 border-neutral-800 text-white shadow-xs' 
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
                title="Toggle trail filters"
              >
                <ListFilter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          )}

          {/* Collapsible Filters Expansion Panel */}
          {minerTab !== 'chat' && showFilters && (
            <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Difficulty</span>
                <div className="flex flex-wrap gap-1">
                  {['All', 'Easy', 'Moderate', 'Hard', 'Extreme'].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setFilterDifficulty(diff)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        filterDifficulty === diff
                          ? 'bg-[#7ABA42] text-white'
                          : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Sort Trails By</span>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 bg-white border border-neutral-200 text-neutral-600 text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="distance">Distance (Max-Min)</option>
                    <option value="uploadedAt">Recently Contributed</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* List Content */}
        <div className={`flex-1 min-h-0 flex flex-col ${minerTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'}`}>
          {minerTab === 'chat' ? (
            <MapChat currentUserEmail={currentUserEmail} />
          ) : isLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-3/4 bg-neutral-200 rounded-md" />
                      <div className="h-3 w-1/2 bg-neutral-100 rounded-md" />
                    </div>
                    <div className="h-5 w-16 bg-neutral-100 rounded-full shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100">
                    <div className="h-7 bg-neutral-100 rounded-lg" />
                    <div className="h-7 bg-neutral-100 rounded-lg" />
                    <div className="h-7 bg-neutral-100 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full text-neutral-400 p-4">
              <Compass className="w-10 h-10 text-neutral-300 animate-pulse" />
              <span className="text-xs font-bold text-neutral-500">No Trails Found</span>
              <span className="text-[10px]">Try adjusting your search filters or upload a new track!</span>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredRoutes.map((route, idx) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  index={idx}
                  isActive={activeRoute?.id === route.id}
                  onClick={handleRouteClick}
                  onDelete={handleDeleteRoute}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map view Pane */}
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-[1000] px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 rounded-xl shadow-md transition-transform hover:scale-105 flex items-center gap-2 text-xs font-bold cursor-pointer"
            title="Open Sidebar"
          >
            <Compass className="w-4 h-4 text-[#7ABA42] animate-spin-slow shrink-0" />
            <span>Show Trail List</span>
          </button>
        )}

        {/* Leaflet Map */}
        <div className="flex-1 h-full w-full">
          <MapView
            routes={filteredRoutes}
            activeRoute={activeRoute}
            onRouteClick={handleRouteClick}
          />
        </div>

        {/* Detailed Sheet overlay (Float style to preserve Map canvas aspect ratio) */}
        {activeRoute && (
          <div className="absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-[380px] z-[1000]">
            <RouteDetail
              route={activeRoute}
              onClose={() => setActiveRoute(null)}
              isMobile={isMobile}
              currentUserEmail={currentUserEmail}
            />
          </div>
        )}
      </div>

      {/* Upload Modal Popup */}
      {isContributionOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#7ABA42]" />
                <h3 className="text-base font-bold text-neutral-800">Contribute Hike Route</h3>
              </div>
              <button
                onClick={() => setContributionModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {contributionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{contributionError}</span>
              </div>
            )}

            <form onSubmit={handleContributeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">
                  Trail Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shivapuri Ridge Loop"
                  value={contributionName}
                  onChange={(e) => setContributionName(e.target.value)}
                  className="w-full p-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7ABA42] text-sm bg-neutral-50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">
                  GPS Track File (GPX or KML)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(false);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) {
                      processFile(droppedFile);
                    }
                  }}
                  className={`border border-dashed rounded-xl p-4 text-center relative transition-all cursor-pointer ${
                    isDraggingFile
                      ? 'border-[#7ABA42] bg-[#7ABA42]/10 ring-2 ring-[#7ABA42]/30'
                      : 'border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50 hover:border-[#7ABA42]'
                  }`}
                >
                  <input
                    type="file"
                    accept=".gpx,.kml"
                    onChange={handleContributionFile}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className={`w-6 h-6 mx-auto mb-2 transition-colors ${isDraggingFile ? 'text-[#7ABA42] scale-110' : 'text-neutral-400'}`} />
                  <span className={`font-bold block mb-1 transition-colors ${isDraggingFile ? 'text-[#5C942D]' : 'text-neutral-600'}`}>
                    {contributionFile ? contributionFile.name : isDraggingFile ? 'Drop trail file here...' : 'Choose file or drag here'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Supports .gpx and .kml formats
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setContributionModalOpen(false)}
                  className="flex-1 py-2.5 border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-bold rounded-xl transition-colors min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isContributing || !contributionFile || !contributionName.trim()}
                  className="flex-1 py-2.5 bg-[#7ABA42] hover:bg-[#6CA838] disabled:opacity-50 text-white font-bold rounded-xl transition-colors min-h-[44px]"
                >
                  {isContributing ? 'Parsing Trail...' : 'Process & Load'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
