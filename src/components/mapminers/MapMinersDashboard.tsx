import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Compass, X, Filter, RefreshCw, Upload, AlertTriangle, ListFilter, MapPin, Map } from 'lucide-react';
import MapView from './MapView';
import RouteCard from './RouteCard';
import RouteDetail from './RouteDetail';
import { parseGPX, parseKML } from './kmlParser';
import { resolveAssetUrl } from './assetUrl';
import { generateDemoRoutes } from './demoData';
import { apiFetch } from '../../services/api';

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
  const [showOnlyMyMaps, setShowOnlyMyMaps] = useState(false);
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load trails from Cloudflare D1 via backend API
  const loadKMLFolder = useCallback(async () => {
    setLoadingState({ status: 'loading', errors: [] });
    setRoutes([]);

    try {
      const parseStartPos = (pos: any): { lat: number; lng: number } | null => {
        if (!pos) return null;
        if (typeof pos.lat === 'number' && !isNaN(pos.lat) && typeof pos.lng === 'number' && !isNaN(pos.lng)) {
          return { lat: pos.lat, lng: pos.lng };
        }
        if (Array.isArray(pos) && pos.length >= 2 && typeof pos[0] === 'number' && typeof pos[1] === 'number' && !isNaN(pos[0]) && !isNaN(pos[1])) {
          return { lat: pos[0], lng: pos[1] };
        }
        return null;
      };

      const communityRes = await apiFetch('mapminers/trails');
      if (communityRes.ok) {
        const communityData = await communityRes.json();
        if (communityData.success && communityData.data) {
          const rawItems = Array.isArray(communityData.data)
            ? communityData.data
            : Object.values(communityData.data);

          if (rawItems.length > 0) {
            const loadedRoutes = rawItems.map((anyMeta: any, index: number) => {
              const startPosObj = parseStartPos(anyMeta.startPos);
              const realFileName = anyMeta.fileName || anyMeta.file_name || anyMeta.name || `trail_${index}.gpx`;

              return {
                ...anyMeta,
                id: anyMeta.id || `trail-${index}-${Math.random().toString(36).substring(2, 7)}`,
                fileName: realFileName,
                name: anyMeta.name || realFileName,
                description: anyMeta.description || '',
                difficulty: anyMeta.difficultyOverride !== 'Auto' ? anyMeta.difficultyOverride : (anyMeta.calculatedDifficulty || 'Moderate'),
                stats: {
                  distance: 0,
                  elevationGain: 0,
                  elevationLoss: 0,
                  minElevation: 0,
                  maxElevation: 0,
                  ...anyMeta.stats,
                  estimatedHours: anyMeta.hoursOverride !== 'Auto' ? anyMeta.hoursOverride : (anyMeta.stats?.estimatedHours || 0)
                },
                province: anyMeta.province || 'Bagmati',
                district: anyMeta.district || 'Kathmandu',
                nearbyCity: anyMeta.nearbyCity || 'Kathmandu',
                highlights: anyMeta.highlights || '',
                uploadedAt: anyMeta.uploadedAt || anyMeta.uploaded_at || new Date().toISOString(),
                contributorEmail: anyMeta.contributorEmail || anyMeta.contributor_email || '',
                contributorName: anyMeta.contributorName || 'Community Member',
                bounds: anyMeta.bounds,
                coordinates: startPosObj ? [startPosObj, startPosObj] : [],
                isLazyLoaded: false,
                isCommunityTrail: true
              };
            });

            loadedRoutes.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
            setRoutes(loadedRoutes);
            setLoadingState({ status: 'done', errors: [] });
            return;
          }
        }
      }

      // Fallback to offline demo routes if Cloudflare returns empty
      console.warn('No Cloudflare trails returned, providing demo routes.');
      setRoutes(generateDemoRoutes());
      setLoadingState({ status: 'done', errors: [] });
    } catch (e: any) {
      console.warn('Failed to fetch Cloudflare trails, falling back to offline demo routes:', e);
      setRoutes(generateDemoRoutes());
      setLoadingState({ status: 'done', errors: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        // Download directly from Cloudflare Worker which pulls from R2
        const res = await apiFetch(`mapminers/download/${encodeURIComponent(route.fileName)}`);

        if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${route.fileName}`);
        const text = await res.text();

        // 350ms delay lets CSS slide-up panels animate beautifully
        await new Promise(resolve => setTimeout(resolve, 350));

        const routeExtension = (route.fileName || '').split('.').pop()?.toLowerCase();
        const parser = routeExtension === 'gpx' ? parseGPX : parseKML;
        const fullParsed = parser(text, route.fileName);
        if (!fullParsed) throw new Error('File has no valid route geometry');

        const updatedRoute = {
          ...fullParsed,
          id: route.id,
          name: route.name,
          description: route.description,
          difficulty: route.difficulty,
          province: route.province,
          district: route.district,
          nearbyCity: route.nearbyCity,
          highlights: route.highlights,
          contributorName: route.contributorName,
          contributorEmail: route.contributorEmail,
          isLazyLoaded: true,
          loadError: null,
        };
        updatedRoute.stats.estimatedHours = route.stats.estimatedHours;
        
        setRoutes(prev => prev.map(r => r.id === route.id ? updatedRoute : r));
        setActiveRoute(updatedRoute);
      } catch (err: any) {
        console.error('Failed to parse route KML', err);
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

  const handleDeleteRoute = useCallback((id: string) => {
    setRoutes(prev => prev.filter(r => r.id !== id));
    setActiveRoute(null);
  }, []);

  const handleContributionFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
      const extension = contributionFile.name.split('.').pop()?.toLowerCase();
      
      const parser = extension === 'gpx' ? parseGPX : parseKML;
      const parsedRoute = parser(fileText, contributionFile.name, contributionName.trim());
      
      if (!parsedRoute) {
        throw new Error('No valid coordinate tracks (<trkpt>, <rtept>, <coordinates>, <wpt>) were found in this file.');
      }

      const defaultStartPos = (parsedRoute as any).startPos || (parsedRoute.coordinates?.[0] ? { lat: parsedRoute.coordinates[0].lat, lng: parsedRoute.coordinates[0].lng } : { lat: 27.7, lng: 85.3 });

      // Call the real backend API (Cloudflare Worker) which stores in R2 + D1
      let uploadResult: any = null;
      try {
        const response = await apiFetch('mapminers/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName: contributionFile.name,
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

        if (response.ok) {
          uploadResult = await response.json();
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn('Backend upload notice:', errorData.error || `HTTP ${response.status}`);
        }
      } catch (backendErr) {
        console.warn('Backend network upload notice (rendering locally in session):', backendErr);
      }

      const sessionRoute = {
        ...parsedRoute,
        id: uploadResult?.id || `local-${Date.now()}`,
        fileName: uploadResult?.fileName || contributionFile.name,
        name: contributionName.trim(),
        uploadedAt: new Date().toISOString(),
        contributorName: currentUserEmail ? currentUserEmail.split('@')[0] : 'Map Miner',
        contributorEmail: currentUserEmail || '',
        isLazyLoaded: true,
        isCommunityTrail: true
      };

      setRoutes(prev => [sessionRoute, ...prev]);
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
      const matchesMyMaps = !showOnlyMyMaps || (currentUserEmail && route.contributorEmail === currentUserEmail);
      return matchesSearch && matchesDifficulty && matchesMyMaps;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'distance') return b.stats.distance - a.stats.distance;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#F9F7F5] relative text-neutral-800">
      
      {/* Sidebar List Pane */}
      <div className={`transition-all duration-300 shrink-0 border-r border-neutral-200 bg-white flex flex-col h-full z-10 ${
        sidebarOpen ? 'w-full md:w-[360px]' : 'w-0 overflow-hidden'
      }`}>
        <div className="p-3.5 border-b border-neutral-100 shrink-0">
          {/* View Tab Segment Selector (All Trails, My Maps, Map View) */}
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-2.5 shrink-0">
            <button
              onClick={() => {
                setShowOnlyMyMaps(false);
                setSidebarOpen(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !showOnlyMyMaps 
                  ? 'bg-white text-neutral-800 shadow-xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">All Trails</span>
            </button>
            <button
              onClick={() => {
                setShowOnlyMyMaps(true);
                setSidebarOpen(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                showOnlyMyMaps 
                  ? 'bg-white text-neutral-800 shadow-xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">My Maps</span>
              <span className="bg-neutral-200 text-neutral-700 text-[10px] px-1.5 py-0.2 rounded-full font-semibold shrink-0">
                {currentUserEmail ? routes.filter(r => r.contributorEmail === currentUserEmail).length : 0}
              </span>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-white/80 hover:bg-white text-neutral-700 hover:text-[#7ABA42] rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border border-neutral-200/60"
              title="Focus full map view"
            >
              <Map className="w-3.5 h-3.5 text-[#7ABA42] shrink-0" />
              <span className="truncate">Map View</span>
            </button>
          </div>

          {/* Search Box and Filters Button Side by Side */}
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

          {/* Collapsible Filters Expansion Panel */}
          {showFilters && (
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
        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full">
              <div className="w-8 h-8 border-3 border-[#7ABA42] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-neutral-400 mt-2">Loading hiking routes...</span>
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full text-neutral-400">
              <Compass className="w-10 h-10 text-neutral-300 animate-pulse" />
              <span className="text-xs font-bold text-neutral-500">No Trails Found</span>
              <span className="text-[10px]">Try adjusting your search filters or upload a new track!</span>
            </div>
          ) : (
            filteredRoutes.map((route, idx) => (
              <RouteCard
                key={route.id}
                route={route}
                index={idx}
                isActive={activeRoute?.id === route.id}
                onClick={handleRouteClick}
                onDelete={handleDeleteRoute}
              />
            ))
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
                <div className="border border-dashed border-neutral-300 rounded-xl p-4 bg-neutral-50/50 text-center relative hover:bg-neutral-50 hover:border-[#7ABA42] transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".gpx,.kml"
                    onChange={handleContributionFile}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                  <span className="font-bold text-neutral-600 block mb-1">
                    {contributionFile ? contributionFile.name : 'Choose file or drag here'}
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
