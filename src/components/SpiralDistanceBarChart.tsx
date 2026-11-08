import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Footprints, Mountain, Sparkles, Trophy, Calendar, Info, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { JourneyPoint } from './3d/LowPolyMountainTrailChart';
import { triggerHaptic } from '../utils/haptics';

interface SpiralDistanceBarChartProps {
  points: JourneyPoint[];
  activePoint: JourneyPoint | null;
  onSelectPoint: (pt: JourneyPoint) => void;
  milestones?: Array<{ km: number; trek: string }>;
  totalCommunityKm?: number;
}

export const SpiralDistanceBarChart: React.FC<SpiralDistanceBarChartProps> = ({
  points,
  activePoint,
  onSelectPoint,
  milestones = [],
  totalCommunityKm: propTotalCommunityKm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Zoom & Pan state (1x to 3x)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStateRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Chronologically sort points
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => {
      if (a.date && b.date) {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (!isNaN(da) && !isNaN(db) && da !== db) {
          return da - db;
        }
      }
      const numA = Number(String(a.event_no || '').replace(/\D/g, '')) || 0;
      const numB = Number(String(b.event_no || '').replace(/\D/g, '')) || 0;
      if (numA && numB && numA !== numB) {
        return numA - numB;
      }
      return (a.total_km || 0) - (b.total_km || 0);
    });
  }, [points]);

  // Derive per-event distance (e.g. 60km, 200km) so each bar is relative to one event total
  const { processedPoints, maxKm, totalCumKm, avgKm } = useMemo(() => {
    let runningCum = 0;
    const items = sortedPoints.map((p, idx) => {
      let eventKm = 20;
      let eventHike = 0;
      let eventTrek = 0;

      // 1. If event_km was precomputed
      if (typeof p.event_km === 'number' && p.event_km > 0) {
        eventKm = p.event_km;
        eventHike = p.event_hike_km ?? p.hike_km ?? 0;
        eventTrek = p.event_trek_km ?? p.trek_km ?? 0;
      } else {
        // 2. Otherwise calculate delta between adjacent cumulative events
        const prev = idx > 0 ? sortedPoints[idx - 1] : null;
        if (prev && typeof p.total_km === 'number' && typeof prev.total_km === 'number' && p.total_km >= prev.total_km) {
          const diff = p.total_km - prev.total_km;
          if (diff > 0) {
            eventKm = diff;
            eventHike = Math.max(0, (p.hike_km || 0) - (prev.hike_km || 0));
            eventTrek = Math.max(0, (p.trek_km || 0) - (prev.trek_km || 0));
          }
        } else if (typeof p.total_km === 'number' && p.total_km > 0 && p.total_km <= 500) {
          eventKm = p.total_km;
          eventHike = p.hike_km || 0;
          eventTrek = p.trek_km || 0;
        } else {
          eventKm = (p.hike_km || 0) + (p.trek_km || 0) || 20;
        }
      }

      eventKm = Math.max(1, Math.round(eventKm * 10) / 10);
      const cumTotal = p.cum_total_km || p.total_km || (runningCum + eventKm);
      runningCum = cumTotal;

      const isTrek = eventTrek > eventHike || (p.title && /trek|overnight|circuit|expedition/i.test(p.title)) || eventKm >= 45;

      return {
        ...p,
        event_km: eventKm,
        event_hike_km: eventHike,
        event_trek_km: eventTrek,
        cum_total_km: cumTotal,
        isTrek
      };
    });

    let max = 25;
    let sum = 0;
    items.forEach((pt) => {
      if (pt.event_km > max) max = pt.event_km;
      sum += pt.event_km;
    });

    const totalCum = items.length > 0 ? items[items.length - 1].cum_total_km : sum;
    const avg = items.length > 0 ? Math.round(sum / items.length) : 25;

    return {
      processedPoints: items,
      maxKm: max,
      totalCumKm: totalCum,
      avgKm: avg
    };
  }, [sortedPoints]);

  // Zoom handlers
  const handleZoomIn = () => {
    triggerHaptic(10);
    setZoomLevel((prev) => Math.min(3, Math.round((prev + 0.5) * 10) / 10));
  };

  const handleZoomOut = () => {
    triggerHaptic(10);
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.round((prev - 0.5) * 10) / 10);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    triggerHaptic(12);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Drag and pan handlers for zoomed-in state
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    const maxPan = 500 * (zoomLevel - 1);
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStartRef.current.x));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStartRef.current.y));
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStateRef.current = { initialDist: dist, initialZoom: zoomLevel };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        triggerHaptic(15);
        if (zoomLevel > 1) {
          handleResetZoom();
        } else {
          setZoomLevel(2);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (zoomLevel > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStateRef.current.initialDist;
      const target = Math.min(3, Math.max(1, Math.round(touchStateRef.current.initialZoom * ratio * 10) / 10));
      setZoomLevel(target);
      if (target === 1) setPanOffset({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && zoomLevel > 1) {
      const maxPan = 500 * (zoomLevel - 1);
      const newX = Math.max(-maxPan, Math.min(maxPan, e.touches[0].clientX - dragStartRef.current.x));
      const newY = Math.max(-maxPan, Math.min(maxPan, e.touches[0].clientY - dragStartRef.current.y));
      setPanOffset({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStateRef.current = null;
  };

  // Wheel zoom handler with Alt/Ctrl/Meta
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoomLevel((prev) => {
        const next = Math.min(3, Math.max(1, Math.round((prev + delta) * 100) / 100));
        if (next === 1) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Double click toggles zoom between 1x and 2x
  const handleDoubleClick = () => {
    triggerHaptic(12);
    if (zoomLevel > 1) {
      handleResetZoom();
    } else {
      setZoomLevel(2);
    }
  };

  // Spiral geometry calculations
  const chartGeometry = useMemo(() => {
    const N = processedPoints.length;
    if (N === 0) return null;

    const size = 560;
    const cx = size / 2;
    const cy = size / 2;
    const rMin = 75; // Center space for tactile info hub
    const rMax = 250;

    // Determine number of windings based on dataset density
    let windings = 2.75;
    if (N <= 15) windings = 1.2;
    else if (N <= 35) windings = 1.75;
    else if (N <= 70) windings = 2.25;
    else windings = 2.85;

    const startAngle = -Math.PI / 2;
    const totalAngle = windings * 2 * Math.PI;
    const trackGap = (rMax - rMin) / windings;
    const slotHeight = Math.min(38, trackGap * 0.68);

    // Baseline spiral curve path
    const spiralSteps = 240;
    let spiralPathD = '';
    for (let s = 0; s <= spiralSteps; s++) {
      const frac = s / spiralSteps;
      const angle = startAngle + frac * totalAngle;
      const r = rMin + frac * (rMax - rMin - slotHeight * 0.35);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      spiralPathD += s === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }

    // Year / period label checkpoints along the baseline
    const yearMarkers: { year: string; x: number; y: number; angleDeg: number }[] = [];
    const seenYears = new Set<string>();

    // Compute each event bar relative to maxKm
    const bars = processedPoints.map((p, idx) => {
      const frac = N === 1 ? 0.5 : idx / (N - 1);
      const angle = startAngle + frac * totalAngle;
      const rBase = rMin + frac * (rMax - rMin - slotHeight * 0.35);

      const eventKm = p.event_km;
      const isTrek = p.isTrek;

      // Radial length of the bar is strictly proportional to this single event's total KM (e.g. 60km, 200km)
      const barHeight = Math.max(4.5, (Math.min(eventKm, maxKm) / maxKm) * slotHeight);

      // Coordinates
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const xBase = cx + rBase * cosA;
      const yBase = cy + rBase * sinA;

      const xSlot = cx + (rBase + slotHeight) * cosA;
      const ySlot = cy + (rBase + slotHeight) * sinA;

      const xBar = cx + (rBase + barHeight) * cosA;
      const yBar = cy + (rBase + barHeight) * sinA;

      // Dynamic bar stroke width
      const circumferenceAtR = 2 * Math.PI * rBase;
      const rawSlotWidth = (circumferenceAtR * windings) / N;
      const strokeWidth = Math.max(2.5, Math.min(9.5, rawSlotWidth * 0.72));

      // Vibrant 6-color palette (red, yellow, orange, black, blue, green)
      // Allocated cyclically so no 2 adjacent bars ever share the same color
      const VIBRANT_PALETTE = [
        '#ef4444', // Red
        '#eab308', // Yellow
        '#f97316', // Orange
        '#09090b', // Black
        '#2563eb', // Blue
        '#16a34a', // Green
      ];
      const barColor = VIBRANT_PALETTE[idx % VIBRANT_PALETTE.length];

      // Track Year markers along spiral
      if (p.date) {
        const yr = p.date.split('-')[0] || p.date.slice(0, 4);
        if (yr && !seenYears.has(yr) && yr.length === 4) {
          seenYears.add(yr);
          yearMarkers.push({
            year: yr,
            x: cx + (rBase - 8) * cosA,
            y: cy + (rBase - 8) * sinA,
            angleDeg: (angle * 180) / Math.PI + 90
          });
        }
      }

      return {
        point: p,
        idx,
        eventKm,
        isTrek,
        xBase,
        yBase,
        xSlot,
        ySlot,
        xBar,
        yBar,
        strokeWidth,
        barColor,
        angle
      };
    });

    return {
      size,
      cx,
      cy,
      rMin,
      rMax,
      slotHeight,
      spiralPathD,
      bars,
      yearMarkers
    };
  }, [processedPoints, maxKm]);

  // Selected or hovered display point
  const currentInspectPoint = useMemo(() => {
    if (hoveredIndex !== null && chartGeometry?.bars[hoveredIndex]) {
      const b = chartGeometry.bars[hoveredIndex];
      return {
        ...b.point,
        barColor: b.barColor
      };
    }
    if (activePoint && chartGeometry) {
      const match = chartGeometry.bars.find(
        (b) =>
          String(b.point.event_no) === String(activePoint.event_no) ||
          (b.point.date && b.point.date === activePoint.date && b.point.cum_total_km === activePoint.total_km)
      );
      if (match) return { ...match.point, barColor: match.barColor };
      return {
        ...activePoint,
        event_km: activePoint.event_km || (activePoint.hike_km + activePoint.trek_km) || 20,
        cum_total_km: activePoint.cum_total_km || activePoint.total_km,
        barColor: '#2563eb'
      };
    }
    return null;
  }, [hoveredIndex, activePoint, chartGeometry]);

  const handleSelectBar = useCallback(
    (pt: any, idx: number) => {
      triggerHaptic(12);
      onSelectPoint(pt);
      setHoveredIndex(idx);
    },
    [onSelectPoint]
  );

  if (!chartGeometry || processedPoints.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
        <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-bounce" />
        <p className="text-xs font-bold text-slate-600">No journey points recorded for this timeframe</p>
      </div>
    );
  }

  const { size, cx, cy, spiralPathD, bars, yearMarkers } = chartGeometry;

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col items-center select-none"
    >
      {/* Legend, Zoom Controls & Summary Subhead */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 px-2 pb-2 text-[11px] font-bold text-slate-600">
        {/* Color Spectrum Swatches */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-none bg-[#ef4444]" title="Red" />
              <span className="w-2.5 h-2.5 rounded-none bg-[#eab308]" title="Yellow" />
              <span className="w-2.5 h-2.5 rounded-none bg-[#f97316]" title="Orange" />
              <span className="w-2.5 h-2.5 rounded-none bg-[#09090b]" title="Black" />
              <span className="w-2.5 h-2.5 rounded-none bg-[#2563eb]" title="Blue" />
              <span className="w-2.5 h-2.5 rounded-none bg-[#16a34a]" title="Green" />
            </div>
            <span className="text-slate-800 font-extrabold ml-1">Vibrant Event Spectrum</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-none bg-slate-200" />
            <span>Headroom Slot</span>
          </div>
        </div>

        {/* Zoom Controls & Event Count Pill */}
        <div className="flex items-center gap-2">
          {/* Zoom Buttons Group */}
          <div className="inline-flex items-center bg-[#f0f4f9] border border-slate-200/90 rounded-xl p-0.5 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-slate-900 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (zoomLevel > 1) handleResetZoom();
                else setZoomLevel(2);
              }}
              className="px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-black text-slate-700 hover:text-blue-600 rounded-lg transition-all cursor-pointer"
              title="Click to toggle zoom (1x / 2x)"
            >
              {zoomLevel}x
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-slate-900 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer border-l border-slate-200"
                title="Reset zoom to 1x"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <span>{bars.length} Events Winded</span>
            <span>&bull;</span>
            <span>Max: {maxKm} km/bar</span>
          </div>
        </div>
      </div>

      {/* Zoom Pan Guidance Strip when Zoomed In */}
      {zoomLevel > 1 && (
        <div className="w-full flex items-center justify-between text-[10px] text-blue-700 bg-blue-50/80 border border-blue-200/80 px-2.5 py-1 rounded-xl mb-1 animate-in fade-in duration-150">
          <span className="font-bold flex items-center gap-1.5">
            <span>🔍 Zoomed {zoomLevel}x</span>
            <span className="text-slate-300">•</span>
            <span>Drag or swipe to pan spiral • Double-tap to reset</span>
          </span>
          <button
            type="button"
            onClick={handleResetZoom}
            className="text-[10px] font-extrabold text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            Reset (1x)
          </button>
        </div>
      )}

      {/* Main Spiral Chart Visual Area (with Zoom & Pan support, not limited on sides) */}
      <div
        className={`relative w-full max-w-full sm:max-w-[660px] md:max-w-[720px] aspect-square flex items-center justify-center ${
          zoomLevel > 1 ? 'overflow-visible' : 'overflow-hidden'
        } rounded-3xl select-none ${
          zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="w-full h-full relative flex items-center justify-center will-change-transform"
        >
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full overflow-visible drop-shadow-sm"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Continuous Archimedean Spiral Baseline Guide Line */}
            <path
              d={spiralPathD}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="opacity-90"
            />

            {/* Year / Period Markers along the spiral baseline */}
            {yearMarkers.map((ym, i) => (
              <text
                key={i}
                x={ym.x}
                y={ym.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight="900"
                fill="#64748b"
                className="select-none pointer-events-none"
              >
                {ym.year}
              </text>
            ))}

            {/* Background Ghost Slots with Angular Edges (strokeLinecap="butt") */}
            <g className="ghost-slots opacity-40">
              {bars.map((bar) => (
                <line
                  key={`slot-${bar.idx}`}
                  x1={bar.xBase}
                  y1={bar.yBase}
                  x2={bar.xSlot}
                  y2={bar.ySlot}
                  stroke="#e2e8f0"
                  strokeWidth={bar.strokeWidth}
                  strokeLinecap="butt"
                  className="transition-opacity duration-150"
                />
              ))}
            </g>

            {/* Active / Colored Event Bars with Angular Edges (strokeLinecap="butt") */}
            <g className="event-bars">
              {bars.map((bar) => {
                const isSelected = activePoint && (
                  String(activePoint.event_no) === String(bar.point.event_no) ||
                  (activePoint.date && activePoint.date === bar.point.date && activePoint.total_km === bar.point.cum_total_km)
                );
                const isHovered = hoveredIndex === bar.idx;
                const isHighlight = isSelected || isHovered;

                return (
                  <g key={`bar-group-${bar.idx}`}>
                    {/* Glowing halo for active/hovered bar */}
                    {isHighlight && (
                      <line
                        x1={bar.xBase}
                        y1={bar.yBase}
                        x2={bar.xBar}
                        y2={bar.yBar}
                        stroke={bar.barColor}
                        strokeWidth={bar.strokeWidth + 4}
                        strokeLinecap="butt"
                        className="opacity-50 animate-pulse"
                      />
                    )}

                    {/* Primary Event KM Bar with angular edges and vibrant allocation */}
                    <line
                      x1={bar.xBase}
                      y1={bar.yBase}
                      x2={bar.xBar}
                      y2={bar.yBar}
                      stroke={bar.barColor}
                      strokeWidth={isHighlight ? bar.strokeWidth + 2 : bar.strokeWidth}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-150 hover:opacity-100"
                      onMouseEnter={() => setHoveredIndex(bar.idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleSelectBar(bar.point, bar.idx)}
                    />

                    {/* Broad transparent hitbox for accurate touch and mouse interactions */}
                    <line
                      x1={bar.xBase}
                      y1={bar.yBase}
                      x2={bar.xSlot}
                      y2={bar.ySlot}
                      stroke="transparent"
                      strokeWidth={Math.max(14, bar.strokeWidth * 2)}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(bar.idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleSelectBar(bar.point, bar.idx)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tactile Neumorphic Center Hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-white border border-slate-200/90 shadow-[6px_6px_18px_#d1d9e6,-6px_-6px_18px_#ffffff] flex flex-col items-center justify-center text-center p-3 pointer-events-auto transition-transform duration-200 active:scale-95">
              {currentInspectPoint ? (
                <div className="animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                  <span
                    className="text-[9px] font-extrabold uppercase block tracking-wider"
                    style={{ color: (currentInspectPoint as any).barColor || '#2563eb' }}
                  >
                    Event #{currentInspectPoint.event_no}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 block leading-tight">
                    {currentInspectPoint.event_km}
                    <span className="text-xs font-bold text-slate-500 ml-0.5">km</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block truncate max-w-[120px]">
                    {currentInspectPoint.title || currentInspectPoint.date || 'Hike Milestone'}
                  </span>
                  <span className="text-[9px] text-emerald-700 font-extrabold block">
                    Cum: {(currentInspectPoint.cum_total_km || currentInspectPoint.total_km)?.toLocaleString()} km
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="w-6 h-6 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-0.5 shadow-2xs">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-wider">
                    Community Total
                  </span>
                  <span className="text-lg sm:text-xl font-black text-blue-600 block leading-tight">
                    {totalCumKm.toLocaleString()}
                    <span className="text-xs font-bold text-slate-500 ml-0.5">km</span>
                  </span>
                  <span className="text-[10px] text-slate-600 font-bold block">
                    {processedPoints.length} Events Winded
                  </span>
                  <span className="text-[8px] text-slate-400 block uppercase tracking-tight">
                    Tap any bar to inspect
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Helpful Guidance Hint */}
      <div className="w-full flex items-center justify-between pt-1 px-1 text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Use zoom controls or pinch / double-click to magnify dense bars. Drag to pan.</span>
        </span>
        {activePoint && (
          <button
            type="button"
            onClick={() => {
              setHoveredIndex(null);
            }}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Hub</span>
          </button>
        )}
      </div>
    </div>
  );
};
