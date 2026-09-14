import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Download, MapPin, Flag, Share2, Check, ChevronUp, ChevronDown } from 'lucide-react';
import ElevationChart from './ElevationChart';
import { routeToGPX } from './kmlParser';

interface RouteDetailProps {
  route: any;
  onClose: () => void;
  isMobile: boolean;
}

function formatEstimatedTime(hours: number): string {
  if (typeof hours !== 'number' || Number.isNaN(hours)) return '-';
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `~${h}h`;
  return `~${h}h ${m}m`;
}

function buildAboutParagraphs(text: string): string[] {
  if (!text) return [];
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?/g) || [text.trim()];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length && paragraphs.length < 3; i += 2) {
    paragraphs.push(`${(sentences[i] || '').trim()} ${(sentences[i + 1] || '').trim()}`.trim());
  }
  return paragraphs.filter(Boolean);
}

function getHighlights(route: any): string[] {
  const chips: string[] = [];
  const difficulty = String(route?.difficulty || '').toLowerCase();
  const text = `${route?.description || ''} ${route?.highlights || ''}`.toLowerCase();

  if (difficulty === 'easy' || difficulty === 'moderate') chips.push('Beginner Friendly');
  if (text.includes('family') || text.includes('kids')) chips.push('Family Friendly');
  if (text.includes('transport') || text.includes('bus') || text.includes('jeep')) {
    chips.push('Transit available');
  }
  if (chips.length === 0 && (route?.stats?.distance || 0) <= 15) chips.push('Great Half-day Hike');

  return chips.slice(0, 3);
}

function maskEmail(email: string): string {
  if (!email) return '';
  const [localPart, domainPart] = String(email).split('@');
  if (!domainPart) return email;

  const visibleChars = localPart.length > 2 ? localPart.slice(0, 2) : localPart.slice(0);
  const maskedChars = '*'.repeat(Math.max(4, localPart.length - visibleChars.length));
  return `${visibleChars}${maskedChars}@${domainPart}`;
}

export default function RouteDetail({ route, onClose, isMobile }: RouteDetailProps) {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'PROFILE' | 'MORE'>('SUMMARY');
  const [shareCopied, setShareCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const highlightChips = getHighlights(route);
  const aboutParagraphs = buildAboutParagraphs(route?.description || '');

  // Keep expanded state synchronized with route switches
  useEffect(() => {
    setIsExpanded(false);
  }, [route.id]);

  const handleDownloadGPX = (e: React.MouseEvent) => {
    e.stopPropagation();
    const gpxString = routeToGPX(route);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${route.name.toLowerCase().replace(/\s+/g, '-')}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodeURIComponent(route.fileName)}`;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleTabClick = (tab: 'SUMMARY' | 'PROFILE' | 'MORE') => {
    setActiveTab(tab);
    setIsExpanded(true); // Auto expand when user clicks any tab
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Fallback scenic nature banner image
  const headerBgImage = route?.heroImage || route?.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="bg-white border border-neutral-200 rounded-t-xl md:rounded-xl shadow-xl overflow-hidden flex flex-col w-full max-w-[410px] mx-auto transition-all duration-300">
      
      {/* Tap/Click to expand top handle area */}
      <div 
        onClick={toggleExpand}
        className="flex flex-col justify-center items-center py-1 cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors shrink-0"
        title={isExpanded ? "Click to collapse" : "Click to expand details"}
      >
        <div className="w-8 h-1 bg-neutral-200 rounded-full mb-0.5" />
        <div className="text-[8px] text-neutral-400 font-bold tracking-wider flex items-center gap-0.5">
          {isExpanded ? (
            <>
              <span>COLLAPSE</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </>
          ) : (
            <>
              <span>TAP TO EXPAND DETAILS</span>
              <ChevronUp className="w-2.5 h-2.5 animate-bounce" />
            </>
          )}
        </div>
      </div>

      {/* Header section with cover image */}
      <div 
        onClick={toggleExpand}
        className="relative mx-2 rounded-lg overflow-hidden shrink-0 bg-neutral-900 cursor-pointer group"
      >
        <div 
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `url('${headerBgImage}')`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Dark linear gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/85" />

        <div className="relative p-2.5 flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[8px] uppercase font-bold tracking-wider text-amber-500">
              ACTIVE ROUTE
            </span>
            <h3 className="text-xs font-bold text-white truncate leading-tight mt-0.5" title={route.name}>
              {route.name}
            </h3>
            
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white border border-white/10 shadow-xs ${
                route.difficulty === 'Easy' ? 'bg-emerald-500' :
                route.difficulty === 'Moderate' ? 'bg-amber-500' :
                route.difficulty === 'Hard' ? 'bg-red-500' : 'bg-rose-700'
              }`}>
                {route.difficulty}
              </span>

              {route.nearbyCity && (
                <span className="text-[8px] text-neutral-300 font-semibold truncate">
                  • {route.nearbyCity}
                </span>
              )}
            </div>
          </div>

          {/* Action Row & Close */}
          <div className="flex items-center gap-1 shrink-0 self-start">
            <button
              onClick={handleDownloadGPX}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-500 hover:bg-sky-600 border border-sky-400 text-white font-bold text-[8px] rounded shadow-xs cursor-pointer"
              title="Export GPS file"
            >
              <Download className="w-2 h-2" />
              <span>Export</span>
            </button>

            <button
              onClick={handleShareRoute}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 border font-bold text-[8px] rounded shadow-xs cursor-pointer text-white ${
                shareCopied 
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500'
              }`}
              title="Copy trail link to share"
            >
              {shareCopied ? <Check className="w-2 h-2" /> : <Share2 className="w-2 h-2" />}
              <span>{shareCopied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 bg-black/60 hover:bg-black/80 border border-white/10 rounded text-white transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex justify-center items-center gap-6 border-b border-neutral-100 bg-white px-3 pt-2 shrink-0">
        {(['SUMMARY', 'PROFILE', 'MORE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`pb-1.5 text-[8.5px] font-bold tracking-wider transition-all border-b-2 uppercase ${
              activeTab === tab 
                ? 'border-[#7ABA42] text-[#7ABA42]' 
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Smooth Expandable Content Box */}
      <div 
        className={`transition-all duration-300 ease-in-out bg-white overflow-hidden ${
          isExpanded ? 'max-h-[190px] opacity-100 border-t border-neutral-50' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="p-2 overflow-y-auto no-scrollbar max-h-[190px]">
          
          {activeTab === 'SUMMARY' && (
            <div className="space-y-2">
              {/* Divider grid perfectly matching references */}
              <div className="grid grid-cols-2 bg-white border border-neutral-200 rounded-lg overflow-hidden divide-x divide-y divide-neutral-200">
                
                {/* Distance */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    DISTANCE
                  </span>
                  <span className="text-xs font-bold text-neutral-800 block mt-0.5">
                    {route.stats.distance}km
                  </span>
                </div>

                {/* Gain */}
                <div className="p-2 !border-t-0">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    GAIN
                  </span>
                  <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                    +{route.stats.elevationGain}m
                  </span>
                </div>

                {/* Loss */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    LOSS
                  </span>
                  <span className="text-xs font-bold text-blue-600 block mt-0.5">
                    -{route.stats.elevationLoss}m
                  </span>
                </div>

                {/* Duration / Time */}
                <div className="p-2">
                  <span className="text-[7.5px] uppercase font-bold tracking-wider text-neutral-400 block">
                    TIME
                  </span>
                  <span className="text-xs font-bold text-[#7ABA42] block mt-0.5">
                    {formatEstimatedTime(route.stats.estimatedHours)}
                  </span>
                </div>

              </div>

              {/* Region location details bar */}
              {(route.district || route.province) && (
                <div className="flex items-center gap-1.5 text-[8.5px] text-neutral-500 px-1 bg-neutral-50 py-1 rounded-lg border border-neutral-100">
                  <MapPin className="w-2.5 h-2.5 text-neutral-400 shrink-0 ml-0.5" />
                  <span className="truncate font-semibold text-[8.5px]">
                    {route.district && route.district} • {route.province && route.province} region
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'PROFILE' && (
            <div className="space-y-1.5">
              <div className="h-[90px] w-full relative">
                {route.loadError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 text-center px-4">
                    <span className="text-[8px] font-bold">Failed to load route file</span>
                    <span className="text-[7.5px] text-neutral-400 mt-0.5">{route.loadError}</span>
                  </div>
                ) : !route.isLazyLoaded ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-1">
                    <div className="w-4 h-4 border-2 border-[#7ABA42] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[8px]">Loading coordinates...</span>
                  </div>
                ) : (
                  <ElevationChart route={route} />
                )}
              </div>
              
              <div className="flex justify-between text-[8px] font-bold text-neutral-500 px-1 pt-1 border-t border-neutral-100">
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                  <span>Peak: {route.stats.maxElevation}m</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <TrendingDown className="w-2.5 h-2.5 text-blue-500" />
                  <span>Min: {route.stats.minElevation}m</span>
                </span>
              </div>
            </div>
          )}

          {activeTab === 'MORE' && (
            <div className="space-y-2 text-[10px]">
              {/* Elevation range */}
              <div className="grid grid-cols-2 gap-1">
                <div className="p-1 bg-neutral-50 rounded border border-neutral-100 text-center">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block">Start Elev</span>
                  <span className="text-[10px] font-bold text-neutral-700 font-mono mt-0.5 block">{route.stats.startElevation}m</span>
                </div>
                <div className="p-1 bg-neutral-50 rounded border border-neutral-100 text-center">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block">End Elev</span>
                  <span className="text-[10px] font-bold text-neutral-700 font-mono mt-0.5 block">{route.stats.endElevation}m</span>
                </div>
              </div>

              {/* Google Maps trailhead navigator */}
              {route.isLazyLoaded && route.waypoints && route.waypoints.length >= 2 && (
                <div className="grid grid-cols-2 gap-1 shrink-0">
                  <a
                    href={`https://www.google.com/maps?q=${route.waypoints[0].lat},${route.waypoints[0].lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-0.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8px] font-bold rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <MapPin size={9} />
                    <span>Start GPS</span>
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${route.waypoints[route.waypoints.length - 1].lat},${route.waypoints[route.waypoints.length - 1].lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-0.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-bold rounded hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <Flag size={9} />
                    <span>End GPS</span>
                  </a>
                </div>
              )}

              {/* Description/About */}
              {route.description && (
                <div className="p-1.5 bg-neutral-50 rounded-lg border border-neutral-150">
                  <span className="text-[7.5px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">About Trail</span>
                  {highlightChips.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mb-1">
                      {highlightChips.map((chip) => (
                        <span key={chip} className="text-[7.5px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-full px-1 py-0.2">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                  {aboutParagraphs.map((p, idx) => (
                    <p key={idx} className="text-[9px] text-neutral-600 leading-relaxed mb-0.5 last:mb-0">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {/* Contributor credentials block */}
              {route.contributorName && (
                <div className="p-1.5 bg-amber-50/40 border border-amber-200/40 rounded-lg flex items-center justify-between text-[9px]">
                  <div>
                    <span className="text-[7.5px] text-amber-600 font-bold uppercase tracking-wider block">CONTRIBUTOR</span>
                    <span className="font-bold text-neutral-700 mt-0.5 block">{route.contributorName}</span>
                  </div>
                  {route.contributorEmail && (
                    <span className="text-[8px] font-mono text-neutral-500 bg-white/60 border border-amber-200/30 px-1 py-0.2 rounded">
                      {maskEmail(route.contributorEmail)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
