// Generates demo KML data for Nepal hiking routes
import { Coordinate, RouteStats, Waypoint } from './kmlParser';

export interface DemoRoute {
  id: string;
  name: string;
  description: string;
  coordinates: Coordinate[];
  stats: RouteStats;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Extreme';
  elevationProfile: { distance: number; elevation: number }[];
  sampledCoords: Coordinate[];
  waypoints: Waypoint[];
  bounds: [[number, number], [number, number]];
  fileName: string;
  uploadedAt: string;
  isDemo: boolean;
}

export function generateDemoRoutes(): DemoRoute[] {
  return [
    generateEverestBasecamp(),
    generateAnnapurnaCircuit(),
    generateLangtangValley(),
  ];
}

function makeDemoRoute(name: string, description: string, difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Extreme', coordsFn: () => Coordinate[]): DemoRoute {
  const coordinates = coordsFn();
  const stats = calcStats(coordinates);
  const sampled = sampleCoords(coordinates, 200);
  const elevationProfile = sampled.map((c, i, arr) => ({
    distance: parseFloat(cumDist(arr, i).toFixed(2)),
    elevation: Math.round(c.ele),
  }));

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);

  return {
    id: Math.random().toString(36).substring(2, 11),
    name,
    description,
    coordinates,
    stats,
    difficulty,
    elevationProfile,
    sampledCoords: sampled,
    waypoints: [
      { lat: coordinates[0].lat, lng: coordinates[0].lng, label: 'Start', type: 'start' },
      { lat: coordinates[Math.floor(coordinates.length / 2)].lat, lng: coordinates[Math.floor(coordinates.length / 2)].lng, label: 'Midpoint', type: 'mid' },
      { lat: coordinates[coordinates.length - 1].lat, lng: coordinates[coordinates.length - 1].lng, label: 'End', type: 'end' },
    ],
    bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
    fileName: name.replace(/ /g, '_') + '.kml',
    uploadedAt: new Date().toISOString(),
    isDemo: true,
  };
}

function generateEverestBasecamp(): DemoRoute {
  const points: Coordinate[] = [];
  const waypts = [
    [27.6868, 86.7314, 2860], [27.7381, 86.7133, 3440], [27.7980, 86.7147, 3962],
    [27.8219, 86.7146, 4280], [27.8441, 86.7599, 4358], [27.8600, 86.7990, 4730],
    [27.8836, 86.8153, 4930], [27.9175, 86.8197, 5140], [27.9804, 86.8500, 5364],
  ];
  for (let i = 0; i < waypts.length - 1; i++) {
    const [lat1, lng1, ele1] = waypts[i];
    const [lat2, lng2, ele2] = waypts[i + 1];
    const steps = 60;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const noise = (Math.random() - 0.5) * 0.002;
      points.push({
        lat: lat1 + (lat2 - lat1) * t + noise,
        lng: lng1 + (lng2 - lng1) * t + noise * 0.5,
        ele: ele1 + (ele2 - ele1) * t + Math.sin(s * 0.5) * 30 + Math.random() * 20,
      });
    }
  }
  return makeDemoRoute(
    'Everest Base Camp Trek',
    'The classic trek to the foot of the world\'s highest peak. Passes through Sherpa villages, glacial moraines, and dramatic Himalayan scenery.',
    'Hard',
    () => points
  );
}

function generateAnnapurnaCircuit(): DemoRoute {
  const points: Coordinate[] = [];
  const waypts = [
    [28.2096, 84.0290, 820], [28.3341, 84.1219, 1890], [28.4000, 84.2000, 2630],
    [28.5245, 84.2312, 3500], [28.5901, 84.2258, 4130], [28.6417, 84.2222, 4522],
    [28.6870, 84.1756, 5416], [28.6300, 84.0900, 4600], [28.5500, 83.9800, 3800],
    [28.4500, 83.8900, 2700], [28.3200, 83.8200, 1800],
  ];
  for (let i = 0; i < waypts.length - 1; i++) {
    const [lat1, lng1, ele1] = waypts[i];
    const [lat2, lng2, ele2] = waypts[i + 1];
    const steps = 50;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const noise = (Math.random() - 0.5) * 0.003;
      points.push({
        lat: lat1 + (lat2 - lat1) * t + noise,
        lng: lng1 + (lng2 - lng1) * t + noise,
        ele: ele1 + (ele2 - ele1) * t + Math.cos(s * 0.3) * 40 + Math.random() * 25,
      });
    }
  }
  return makeDemoRoute(
    'Annapurna Circuit',
    'A legendary 200km+ circuit around the Annapurna massif, crossing Thorong La pass at 5,416m. One of the world\'s greatest treks.',
    'Extreme',
    () => points
  );
}

function generateLangtangValley(): DemoRoute {
  const points: Coordinate[] = [];
  const waypts = [
    [28.1083, 85.2808, 1400], [28.1700, 85.3200, 2380], [28.2300, 85.3700, 3430],
    [28.2900, 85.4200, 3870], [28.3500, 85.4800, 4080], [28.3978, 85.5197, 4380],
  ];
  for (let i = 0; i < waypts.length - 1; i++) {
    const [lat1, lng1, ele1] = waypts[i];
    const [lat2, lng2, ele2] = waypts[i + 1];
    const steps = 55;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const noise = (Math.random() - 0.5) * 0.002;
      points.push({
        lat: lat1 + (lat2 - lat1) * t + noise,
        lng: lng1 + (lng2 - lng1) * t + noise * 0.7,
        ele: ele1 + (ele2 - ele1) * t + Math.sin(s * 0.4) * 25 + Math.random() * 15,
      });
    }
  }
  return makeDemoRoute(
    'Langtang Valley Trek',
    'A hidden gem north of Kathmandu offering stunning glacier views, traditional Tamang villages, and the beautiful Langtang Valley.',
    'Moderate',
    () => points
  );
}

function calcStats(coords: Coordinate[]): RouteStats {
  let totalDist = 0, gain = 0, loss = 0;
  let minEle = Infinity, maxEle = -Infinity;
  for (let i = 0; i < coords.length; i++) {
    if (coords[i].ele < minEle) minEle = coords[i].ele;
    if (coords[i].ele > maxEle) maxEle = coords[i].ele;
  }
  for (let i = 1; i < coords.length; i++) {
    totalDist += hav(coords[i - 1], coords[i]);
    const diff = coords[i].ele - coords[i - 1].ele;
    if (diff > 0) gain += diff; else loss += Math.abs(diff);
  }
  const distKm = totalDist / 1000;
  return {
    distance: parseFloat(distKm.toFixed(2)),
    elevationGain: Math.round(gain),
    elevationLoss: Math.round(loss),
    minElevation: Math.round(minEle),
    maxElevation: Math.round(maxEle),
    startElevation: Math.round(coords[0].ele),
    endElevation: Math.round(coords[coords.length - 1].ele),
    estimatedHours: parseFloat(((distKm / 5) + (gain / 600)).toFixed(1)),
    pointCount: coords.length,
  };
}

function hav(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) {
  const R = 6371000;
  const φ1 = p1.lat * Math.PI / 180, φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cumDist(arr: Coordinate[], idx: number) {
  let d = 0;
  for (let i = 1; i <= idx; i++) d += hav(arr[i - 1], arr[i]) / 1000;
  return d;
}

function sampleCoords(arr: Coordinate[], max: number) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}
