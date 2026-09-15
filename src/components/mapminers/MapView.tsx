import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon issue in React/Webpack environments
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapViewProps {
  routes: any[];
  activeRoute: any;
  onRouteClick: (route: any) => void;
  detailPanelHeight?: number;
}

const ROUTE_COLORS = [
  '#fc6600', '#fc6600',
];

interface MapErrorBoundaryProps {
  children: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MapErrorBoundary] Caught Leaflet rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-neutral-50 rounded-2xl p-6 text-center border border-neutral-200">
          <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
              <line x1="8" y1="2" x2="8" y2="18"></line>
              <line x1="16" y1="6" x2="16" y2="22"></line>
            </svg>
          </div>
          <h4 className="font-bold text-neutral-800 text-sm mb-1">Map View Standardizing</h4>
          <p className="text-xs text-neutral-500 max-w-xs mb-4">
            Some route coordinates were invalid or missing. Click below to reload the map engine.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-[#7ABA42] hover:bg-[#6ba637] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            Reload Map View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function FitBounds({ route, bottomPadding }: { route: any; bottomPadding?: number }) {
  const map = useMap();
  useEffect(() => {
    if (route?.bounds && Array.isArray(route.bounds) && route.bounds.length === 2) {
      const [[lat1, lng1], [lat2, lng2]] = route.bounds;
      if (
        typeof lat1 === 'number' && !isNaN(lat1) &&
        typeof lng1 === 'number' && !isNaN(lng1) &&
        typeof lat2 === 'number' && !isNaN(lat2) &&
        typeof lng2 === 'number' && !isNaN(lng2)
      ) {
        const pad = bottomPadding || 0;
        try {
          map.fitBounds(route.bounds, {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, pad + 40],
            animate: true,
            duration: 0.8,
          });
        } catch (e) {
          console.warn('[FitBounds] Error fitting bounds:', e);
        }
      }
    }
  }, [route, bottomPadding, map]);
  return null;
}

function AllRoutesBounds({ routes }: { routes: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (!routes || routes.length === 0) return;
    const allLats: number[] = [];
    const allLngs: number[] = [];
    routes.forEach(r => {
      if (r?.bounds && Array.isArray(r.bounds) && r.bounds.length === 2) {
        const [[lat1, lng1], [lat2, lng2]] = r.bounds;
        if (typeof lat1 === 'number' && !isNaN(lat1)) allLats.push(lat1);
        if (typeof lat2 === 'number' && !isNaN(lat2)) allLats.push(lat2);
        if (typeof lng1 === 'number' && !isNaN(lng1)) allLngs.push(lng1);
        if (typeof lng2 === 'number' && !isNaN(lng2)) allLngs.push(lng2);
      }
    });

    if (allLats.length === 0 || allLngs.length === 0) return;
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...allLats), Math.min(...allLngs)],
      [Math.max(...allLats), Math.max(...allLngs)]
    ];
    try {
      map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 0.8 });
    } catch (e) {
      console.warn('[AllRoutesBounds] Error fitting bounds:', e);
    }
  }, [routes, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let timer: NodeJS.Timeout;
    const invalidate = () => {
      map.invalidateSize({ animate: false });
      clearTimeout(timer);
      timer = setTimeout(() => map.invalidateSize({ animate: false }), 400);
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    window.addEventListener('sidebar-toggle', invalidate);
    return () => {
      observer.disconnect();
      window.removeEventListener('sidebar-toggle', invalidate);
      clearTimeout(timer);
    };
  }, [map]);
  return null;
}

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
};

function TileLayerToggle() {
  const [mode, setMode] = useState<'street' | 'satellite'>('street');
  const [isCompact, setIsCompact] = useState(() => window.innerWidth <= 768);
  const tile = TILE_LAYERS[mode];

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <TileLayer key={mode} url={tile.url} attribution={tile.attribution} />
      <div className="absolute top-3 right-3 z-[1000]">
        <button
          onClick={() => setMode(m => m === 'street' ? 'satellite' : 'street')}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-700 text-xs font-bold hover:border-[#7ABA42] hover:text-[#7ABA42] transition-colors shadow-sm cursor-pointer"
          title={mode === 'street' ? 'Switch to Satellite View' : 'Switch to Street View'}
        >
          {mode === 'street' ? (
            /* Globe icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
            </svg>
          ) : (
            /* Map icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/>
            </svg>
          )}
          {!isCompact && (mode === 'street' ? 'Satellite' : 'Map')}
        </button>
      </div>
    </>
  );
}

export default function MapView({ routes, activeRoute, onRouteClick, detailPanelHeight }: MapViewProps) {
  const center: [number, number] = [27.7172, 85.3240];

  return (
    <div className="w-full h-full relative" style={{ minHeight: '300px' }}>
      <MapErrorBoundary>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={true}
        >
          <MapResizer />
          <TileLayerToggle />
          <ZoomControl position="bottomright" />

          {routes.map((route, idx) => {
            if (!route) return null;
            const renderSegments = route.displayLineSegments?.length
              ? route.displayLineSegments
              : (route.lineSegments?.length ? route.lineSegments : (route.coordinates?.length ? [route.coordinates] : []));

            // Extract only valid numeric coordinates into segments of [lat, lng] tuples
            const validSegments: [number, number][][] = (renderSegments || [])
              .map((seg: any) =>
                (seg || [])
                  .filter((c: any) => c && typeof c.lat === 'number' && !isNaN(c.lat) && typeof c.lng === 'number' && !isNaN(c.lng))
                  .map((c: any) => [c.lat, c.lng] as [number, number])
              )
              .filter((seg: [number, number][]) => seg.length > 0);

            const flatPositions = validSegments.flat();
            if (flatPositions.length === 0) return null;

            const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const isActive = activeRoute?.id === route.id;
            const startPos = flatPositions[0];
            const endPos = flatPositions[flatPositions.length - 1];

            if (isActive) {
              return (
                <div key={route.id || idx}>
                  {validSegments.map((positions: [number, number][], segmentIdx: number) => (
                    <div key={`${route.id || idx}-seg-${segmentIdx}`}>
                      {/* Shadow/glow line */}
                      <Polyline
                        positions={positions}
                        pathOptions={{ color: color, weight: 10, opacity: 0.15 }}
                        eventHandlers={{ click: () => onRouteClick(route) }}
                      />
                      {/* Main line */}
                      <Polyline
                        positions={positions}
                        pathOptions={{ color: color, weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                        eventHandlers={{ click: () => onRouteClick(route) }}
                      >
                        <Tooltip sticky>
                          <div className="font-bold text-xs p-1 max-w-[200px] break-words [overflow-wrap:anywhere]">{route.name}</div>
                          <div className="text-[10px] text-neutral-500 p-1 mt-0.5">{route.stats?.distance ?? 0}km • {route.difficulty}</div>
                        </Tooltip>
                      </Polyline>
                    </div>
                  ))}

                  {/* Start marker */}
                  <CircleMarker
                    center={startPos}
                    radius={8}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}
                    eventHandlers={{ click: () => onRouteClick(route) }}
                  >
                    <Popup>
                      <div className="min-w-[180px] max-w-[240px] text-xs">
                        <div className="font-bold text-neutral-800 text-sm mb-1 break-words [overflow-wrap:anywhere] leading-tight">{route.name}</div>
                        <div className="text-neutral-500 mb-2 text-[10px] break-words [overflow-wrap:anywhere]">{route.fileName}</div>
                        <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-neutral-100">
                          <div>
                            <div className="font-bold" style={{ color }}>{route.stats?.distance ?? 0}km</div>
                            <div className="text-[10px] text-neutral-400">Distance</div>
                          </div>
                          <div>
                            <div className="font-bold" style={{ color }}>{route.stats?.elevationGain ?? 0}m</div>
                            <div className="text-[10px] text-neutral-400">Gain</div>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>

                  {/* End marker */}
                  <CircleMarker
                    center={endPos}
                    radius={6}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: '#1e293b', fillOpacity: 1 }}
                    eventHandlers={{ click: () => onRouteClick(route) }}
                  />
                </div>
              );
            } else {
              // For inactive routes, ONLY render a lightweight dot to prevent browser lag
              return (
                <CircleMarker
                  key={route.id || idx}
                  center={startPos}
                  radius={5}
                  pathOptions={{ color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.7 }}
                  eventHandlers={{ click: () => onRouteClick(route) }}
                >
                  <Tooltip sticky>
                    <div className="font-bold text-xs max-w-[200px] break-words [overflow-wrap:anywhere]">{route.name}</div>
                  </Tooltip>
                </CircleMarker>
              );
            }
          })}

          {activeRoute && <FitBounds route={activeRoute} bottomPadding={detailPanelHeight} />}
          {!activeRoute && routes.length > 0 && <AllRoutesBounds routes={routes} />}

          {/* Imperative hover dot — listens to DOM events, zero React overhead */}
          <HoverDot />
        </MapContainer>
      </MapErrorBoundary>
    </div>
  );
}

// Fully imperative: listens to 'chart-hover' CustomEvent, calls setLatLng() directly
function HoverDot() {
  const map = useMap();
  const glowRef = useRef<L.CircleMarker | null>(null);
  const dotRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    const glow = L.circleMarker([0, 0], {
      radius: 14, color: 'transparent', fillColor: '#f97316', fillOpacity: 0.25, weight: 0, interactive: false,
    });
    const dot = L.circleMarker([0, 0], {
      radius: 6, color: '#fff', weight: 2.5, fillColor: '#f97316', fillOpacity: 1, interactive: false,
    });
    glowRef.current = glow;
    dotRef.current = dot;

    const handler = (e: any) => {
      const coord = e.detail;
      if (coord && typeof coord.lat === 'number' && !isNaN(coord.lat) && typeof coord.lng === 'number' && !isNaN(coord.lng)) {
        const latlng: [number, number] = [coord.lat, coord.lng];
        glow.setLatLng(latlng).addTo(map);
        dot.setLatLng(latlng).addTo(map);
      } else {
        glow.remove();
        dot.remove();
      }
    };

    window.addEventListener('chart-hover', handler);
    return () => {
      window.removeEventListener('chart-hover', handler);
      glow.remove();
      dot.remove();
    };
  }, [map]);

  return null;
}
