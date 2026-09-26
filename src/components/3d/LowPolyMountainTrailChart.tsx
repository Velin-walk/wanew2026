import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Mountain,
  ArrowUp,
  ArrowDown,
  Move,
  Compass,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Sun,
  Sunset,
  Moon,
  Flame,
  Trophy,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CloudSun,
  Activity,
  Layers,
} from 'lucide-react';

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

type LightingMode = 'morning' | 'golden' | 'alpenglow' | 'night';

interface ComputedTrailNode {
  point: JourneyPoint;
  index: number;
  x: number;
  y: number;
  depthZ: number; // 0.0 = closest foreground foothill, 1.0 = farthest high-alpine zone
  spurRelief: number; // >0 = nearer protruding ridge spur, <0 = farther recessed saddle
  perspectiveScale: number;
  trailWidth: number;
  zoneLabel: string;
  isTrekEvent: boolean;
  deltaKm: number;
  milestoneKm: number | null;
  autoMilestoneKm: number | null;
  isSummit: boolean;
  isBaseCamp: boolean;
  altitudeM: number;
  altitudeGainM: number;
  steepnessPct: number;
  difficultyLabel: 'Moderate' | 'Challenging' | 'Steep Climb' | 'Extreme Alpine';
  heatColor: string;
  weatherLabel: string;
  tempC: number;
  achievements: Array<{ icon: string; label: string; color: string }>;
  routeInsight: string;
}

interface CartoonTerraceBand {
  fullBandD: string;
  sunlitLeftD: string;
  shadowRightD: string;
  rimHighlightD: string;
  sunlitFill: string;
  shadowFill: string;
  outlineColor: string;
}

interface TreeCluster {
  x: number;
  y: number;
  scale: number;
  shade: string;
  highlight: string;
  trunkColor: string;
  opacity: number;
  variant: 'pine' | 'cedar' | 'rhododendron';
}

interface HikerFigure {
  id: string;
  x: number;
  y: number;
  scale: number;
  facingRight: boolean;
  type: 'group' | 'duo' | 'solo' | 'summit';
  jacketColor: string;
  packColor: string;
  label?: string;
  animDelay: string;
}

const pseudoRand = (r: number, c: number, s: number): number => {
  const v = Math.sin(r * 127.1 + c * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Art-Directed 3D Scenic Trail Waypoints (Normalized [0..1] across the panoramic mountain range).
 */
const SCENIC_TRAIL_WAYPOINTS: Array<{
  nx: number;
  ny: number;
  spurRelief: number;
  zoneLabel: string;
}> = [
  { nx: 0.24, ny: 0.91, spurRelief: 1.0, zoneLabel: 'Foreground Valley Base (Near)' },
  { nx: 0.56, ny: 0.86, spurRelief: 0.9, zoneLabel: 'Lower Foothill Knoll (Near)' },
  { nx: 0.77, ny: 0.79, spurRelief: 0.65, zoneLabel: 'Eastern Pine Terrace' },
  { nx: 0.44, ny: 0.73, spurRelief: 0.25, zoneLabel: 'Central Forest Switchback' },
  { nx: 0.18, ny: 0.66, spurRelief: 0.75, zoneLabel: 'Sunlit Western Spur (Nearer)' },
  { nx: 0.38, ny: 0.60, spurRelief: -0.75, zoneLabel: 'Misty Valley Saddle Pass (Farther)' },
  { nx: 0.69, ny: 0.54, spurRelief: -0.45, zoneLabel: 'Deep Canyon Traverse (Farther)' },
  { nx: 0.82, ny: 0.48, spurRelief: 0.55, zoneLabel: 'Eastern Granite Cliff Ledge' },
  { nx: 0.52, ny: 0.42, spurRelief: -0.35, zoneLabel: 'High Mountain Col (Far)' },
  { nx: 0.27, ny: 0.36, spurRelief: 0.6, zoneLabel: 'Western Sub-Peak Shoulder' },
  { nx: 0.65, ny: 0.31, spurRelief: 0.3, zoneLabel: 'Upper Alpine Crest' },
  { nx: 0.44, ny: 0.26, spurRelief: 0.2, zoneLabel: 'Summit Approach Ridge' },
  { nx: 0.53, ny: 0.215, spurRelief: 0.45, zoneLabel: 'High Alpine Summit Peak' },
];

const interpolateSpline = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

export const LowPolyMountainTrailChart: React.FC<LowPolyMountainTrailChartProps> = ({
  points,
  activePoint,
  onSelectPoint,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 780,
    height: 440,
  });

  const [zoom, setZoom] = useState<number>(0.76);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  // Enhanced Visual, Atmospheric & Interactive States
  const [lightingMode, setLightingMode] = useState<LightingMode>('morning');
  const [heatMapEnabled, setHeatMapEnabled] = useState<boolean>(false);
  const [unitSystem, setUnitSystem] = useState<'km' | 'mi'>('km');
  const [isStoryPlaying, setIsStoryPlaying] = useState<boolean>(false);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const [is3DTiltEnabled, setIs3DTiltEnabled] = useState<boolean>(true);

  const triggerHaptic = useCallback((ms = 10) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // Ignore on unsupported devices
    }
  }, []);

  const formatDist = useCallback(
    (kmVal: number, decimals = 1) => {
      if (unitSystem === 'mi') {
        const mi = kmVal * 0.621371;
        return `${mi.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })} mi`;
      }
      return `${kmVal.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })} km`;
    },
    [unitSystem]
  );

  const formatAlt = useCallback(
    (meters: number) => {
      if (unitSystem === 'mi') {
        return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
      }
      return `${Math.round(meters).toLocaleString()} m`;
    },
    [unitSystem]
  );

  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
    movedDistance: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
    movedDistance: 0,
  });

  const inertiaRafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const orderedPoints = useMemo(() => {
    if (!points || points.length === 0) return [];
    const copy = [...points];
    copy.sort((a, b) => {
      const totalDiff = (a.total_km || 0) - (b.total_km || 0);
      if (totalDiff !== 0) return totalDiff;
      const numA = parseInt(String(a.event_no).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.event_no).replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    return copy;
  }, [points]);

  // Fixed Panoramic Horizon Proportions
  const { sceneWidth, sceneHeight } = useMemo(() => {
    const count = orderedPoints.length;
    const horizonExpansion = count > 80 ? 1.52 : count > 35 ? 1.42 : 1.32;
    const w = Math.max(980, Math.round(viewportSize.width * horizonExpansion));
    const h = Math.max(660, Math.min(860, Math.round(w * 0.68)));
    return { sceneWidth: w, sceneHeight: h };
  }, [viewportSize.width, orderedPoints.length]);

  const clampPan = useCallback(
    (nx: number, ny: number, targetZoom = zoom) => {
      const scaledW = sceneWidth * targetZoom;
      const scaledH = sceneHeight * targetZoom;

      const minX =
        scaledW > viewportSize.width
          ? viewportSize.width - scaledW
          : (viewportSize.width - scaledW) / 2;
      const maxX =
        scaledW > viewportSize.width ? 0 : (viewportSize.width - scaledW) / 2;

      const minY =
        scaledH > viewportSize.height
          ? viewportSize.height - scaledH
          : (viewportSize.height - scaledH) / 2;
      const maxY =
        scaledH > viewportSize.height ? 0 : (viewportSize.height - scaledH) / 2;

      return {
        x: Math.max(minX, Math.min(maxX, nx)),
        y: Math.max(minY, Math.min(maxY, ny)),
      };
    },
    [viewportSize.width, viewportSize.height, sceneWidth, sceneHeight, zoom]
  );

  const fitZoomLevel = useMemo(() => {
    const fitH = viewportSize.height / Math.max(1, sceneHeight);
    const fitW = viewportSize.width / Math.max(1, sceneWidth * 0.95);
    return Math.max(0.5, Math.min(0.92, Math.min(fitH * 0.98, fitW)));
  }, [viewportSize.height, viewportSize.width, sceneHeight, sceneWidth]);

  useEffect(() => {
    const initialZoom = Math.max(0.64, Math.min(0.84, fitZoomLevel * 1.06));
    setZoom(initialZoom);
    const scaledW = sceneWidth * initialZoom;
    const centeredX = Math.round((viewportSize.width - scaledW) / 2);
    setPan(clampPan(centeredX, 0, initialZoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneWidth, sceneHeight, viewportSize.width, orderedPoints.length]);

  useEffect(() => {
    if (orderedPoints.length > 0 && !activePoint) {
      onSelectPoint(orderedPoints[orderedPoints.length - 1]);
    }
  }, [orderedPoints, activePoint, onSelectPoint]);

  /**
   * Sculptural Multi-Peak Mountain Silhouette & Ridge Spine Geometry.
   * Defines a true pointed main summit pyramid (`nx=0.53`), a distinct western sub-peak
   * (`nx=0.26`), and a dramatic eastern granite cliff buttress (`nx=0.79`) with natural
   * concave/convex mountain slopes.
   */
  const getMountainProfileAtY = useCallback(
    (y: number) => {
      const peakApexY = sceneHeight * 0.16;
      const t = Math.max(0, Math.min(1, (y - peakApexY) / (sceneHeight - peakApexY)));

      // Natural concave-to-convex mountain slope profile (sharp alpine summit widening to sweeping foothills)
      const upperCone = Math.pow(t, 0.74);
      const westernSubPeak =
        t > 0.14
          ? Math.exp(-Math.pow((t - 0.36) / 0.19, 2)) * (sceneWidth * 0.165)
          : 0;
      const westernFoothillSweep =
        Math.exp(-Math.pow((t - 0.74) / 0.24, 2)) * (sceneWidth * 0.135);
      const easternCliffButtress =
        t > 0.18
          ? Math.exp(-Math.pow((t - 0.46) / 0.21, 2)) * (sceneWidth * 0.155)
          : 0;
      const easternValleySweep =
        Math.pow(t, 1.35) * (sceneWidth * 0.08);

      // Central main ridge arête meandering naturally down from the summit apex (0.53)
      const centerX =
        sceneWidth * 0.53 +
        Math.sin(t * Math.PI * 1.9 - 0.15) * (sceneWidth * 0.028) * Math.pow(t, 0.5);

      // Secondary western ridge arête descending from the western sub-peak
      const secondarySpurX =
        sceneWidth * 0.27 - Math.sin(t * Math.PI * 1.4) * (sceneWidth * 0.055);

      // Eastern cliff arête descending along the granite buttress
      const easternSpurX =
        sceneWidth * 0.76 + Math.sin(t * Math.PI * 1.3) * (sceneWidth * 0.045);

      // At t=0 (very peak), half-span is near zero so the summit is a real mountain peak, not a flat table!
      const baseHalfSpan = sceneWidth * 0.012 + upperCone * (sceneWidth * 0.45);
      const leftFlankX =
        centerX - baseHalfSpan * 1.06 - westernSubPeak - westernFoothillSweep;
      const rightFlankX =
        centerX + baseHalfSpan * 1.02 + easternCliffButtress + easternValleySweep;
      const halfSpan = (rightFlankX - leftFlankX) * 0.5;

      return {
        t,
        centerX,
        secondarySpurX,
        easternSpurX,
        halfSpan,
        leftFlankX,
        rightFlankX,
        peakApexY,
      };
    },
    [sceneWidth, sceneHeight]
  );

  // Sample dense smooth points along the Art-Directed Scenic Trail Spline
  const denseTrailCurve = useMemo(() => {
    const wps = SCENIC_TRAIL_WAYPOINTS;
    const samplesPerSegment = 24;
    const rawSamples: Array<{
      x: number;
      y: number;
      spurRelief: number;
      zoneLabel: string;
      arcLen: number;
    }> = [];

    let totalArc = 0;

    for (let i = 0; i < wps.length - 1; i++) {
      const p0 = wps[Math.max(0, i - 1)];
      const p1 = wps[i];
      const p2 = wps[i + 1];
      const p3 = wps[Math.min(wps.length - 1, i + 2)];

      const steps = i === wps.length - 2 ? samplesPerSegment + 1 : samplesPerSegment;
      for (let s = 0; s < steps; s++) {
        const u = s / samplesPerSegment;
        const nx = interpolateSpline(p0.nx, p1.nx, p2.nx, p3.nx, u);
        const ny = interpolateSpline(p0.ny, p1.ny, p2.ny, p3.ny, u);
        const spurRelief = interpolateSpline(
          p0.spurRelief,
          p1.spurRelief,
          p2.spurRelief,
          p3.spurRelief,
          u
        );

        const x = nx * sceneWidth;
        const y = ny * sceneHeight;

        if (rawSamples.length > 0) {
          const prev = rawSamples[rawSamples.length - 1];
          totalArc += Math.hypot(x - prev.x, y - prev.y);
        }

        rawSamples.push({
          x,
          y,
          spurRelief: Math.max(-1, Math.min(1, spurRelief)),
          zoneLabel: u < 0.5 ? p1.zoneLabel : p2.zoneLabel,
          arcLen: totalArc,
        });
      }
    }

    return { samples: rawSamples, totalArc: Math.max(1, totalArc) };
  }, [sceneWidth, sceneHeight]);

  // Evaluate position & 3D depth at any normalized progress [0..1] along the scenic trail
  const getPointOnScenicTrail = useCallback(
    (progress: number) => {
      const { samples, totalArc } = denseTrailCurve;
      if (samples.length === 0) {
        return {
          x: sceneWidth * 0.5,
          y: sceneHeight * 0.5,
          dx: 1,
          dy: -1,
          spurRelief: 0,
          depthZ: 0.5,
          perspectiveScale: 1,
          trailWidth: 10,
          zoneLabel: 'Mid-Hill Ridge',
        };
      }

      const targetArc = Math.max(0, Math.min(1, progress)) * totalArc;
      let idx = 0;
      while (idx < samples.length - 2 && samples[idx + 1].arcLen < targetArc) {
        idx++;
      }

      const s0 = samples[idx];
      const s1 = samples[Math.min(samples.length - 1, idx + 1)];
      const segLen = Math.max(0.0001, s1.arcLen - s0.arcLen);
      const frac = Math.max(0, Math.min(1, (targetArc - s0.arcLen) / segLen));

      const x = s0.x + (s1.x - s0.x) * frac;
      const y = s0.y + (s1.y - s0.y) * frac;
      const spurRelief = s0.spurRelief + (s1.spurRelief - s0.spurRelief) * frac;

      const nextSample = samples[Math.min(samples.length - 1, idx + 2)];
      const prevSample = samples[Math.max(0, idx - 1)];
      const dx = nextSample.x - prevSample.x;
      const dy = nextSample.y - prevSample.y;

      const peakApexY = sceneHeight * 0.16;
      const t = Math.max(0, Math.min(1, (y - peakApexY) / (sceneHeight - peakApexY)));

      const macroDepth = 1 - t;
      const localDepthMod = -spurRelief * 0.16 * (1 - macroDepth * 0.35);
      const depthZ = Math.max(0, Math.min(1, macroDepth * 0.85 + localDepthMod));

      const perspectiveScale = 1.24 - depthZ * 0.46;

      const baseTrailW = 4.5 + Math.pow(t, 1.22) * 20.5;
      const trailWidth = Math.max(4.2, baseTrailW * (1 + spurRelief * 0.18));

      return {
        x,
        y,
        dx,
        dy,
        spurRelief,
        depthZ,
        perspectiveScale,
        trailWidth,
        zoneLabel: frac < 0.5 ? s0.zoneLabel : s1.zoneLabel,
      };
    },
    [denseTrailCurve, sceneWidth, sceneHeight]
  );

  // Place all Hike Rest Points smoothly along the Scenic 3D Trail
  const trailNodes: ComputedTrailNode[] = useMemo(() => {
    const count = orderedPoints.length;
    if (count === 0) return [];

    const maxKm = Math.max(1, orderedPoints[count - 1]?.total_km || 1);
    const minKm = orderedPoints[0]?.total_km || 0;
    const kmSpan = Math.max(1, maxKm - minKm);

    // Choose a clean milestone step so at most ~3-4 milestone markers appear across the entire trail
    const NICE_STEPS = [
      5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000, 20000, 25000, 50000, 100000,
    ];
    const targetRawStep = kmSpan / 3.5;
    const autoStep =
      NICE_STEPS.find((s) => s >= targetRawStep) ||
      Math.ceil(targetRawStep / 50000) * 50000;
    let lastAutoBucket = Math.floor(minKm / autoStep);
    let lastMilestoneNodeIdx = -999;
    const minNodeGap = Math.max(3, Math.floor(count * 0.22));

    // Compute average delta km for steepness & route insight comparison
    const avgDeltaKm = Math.max(1, kmSpan / Math.max(1, count - 1));

    const WEATHER_TYPES = [
      'Crisp Alpine Sun',
      'Clear Ridge Breeze',
      'Highland Morning Mist',
      'Golden Valley Glow',
      'Brisk Mountain Wind',
      'Crystal Summit Sky',
    ];

    return orderedPoints.map((pt, idx) => {
      const prevPt = idx > 0 ? orderedPoints[idx - 1] : null;
      const indexRatio = count > 1 ? idx / (count - 1) : 1;
      const kmRatio = Math.max(0, Math.min(1, ((pt.total_km || 0) - minKm) / kmSpan));

      const progress = indexRatio * 0.86 + kmRatio * 0.14;
      const sample = getPointOnScenicTrail(progress);

      const prevTrekKm = prevPt ? prevPt.trek_km || 0 : 0;
      const currTrekKm = pt.trek_km || 0;
      const isTrekEvent = currTrekKm > prevTrekKm;

      const prevTotalKm = prevPt ? prevPt.total_km || 0 : 0;
      const deltaKm = Math.max(0, (pt.total_km || 0) - prevTotalKm);

      const currAutoBucket = Math.floor((pt.total_km || 0) / autoStep);
      let milestoneKm: number | null = null;
      let autoMilestoneKm: number | null = null;
      if (
        currAutoBucket > lastAutoBucket &&
        idx > 1 &&
        idx < count - 2 &&
        idx - lastMilestoneNodeIdx >= minNodeGap
      ) {
        autoMilestoneKm = currAutoBucket * autoStep;
        milestoneKm = autoMilestoneKm;
        lastAutoBucket = currAutoBucket;
        lastMilestoneNodeIdx = idx;
      } else if (currAutoBucket > lastAutoBucket) {
        lastAutoBucket = currAutoBucket;
      }

      // Realistic Himalayan altitude profile (1,400m Kathmandu Valley Base -> 5,364m Everest Base/Kala Patthar Ridge)
      const altitudeM = Math.round(1400 + Math.pow(progress, 1.08) * 3964);
      const prevProgress =
        idx > 0
          ? ((idx - 1) / Math.max(1, count - 1)) * 0.86 +
            Math.max(0, Math.min(1, (prevTotalKm - minKm) / kmSpan)) * 0.14
          : 0;
      const prevAltitudeM = idx > 0 ? Math.round(1400 + Math.pow(prevProgress, 1.08) * 3964) : 1400;
      const altitudeGainM = Math.max(25, altitudeM - prevAltitudeM);

      // Steepness % combining relative hike distance intensity and mountain slope
      const intensityRatio = deltaKm / Math.max(0.5, avgDeltaKm);
      const rawSteepness = Math.round(
        11 + progress * 14 + Math.min(24, intensityRatio * 9.5) + (isTrekEvent ? 6 : 0)
      );
      const steepnessPct = Math.max(8, Math.min(48, rawSteepness));

      let difficultyLabel: ComputedTrailNode['difficultyLabel'] = 'Moderate';
      let heatColor = '#34D399'; // Emerald moderate
      if (steepnessPct >= 34) {
        difficultyLabel = 'Extreme Alpine';
        heatColor = '#F43F5E'; // Crimson-rose extreme
      } else if (steepnessPct >= 25) {
        difficultyLabel = 'Steep Climb';
        heatColor = '#F97316'; // Fiery orange steep
      } else if (steepnessPct >= 18) {
        difficultyLabel = 'Challenging';
        heatColor = '#FACC15'; // Warm amber challenging
      }

      // Deterministic weather & alpine temperature lapse rate (-6.5°C per 1000m)
      const weatherIdx = Math.floor(pseudoRand(idx + 1, Math.round(pt.total_km || 1), 7) * WEATHER_TYPES.length);
      const weatherLabel =
        idx === count - 1
          ? 'Crystal Summit Sky'
          : WEATHER_TYPES[weatherIdx % WEATHER_TYPES.length];
      const tempC = Math.round(21 - ((altitudeM - 1400) / 1000) * 6.2);

      // Achievement Badges for this node
      const achievements: Array<{ icon: string; label: string; color: string }> = [];
      if (idx === count - 1) {
        achievements.push({
          icon: '🏔️',
          label: 'Summit Conqueror',
          color: '#A3E635',
        });
      }
      if (idx === 0) {
        achievements.push({
          icon: '🏕️',
          label: 'Trailhead Pioneer',
          color: '#34D399',
        });
      }
      if (milestoneKm || autoMilestoneKm) {
        achievements.push({
          icon: '🏆',
          label: `${(milestoneKm || autoMilestoneKm || 0).toLocaleString()} KM Milestone`,
          color: '#FACC15',
        });
      }
      if (isTrekEvent) {
        achievements.push({
          icon: '🥾',
          label: 'Multi-Day Trek',
          color: '#FB923C',
        });
      }
      if (steepnessPct >= 28) {
        achievements.push({
          icon: '🔥',
          label: 'Steep Ridge Climber',
          color: '#F43F5E',
        });
      } else if (achievements.length === 0) {
        achievements.push({
          icon: '⚡',
          label: 'Steady Ridge Cadence',
          color: '#38BDF8',
        });
      }

      const diffFromAvgPct = Math.round(((deltaKm - avgDeltaKm) / Math.max(0.5, avgDeltaKm)) * 100);
      const routeInsight =
        diffFromAvgPct > 18
          ? `Climbed +${diffFromAvgPct}% above average hike distance on this ridge section`
          : diffFromAvgPct < -18
          ? `Recovery cadence (${Math.abs(diffFromAvgPct)}% lighter load before next ascent)`
          : `Optimal steady ascent pace (+${altitudeGainM}m vertical gain)`;

      return {
        point: pt,
        index: idx,
        x: sample.x,
        y: sample.y,
        depthZ: sample.depthZ,
        spurRelief: sample.spurRelief,
        perspectiveScale: sample.perspectiveScale,
        trailWidth: sample.trailWidth,
        zoneLabel:
          idx === count - 1
            ? 'High Alpine Summit Peak'
            : idx === 0
            ? 'Foreground Valley Trailhead'
            : sample.zoneLabel,
        isTrekEvent,
        deltaKm,
        milestoneKm,
        autoMilestoneKm,
        isSummit: idx === count - 1,
        isBaseCamp: idx === 0,
        altitudeM,
        altitudeGainM,
        steepnessPct,
        difficultyLabel,
        heatColor,
        weatherLabel,
        tempC,
        achievements,
        routeInsight,
      };
    });
  }, [orderedPoints, getPointOnScenicTrail]);

  // Generate Lively Solo Hikers & Trekking Groups Along the Trail
  const hikerFigures: HikerFigure[] = useMemo(() => {
    const specs: Array<{
      progress: number;
      type: 'group' | 'duo' | 'solo' | 'summit';
      jacketColor: string;
      packColor: string;
      label?: string;
      animDelay: string;
    }> = [
      {
        progress: 0.06,
        type: 'group',
        jacketColor: '#F97316',
        packColor: '#FACC15',
        label: 'Morning Trail Group',
        animDelay: '0s',
      },
      {
        progress: 0.19,
        type: 'solo',
        jacketColor: '#38BDF8',
        packColor: '#E2E8F0',
        animDelay: '0.4s',
      },
      {
        progress: 0.33,
        type: 'group',
        jacketColor: '#EC4899',
        packColor: '#A8E063',
        label: 'Ridge Caravan',
        animDelay: '0.9s',
      },
      {
        progress: 0.47,
        type: 'duo',
        jacketColor: '#FACC15',
        packColor: '#FB923C',
        animDelay: '0.2s',
      },
      {
        progress: 0.61,
        type: 'solo',
        jacketColor: '#A3E635',
        packColor: '#38BDF8',
        animDelay: '1.1s',
      },
      {
        progress: 0.75,
        type: 'group',
        jacketColor: '#FB7185',
        packColor: '#FDE047',
        label: 'Alpine Team',
        animDelay: '0.6s',
      },
      {
        progress: 0.88,
        type: 'solo',
        jacketColor: '#22D3EE',
        packColor: '#F97316',
        animDelay: '0.3s',
      },
      {
        progress: 0.985,
        type: 'summit',
        jacketColor: '#C4ED39',
        packColor: '#F97316',
        animDelay: '0s',
      },
    ];

    return specs.map((sp, i) => {
      const pos = getPointOnScenicTrail(sp.progress);
      return {
        id: `hiker-${i}`,
        x: pos.x,
        y: pos.y,
        scale: pos.perspectiveScale,
        facingRight: pos.dx >= 0,
        type: sp.type,
        jacketColor: sp.jacketColor,
        packColor: sp.packColor,
        label: sp.label,
        animDelay: sp.animDelay,
      };
    });
  }, [getPointOnScenicTrail]);

  // Build Vibrant Cartoon Hill Massif, Rounded Snow Caps, Layered Meadow Terraces, Waterfall, Cartoon Forest & Trail
  const {
    distantSnowPeaks,
    cartoonClouds,
    flankingHillLayers,
    mountainBaseHullD,
    mountainLeftSunlitD,
    mountainRightShadowD,
    cartoonHillTerraces,
    cartoonSnowCap,
    cartoonBoulders,
    cartoonGrassTufts,
    centralCartoonRidgeD,
    alpineStreamPaths,
    treeClusters,
    mistBands,
    trailSegments,
  } = useMemo(() => {
    const peakApexY = sceneHeight * 0.16;
    const totalMeshHeight = sceneHeight - peakApexY + 38;

    // -------------------------------------------------------------------------
    // 1. Cartoon Rounded Distant Snow-Capped Hills & Puffy Clouds
    // -------------------------------------------------------------------------
    const horizonBaseY = sceneHeight * 0.58;
    const distantPeaksConfig = [
      { apexX: sceneWidth * 0.08, apexY: peakApexY + 38, leftX: -70, rightX: sceneWidth * 0.24 },
      { apexX: sceneWidth * 0.23, apexY: peakApexY + 12, leftX: sceneWidth * 0.08, rightX: sceneWidth * 0.40 },
      { apexX: sceneWidth * 0.38, apexY: peakApexY + 46, leftX: sceneWidth * 0.24, rightX: sceneWidth * 0.52 },
      { apexX: sceneWidth * 0.73, apexY: peakApexY + 10, leftX: sceneWidth * 0.53, rightX: sceneWidth * 0.90 },
      { apexX: sceneWidth * 0.90, apexY: peakApexY + 32, leftX: sceneWidth * 0.74, rightX: sceneWidth + 70 },
    ];

    const distantSnowPeaks = distantPeaksConfig.map((pk) => {
      const span = pk.rightX - pk.leftX;
      const fullDomeD = `
        M ${pk.leftX.toFixed(1)} ${horizonBaseY.toFixed(1)}
        Q ${(pk.leftX + span * 0.22).toFixed(1)} ${(pk.apexY + 18).toFixed(1)}, ${pk.apexX.toFixed(1)} ${pk.apexY.toFixed(1)}
        Q ${(pk.rightX - span * 0.22).toFixed(1)} ${(pk.apexY + 18).toFixed(1)}, ${pk.rightX.toFixed(1)} ${horizonBaseY.toFixed(1)}
        Z
      `;
      const shadowRightD = `
        M ${pk.apexX.toFixed(1)} ${pk.apexY.toFixed(1)}
        Q ${(pk.rightX - span * 0.22).toFixed(1)} ${(pk.apexY + 18).toFixed(1)}, ${pk.rightX.toFixed(1)} ${horizonBaseY.toFixed(1)}
        L ${(pk.apexX + 10).toFixed(1)} ${horizonBaseY.toFixed(1)}
        Q ${(pk.apexX - 6).toFixed(1)} ${((pk.apexY + horizonBaseY) * 0.5).toFixed(1)}, ${pk.apexX.toFixed(1)} ${pk.apexY.toFixed(1)}
        Z
      `;
      const snowBotY = pk.apexY + (horizonBaseY - pk.apexY) * 0.36;
      const snowLeftX = pk.apexX - span * 0.19;
      const snowRightX = pk.apexX + span * 0.19;
      const snowCapD = `
        M ${snowLeftX.toFixed(1)} ${snowBotY.toFixed(1)}
        Q ${(snowLeftX + (pk.apexX - snowLeftX) * 0.35).toFixed(1)} ${(pk.apexY + 6).toFixed(1)}, ${pk.apexX.toFixed(1)} ${pk.apexY.toFixed(1)}
        Q ${(pk.apexX + (snowRightX - pk.apexX) * 0.65).toFixed(1)} ${(pk.apexY + 6).toFixed(1)}, ${snowRightX.toFixed(1)} ${snowBotY.toFixed(1)}
        Q ${(pk.apexX + span * 0.1).toFixed(1)} ${(snowBotY + 14).toFixed(1)}, ${pk.apexX.toFixed(1)} ${(snowBotY - 3).toFixed(1)}
        Q ${(pk.apexX - span * 0.1).toFixed(1)} ${(snowBotY + 14).toFixed(1)}, ${snowLeftX.toFixed(1)} ${snowBotY.toFixed(1)}
        Z
      `;
      return { fullDomeD, shadowRightD, snowCapD };
    });

    const cartoonClouds = [
      { cx: sceneWidth * 0.15, cy: peakApexY - 6, scale: 1.05, opacity: 0.88 },
      { cx: sceneWidth * 0.36, cy: peakApexY - 22, scale: 0.82, opacity: 0.78 },
      { cx: sceneWidth * 0.69, cy: peakApexY - 14, scale: 0.95, opacity: 0.85 },
      { cx: sceneWidth * 0.88, cy: peakApexY + 8, scale: 0.78, opacity: 0.75 },
    ];

    // -------------------------------------------------------------------------
    // 2. Lush Cartoon Rolling Flanking Valley Hills
    // -------------------------------------------------------------------------
    const flankingHillLayers = [
      {
        d: `M -60 ${sceneHeight * 0.68}
            Q ${sceneWidth * 0.08} ${peakApexY + 95}, ${sceneWidth * 0.22} ${sceneHeight * 0.43}
            T ${sceneWidth * 0.44} ${sceneHeight * 0.68}
            L -60 ${sceneHeight * 0.68} Z`,
        fill: 'url(#flankHillLeftFar)',
        stroke: '#163A24',
        opacity: 0.94,
      },
      {
        d: `M ${sceneWidth * 0.56} ${sceneHeight * 0.68}
            Q ${sceneWidth * 0.78} ${sceneHeight * 0.40}, ${sceneWidth * 0.92} ${peakApexY + 105}
            T ${sceneWidth + 60} ${sceneHeight * 0.68}
            Z`,
        fill: 'url(#flankHillRightFar)',
        stroke: '#123020',
        opacity: 0.92,
      },
      {
        d: `M -60 ${sceneHeight}
            L -60 ${sceneHeight * 0.53}
            Q ${sceneWidth * 0.12} ${sceneHeight * 0.40}, ${sceneWidth * 0.29} ${sceneHeight * 0.60}
            T ${sceneWidth * 0.49} ${sceneHeight}
            Z`,
        fill: 'url(#flankHillLeftNear)',
        stroke: '#143818',
        opacity: 0.98,
      },
      {
        d: `M ${sceneWidth * 0.53} ${sceneHeight}
            Q ${sceneWidth * 0.74} ${sceneHeight * 0.56}, ${sceneWidth * 0.88} ${sceneHeight * 0.45}
            T ${sceneWidth + 60} ${sceneHeight * 0.55}
            L ${sceneWidth + 60} ${sceneHeight}
            Z`,
        fill: 'url(#flankHillRightNear)',
        stroke: '#0F2E14',
        opacity: 0.98,
      },
    ];

    // -------------------------------------------------------------------------
    // 3. Main Cartoon Hill Silhouette & Layered Scalloped Meadow Terraces
    // -------------------------------------------------------------------------
    const numRows = 38;
    const rowStep = totalMeshHeight / numRows;
    const numCols = 28;
    const mainSpineCol = 15;
    const westPeakCol = 6;
    const eastButtressCol = 22;

    const grid: Array<
      Array<{
        x: number;
        y: number;
        normX: number;
        normY: number;
        distToStream: number;
      }>
    > = [];

    for (let r = 0; r <= numRows; r++) {
      const rowNormY = r / numRows;
      const baseY = peakApexY + r * rowStep;
      const {
        centerX,
        secondarySpurX,
        easternSpurX,
        leftFlankX,
        rightFlankX,
      } = getMountainProfileAtY(baseY);

      const row: Array<{
        x: number;
        y: number;
        normX: number;
        normY: number;
        distToStream: number;
      }> = [];

      for (let c = 0; c <= numCols; c++) {
        const colNormX = c / numCols;

        // Smooth rounded cartoon dome crown at r === 0
        if (r === 0) {
          const apexWidth = sceneWidth * 0.048;
          const x = centerX + (colNormX - 0.53) * apexWidth;
          const domeArc = Math.pow((colNormX - 0.53) * 2, 2) * 11;
          const y = peakApexY + domeArc;
          row.push({ x, y, normX: colNormX, normY: rowNormY, distToStream: 1 });
          continue;
        }

        let baseX: number;
        if (c <= westPeakCol) {
          const u = c / westPeakCol;
          baseX = leftFlankX + u * (secondarySpurX - leftFlankX);
        } else if (c <= mainSpineCol) {
          const u = (c - westPeakCol) / (mainSpineCol - westPeakCol);
          baseX = secondarySpurX + u * (centerX - secondarySpurX);
        } else if (c <= eastButtressCol) {
          const u = (c - mainSpineCol) / (eastButtressCol - mainSpineCol);
          baseX = centerX + u * (easternSpurX - centerX);
        } else {
          const u = (c - eastButtressCol) / (numCols - eastButtressCol);
          baseX = easternSpurX + u * (rightFlankX - easternSpurX);
        }

        // Smooth rounded cartoon hill bumps on the Western Sub-Peak & Eastern Shoulder
        let ridgeCrownLiftY = 0;
        if (rowNormY > 0.10 && rowNormY < 0.52) {
          const westProximity = Math.exp(-Math.pow((colNormX - 0.22) / 0.11, 2));
          const westElevWindow = Math.exp(-Math.pow((rowNormY - 0.25) / 0.12, 2));
          ridgeCrownLiftY -= westProximity * westElevWindow * 30;

          const eastProximity = Math.exp(-Math.pow((colNormX - 0.78) / 0.11, 2));
          const eastElevWindow = Math.exp(-Math.pow((rowNormY - 0.34) / 0.13, 2));
          ridgeCrownLiftY -= eastProximity * eastElevWindow * 24;
        }

        // Gentle organic wave on outer flanks so the cartoon hill has soft rolling contours
        const flankBulgeX =
          (c === 0 ? -1 : c === numCols ? 1 : 0) *
          Math.sin(rowNormY * Math.PI * 4.5) *
          10;

        const x = baseX + flankBulgeX;
        const y = baseY + ridgeCrownLiftY;

        const streamNormX = 0.47 + rowNormY * 0.15 + Math.sin(rowNormY * Math.PI * 3) * 0.025;
        const distToStream = Math.abs(colNormX - streamNormX);

        row.push({ x, y, normX: colNormX, normY: rowNormY, distToStream });
      }
      grid.push(row);
    }

    const buildSmoothPolylineD = (pts: Array<{ x: number; y: number }>, moveFirst = true) => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `${moveFirst ? 'M' : 'L'} ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      let d = `${moveFirst ? 'M' : 'L'} ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = ((p0.x + p1.x) * 0.5).toFixed(1);
        const my = ((p0.y + p1.y) * 0.5).toFixed(1);
        d += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}, ${mx} ${my}`;
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      return d;
    };

    const leftOuterNodes = grid.map((r) => ({ x: r[0].x, y: r[0].y }));
    const topDomeNodes = grid[0].map((c) => ({ x: c.x, y: c.y }));
    const rightOuterNodes = grid.map((r) => ({ x: r[numCols].x, y: r[numCols].y }));
    const spineNodes = grid.map((r) => ({ x: r[mainSpineCol].x, y: r[mainSpineCol].y }));

    const leftUpD = buildSmoothPolylineD([...leftOuterNodes].reverse(), true);
    const topAcrossD = buildSmoothPolylineD(topDomeNodes, false);
    const rightDownD = buildSmoothPolylineD(rightOuterNodes, false);
    const spineDownD = buildSmoothPolylineD(spineNodes, false);
    const spineUpD = buildSmoothPolylineD([...spineNodes].reverse(), false);

    const mountainBaseHullD = `${leftUpD} ${topAcrossD} ${rightDownD} Z`;
    const mountainLeftSunlitD = `${leftUpD} ${ buildSmoothPolylineD(topDomeNodes.slice(0, mainSpineCol + 1), false)} ${spineDownD} Z`;
    const mountainRightShadowD = `${buildSmoothPolylineD(spineNodes, true)} L ${rightOuterNodes[rightOuterNodes.length - 1].x.toFixed(1)} ${rightOuterNodes[rightOuterNodes.length - 1].y.toFixed(1)} ${buildSmoothPolylineD([...rightOuterNodes].reverse(), false)} ${buildSmoothPolylineD([...topDomeNodes.slice(mainSpineCol)].reverse(), false)} Z`;
    const centralCartoonRidgeD = buildSmoothPolylineD(spineNodes, true);

    // Build 6 Lush Layered Cartoon Meadow Terraces (Painter's Order: Bottom to Top so each upper terrace's scalloped wavy edge overlaps below)
    const terraceSpecs = [
      {
        startRow: 28,
        endRow: 38,
        lobes: 7,
        amp: 16,
        sunlitFill: '#4D9E2A',
        shadowFill: '#246621',
        outlineColor: '#133C16',
      },
      {
        startRow: 22,
        endRow: 31,
        lobes: 6,
        amp: 15,
        sunlitFill: '#62B62C',
        shadowFill: '#2D7A27',
        outlineColor: '#17461A',
      },
      {
        startRow: 16,
        endRow: 25,
        lobes: 6,
        amp: 14,
        sunlitFill: '#78C82E',
        shadowFill: '#378E2D',
        outlineColor: '#1B521E',
      },
      {
        startRow: 11,
        endRow: 19,
        lobes: 5,
        amp: 13,
        sunlitFill: '#8FD932',
        shadowFill: '#43A136',
        outlineColor: '#215E22',
      },
      {
        startRow: 6,
        endRow: 13,
        lobes: 5,
        amp: 12,
        sunlitFill: '#A8E638',
        shadowFill: '#53B343',
        outlineColor: '#286B27',
      },
      {
        startRow: 2,
        endRow: 8,
        lobes: 4,
        amp: 10,
        sunlitFill: '#C2F252',
        shadowFill: '#67C454',
        outlineColor: '#31782E',
      },
    ];

    const cartoonHillTerraces: CartoonTerraceBand[] = terraceSpecs.map((spec, idx) => {
      const rTop = spec.startRow;
      const rBot = spec.endRow;

      // Top contour across the hill at rTop (with gentle cartoon hillock wave)
      const topPts: Array<{ x: number; y: number }> = [];
      for (let c = 0; c <= numCols; c++) {
        const p = grid[rTop][c];
        const waveY = Math.sin((c / numCols) * Math.PI * spec.lobes + idx) * (spec.amp * 0.45);
        topPts.push({ x: p.x, y: p.y + waveY });
      }

      // Bottom scalloped cartoon meadow drape at rBot
      const botPts: Array<{ x: number; y: number }> = [];
      for (let c = 0; c <= numCols; c++) {
        const p = grid[rBot][c];
        const scallopY =
          rBot >= numRows
            ? 0
            : Math.abs(Math.sin((c / numCols) * Math.PI * spec.lobes + idx * 0.7)) * spec.amp;
        botPts.push({ x: p.x, y: p.y + scallopY });
      }

      const leftSidePts: Array<{ x: number; y: number }> = [];
      for (let r = rTop; r <= rBot; r++) {
        leftSidePts.push({ x: grid[r][0].x, y: grid[r][0].y });
      }

      const rightSidePts: Array<{ x: number; y: number }> = [];
      for (let r = rTop; r <= rBot; r++) {
        rightSidePts.push({ x: grid[r][numCols].x, y: grid[r][numCols].y });
      }

      const spineBandPts: Array<{ x: number; y: number }> = [];
      for (let r = rTop; r <= rBot; r++) {
        spineBandPts.push({ x: grid[r][mainSpineCol].x, y: grid[r][mainSpineCol].y });
      }

      const fullBandD = `${buildSmoothPolylineD(topPts, true)} ${buildSmoothPolylineD(
        rightSidePts,
        false
      )} ${buildSmoothPolylineD([...botPts].reverse(), false)} ${buildSmoothPolylineD(
        [...leftSidePts].reverse(),
        false
      )} Z`;

      const sunlitLeftD = `${buildSmoothPolylineD(
        topPts.slice(0, mainSpineCol + 1),
        true
      )} ${buildSmoothPolylineD(spineBandPts, false)} ${buildSmoothPolylineD(
        [...botPts.slice(0, mainSpineCol + 1)].reverse(),
        false
      )} ${buildSmoothPolylineD([...leftSidePts].reverse(), false)} Z`;

      const shadowRightD = `${buildSmoothPolylineD(
        topPts.slice(mainSpineCol),
        true
      )} ${buildSmoothPolylineD(rightSidePts, false)} ${buildSmoothPolylineD(
        [...botPts.slice(mainSpineCol)].reverse(),
        false
      )} ${buildSmoothPolylineD([...spineBandPts].reverse(), false)} Z`;

      const rimHighlightD = buildSmoothPolylineD(
        botPts.slice(1, Math.max(2, mainSpineCol + 2)),
        true
      );

      return {
        fullBandD,
        sunlitLeftD,
        shadowRightD,
        rimHighlightD,
        sunlitFill: spec.sunlitFill,
        shadowFill: spec.shadowFill,
        outlineColor: spec.outlineColor,
      };
    });

    // Cartoon Rounded Snow-Cap Crown at the Summit (r = 0..5)
    const snowRow = 5;
    const snowLeftFlank = grid.slice(0, snowRow + 1).map((r) => ({ x: r[0].x, y: r[0].y }));
    const snowRightFlank = grid.slice(0, snowRow + 1).map((r) => ({ x: r[numCols].x, y: r[numCols].y }));
    const snowSpine = grid.slice(0, snowRow + 1).map((r) => ({ x: r[mainSpineCol].x, y: r[mainSpineCol].y }));
    const snowBottomScallop: Array<{ x: number; y: number }> = [];
    for (let c = 0; c <= numCols; c++) {
      const p = grid[snowRow][c];
      const drip = Math.abs(Math.sin((c / numCols) * Math.PI * 4.5)) * 14;
      snowBottomScallop.push({ x: p.x, y: p.y + drip });
    }

    const cartoonSnowCap = {
      fullD: `${buildSmoothPolylineD([...snowLeftFlank].reverse(), true)} ${buildSmoothPolylineD(
        topDomeNodes,
        false
      )} ${buildSmoothPolylineD(snowRightFlank, false)} ${buildSmoothPolylineD(
        [...snowBottomScallop].reverse(),
        false
      )} Z`,
      shadowD: `${buildSmoothPolylineD(
        topDomeNodes.slice(mainSpineCol),
        true
      )} ${buildSmoothPolylineD(snowRightFlank, false)} ${buildSmoothPolylineD(
        [...snowBottomScallop.slice(mainSpineCol)].reverse(),
        false
      )} ${buildSmoothPolylineD([...snowSpine].reverse(), false)} Z`,
      bottomWaveD: buildSmoothPolylineD(snowBottomScallop, true),
    };

    // Cartoon Rounded Boulders & Cliff Outcrops
    const cartoonBoulders = [
      { x: grid[10][4].x, y: grid[10][4].y, rx: 22, ry: 12 },
      { x: grid[14][23].x, y: grid[14][23].y, rx: 26, ry: 14 },
      { x: grid[19][24].x, y: grid[19][24].y, rx: 22, ry: 12 },
      { x: grid[23][5].x, y: grid[23][5].y, rx: 19, ry: 10 },
      { x: grid[28][21].x, y: grid[28][21].y, rx: 24, ry: 12 },
    ];

    // Cartoon Grass Tufts & Meadow Wildflowers
    const cartoonGrassTufts: Array<{
      x: number;
      y: number;
      scale: number;
      hasFlower: boolean;
      flowerColor: string;
    }> = [];
    for (let r = 8; r <= numRows - 2; r += 3) {
      for (let c = 2; c <= numCols - 2; c += 3) {
        if (pseudoRand(r, c, 33) < 0.52) continue;
        const v = grid[r][c];
        if (v.distToStream < 0.06) continue;
        const sc = 0.65 + (r / numRows) * 0.7;
        const flowerSeed = pseudoRand(r, c, 44);
        cartoonGrassTufts.push({
          x: v.x,
          y: v.y,
          scale: sc,
          hasFlower: flowerSeed > 0.62,
          flowerColor: flowerSeed > 0.82 ? '#FDE047' : '#FB7185',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 4. Cascading Alpine Glacial Stream & Waterfall in the Central-Right Ravine
    // -------------------------------------------------------------------------
    const streamPts: Array<{ x: number; y: number }> = [];
    for (let r = 6; r <= numRows - 1; r++) {
      const rn = r / numRows;
      const streamColFloat =
        (0.47 + rn * 0.15 + Math.sin(rn * Math.PI * 3) * 0.025) * numCols;
      const cIdx = Math.max(1, Math.min(numCols - 1, Math.round(streamColFloat)));
      const v = grid[r][cIdx];
      streamPts.push({ x: v.x, y: v.y });
    }
    const alpineStreamPaths = {
      mainD: buildSmoothPolylineD(streamPts, true),
    };

    // -------------------------------------------------------------------------
    // 5. Cartoon Pine, Cedar & Blooming Rhododendron Trees
    // -------------------------------------------------------------------------
    const treeClusters: TreeCluster[] = [];
    for (let r = 6; r < numRows - 1; r++) {
      const rowNormY = r / numRows;
      if (rowNormY < 0.24) continue;

      for (let c = 1; c < numCols - 1; c++) {
        const seed = pseudoRand(r, c, 77);
        const densityThreshold = rowNormY > 0.68 ? 0.56 : 0.74;
        if (seed < densityThreshold) continue;

        const v = grid[r][c];
        if (v.normX > 0.66 && rowNormY < 0.70) continue;
        if (v.distToStream < 0.045) continue;

        const scale = 0.58 + Math.pow(rowNormY, 1.35) * 1.28;
        const isSunlit = v.normX < 0.53;
        const variantSeed = pseudoRand(r, c, 91);
        const variant: 'pine' | 'cedar' | 'rhododendron' =
          variantSeed > 0.80 && rowNormY > 0.44
            ? 'rhododendron'
            : variantSeed > 0.42
            ? 'pine'
            : 'cedar';

        treeClusters.push({
          x: v.x,
          y: v.y,
          scale,
          shade: isSunlit ? '#1B5E20' : '#0F3B15',
          highlight:
            variant === 'rhododendron'
              ? '#FB7185'
              : isSunlit
              ? '#84CC16'
              : '#388E3C',
          trunkColor: '#5D4037',
          opacity: 0.78 + rowNormY * 0.22,
          variant,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 6. Luminous Atmospheric Valley Mist & Cloud Bands
    // -------------------------------------------------------------------------
    const mistBands = [
      {
        cx: sceneWidth * 0.24,
        cy: peakApexY + totalMeshHeight * 0.27,
        rx: sceneWidth * 0.25,
        ry: 28,
        opacity: 0.22,
      },
      {
        cx: sceneWidth * 0.52,
        cy: peakApexY + totalMeshHeight * 0.55,
        rx: sceneWidth * 0.34,
        ry: 38,
        opacity: 0.24,
      },
      {
        cx: sceneWidth * 0.78,
        cy: peakApexY + totalMeshHeight * 0.42,
        rx: sceneWidth * 0.25,
        ry: 28,
        opacity: 0.18,
      },
      {
        cx: sceneWidth * 0.34,
        cy: peakApexY + totalMeshHeight * 0.77,
        rx: sceneWidth * 0.36,
        ry: 40,
        opacity: 0.16,
      },
    ];

    // -------------------------------------------------------------------------
    // 7. 3D Scenic Trail Ribbon Segments
    // -------------------------------------------------------------------------
    const trailSegments: Array<{
      ribbonD: string;
      cliffWallD: string;
      centerLineD: string;
      isNearSpur: boolean;
    }> = [];

    const totalSamples = 145;
    const sampledPoints: Array<{
      x: number;
      y: number;
      w: number;
      depthZ: number;
      spurRelief: number;
    }> = [];

    const firstPos = getPointOnScenicTrail(0);
    sampledPoints.push({
      x: firstPos.x - 34,
      y: sceneHeight + 12,
      w: firstPos.trailWidth * 1.25,
      depthZ: 0,
      spurRelief: 1,
    });

    for (let s = 0; s <= totalSamples; s++) {
      const u = s / totalSamples;
      const pt = getPointOnScenicTrail(u);
      sampledPoints.push({
        x: pt.x,
        y: pt.y,
        w: pt.trailWidth,
        depthZ: pt.depthZ,
        spurRelief: pt.spurRelief,
      });
    }

    const chunkSize = 14;
    for (let start = 0; start < sampledPoints.length - 1; start += chunkSize) {
      const slice = sampledPoints.slice(
        start,
        Math.min(sampledPoints.length, start + chunkSize + 1)
      );
      if (slice.length < 2) continue;

      const leftEdge: string[] = [];
      const rightEdge: string[] = [];
      const cliffUnderside: string[] = [];
      const bottomEdgeStart: string[] = [];
      let centerLineD = '';

      const avgDepth = slice.reduce((acc, p) => acc + p.depthZ, 0) / slice.length;
      const avgRelief = slice.reduce((acc, p) => acc + p.spurRelief, 0) / slice.length;
      const cliffDepthPx = Math.max(2.2, (1 - avgDepth * 0.55) * (5.2 + avgRelief * 1.8));

      slice.forEach((pt, idx) => {
        const hw = pt.w / 2;
        const lx = (pt.x - hw).toFixed(1);
        const rx = (pt.x + hw).toFixed(1);
        const py = pt.y.toFixed(1);

        leftEdge.push(`${idx === 0 ? 'M' : 'L'} ${lx} ${py}`);
        rightEdge.unshift(`L ${rx} ${py}`);

        bottomEdgeStart.push(
          `${idx === 0 ? 'M' : 'L'} ${(pt.x - hw).toFixed(1)} ${(pt.y + cliffDepthPx * 0.78).toFixed(1)}`
        );
        cliffUnderside.push(
          `L ${(pt.x + hw + cliffDepthPx * 0.45).toFixed(1)} ${(pt.y + cliffDepthPx).toFixed(1)}`
        );

        centerLineD += `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${py} `;
      });

      trailSegments.push({
        ribbonD: `${leftEdge.join(' ')} ${rightEdge.join(' ')} Z`,
        cliffWallD: `${bottomEdgeStart.join(' ')} ${cliffUnderside.reverse().join(' ')} Z`,
        centerLineD,
        isNearSpur: avgRelief >= -0.1,
      });
    }

    return {
      distantSnowPeaks,
      cartoonClouds,
      flankingHillLayers,
      mountainBaseHullD,
      mountainLeftSunlitD,
      mountainRightShadowD,
      cartoonHillTerraces,
      cartoonSnowCap,
      cartoonBoulders,
      cartoonGrassTufts,
      centralCartoonRidgeD,
      alpineStreamPaths,
      treeClusters,
      mistBands,
      trailSegments,
    };
  }, [sceneHeight, sceneWidth, getMountainProfileAtY, getPointOnScenicTrail]);

  const stopInertia = () => {
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag="true"]')) return;

    stopInertia();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      movedDistance: 0,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;

    const now = performance.now();
    const dt = Math.max(1, now - st.lastTime);
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    const stepX = e.clientX - st.lastX;
    const stepY = e.clientY - st.lastY;

    st.vx = stepX / dt;
    st.vy = stepY / dt;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.lastTime = now;
    st.movedDistance = Math.hypot(dx, dy);

    const next = clampPan(st.startPanX + dx, st.startPanY + dy, zoom);
    setPan(next);

    setTilt({
      rx: Math.max(-2.2, Math.min(2.2, -stepY * 0.11)),
      ry: Math.max(-2.8, Math.min(2.8, stepX * 0.13)),
    });
  };

  const handlePointerUpOrCancel = () => {
    const st = dragStateRef.current;
    if (!st.active) return;
    st.active = false;
    setIsDragging(false);
    setTilt({ rx: 0, ry: 0 });

    let vx = st.vx * 16;
    let vy = st.vy * 16;

    if (Math.hypot(vx, vy) > 0.8) {
      const stepInertia = () => {
        vx *= 0.91;
        vy *= 0.91;
        if (Math.hypot(vx, vy) < 0.35) {
          inertiaRafRef.current = null;
          return;
        }
        setPan((prev) => clampPan(prev.x + vx, prev.y + vy, zoom));
        inertiaRafRef.current = requestAnimationFrame(stepInertia);
      };
      inertiaRafRef.current = requestAnimationFrame(stepInertia);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    stopInertia();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const nextZoom = Math.max(0.48, Math.min(1.38, zoom - e.deltaY * 0.0015));
      setZoom(nextZoom);
      setPan((prev) => clampPan(prev.x, prev.y, nextZoom));
      return;
    }
    setPan((prev) => clampPan(prev.x - e.deltaX * 0.8, prev.y - e.deltaY * 0.85, zoom));
  };

  const animateCameraTo = useCallback(
    (targetPanX: number, targetPanY: number, targetZoom = zoom) => {
      stopInertia();
      const clamped = clampPan(targetPanX, targetPanY, targetZoom);
      const startX = pan.x;
      const startY = pan.y;
      const startZ = zoom;
      const startTime = performance.now();
      const duration = 440;

      const tick = (now: number) => {
        const p = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - p, 3);
        const curZ = startZ + (targetZoom - startZ) * ease;
        setZoom(curZ);
        setPan({
          x: startX + (clamped.x - startX) * ease,
          y: startY + (clamped.y - startY) * ease,
        });
        if (p < 1) {
          inertiaRafRef.current = requestAnimationFrame(tick);
        } else {
          inertiaRafRef.current = null;
        }
      };
      inertiaRafRef.current = requestAnimationFrame(tick);
    },
    [pan.x, pan.y, zoom, clampPan]
  );

  const jumpToSummit = () => {
    const targetZoom = 0.95;
    const summitNode = trailNodes[trailNodes.length - 1];
    const targetX = summitNode
      ? viewportSize.width / 2 - summitNode.x * targetZoom
      : Math.round((viewportSize.width - sceneWidth * targetZoom) / 2);
    animateCameraTo(targetX, 0, targetZoom);
    if (summitNode) {
      onSelectPoint(summitNode.point);
    }
  };

  const jumpToBaseCamp = () => {
    const targetZoom = 0.95;
    const baseNode = trailNodes[0];
    const targetX = baseNode
      ? viewportSize.width / 2 - baseNode.x * targetZoom
      : Math.round((viewportSize.width - sceneWidth * targetZoom) / 2);
    const bottomY = viewportSize.height - sceneHeight * targetZoom;
    animateCameraTo(targetX, bottomY, targetZoom);
    if (baseNode) {
      onSelectPoint(baseNode.point);
    }
  };

  const fitFullMountain = () => {
    const targetZoom = fitZoomLevel;
    const centeredX = Math.round((viewportSize.width - sceneWidth * targetZoom) / 2);
    const centeredY = Math.round((viewportSize.height - sceneHeight * targetZoom) / 2);
    animateCameraTo(centeredX, centeredY, targetZoom);
  };

  const adjustZoom = (delta: number) => {
    const nextZoom = Math.max(0.48, Math.min(1.38, Number((zoom + delta).toFixed(2))));
    const centerRatioX = (viewportSize.width / 2 - pan.x) / (sceneWidth * zoom);
    const centerRatioY = (viewportSize.height / 2 - pan.y) / (sceneHeight * zoom);
    const targetPanX = viewportSize.width / 2 - centerRatioX * sceneWidth * nextZoom;
    const targetPanY = viewportSize.height / 2 - centerRatioY * sceneHeight * nextZoom;
    animateCameraTo(targetPanX, targetPanY, nextZoom);
  };

  const handleRestPointClick = useCallback(
    (node: ComputedTrailNode) => {
      if (dragStateRef.current.movedDistance > 8) return;
      triggerHaptic(12);
      onSelectPoint(node.point);
      const targetX = viewportSize.width / 2 - node.x * zoom;
      const targetY = viewportSize.height / 2 - node.y * zoom;
      animateCameraTo(targetX, targetY, zoom);
    },
    [triggerHaptic, onSelectPoint, viewportSize.width, viewportSize.height, zoom, animateCameraTo]
  );

  const labelStep = useMemo(() => {
    const len = trailNodes.length;
    if (len <= 10) return 2;
    if (len <= 25) return 4;
    if (len <= 60) return 9;
    if (len <= 120) return 16;
    return 26;
  }, [trailNodes.length]);

  const activeNode = useMemo(() => {
    if (!activePoint && trailNodes.length > 0) {
      return trailNodes[trailNodes.length - 1];
    }
    return (
      trailNodes.find(
        (n) =>
          String(n.point.event_no) === String(activePoint?.event_no) &&
          n.point.date === activePoint?.date
      ) || trailNodes[trailNodes.length - 1]
    );
  }, [trailNodes, activePoint]);

  // Story Mode narrated auto-progression along the trail
  useEffect(() => {
    if (!isStoryPlaying || trailNodes.length <= 1) return;
    const timer = window.setInterval(() => {
      const currIdx = activeNode ? activeNode.index : 0;
      const nextIdx = currIdx + 1 >= trailNodes.length ? 0 : currIdx + 1;
      const targetNode = trailNodes[nextIdx];
      if (targetNode) {
        onSelectPoint(targetNode.point);
        const targetZoom = Math.max(zoom, 0.86);
        const tx = viewportSize.width / 2 - targetNode.x * targetZoom;
        const ty = viewportSize.height / 2 - targetNode.y * targetZoom;
        animateCameraTo(tx, ty, targetZoom);
      }
    }, 2200);
    return () => window.clearInterval(timer);
  }, [
    isStoryPlaying,
    trailNodes,
    activeNode,
    onSelectPoint,
    zoom,
    viewportSize.width,
    viewportSize.height,
    animateCameraTo,
  ]);

  const selectAdjacentNode = (dir: -1 | 1) => {
    if (trailNodes.length === 0 || !activeNode) return;
    const nextIdx = Math.max(0, Math.min(trailNodes.length - 1, activeNode.index + dir));
    const nextNode = trailNodes[nextIdx];
    if (nextNode) {
      handleRestPointClick(nextNode);
    }
  };

  // Trail Breadcrumb Path (Base Camp -> Active Node) & Heat Map Segments
  const { breadcrumbPathD, fullTrailCenterD, heatTrailSegments, starfieldNodes } = useMemo(() => {
    if (trailNodes.length === 0) {
      return {
        breadcrumbPathD: '',
        fullTrailCenterD: '',
        heatTrailSegments: [] as Array<{ d: string; color: string; width: number }>,
        starfieldNodes: [] as Array<{ cx: number; cy: number; r: number; delay: string }>,
      };
    }

    const activeProgress =
      trailNodes.length > 1 && activeNode
        ? activeNode.index / (trailNodes.length - 1)
        : 1;

    const totalSamples = denseTrailCurve.samples.length;
    const cutoffIdx = Math.max(1, Math.round(activeProgress * (totalSamples - 1)));

    const bPts = denseTrailCurve.samples
      .slice(0, cutoffIdx + 1)
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`)
      .join(' ');

    const fPts = denseTrailCurve.samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`)
      .join(' ');

    const hSegs: Array<{ d: string; color: string; width: number }> = [];
    for (let i = 0; i < trailNodes.length - 1; i++) {
      const n0 = trailNodes[i];
      const n1 = trailNodes[i + 1];
      const s0 = Math.floor((i / Math.max(1, trailNodes.length - 1)) * (totalSamples - 1));
      const s1 = Math.max(
        s0 + 1,
        Math.floor(((i + 1) / Math.max(1, trailNodes.length - 1)) * (totalSamples - 1))
      );
      const sub = denseTrailCurve.samples.slice(s0, s1 + 1);
      if (sub.length >= 2) {
        const d = sub
          .map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        const width = Math.max(3.5, (n0.trailWidth + n1.trailWidth) * 0.28);
        hSegs.push({ d, color: n1.heatColor, width });
      }
    }

    const stars: Array<{ cx: number; cy: number; r: number; delay: string }> = [];
    for (let s = 0; s < 38; s++) {
      stars.push({
        cx: pseudoRand(s, 11, 3) * sceneWidth,
        cy: pseudoRand(s, 27, 9) * (sceneHeight * 0.34),
        r: 0.7 + pseudoRand(s, 41, 5) * 1.4,
        delay: `${(pseudoRand(s, 19, 2) * 3).toFixed(1)}s`,
      });
    }

    return {
      breadcrumbPathD: bPts,
      fullTrailCenterD: fPts,
      heatTrailSegments: hSegs,
      starfieldNodes: stars,
    };
  }, [trailNodes, activeNode, denseTrailCurve.samples, sceneWidth, sceneHeight]);

  // Mini Elevation Profile Sparkline Geometry (120 x 26)
  const sparklineData = useMemo(() => {
    const w = 116;
    const h = 24;
    if (trailNodes.length === 0) return { lineD: '', areaD: '', nodes: [] };
    const minAlt = trailNodes[0].altitudeM;
    const maxAlt = Math.max(minAlt + 100, trailNodes[trailNodes.length - 1].altitudeM);
    const pts = trailNodes.map((n, i) => {
      const sx = 3 + (i / Math.max(1, trailNodes.length - 1)) * (w - 6);
      const sy = h - 3 - ((n.altitudeM - minAlt) / (maxAlt - minAlt)) * (h - 6);
      return { sx, sy, node: n };
    });
    const lineD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`)
      .join(' ');
    const areaD = `${lineD} L ${pts[pts.length - 1].sx.toFixed(1)} ${h} L ${pts[0].sx.toFixed(1)} ${h} Z`;
    return { lineD, areaD, nodes: pts };
  }, [trailNodes]);

  if (orderedPoints.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-stone-500 font-medium bg-stone-100 rounded-2xl border border-stone-200">
        Growth curve updates with completed treks
      </div>
    );
  }

  const newestNode = trailNodes[trailNodes.length - 1];
  const oldestNode = trailNodes[0];
  const minY = Math.min(0, viewportSize.height - sceneHeight * zoom);
  const verticalProgress = minY < 0 ? 1 - pan.y / minY : 1;
  const isFullMountainZoom = Math.abs(zoom - fitZoomLevel) < 0.06;

  // Render a single stylized 3D Hiker silhouette with backpack, cap, and trekking pole
  const renderSingleHikerSVG = (
    offsetX: number,
    offsetY: number,
    memberScale: number,
    jacketColor: string,
    packColor: string,
    isCelebration = false
  ) => (
    <g
      transform={`translate(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}) scale(${memberScale.toFixed(2)})`}
    >
      <ellipse cx="0" cy="1" rx="6.5" ry="2.2" fill="#091E0D" opacity="0.45" />
      <rect
        x="-6.2"
        y="-16.5"
        width="4.8"
        height="8.2"
        rx="1.6"
        fill={packColor}
        stroke="#1E293B"
        strokeWidth="0.7"
      />
      <path
        d="M -1.5 -8.5 L -3.8 -1 L -2.2 0 M 1.2 -8.5 L 3.6 -1 L 5.2 -0.8"
        stroke="#1E293B"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M -2.4 -8.2 L -1.6 -16.8 L 2.5 -16.2 L 2.0 -8.2 Z"
        fill={jacketColor}
        stroke="#0F172A"
        strokeWidth="0.65"
      />
      <circle cx="0.8" cy="-19.8" r="2.5" fill="#FDE68A" stroke="#0F172A" strokeWidth="0.6" />
      <path d="M -2.2 -20.6 Q 0.8 -23.2 4.2 -20.2 Z" fill={jacketColor} />
      {isCelebration ? (
        <>
          <path
            d="M 1.4 -15.2 L 5.5 -21.5"
            stroke={jacketColor}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="5.5"
            y1="-26.5"
            x2="5.5"
            y2="-6"
            stroke="#F8FAFC"
            strokeWidth="1.1"
          />
          <polygon points="5.5,-26.5 14,-23.5 5.5,-20.5" fill="#F97316" />
        </>
      ) : (
        <>
          <path
            d="M 1.2 -15 L 4.8 -11.8"
            stroke={jacketColor}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="4.6"
            y1="-14.2"
            x2="6.8"
            y2="0.5"
            stroke="#E2E8F0"
            strokeWidth="1.0"
          />
        </>
      )}
    </g>
  );

  const parallaxFarX = (pan.x / Math.max(1, sceneWidth)) * -28;
  const parallaxFarY = (pan.y / Math.max(1, sceneHeight)) * -14;
  const parallaxMidX = (pan.x / Math.max(1, sceneWidth)) * -14;
  const parallaxMidY = (pan.y / Math.max(1, sceneHeight)) * -7;

  const skyPalette =
    lightingMode === 'golden'
      ? {
          s0: '#1E1136',
          s1: '#582841',
          s2: '#9E4747',
          s3: '#D97F43',
          s4: '#F3BA63',
          sunX: '28%',
          sunY: '26%',
          sunColor: '#FDE047',
          tintColor: '#F59E0B',
          tintOpacity: 0.14,
        }
      : lightingMode === 'alpenglow'
      ? {
          s0: '#0F102E',
          s1: '#2D1E4A',
          s2: '#692C5C',
          s3: '#B5486A',
          s4: '#F28F79',
          sunX: '22%',
          sunY: '30%',
          sunColor: '#FB7185',
          tintColor: '#EC4899',
          tintOpacity: 0.15,
        }
      : lightingMode === 'night'
      ? {
          s0: '#020817',
          s1: '#07142B',
          s2: '#0F2547',
          s3: '#1B3B66',
          s4: '#29547A',
          sunX: '76%',
          sunY: '16%',
          sunColor: '#E0F2FE',
          tintColor: '#0284C7',
          tintOpacity: 0.22,
        }
      : {
          s0: '#052952',
          s1: '#114E84',
          s2: '#2F7CB0',
          s3: '#6AAED1',
          s4: '#9ED2E6',
          sunX: '38%',
          sunY: '20%',
          sunColor: '#FFF7D6',
          tintColor: '#FACC15',
          tintOpacity: 0.04,
        };

  const cycleLightingMode = () => {
    const order: LightingMode[] = ['morning', 'golden', 'alpenglow', 'night'];
    const next = order[(order.indexOf(lightingMode) + 1) % order.length];
    setLightingMode(next);
    triggerHaptic(8);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-stone-300/90 shadow-md bg-[#083A6E]">
      <style>{`
        @keyframes trailHikerBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2.2px); }
        }
        @keyframes trailFlowDash {
          to { stroke-dashoffset: -28; }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 0.95; transform: scale(1.15); }
        }
        .animate-trail-hiker {
          animation: trailHikerBob 2.2s ease-in-out infinite;
        }
        .animate-trail-flow {
          animation: trailFlowDash 1.4s linear infinite;
        }
        .animate-star-twinkle {
          animation: starTwinkle 2.8s ease-in-out infinite;
        }
      `}</style>

      {/* Top Gradient Glass Control Panel & Live Elevation Sparkline HUD */}
      <div className="absolute top-2 left-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          {/* Left Gradient Glass Card: Title + Live Elevation Zone / Steepness / Altitude Gain */}
          <div
            className="bg-gradient-to-r from-stone-950/85 via-stone-900/75 to-emerald-950/80 backdrop-blur-xl text-white px-2.5 py-1.5 rounded-xl border border-white/20 flex items-center gap-2.5 shadow-lg pointer-events-auto"
            data-no-drag="true"
          >
            <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-[#C4ED39]/15 border border-[#C4ED39]/40 shrink-0">
              <Compass
                className="w-3.5 h-3.5 text-[#C4ED39] transition-transform duration-300"
                style={{
                  transform: `rotate(${Math.round(pan.x * 0.25 + tilt.ry * 12)}deg)`,
                }}
              />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#C4ED39] animate-ping" />
            </div>

            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wide text-white">
                  HIMALAYAN 3D TRAIL
                </span>
                {activeNode && (
                  <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[8.5px] font-bold text-[#C4ED39] border border-white/10">
                    <Activity className="w-2.5 h-2.5" />
                    {activeNode.zoneLabel}
                  </span>
                )}
              </div>
              {activeNode ? (
                <div className="flex flex-wrap items-center gap-2 text-[9px] text-white/85 font-semibold mt-0.5">
                  <span className="text-[#C4ED39] font-extrabold">
                    Alt {formatAlt(activeNode.altitudeM)}
                  </span>
                  <span className="text-white/40">•</span>
                  <span
                    className="font-bold"
                    style={{ color: activeNode.heatColor }}
                  >
                    Grade {activeNode.steepnessPct}% ({activeNode.difficultyLabel})
                  </span>
                  <span className="hidden sm:inline text-white/40">•</span>
                  <span className="hidden sm:inline text-emerald-300 font-bold">
                    +{formatAlt(activeNode.altitudeGainM)} gain
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-white/75 font-medium block">
                  Drag 360° horizon • Click rest points
                </span>
              )}
            </div>

            {/* Mini Interactive Elevation Profile Sparkline Scrubber */}
            {sparklineData.nodes.length > 1 && (
              <div
                className="hidden lg:flex flex-col items-end pl-2 border-l border-white/15"
                title="Interactive Elevation Profile — Click to scrub along journey"
              >
                <div className="flex items-center justify-between w-full text-[8px] font-bold text-white/70 mb-0.5">
                  <span>ELEVATION ARC</span>
                  <span className="text-[#C4ED39]">
                    {activeNode ? `#${activeNode.point.event_no}` : ''}
                  </span>
                </div>
                <svg
                  width="116"
                  height="24"
                  viewBox="0 0 116 24"
                  className="overflow-visible cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
                    );
                    const idx = Math.round(ratio * (trailNodes.length - 1));
                    if (trailNodes[idx]) {
                      handleRestPointClick(trailNodes[idx]);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C4ED39" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path d={sparklineData.areaD} fill="url(#sparkGrad)" />
                  <path
                    d={sparklineData.lineD}
                    fill="none"
                    stroke="#C4ED39"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  {activeNode && sparklineData.nodes[activeNode.index] && (
                    <g>
                      <line
                        x1={sparklineData.nodes[activeNode.index].sx}
                        y1={0}
                        x2={sparklineData.nodes[activeNode.index].sx}
                        y2={24}
                        stroke="#FFFFFF"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={sparklineData.nodes[activeNode.index].sx}
                        cy={sparklineData.nodes[activeNode.index].sy}
                        r="3"
                        fill="#C4ED39"
                        stroke="#090D16"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}
                </svg>
              </div>
            )}
          </div>

          {/* Right Gradient Glass Action Bar: Lighting, Heat Map, Units, Story Tour, Timeline, Camera */}
          <div
            className="flex flex-wrap items-center gap-1 pointer-events-auto"
            data-no-drag="true"
          >
            {/* Time-of-Day Dynamic Lighting Toggle */}
            <button
              type="button"
              onClick={cycleLightingMode}
              title={`Lighting: ${lightingMode.toUpperCase()} (Click to cycle Morning / Golden Hour / Alpenglow / Starlight)`}
              className="px-2 py-1 rounded-lg bg-stone-950/75 backdrop-blur-md text-white border border-white/15 hover:bg-stone-900/90 text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer capitalize"
            >
              {lightingMode === 'morning' && <Sun className="w-3 h-3 text-amber-300" />}
              {lightingMode === 'golden' && <Sunset className="w-3 h-3 text-orange-400" />}
              {lightingMode === 'alpenglow' && <Sparkles className="w-3 h-3 text-rose-400" />}
              {lightingMode === 'night' && <Moon className="w-3 h-3 text-sky-300" />}
              <span className="hidden sm:inline">{lightingMode}</span>
            </button>

            {/* Trail Heat Map Toggle */}
            <button
              type="button"
              onClick={() => {
                setHeatMapEnabled((v) => !v);
                triggerHaptic(8);
              }}
              title="Toggle Steepness & Intensity Trail Heat Map"
              className={`px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                heatMapEnabled
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white border-amber-300 shadow-xs'
                  : 'bg-stone-950/75 backdrop-blur-md text-white border-white/15 hover:bg-stone-900/90'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span className="hidden sm:inline">Heat</span>
            </button>

            {/* Metric / Imperial Unit Toggle */}
            <button
              type="button"
              onClick={() => {
                setUnitSystem((u) => (u === 'km' ? 'mi' : 'km'));
                triggerHaptic(8);
              }}
              title="Switch between Kilometers (KM) and Miles (MI)"
              className="px-2 py-1 rounded-lg bg-stone-950/75 backdrop-blur-md text-[#C4ED39] border border-white/15 hover:bg-stone-900/90 text-[9.5px] font-extrabold transition-all cursor-pointer uppercase"
            >
              {unitSystem}
            </button>

            {/* Story Mode Auto-Tour Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsStoryPlaying((p) => !p);
                triggerHaptic(10);
              }}
              title="Story Mode: Narrated automatic camera tour along all hikes"
              className={`px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                isStoryPlaying
                  ? 'bg-[#C4ED39] text-stone-950 border-[#E2F97E] shadow-xs'
                  : 'bg-stone-950/75 backdrop-blur-md text-white border-white/15 hover:bg-stone-900/90'
              }`}
            >
              {isStoryPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span className="hidden md:inline">Tour</span>
            </button>

            {/* Camera View & Zoom Controls */}
            <button
              type="button"
              onClick={fitFullMountain}
              title="Zoom out to full panoramic horizon"
              className={`px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                isFullMountainZoom
                  ? 'bg-[#C4ED39] text-stone-950 border-[#E2F97E] shadow-xs'
                  : 'bg-stone-950/75 backdrop-blur-md text-white border-white/15 hover:bg-stone-900/90'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden xl:inline">Full</span>
            </button>

            <button
              type="button"
              onClick={() => adjustZoom(-0.14)}
              title="Zoom Out"
              className="p-1.5 rounded-lg bg-stone-950/75 backdrop-blur-md text-white border border-white/15 hover:bg-stone-900/90 transition-all cursor-pointer"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(0.14)}
              title="Zoom In"
              className="p-1.5 rounded-lg bg-stone-950/75 backdrop-blur-md text-white border border-white/15 hover:bg-stone-900/90 transition-all cursor-pointer"
            >
              <ZoomIn className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={jumpToSummit}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-0.5 transition-all cursor-pointer border ${
                !isFullMountainZoom && verticalProgress > 0.78
                  ? 'bg-[#C4ED39] text-stone-950 border-[#E2F97E] shadow-xs'
                  : 'bg-stone-950/75 backdrop-blur-md text-white border-white/15 hover:bg-stone-900/90'
              }`}
            >
              <ArrowUp className="w-3 h-3" />
              <span>Summit</span>
            </button>
            <button
              type="button"
              onClick={jumpToBaseCamp}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-0.5 transition-all cursor-pointer border ${
                !isFullMountainZoom && verticalProgress < 0.22
                  ? 'bg-[#C4ED39] text-stone-950 border-[#E2F97E] shadow-xs'
                  : 'bg-stone-950/75 backdrop-blur-md text-white border-white/15 hover:bg-stone-900/90'
              }`}
            >
              <ArrowDown className="w-3 h-3" />
              <span>Base</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Legend & Hiker Activity Strip */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <div className="bg-stone-950/75 backdrop-blur-md text-white/95 px-2.5 py-1 rounded-lg border border-white/15 flex flex-wrap items-center gap-2.5 text-[9px] sm:text-[10px] font-semibold">
          {heatMapEnabled ? (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Moderate
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                Challenging
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                Steep
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Extreme
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white border border-emerald-900 inline-block" />
                Hike Rest
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 border border-stone-900 inline-block" />
                Trek Camp
              </span>
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="w-3 h-0.5 bg-cyan-300 inline-block rounded" />
                Breadcrumb Path
              </span>
              <span className="hidden sm:flex items-center gap-1 text-[#C4ED39] border-l border-white/15 pl-2">
                <Users className="w-3 h-3" />
                Solo &amp; Group Hikers
              </span>
            </>
          )}
        </div>

        <div
          className="bg-stone-950/75 backdrop-blur-md text-white/90 px-2 py-1 rounded-lg border border-white/15 text-[9px] font-bold flex items-center gap-1.5 pointer-events-auto"
          data-no-drag="true"
        >
          <button
            type="button"
            onClick={() => setIs3DTiltEnabled((v) => !v)}
            className={`flex items-center gap-1 cursor-pointer ${
              is3DTiltEnabled ? 'text-[#C4ED39]' : 'text-white/60'
            }`}
            title="Toggle 3D Perspective Tilt"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">3D Tilt</span>
          </button>
          <span className="text-white/30">|</span>
          <span>
            {orderedPoints.length} Hikes • {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* INTERACTIVE 3D PANORAMIC VIEWPORT */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onWheel={handleWheel}
        className={`w-full h-[390px] sm:h-[460px] overflow-hidden relative select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          perspective: '1100px',
        }}
      >
        <div
          className="relative will-change-transform"
          style={{
            width: `${sceneWidth}px`,
            height: `${sceneHeight}px`,
            transform: `translate3d(${pan.x.toFixed(1)}px, ${pan.y.toFixed(1)}px, 0) scale(${zoom.toFixed(3)}) rotateX(${(
              is3DTiltEnabled ? tilt.rx : 0
            ).toFixed(2)}deg) rotateY(${(is3DTiltEnabled ? tilt.ry : 0).toFixed(2)}deg)`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 140ms ease-out',
          }}
        >
          {/* SVG Layer: Cartoon Hill Range, Waterfall, Cartoon Forest, 3D Trail & Hikers */}
          <svg
            width={sceneWidth}
            height={sceneHeight}
            viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
            className="block w-full h-full pointer-events-none"
          >
            <defs>
              {/* Dynamic Time-of-Day Himalayan Alpine Sky */}
              <linearGradient id="alpineSky3D" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={skyPalette.s0} />
                <stop offset="16%" stopColor={skyPalette.s1} />
                <stop offset="34%" stopColor={skyPalette.s2} />
                <stop offset="50%" stopColor={skyPalette.s3} />
                <stop offset="64%" stopColor={skyPalette.s4} />
                <stop offset="76%" stopColor="#1B462B" />
                <stop offset="100%" stopColor="#0B2210" />
              </linearGradient>

              {/* Dynamic Sun / Moon Celestial Glow */}
              <radialGradient
                id="morningSunGlow"
                cx={skyPalette.sunX}
                cy={skyPalette.sunY}
                r="48%"
              >
                <stop offset="0%" stopColor={skyPalette.sunColor} stopOpacity="0.55" />
                <stop offset="42%" stopColor={skyPalette.s4} stopOpacity="0.22" />
                <stop offset="100%" stopColor={skyPalette.s2} stopOpacity="0" />
              </radialGradient>

              {/* High-Altitude Aurora Ribbon Gradient */}
              <linearGradient id="auroraRibbonGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                <stop offset="28%" stopColor="#34D399" stopOpacity="0.35" />
                <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.42" />
                <stop offset="80%" stopColor="#A855F7" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
              </linearGradient>

              {/* Volumetric Crepuscular God-Ray Gradient */}
              <linearGradient id="volumetricRayGrad" x1="0" y1="0" x2="0.6" y2="1">
                <stop offset="0%" stopColor={skyPalette.sunColor} stopOpacity="0.24" />
                <stop offset="55%" stopColor={skyPalette.sunColor} stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              {/* Distant Cartoon Peaks Gradients */}
              <linearGradient id="distantSunlitSnow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id="distantShadowSnow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>

              {/* Flanking Cartoon Valley Hill Gradients */}
              <linearGradient id="flankHillLeftFar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="55%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
              <linearGradient id="flankHillRightFar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="55%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="flankHillLeftNear" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#84CC16" />
                <stop offset="55%" stopColor="#4D7C0F" />
                <stop offset="100%" stopColor="#14532D" />
              </linearGradient>
              <linearGradient id="flankHillRightNear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="55%" stopColor="#15803D" />
                <stop offset="100%" stopColor="#052E16" />
              </linearGradient>

              {/* Cartoon Main Hill Base Underpainting */}
              <linearGradient id="mainMassifSunlitBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D9F99D" />
                <stop offset="28%" stopColor="#A3E635" />
                <stop offset="65%" stopColor="#65A30D" />
                <stop offset="100%" stopColor="#365314" />
              </linearGradient>
              <linearGradient id="mainMassifShadowBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#86EFAC" />
                <stop offset="30%" stopColor="#4ADE80" />
                <stop offset="68%" stopColor="#16A34A" />
                <stop offset="100%" stopColor="#14532D" />
              </linearGradient>

              {/* Trail Gradients */}
              <linearGradient id="nearSpurTrailGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FBF6E9" />
                <stop offset="52%" stopColor="#ECE3C9" />
                <stop offset="100%" stopColor="#D0C4A3" />
              </linearGradient>

              <linearGradient id="farSaddleTrailGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#DCE4DD" />
                <stop offset="55%" stopColor="#C4D0C7" />
                <stop offset="100%" stopColor="#9EB0A4" />
              </linearGradient>

              <radialGradient id="valleyMistRadial" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F0F9FF" stopOpacity="0.82" />
                <stop offset="52%" stopColor="#BAE6FD" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
              </radialGradient>

              <filter id="ribbonDropShadow" x="-15%" y="-5%" width="130%" height="115%">
                <feDropShadow
                  dx="0"
                  dy="3.5"
                  stdDeviation="2.5"
                  floodColor="#061508"
                  floodOpacity="0.55"
                />
              </filter>
            </defs>

            {/* 1. Deep Himalayan Sky & Dynamic Celestial Glow */}
            <rect x="0" y="0" width={sceneWidth} height={sceneHeight} fill="url(#alpineSky3D)" />
            <rect x="0" y="0" width={sceneWidth} height={sceneHeight * 0.7} fill="url(#morningSunGlow)" />

            {/* 1B. Subtle High-Altitude Starfield & Aurora Ribbon (Visible when zoomed out or in Night/Alpenglow) */}
            <g
              opacity={
                lightingMode === 'night'
                  ? 0.92
                  : lightingMode === 'alpenglow'
                  ? 0.58
                  : zoom < 0.78
                  ? 0.35
                  : 0.18
              }
            >
              {starfieldNodes.map((st, idx) => (
                <circle
                  key={`star-${idx}`}
                  cx={st.cx}
                  cy={st.cy}
                  r={st.r}
                  fill="#F8FAFC"
                  className="animate-star-twinkle"
                  style={{ animationDelay: st.delay }}
                />
              ))}
              <path
                d={`M ${sceneWidth * 0.08} ${sceneHeight * 0.11} Q ${sceneWidth * 0.34} ${
                  sceneHeight * 0.04
                } ${sceneWidth * 0.58} ${sceneHeight * 0.1} T ${sceneWidth * 0.92} ${
                  sceneHeight * 0.07
                }`}
                fill="none"
                stroke="url(#auroraRibbonGrad)"
                strokeWidth="18"
                strokeLinecap="round"
                opacity={lightingMode === 'night' || lightingMode === 'alpenglow' ? 0.85 : 0.45}
              />
            </g>

            {/* 1C. Celestial Sun / Moon Orb & Puffy Cartoon Clouds */}
            <g
              transform={`translate(${
                lightingMode === 'night' ? sceneWidth * 0.76 : sceneWidth * 0.3
              }, ${sceneHeight * 0.14})`}
            >
              <circle
                cx="0"
                cy="0"
                r="28"
                fill={skyPalette.sunColor}
                opacity="0.22"
              />
              <circle
                cx="0"
                cy="0"
                r="14"
                fill={skyPalette.sunColor}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                opacity="0.92"
              />
            </g>

            <g transform={`translate(${(parallaxFarX * 0.6).toFixed(1)}, ${(parallaxFarY * 0.4).toFixed(1)})`}>
              {cartoonClouds.map((cl, idx) => (
                <g
                  key={`c-cloud-${idx}`}
                  transform={`translate(${cl.cx.toFixed(1)}, ${cl.cy.toFixed(1)}) scale(${cl.scale.toFixed(2)})`}
                  opacity={lightingMode === 'night' ? cl.opacity * 0.45 : cl.opacity}
                >
                  <path
                    d="M -38 8 Q -42 -6 -26 -10 Q -18 -26 2 -22 Q 20 -26 28 -10 Q 44 -6 38 8 Z"
                    fill="#FFFFFF"
                    stroke="#BAE6FD"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <ellipse cx="-12" cy="-8" rx="14" ry="8" fill="#F0F9FF" />
                </g>
              ))}
            </g>

            {/* 2. Cartoon Rounded Distant Snow-Capped Hills (with Parallax Depth Shift) */}
            <g
              opacity="0.9"
              transform={`translate(${parallaxFarX.toFixed(1)}, ${parallaxFarY.toFixed(1)})`}
            >
              {distantSnowPeaks.map((pk, idx) => (
                <g key={`dist-snow-pk-${idx}`}>
                  <path
                    d={pk.fullDomeD}
                    fill="url(#distantSunlitSnow)"
                    stroke="#1E3A8A"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path d={pk.shadowRightD} fill="url(#distantShadowSnow)" opacity="0.85" />
                  <path
                    d={pk.snowCapD}
                    fill="#FFFFFF"
                    stroke="#93C5FD"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </g>

            {/* 3. Cartoon Rolling Flanking Valley Hills (with Mid-Ground Parallax Shift) */}
            <g transform={`translate(${parallaxMidX.toFixed(1)}, ${parallaxMidY.toFixed(1)})`}>
              {flankingHillLayers.map((layer, idx) => (
                <path
                  key={`flank-layer-${idx}`}
                  d={layer.d}
                  fill={layer.fill}
                  stroke={layer.stroke}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  opacity={layer.opacity}
                />
              ))}
            </g>

            {/* 3B. Volumetric Crepuscular God-Rays Cutting Across the Valley */}
            {lightingMode !== 'night' && (
              <g opacity="0.5" style={{ mixBlendMode: 'screen' }}>
                <polygon
                  points={`${sceneWidth * 0.28},${sceneHeight * 0.12} ${sceneWidth * 0.48},${
                    sceneHeight * 0.65
                  } ${sceneWidth * 0.62},${sceneHeight * 0.65}`}
                  fill="url(#volumetricRayGrad)"
                />
                <polygon
                  points={`${sceneWidth * 0.3},${sceneHeight * 0.12} ${sceneWidth * 0.68},${
                    sceneHeight * 0.6
                  } ${sceneWidth * 0.82},${sceneHeight * 0.6}`}
                  fill="url(#volumetricRayGrad)"
                />
                <polygon
                  points={`${sceneWidth * 0.26},${sceneHeight * 0.12} ${sceneWidth * 0.22},${
                    sceneHeight * 0.68
                  } ${sceneWidth * 0.36},${sceneHeight * 0.68}`}
                  fill="url(#volumetricRayGrad)"
                />
              </g>
            )}

            {/* 4. Deep Valley Horizon Mist Separating Background Range from Main Cartoon Hill */}
            <ellipse
              cx={sceneWidth * 0.5}
              cy={sceneHeight * 0.44}
              rx={sceneWidth * 0.52}
              ry={56}
              fill="url(#valleyMistRadial)"
              opacity={0.38}
            />

            {/* 5. Main Cartoon Hill Base Silhouette & Cel-Shaded Underpainting */}
            <path
              d={mountainBaseHullD}
              fill="#14532D"
              stroke="#0D2E14"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d={mountainLeftSunlitD} fill="url(#mainMassifSunlitBase)" />
            <path d={mountainRightShadowD} fill="url(#mainMassifShadowBase)" />

            {/* 6. Layered Cartoon Rolling Meadow Terraces (Scalloped Storybook Hill Tiers) */}
            <g>
              {cartoonHillTerraces.map((terrace, idx) => (
                <g key={`cartoon-terrace-${idx}`}>
                  <path d={terrace.sunlitLeftD} fill={terrace.sunlitFill} />
                  <path d={terrace.shadowRightD} fill={terrace.shadowFill} />
                  <path
                    d={terrace.fullBandD}
                    fill="none"
                    stroke={terrace.outlineColor}
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <path
                    d={terrace.rimHighlightD}
                    fill="none"
                    stroke="#ECFCCB"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity="0.65"
                  />
                </g>
              ))}
            </g>

            {/* 6B. Cartoon Rounded Summit Snow-Cap Crown with Scalloped Snow Drips */}
            <g>
              <path
                d={cartoonSnowCap.fullD}
                fill="#FFFFFF"
                stroke="#1E3A8A"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <path d={cartoonSnowCap.shadowD} fill="#BAE6FD" opacity="0.85" />
              <path
                d={cartoonSnowCap.bottomWaveD}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>

            {/* 6C. Central Cartoon Hill Ridge Line */}
            <path
              d={centralCartoonRidgeD}
              fill="none"
              stroke="#ECFCCB"
              strokeWidth="2.5"
              strokeDasharray="10 8"
              strokeLinecap="round"
              opacity="0.55"
            />

            {/* 6D. Cartoon Rounded Boulders & Meadow Grass Tufts / Wildflowers */}
            <g>
              {cartoonBoulders.map((b, idx) => (
                <g
                  key={`c-boulder-${idx}`}
                  transform={`translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)})`}
                >
                  <ellipse
                    cx="0"
                    cy="2"
                    rx={b.rx * 1.05}
                    ry={b.ry * 0.55}
                    fill="#0F2E14"
                    opacity="0.35"
                  />
                  <path
                    d={`M ${(-b.rx).toFixed(1)} 0 Q ${(-b.rx * 0.8).toFixed(1)} ${(-b.ry * 1.3).toFixed(
                      1
                    )} 0 ${(-b.ry * 1.2).toFixed(1)} Q ${(b.rx * 0.85).toFixed(1)} ${(-b.ry * 1.1).toFixed(
                      1
                    )} ${b.rx.toFixed(1)} 0 Z`}
                    fill="#94A3B8"
                    stroke="#1E293B"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${(-b.rx * 0.72).toFixed(1)} ${(-b.ry * 0.25).toFixed(1)} Q ${(-b.rx * 0.35).toFixed(
                      1
                    )} ${(-b.ry * 1.05).toFixed(1)} ${(b.rx * 0.2).toFixed(1)} ${(-b.ry * 0.85).toFixed(1)}`}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {cartoonGrassTufts.map((gt, idx) => (
                <g
                  key={`c-tuft-${idx}`}
                  transform={`translate(${gt.x.toFixed(1)}, ${gt.y.toFixed(1)}) scale(${gt.scale.toFixed(2)})`}
                >
                  <path
                    d="M 0 0 Q -4 -7 -7 -10 M 0 0 Q 0 -8 -1 -12 M 0 0 Q 4 -7 7 -9"
                    fill="none"
                    stroke="#14532D"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  {gt.hasFlower && (
                    <circle
                      cx="-1"
                      cy="-13"
                      r="2.6"
                      fill={gt.flowerColor}
                      stroke="#14532D"
                      strokeWidth="0.8"
                    />
                  )}
                </g>
              ))}
            </g>

            {/* Time-of-Day Atmospheric Tint on Main Cartoon Hill */}
            {skyPalette.tintOpacity > 0.05 && (
              <path
                d={mountainBaseHullD}
                fill={skyPalette.tintColor}
                opacity={skyPalette.tintOpacity}
                style={{ mixBlendMode: lightingMode === 'night' ? 'multiply' : 'soft-light' }}
              />
            )}

            {/* 8. Cascading Alpine Glacial Stream & Waterfall in the Ravine */}
            {alpineStreamPaths.mainD && (
              <g opacity="0.82">
                <path
                  d={alpineStreamPaths.mainD}
                  fill="none"
                  stroke="#0F3528"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
                <path
                  d={alpineStreamPaths.mainD}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                />
                <path
                  d={alpineStreamPaths.mainD}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* 9. Cartoon Rounded Pine, Cedar & Blooming Rhododendron Trees */}
            <g>
              {treeClusters.map((tr, idx) => {
                const h = 13 * tr.scale;
                const w = 6.5 * tr.scale;
                return (
                  <g
                    key={`tree-${idx}`}
                    transform={`translate(${tr.x.toFixed(1)}, ${tr.y.toFixed(1)})`}
                    opacity={tr.opacity}
                  >
                    {/* Cartoon ground shadow */}
                    <ellipse
                      cx="0"
                      cy="1.2"
                      rx={w * 0.85}
                      ry={w * 0.28}
                      fill="#071A0A"
                      opacity="0.42"
                    />
                    {/* Cartoon Wooden Trunk */}
                    <rect
                      x={(-w * 0.22).toFixed(1)}
                      y={(-h * 0.25).toFixed(1)}
                      width={(w * 0.44).toFixed(1)}
                      height={(h * 0.28).toFixed(1)}
                      rx="1.2"
                      fill={tr.trunkColor}
                      stroke="#1E293B"
                      strokeWidth="0.7"
                    />
                    {tr.variant === 'pine' ? (
                      <>
                        {/* Lower rounded cartoon pine tier */}
                        <path
                          d={`M 0 ${(-h * 0.76).toFixed(1)} Q ${(-w * 1.15).toFixed(1)} ${(-h * 0.22).toFixed(
                            1
                          )} ${(-w * 0.88).toFixed(1)} ${(-h * 0.16).toFixed(1)} Q 0 ${(-h * 0.06).toFixed(
                            1
                          )} ${(w * 0.88).toFixed(1)} ${(-h * 0.16).toFixed(1)} Q ${(w * 1.15).toFixed(
                            1
                          )} ${(-h * 0.22).toFixed(1)} 0 ${(-h * 0.76).toFixed(1)} Z`}
                          fill={tr.shade}
                          stroke="#0D2E14"
                          strokeWidth="1.1"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M 0 ${(-h * 0.76).toFixed(1)} Q ${(-w * 1.05).toFixed(1)} ${(-h * 0.24).toFixed(
                            1
                          )} ${(-w * 0.75).toFixed(1)} ${(-h * 0.18).toFixed(1)} Q -1 ${(-h * 0.14).toFixed(
                            1
                          )} 0 ${(-h * 0.76).toFixed(1)} Z`}
                          fill={tr.highlight}
                        />
                        {/* Upper rounded cartoon pine crown */}
                        <path
                          d={`M 0 ${(-h * 1.05).toFixed(1)} Q ${(-w * 0.92).toFixed(1)} ${(-h * 0.46).toFixed(
                            1
                          )} ${(-w * 0.68).toFixed(1)} ${(-h * 0.42).toFixed(1)} Q 0 ${(-h * 0.34).toFixed(
                            1
                          )} ${(w * 0.68).toFixed(1)} ${(-h * 0.42).toFixed(1)} Q ${(w * 0.92).toFixed(
                            1
                          )} ${(-h * 0.46).toFixed(1)} 0 ${(-h * 1.05).toFixed(1)} Z`}
                          fill={tr.shade}
                          stroke="#0D2E14"
                          strokeWidth="1.1"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M 0 ${(-h * 1.05).toFixed(1)} Q ${(-w * 0.84).toFixed(1)} ${(-h * 0.48).toFixed(
                            1
                          )} ${(-w * 0.56).toFixed(1)} ${(-h * 0.43).toFixed(1)} Q -1 ${(-h * 0.4).toFixed(
                            1
                          )} 0 ${(-h * 1.05).toFixed(1)} Z`}
                          fill={tr.highlight}
                        />
                      </>
                    ) : tr.variant === 'cedar' ? (
                      /* Puffy Cartoon Tree Canopy */
                      <>
                        <circle
                          cx="0"
                          cy={(-h * 0.58).toFixed(1)}
                          r={(w * 0.78).toFixed(1)}
                          fill={tr.shade}
                          stroke="#0D2E14"
                          strokeWidth="1.1"
                        />
                        <circle
                          cx={(-w * 0.22).toFixed(1)}
                          cy={(-h * 0.64).toFixed(1)}
                          r={(w * 0.56).toFixed(1)}
                          fill={tr.highlight}
                        />
                      </>
                    ) : (
                      /* Blooming Cartoon Rhododendron Bush */
                      <>
                        <circle
                          cx="0"
                          cy={(-h * 0.52).toFixed(1)}
                          r={(w * 0.82).toFixed(1)}
                          fill="#22C55E"
                          stroke="#0D2E14"
                          strokeWidth="1.1"
                        />
                        <circle cx={-w * 0.28} cy={-h * 0.58} r={2.1 * tr.scale} fill="#FB7185" />
                        <circle cx={w * 0.24} cy={-h * 0.44} r={1.8 * tr.scale} fill="#F43F5E" />
                        <circle cx={0} cy={-h * 0.72} r={1.6 * tr.scale} fill="#FDE047" />
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 10. Subtle Horizon Elevation & Depth Zone Markers (Placed on outer left flank, away from summit crown) */}
            <g>
              {[
                { ratio: 0.34, zone: 'HIGH ALPINE SUMMIT ZONE (FAR)' },
                { ratio: 0.58, zone: 'MID-HILL SPURS & SADDLE PASS' },
                { ratio: 0.82, zone: 'FOOTHILL VALLEY KNOLLS (NEAR)' },
              ].map((item, idx) => {
                const y = sceneHeight * item.ratio;
                const maxKm = newestNode?.point.total_km || 0;
                const kmVal = Math.round((maxKm * (1 - item.ratio * 0.88)) / 100) * 100;
                const { leftFlankX, centerX } = getMountainProfileAtY(y);
                const lineStartX = Math.max(24, leftFlankX + 24);
                const lineEndX = Math.min(centerX - 85, lineStartX + 125);

                if (lineEndX <= lineStartX + 24) return null;
                return (
                  <g key={`contour-${idx}`} opacity={0.46}>
                    <line
                      x1={lineStartX}
                      y1={y}
                      x2={lineEndX}
                      y2={y}
                      stroke="#FFFFFF"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={lineStartX + 4}
                      y={y - 14}
                      fill="#C4ED39"
                      fontSize="8.5"
                      fontWeight="800"
                      letterSpacing="0.06em"
                    >
                      {item.zone}
                    </text>
                    <text
                      x={lineStartX + 4}
                      y={y - 4}
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="800"
                      letterSpacing="0.05em"
                    >
                      {formatDist(kmVal, 0).toUpperCase()} HORIZON
                    </text>
                  </g>
                );
              })}
            </g>

            {/* 11. 3D Scenic Trail Ribbon (Wide & Warm on Near Spurs, Narrow & Cool in Far Saddles) */}
            <g>
              {trailSegments.map((seg, idx) => (
                <g key={`tseg-${idx}`}>
                  <path
                    d={seg.cliffWallD}
                    fill={seg.isNearSpur ? '#5C533B' : '#3C4D44'}
                    opacity={seg.isNearSpur ? 0.92 : 0.75}
                  />
                  <path
                    d={seg.ribbonD}
                    fill={seg.isNearSpur ? 'url(#nearSpurTrailGrad)' : 'url(#farSaddleTrailGrad)'}
                    stroke={seg.isNearSpur ? '#B8AC8A' : '#8FA396'}
                    strokeWidth={seg.isNearSpur ? '0.95' : '0.7'}
                    filter={seg.isNearSpur ? 'url(#ribbonDropShadow)' : undefined}
                  />
                  <path
                    d={seg.centerLineD}
                    fill="none"
                    stroke={seg.isNearSpur ? '#85795B' : '#5E7266'}
                    strokeWidth={seg.isNearSpur ? '1.15' : '0.85'}
                    strokeDasharray="4 4"
                    opacity={seg.isNearSpur ? 0.65 : 0.45}
                  />
                </g>
              ))}
            </g>

            {/* 11B. Dynamic Trail Heat Map Coloring Overlay (Steepness / Intensity) */}
            {heatMapEnabled && (
              <g opacity="0.88">
                {heatTrailSegments.map((hs, idx) => (
                  <path
                    key={`heat-seg-${idx}`}
                    d={hs.d}
                    fill="none"
                    stroke={hs.color}
                    strokeWidth={hs.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}

            {/* 11C. Trail Breadcrumb Path & Animated Flow Connectors (Base Camp -> Selected Point) */}
            {breadcrumbPathD && (
              <g>
                <path
                  d={breadcrumbPathD}
                  fill="none"
                  stroke="#22D3EE"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.32"
                />
                <path
                  d={breadcrumbPathD}
                  fill="none"
                  stroke="#C4ED39"
                  strokeWidth="2.2"
                  strokeDasharray="6 8"
                  strokeLinecap="round"
                  className="animate-trail-flow"
                  opacity="0.9"
                />
              </g>
            )}

            {/* 12. Base Camp Tents near the Foreground Trailhead */}
            {oldestNode && (
              <g
                transform={`translate(${(oldestNode.x - 42).toFixed(1)}, ${(oldestNode.y + 8).toFixed(1)})`}
              >
                <polygon points="0,-16 -14,0 0,0" fill="#F59E0B" stroke="#78350F" strokeWidth="0.6" />
                <polygon points="0,-16 0,0 14,0" fill="#D97706" stroke="#78350F" strokeWidth="0.6" />
                <polygon points="0,-6 -4,0 4,0" fill="#1E293B" />
                <g transform="translate(-22, 5) scale(0.78)">
                  <polygon points="0,-15 -13,0 0,0" fill="#38BDF8" stroke="#0C4A6E" strokeWidth="0.6" />
                  <polygon points="0,-15 0,0 13,0" fill="#0284C7" stroke="#0C4A6E" strokeWidth="0.6" />
                </g>
              </g>
            )}

            {/* 13. Lively Solo Hikers & Trekking Groups Walking Along the Trail */}
            <g>
              {hikerFigures.map((hk) => {
                const dirFlip = hk.facingRight ? 1 : -1;
                return (
                  <g
                    key={hk.id}
                    transform={`translate(${hk.x.toFixed(1)}, ${hk.y.toFixed(1)}) scale(${(
                      hk.scale * dirFlip
                    ).toFixed(2)}, ${hk.scale.toFixed(2)})`}
                  >
                    <g
                      className="animate-trail-hiker"
                      style={{ animationDelay: hk.animDelay }}
                    >
                      {hk.type === 'group' && (
                        <>
                          {renderSingleHikerSVG(11, -2, 1.0, hk.jacketColor, hk.packColor)}
                          {renderSingleHikerSVG(0, 1.5, 0.94, '#38BDF8', '#FACC15')}
                          {renderSingleHikerSVG(-11, 4.5, 0.88, '#A3E635', '#F97316')}
                        </>
                      )}

                      {hk.type === 'duo' && (
                        <>
                          {renderSingleHikerSVG(6, -1, 0.98, hk.jacketColor, hk.packColor)}
                          {renderSingleHikerSVG(-6, 2.5, 0.9, '#F43F5E', '#38BDF8')}
                        </>
                      )}

                      {hk.type === 'solo' &&
                        renderSingleHikerSVG(0, 0, 1.0, hk.jacketColor, hk.packColor)}

                      {hk.type === 'summit' && (
                        <>
                          {renderSingleHikerSVG(
                            -14,
                            2,
                            0.95,
                            hk.jacketColor,
                            hk.packColor,
                            true
                          )}
                          {renderSingleHikerSVG(-24, 5, 0.88, '#38BDF8', '#FACC15')}
                        </>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>

            {/* 14. Drifting Atmospheric Valley Mist Wisps Across Recessed Saddles */}
            <g>
              {mistBands.map((mb, idx) => (
                <ellipse
                  key={`mist-${idx}`}
                  cx={mb.cx}
                  cy={mb.cy}
                  rx={mb.rx}
                  ry={mb.ry}
                  fill="url(#valleyMistRadial)"
                  opacity={mb.opacity}
                />
              ))}
            </g>
          </svg>

          {/* HTML/CSS OVERLAY LAYER: Crisp Typography & Interactive Rest Points */}

          {/* Summit Peak Badge (Anchored to the right of the peak when not selected so the snow apex is never covered) */}
          {newestNode && activeNode?.index !== newestNode.index && (
            <div
              onClick={() => handleRestPointClick(newestNode)}
              style={{
                left: `${newestNode.x + 16}px`,
                top: `${newestNode.y}px`,
                transform: `translate(0, -50%) scale(${(1 / Math.max(0.72, zoom)).toFixed(2)})`,
                transformOrigin: 'left center',
              }}
              className="absolute z-20 cursor-pointer select-none group flex items-center"
              data-no-drag="true"
            >
              <div className="w-3.5 h-0.5 bg-[#C4ED39] shrink-0" />
              <div className="bg-stone-950/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-[#C4ED39]/85 shadow-lg text-left whitespace-nowrap transition-transform group-hover:scale-105">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#C4ED39] flex items-center gap-1">
                  <Mountain className="w-2.5 h-2.5" />
                  <span>Summit • Hike #{newestNode.point.event_no}</span>
                </div>
                <div className="text-[11px] font-black text-white leading-tight">
                  {formatDist(newestNode.point.total_km || 0, 1)} Total
                </div>
              </div>
            </div>
          )}

          {/* Base Camp Badge (Oldest Hike in Near Foreground) */}
          {oldestNode && activeNode?.index !== oldestNode.index && (
            <div
              onClick={() => handleRestPointClick(oldestNode)}
              style={{
                left: `${oldestNode.x}px`,
                top: `${oldestNode.y + 15}px`,
                transform: `translate(-50%, 0) scale(${(1 / Math.max(0.72, zoom)).toFixed(2)})`,
                transformOrigin: 'top center',
              }}
              className="absolute z-20 cursor-pointer select-none group"
              data-no-drag="true"
            >
              <div className="bg-stone-950/85 backdrop-blur-md text-white px-2.5 py-1 rounded-lg border border-amber-300/45 shadow-md text-center whitespace-nowrap transition-transform group-hover:scale-105">
                <div className="text-[8.5px] font-extrabold uppercase tracking-wider text-amber-300">
                  Base Camp Trailhead • Hike #{oldestNode.point.event_no}
                </div>
                <div className="text-[10px] font-bold text-white/95 leading-tight">
                  {formatDist(oldestNode.point.total_km || 0, 1)} • {oldestNode.point.date}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Rest Point Pins Along the Scenic Trail */}
          {trailNodes.map((node) => {
            const isSelected =
              activeNode &&
              String(activeNode.point.event_no) === String(node.point.event_no) &&
              activeNode.point.date === node.point.date;

            const isHovered = hoveredNodeIdx === node.index && !isSelected;

            const isNearSummitCrown =
              node.isSummit ||
              node.index >= trailNodes.length - 3 ||
              node.y < sceneHeight * 0.29;

            const trophyMilestone = node.milestoneKm || node.autoMilestoneKm;
            const showMilestone = trophyMilestone !== null && !node.isSummit;
            const showCompactTag =
              !isSelected &&
              !isNearSummitCrown &&
              !node.isBaseCamp &&
              showMilestone;

            const placeTagRight = node.x < sceneWidth * 0.52;
            const invZoomScale = Math.min(1.22, Math.max(0.9, 1 / Math.pow(zoom, 0.6)));

            return (
              <div
                key={`node-pin-${node.index}-${node.point.event_no}`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              >
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={() => handleRestPointClick(node)}
                  onMouseEnter={() => setHoveredNodeIdx(node.index)}
                  onMouseLeave={() =>
                    setHoveredNodeIdx((prev) => (prev === node.index ? null : prev))
                  }
                  style={{
                    transform: `scale(${node.perspectiveScale.toFixed(2)})`,
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer group focus:outline-none"
                  title={`${node.point.title || `Hike #${node.point.event_no}`} (${formatDist(
                    node.point.total_km || 0,
                    1
                  )} • ${node.zoneLabel})`}
                >
                  {/* Multi-Ring Pulsing Glow Aura around Selected Point */}
                  {isSelected && (
                    <>
                      <span className="absolute w-8 h-8 rounded-full bg-[#C4ED39]/30 animate-ping pointer-events-none" />
                      <span className="absolute w-6 h-6 rounded-full bg-cyan-300/40 animate-pulse pointer-events-none" />
                    </>
                  )}

                  <span
                    className={`rounded-full transition-all duration-200 group-hover:scale-125 shadow-sm ${
                      isSelected
                        ? 'w-4 h-4 bg-[#C4ED39] border-2 border-stone-950 ring-2 ring-white'
                        : heatMapEnabled
                        ? 'w-3 h-3 border border-stone-950'
                        : node.isSummit || node.isBaseCamp
                        ? 'w-3.5 h-3.5 bg-[#C4ED39] border-2 border-stone-950'
                        : showMilestone
                        ? 'w-3.5 h-3.5 bg-amber-300 border-2 border-stone-950'
                        : node.isTrekEvent
                        ? 'w-3 h-3 bg-amber-400 border-2 border-stone-900'
                        : node.spurRelief >= 0
                        ? 'w-2.5 h-2.5 bg-white border-2 border-[#1B5E20]'
                        : 'w-2 h-2 bg-emerald-100/90 border border-[#144418]'
                    }`}
                    style={
                      heatMapEnabled && !isSelected
                        ? { backgroundColor: node.heatColor }
                        : undefined
                    }
                  />
                </button>

                {/* Hover Micro-Interaction Preview Pill */}
                {isHovered && (
                  <div
                    data-no-drag="true"
                    style={{
                      transform: `translate(-50%, -135%) scale(${invZoomScale.toFixed(2)})`,
                      transformOrigin: 'bottom center',
                    }}
                    className="absolute left-1/2 top-0 z-30 pointer-events-none bg-stone-950/95 backdrop-blur-md text-white px-2 py-1 rounded-lg border border-[#C4ED39]/60 shadow-lg whitespace-nowrap transition-all duration-150"
                  >
                    <div className="text-[8.5px] font-extrabold text-[#C4ED39]">
                      #{node.point.event_no} • {node.point.title || 'Trail Hike'}
                    </div>
                    <div className="text-[8px] font-semibold text-white/85">
                      {formatDist(node.point.total_km || 0, 1)} (+{formatDist(node.deltaKm, 1)}) • Alt{' '}
                      {formatAlt(node.altitudeM)}
                    </div>
                  </div>
                )}

                {/* Spaced Major Milestone Celebration Marker */}
                {showCompactTag && (
                  <div
                    onClick={() => handleRestPointClick(node)}
                    data-no-drag="true"
                    style={{
                      transform: `translateY(-50%) scale(${invZoomScale.toFixed(2)})`,
                      transformOrigin: placeTagRight ? 'left center' : 'right center',
                    }}
                    className={`absolute top-1/2 cursor-pointer whitespace-nowrap px-1.5 py-0.5 rounded-md text-[8.5px] leading-none border transition-transform hover:scale-105 flex items-center gap-1 bg-gradient-to-r from-amber-300 to-yellow-400 text-stone-950 border-white font-extrabold shadow-sm ${
                      placeTagRight ? 'left-4' : 'right-4'
                    }`}
                  >
                    <Trophy className="w-2.5 h-2.5 text-amber-900 shrink-0" />
                    <span>
                      {trophyMilestone! >= 1000
                        ? `${(trophyMilestone! / 1000).toFixed(
                            trophyMilestone! % 1000 === 0 ? 0 : 1
                          )}k`
                        : trophyMilestone}{' '}
                      km
                    </span>
                  </div>
                )}

                {/* Compact Selected Point Pop-Up Card */}
                {isSelected && (
                  <div
                    data-no-drag="true"
                    style={
                      isNearSummitCrown
                        ? {
                            left: '16px',
                            top: '50%',
                            transform: `translate(0, -50%) scale(${invZoomScale.toFixed(2)})`,
                            transformOrigin: 'left center',
                          }
                        : {
                            left: '50%',
                            top: '0px',
                            transform: `${
                              node.x > sceneWidth * 0.66
                                ? 'translate(-92%, -110%)'
                                : node.x < sceneWidth * 0.34
                                ? 'translate(-8%, -110%)'
                                : 'translate(-50%, -112%)'
                            } scale(${invZoomScale.toFixed(2)})`,
                            transformOrigin: 'bottom center',
                          }
                    }
                    className="absolute z-30 bg-stone-950/92 backdrop-blur-xl text-white px-2 py-1.5 rounded-lg shadow-xl border border-[#C4ED39]/60 min-w-[138px] max-w-[168px] pointer-events-auto"
                  >
                    {/* Compact Header Row + Prev/Next Navigation */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[8px] font-extrabold uppercase tracking-wider px-1 py-0.2 rounded bg-[#C4ED39] text-stone-950 leading-tight">
                        {node.isSummit
                          ? `Summit #${node.point.event_no}`
                          : node.isBaseCamp
                          ? `Base #${node.point.event_no}`
                          : `#${node.point.event_no}`}
                      </span>
                      <span className="text-[8px] font-semibold text-white/70 truncate">
                        {node.point.date}
                      </span>
                      <div className="flex items-center gap-0.5 ml-auto shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAdjacentNode(-1);
                          }}
                          disabled={node.index === 0}
                          title="Previous Hike"
                          className="p-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-2.5 h-2.5 text-white" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAdjacentNode(1);
                          }}
                          disabled={node.index === trailNodes.length - 1}
                          title="Next Hike"
                          className="p-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Hike Title */}
                    <div className="text-[9.5px] font-extrabold text-white truncate mt-0.5 leading-tight">
                      {node.point.title || `Event #${node.point.event_no}`}
                    </div>

                    {/* Distance & Delta Row */}
                    <div className="flex items-baseline justify-between gap-1.5 mt-0.5 leading-tight">
                      <div className="text-[9.5px] font-black text-[#C4ED39]">
                        {formatDist(node.point.total_km || 0, 1)}{' '}
                        <span className="text-[8px] font-bold text-emerald-300">
                          (+{formatDist(node.deltaKm, 1)})
                        </span>
                      </div>
                      <span className="text-[8px] font-bold text-sky-300 shrink-0">
                        {formatAlt(node.altitudeM)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
