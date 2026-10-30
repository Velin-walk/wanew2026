import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Footprints, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface JourneyPoint {
  event_no: string | number;
  title: string;
  date: string;
  hike_km: number;
  trek_km: number;
  total_km: number;
}

interface LowPolyMountainTrailChartProps {
  points: JourneyPoint[];
  activePoint: JourneyPoint | null;
  onSelectPoint: (pt: JourneyPoint) => void;
  milestones?: Array<{ km: number; trek: string }>;
}

export const LowPolyMountainTrailChart: React.FC<LowPolyMountainTrailChartProps> = ({
  points,
  activePoint,
  onSelectPoint,
}) => {
  // Mobile zoom state (1x to 3.5x)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => {
      return (a.total_km || 0) - (b.total_km || 0);
    });
  }, [points]);

  const chartData = useMemo(() => {
    if (sortedPoints.length === 0) return { coords: [], dLine: '', dArea: '', maxKm: 1 };

    const maxKm = Math.max(...sortedPoints.map(p => p.total_km), 1);

    const width = 1000;
    const height = 300;
    const paddingLeft = 60;
    const paddingRight = 40;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const coords = sortedPoints.map((pt, idx) => {
      const xRatio = sortedPoints.length > 1 ? idx / (sortedPoints.length - 1) : 0;
      const yRatio = pt.total_km / maxKm;

      const x = paddingLeft + xRatio * chartWidth;
      const y = height - paddingBottom - yRatio * chartHeight;

      return { x, y, pt };
    });

    // Create SVG path string for the line
    const dLine = coords.reduce((acc, coord, idx) => {
      return acc + `${idx === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`;
    }, '');

    // Create SVG path string for the filled area underneath
    const firstCoord = coords[0];
    const lastCoord = coords[coords.length - 1];
    const floorY = height - paddingBottom;
    const dArea = dLine
      ? `${dLine} L ${lastCoord.x.toFixed(1)} ${floorY} L ${firstCoord.x.toFixed(1)} ${floorY} Z`
      : '';

    return { coords, dLine, dArea, maxKm, chartHeight, paddingLeft, chartWidth, floorY };
  }, [sortedPoints]);

  const { coords, dLine, dArea, maxKm, floorY, paddingLeft } = chartData;

  // Center on active point when zoomed in
  useEffect(() => {
    if (activePoint && zoomLevel > 1 && scrollContainerRef.current && coords) {
      const activeCoord = coords.find(
        (c) =>
          String(c.pt.event_no) === String(activePoint.event_no) ||
          c.pt.date === activePoint.date
      );
      if (activeCoord) {
        const container = scrollContainerRef.current;
        const totalContentWidth = container.scrollWidth;
        const targetX = (activeCoord.x / 1000) * totalContentWidth;
        const scrollTarget = targetX - container.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    }
  }, [activePoint, zoomLevel, coords]);

  // Handle Zoom In
  const handleZoomIn = () => {
    triggerHaptic(15);
    setZoomLevel((prev) => Math.min(3.5, +(prev + 0.5).toFixed(1)));
  };

  // Handle Zoom Out
  const handleZoomOut = () => {
    triggerHaptic(15);
    setZoomLevel((prev) => Math.max(1, +(prev - 0.5).toFixed(1)));
  };

  // Handle Zoom Reset
  const handleResetZoom = () => {
    triggerHaptic(15);
    setZoomLevel(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Double tap to toggle zoom between 1x and 2x
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      triggerHaptic(20);
      setZoomLevel((prev) => (prev > 1 ? 1 : 2));
    }
    lastTapRef.current = now;
  };

  // Pinch-to-zoom touch handlers for native mobile feel
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStateRef.current = { initialDist: dist, initialZoom: zoomLevel };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStateRef.current.initialDist;
      const nextZoom = Math.min(3.5, Math.max(1, +(touchStateRef.current.initialZoom * factor).toFixed(1)));
      setZoomLevel(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current = null;
  };

  if (sortedPoints.length === 0) {
    return (
      <div className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center text-stone-500 text-xs">
        No journey points to plot.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs space-y-2.5 sm:space-y-3">
      {/* Chart Title / Caption with Mobile Zoom Controls */}
      <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-stone-600 font-semibold px-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <Footprints className="w-4 h-4 text-[#7ABA42] shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-[#1F1F1F] truncate">
            Cumulative Distance Progress Curve
          </span>
        </span>

        {/* Action Controls & Peak Metric */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {/* Zoom Buttons (Optimized for Mobile Close-Up Inspection) */}
          <div className="inline-flex items-center bg-[#FAF8F5] border border-stone-200 rounded-lg p-0.5 shadow-3xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1 sm:px-1.5 sm:py-0.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold text-stone-700 hover:text-stone-900 hover:bg-white rounded-md transition-all cursor-pointer"
              title="Tap to reset zoom to 1x"
            >
              {zoomLevel}x
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              className="p-1 sm:px-1.5 sm:py-0.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-md transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-md transition-all cursor-pointer border-l border-stone-200"
                title="Reset zoom to 1x"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Peak Total Badge */}
          <span className="font-bold text-stone-900 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md text-[10px] sm:text-xs">
            Peak: {maxKm.toLocaleString()} km
          </span>
        </div>
      </div>

      {/* Mobile Pan / Swipe Hint when Zoomed In */}
      {zoomLevel > 1 && (
        <div className="flex items-center justify-between text-[10px] text-stone-500 bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-1 rounded-lg animate-in fade-in duration-150">
          <span className="font-semibold text-emerald-900 flex items-center gap-1">
            <span>🔍 Zoomed {zoomLevel}x</span>
            <span className="text-stone-400">•</span>
            <span>Swipe horizontally to pan timeline</span>
          </span>
          <button
            type="button"
            onClick={handleResetZoom}
            className="text-[9.5px] font-bold text-emerald-800 hover:underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* SVG Chart Container - Supports Smooth Horizontal Pan & Touch Zoom */}
      <div
        ref={scrollContainerRef}
        onClick={handleDoubleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full relative select-none rounded-xl transition-all ${
          zoomLevel > 1
            ? 'overflow-x-auto scrollbar-thin overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing pb-1'
            : 'overflow-hidden'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            minWidth: zoomLevel > 1 ? `${zoomLevel * 100}%` : '100%',
            transition: touchStateRef.current ? 'none' : 'min-width 0.2s ease-out',
          }}
        >
          <svg
            viewBox="0 0 1000 300"
            className="w-full h-auto select-none overflow-visible"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7ABA42" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7ABA42" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = floorY - ratio * (floorY - 30);
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={1000 - 40}
                    y2={y}
                    stroke="#EFEAE4"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] font-black fill-stone-500 font-mono"
                  >
                    {Math.round(ratio * maxKm).toLocaleString()} km
                  </text>
                </g>
              );
            })}

            {/* Filled Area Under the Curve */}
            {dArea && (
              <path
                d={dArea}
                fill="url(#chartGradient)"
              />
            )}

            {/* Line Curve */}
            {dLine && (
              <path
                d={dLine}
                fill="none"
                stroke="#7ABA42"
                strokeWidth={zoomLevel > 1.8 ? '4' : '3.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Data Points */}
            {coords.map((coord, idx) => {
              const isActive =
                activePoint &&
                (String(activePoint.event_no) === String(coord.pt.event_no) ||
                  activePoint.date === coord.pt.date);

              // Scale node sizes slightly when zoomed in for effortless mobile tapping
              const tapRadius = zoomLevel > 1.5 ? 20 : 15;
              const nodeRadius = isActive ? (zoomLevel > 1.5 ? '5' : '4') : (zoomLevel > 1.5 ? '2.5' : '1.8');

              return (
                <g
                  key={idx}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic(10);
                    onSelectPoint(coord.pt);
                  }}
                  onMouseEnter={() => onSelectPoint(coord.pt)}
                >
                  {/* Larger Invisible Tap Area */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={tapRadius}
                    fill="transparent"
                  />

                  {/* Pulsing Active Highlight */}
                  {isActive && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={zoomLevel > 1.5 ? '9' : '7'}
                      fill="#7ABA42"
                      opacity="0.35"
                      className="animate-ping"
                    />
                  )}

                  {/* Core Node Circle */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={nodeRadius}
                    fill={isActive ? '#E08828' : '#7ABA42'}
                    stroke="white"
                    strokeWidth={isActive ? '1.5' : '0.75'}
                    className="transition-all duration-150 group-hover:scale-125"
                  />
                </g>
              );
            })}

            {/* X-Axis Timeline Guideline */}
            <line
              x1={paddingLeft}
              y1={floorY}
              x2={1000 - 40}
              y2={floorY}
              stroke="#D4CCC0"
              strokeWidth="1.5"
            />

            {/* X-Axis Labels */}
            {coords.length > 0 && (
              <>
                {/* First Point Label */}
                <text
                  x={coords[0].x}
                  y={floorY + 20}
                  textAnchor="start"
                  className="text-[10px] font-black fill-stone-500 font-mono"
                >
                  {coords[0].pt.date ? coords[0].pt.date.slice(2) : 'Start'}
                </text>

                {/* Middle Point Label */}
                {coords.length > 2 && (
                  <text
                    x={coords[Math.floor(coords.length / 2)].x}
                    y={floorY + 20}
                    textAnchor="middle"
                    className="text-[10px] font-black fill-stone-500 font-mono"
                  >
                    {coords[Math.floor(coords.length / 2)].pt.date
                      ? coords[Math.floor(coords.length / 2)].pt.date.slice(2)
                      : ''}
                  </text>
                )}

                {/* Last Point Label */}
                <text
                  x={coords[coords.length - 1].x}
                  y={floorY + 20}
                  textAnchor="end"
                  className="text-[10px] font-black fill-stone-500 font-mono"
                >
                  {coords[coords.length - 1].pt.date
                    ? coords[coords.length - 1].pt.date.slice(2)
                    : 'Current'}
                </text>
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
