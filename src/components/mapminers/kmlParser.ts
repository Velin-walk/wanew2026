// KML Parser utility - converts KML/GPX to usable route data with TypeScript support

export interface Coordinate {
  lat: number;
  lng: number;
  ele: number;
}

export interface RouteStats {
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  minElevation: number;
  maxElevation: number;
  startElevation: number;
  endElevation: number;
  estimatedHours: number;
  pointCount: number;
}

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
  type: 'start' | 'mid' | 'end';
}

export interface ParsedRoute {
  id: string;
  name: string;
  description: string;
  coordinates: Coordinate[];
  lineSegments: Coordinate[][];
  displayLineSegments: Coordinate[][];
  stats: RouteStats;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Extreme';
  elevationProfile: { distance: number; elevation: number; index: number }[];
  sampledCoords: Coordinate[];
  waypoints: Waypoint[];
  bounds: [[number, number], [number, number]];
  fileName: string;
  uploadedAt: string;
}

export function parseKML(kmlText: string, fileName: string, nameOverride = ''): ParsedRoute | null {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'application/xml');

  // Case-insensitive name and description tags search
  const allElements = Array.from(xmlDoc.getElementsByTagName('*'));
  const nameEl = allElements.find(el => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    return name === 'name' || name.endsWith(':name');
  });
  const name = nameOverride.trim() || nameEl?.textContent?.trim() || fileName.replace('.kml', '').replace(/_/g, ' ');

  const descEl = allElements.find(el => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    return name === 'description' || name.endsWith(':description');
  });
  const description = descEl?.textContent?.trim() || '';

  const lineSegments = extractLineSegments(xmlDoc);
  const coordinates = lineSegments.flat();

  if (coordinates.length === 0) return null;

  const stats = calculateStats(lineSegments);
  const difficulty = getDifficulty(stats);

  const { elevationProfile, sampledCoords } = buildElevationProfile(lineSegments, 300);
  const displayLineSegments = simplifyLineSegments(lineSegments, 12000);

  const waypoints: Waypoint[] = [
    { lat: coordinates[0].lat, lng: coordinates[0].lng, label: 'Start', type: 'start' },
    { lat: coordinates[Math.floor(coordinates.length / 2)].lat, lng: coordinates[Math.floor(coordinates.length / 2)].lng, label: 'Midpoint', type: 'mid' },
    { lat: coordinates[coordinates.length - 1].lat, lng: coordinates[coordinates.length - 1].lng, label: 'End', type: 'end' },
  ];

  const bounds = calculateBounds(coordinates);

  return {
    id: generateId(),
    name,
    description,
    coordinates,
    lineSegments,
    displayLineSegments,
    stats,
    difficulty,
    elevationProfile,
    sampledCoords,
    waypoints,
    bounds,
    fileName,
    uploadedAt: new Date().toISOString(),
  };
}

export function routeToGPX(route: any): string {
  const segments = route?.lineSegments?.length ? route.lineSegments : [route?.coordinates || []];
  const tracks = segments.map((segment: Coordinate[]) => segment.map(point => {
    const elevation = Number.isFinite(point.ele) ? `<ele>${point.ele}</ele>` : '';
    return `<trkpt lat="${point.lat}" lon="${point.lng}">${elevation}</trkpt>`;
  }).join('')).join('');
  const name = String(route?.name || 'Hiking Route')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="KTM Hike Trail" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg>${tracks}</trkseg></trk></gpx>`;
}

export function parseGPX(gpxText: string, fileName: string, nameOverride = ''): ParsedRoute | null {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxText, 'application/xml');
  const allElements = Array.from(xmlDoc.getElementsByTagName('*'));

  // Let's find all track segments (<trkseg>) and route segments (<rte>)
  const segments: Coordinate[][] = [];

  // 1. Find all trkseg elements
  const trksegs = allElements.filter(el => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    return name === 'trkseg' || name.endsWith(':trkseg');
  });

  if (trksegs.length > 0) {
    trksegs.forEach(seg => {
      const segPoints: Coordinate[] = [];
      const trkpts = Array.from(seg.getElementsByTagName('*')).filter(el => {
        const name = (el.localName || el.nodeName || '').toLowerCase();
        return name === 'trkpt' || name.endsWith(':trkpt');
      });
      trkpts.forEach(pt => {
        const latAttr = pt.getAttribute('lat');
        const lonAttr = pt.getAttribute('lon');
        if (latAttr && lonAttr) {
          const lat = parseFloat(latAttr);
          const lng = parseFloat(lonAttr);
          let ele = 0;
          const eleEl = Array.from(pt.getElementsByTagName('*')).find(child => {
            const cName = (child.localName || child.nodeName || '').toLowerCase();
            return cName === 'ele' || cName.endsWith(':ele');
          });
          if (eleEl) ele = parseFloat(eleEl.textContent || '0');
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            segPoints.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
          }
        }
      });
      if (segPoints.length > 0) {
        segments.push(segPoints);
      }
    });
  }

  // 2. If no track segments, check for routes (<rte>)
  if (segments.length === 0) {
    const rtes = allElements.filter(el => {
      const name = (el.localName || el.nodeName || '').toLowerCase();
      return name === 'rte' || name.endsWith(':rte');
    });
    rtes.forEach(rte => {
      const rtePoints: Coordinate[] = [];
      const rtepts = Array.from(rte.getElementsByTagName('*')).filter(el => {
        const name = (el.localName || el.nodeName || '').toLowerCase();
        return name === 'rtept' || name.endsWith(':rtept');
      });
      rtepts.forEach(pt => {
        const latAttr = pt.getAttribute('lat');
        const lonAttr = pt.getAttribute('lon');
        if (latAttr && lonAttr) {
          const lat = parseFloat(latAttr);
          const lng = parseFloat(lonAttr);
          let ele = 0;
          const eleEl = Array.from(pt.getElementsByTagName('*')).find(child => {
            const cName = (child.localName || child.nodeName || '').toLowerCase();
            return cName === 'ele' || cName.endsWith(':ele');
          });
          if (eleEl) ele = parseFloat(eleEl.textContent || '0');
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            rtePoints.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
          }
        }
      });
      if (rtePoints.length > 0) {
        segments.push(rtePoints);
      }
    });
  }

  // 3. Fallback: if still no segments, look for any loose trackpts/routepts
  if (segments.length === 0) {
    const loosePts = allElements.filter(el => {
      const name = (el.localName || el.nodeName || '').toLowerCase();
      return name === 'trkpt' || name === 'rtept' || name.endsWith(':trkpt') || name.endsWith(':rtept');
    });
    const parsedPts: Coordinate[] = [];
    loosePts.forEach(pt => {
      const latAttr = pt.getAttribute('lat');
      const lonAttr = pt.getAttribute('lon');
      if (latAttr && lonAttr) {
        const lat = parseFloat(latAttr);
        const lng = parseFloat(lonAttr);
        let ele = 0;
        const eleEl = Array.from(pt.getElementsByTagName('*')).find(child => {
          const cName = (child.localName || child.nodeName || '').toLowerCase();
          return cName === 'ele' || cName.endsWith(':ele');
        });
        if (eleEl) ele = parseFloat(eleEl.textContent || '0');
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          parsedPts.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
        }
      }
    });
    if (parsedPts.length > 0) {
      segments.push(parsedPts);
    }
  }

  // 4. Fallback: look for waypoints (<wpt>) if no tracks or routes exist
  if (segments.length === 0) {
    const wpts = allElements.filter(el => {
      const name = (el.localName || el.nodeName || '').toLowerCase();
      return name === 'wpt' || name.endsWith(':wpt');
    });
    const parsedWpts: Coordinate[] = [];
    wpts.forEach(pt => {
      const latAttr = pt.getAttribute('lat');
      const lonAttr = pt.getAttribute('lon');
      if (latAttr && lonAttr) {
        const lat = parseFloat(latAttr);
        const lng = parseFloat(lonAttr);
        let ele = 0;
        const eleEl = Array.from(pt.getElementsByTagName('*')).find(child => {
          const cName = (child.localName || child.nodeName || '').toLowerCase();
          return cName === 'ele' || cName.endsWith(':ele');
        });
        if (eleEl) ele = parseFloat(eleEl.textContent || '0');
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          parsedWpts.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0 });
        }
      }
    });
    if (parsedWpts.length > 0) {
      segments.push(parsedWpts);
    }
  }

  if (segments.length === 0) return null;

  // Metadata/names search
  const metadataNameEl = allElements.find(el => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    const parentName = ((el.parentNode as any)?.localName || el.parentNode?.nodeName || '').toLowerCase();
    return (name === 'name' || name.endsWith(':name')) && (parentName === 'metadata' || parentName === 'trk' || parentName === 'rte' || parentName.endsWith(':metadata') || parentName.endsWith(':trk') || parentName.endsWith(':rte'));
  });
  
  const fallbackName = metadataNameEl?.textContent?.trim() || fileName.replace(/\.gpx$/i, '').replace(/_/g, ' ');
  const name = nameOverride || fallbackName;

  const metadataDescEl = allElements.find(el => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    const parentName = ((el.parentNode as any)?.localName || el.parentNode?.nodeName || '').toLowerCase();
    return (name === 'desc' || name.endsWith(':desc') || name === 'description' || name.endsWith(':description')) && (parentName === 'metadata' || parentName === 'trk' || parentName === 'rte' || parentName.endsWith(':metadata') || parentName.endsWith(':trk') || parentName.endsWith(':rte'));
  });
  const description = metadataDescEl?.textContent?.trim() || '';

  const coordinates = segments.flat();
  const stats = calculateStats(segments);
  const difficulty = getDifficulty(stats);
  const { elevationProfile, sampledCoords } = buildElevationProfile(segments, 300);
  const displayLineSegments = simplifyLineSegments(segments, 12000);

  const waypoints: Waypoint[] = [
    { lat: coordinates[0].lat, lng: coordinates[0].lng, label: 'Start', type: 'start' },
    { lat: coordinates[Math.floor(coordinates.length / 2)].lat, lng: coordinates[Math.floor(coordinates.length / 2)].lng, label: 'Midpoint', type: 'mid' },
    { lat: coordinates[coordinates.length - 1].lat, lng: coordinates[coordinates.length - 1].lng, label: 'End', type: 'end' },
  ];

  const bounds = calculateBounds(coordinates);

  return {
    id: generateId(),
    name,
    description,
    coordinates,
    lineSegments: segments,
    displayLineSegments,
    stats,
    difficulty,
    elevationProfile,
    sampledCoords,
    waypoints,
    bounds,
    fileName,
    uploadedAt: new Date().toISOString(),
  };
}

function parseCoordinateString(str: string): Coordinate[] {
  if (!str) return [];
  // Normalize whitespace and remove spaces next to commas to support malformed structures
  const normalized = str.trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s*,\s*/g, ',');

  return normalized.split(/\s+/)
    .map(coord => {
      if (!coord) return null;
      const parts = coord.split(',');
      if (parts.length < 2) return null;
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const ele = parts[2] ? parseFloat(parts[2]) : 0;
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng, ele };
    })
    .filter((x): x is Coordinate => !!x);
}

function extractLineSegments(xmlDoc: Document): Coordinate[][] {
  const segments: Coordinate[][] = [];
  const allElements = Array.from(xmlDoc.getElementsByTagName('*'));

  const isCoordinatesNode = (el: Element) => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    return name === 'coordinates' || name.endsWith(':coordinates');
  };

  const isLineStringNode = (el: Element) => {
    const name = (el.localName || el.nodeName || '').toLowerCase();
    return name.includes('linestring');
  };

  // 1. Search coordinates in LineString (case-insensitive & namespace-insensitive)
  allElements.forEach(el => {
    if (isCoordinatesNode(el)) {
      const parent = el.parentNode as Element;
      const parentName = (parent?.localName || parent?.nodeName || '').toLowerCase();
      if (isLineStringNode(parent) || parentName.includes('linestring') || parentName.includes('multigeometry') || parentName.includes('track')) {
        const parsed = parseCoordinateString(el.textContent || '');
        if (parsed.length > 0) segments.push(parsed);
      }
    }
  });

  // 2. Fallback to any coordinates tag if no LineString matched
  if (segments.length === 0) {
    allElements.forEach(el => {
      if (isCoordinatesNode(el)) {
        const parsed = parseCoordinateString(el.textContent || '');
        if (parsed.length >= 2) {
          segments.push(parsed);
        }
      }
    });
  }

  // 3. Fallback to Track / gx:Track structure
  if (segments.length === 0) {
    allElements.forEach(el => {
      const name = (el.localName || el.nodeName || '').toLowerCase();
      if (name.includes('track')) {
        const trackChildren = Array.from(el.getElementsByTagName('*'));
        const parsed: Coordinate[] = [];
        trackChildren.forEach(child => {
          const childName = (child.localName || child.nodeName || '').toLowerCase();
          if (childName.includes('coord') || childName.endsWith(':coord')) {
            const parts = (child.textContent || '').trim().split(/\s+/);
            if (parts.length >= 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              const ele = parts[2] ? parseFloat(parts[2]) : 0;
              if (!isNaN(lat) && !isNaN(lng)) {
                parsed.push({ lat, lng, ele: isNaN(ele) ? 0 : ele });
              }
            }
          }
        });
        if (parsed.length > 0) segments.push(parsed);
      }
    });
  }

  // 4. Ultimate fallback: if there are any coordinates with length >= 1, take them
  if (segments.length === 0) {
    allElements.forEach(el => {
      if (isCoordinatesNode(el)) {
        const parsed = parseCoordinateString(el.textContent || '');
        if (parsed.length > 0) {
          segments.push(parsed);
        }
      }
    });
  }

  return segments;
}

function haversineDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371000;
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateStats(segments: Coordinate[][]): RouteStats {
  const coords = segments.flat();
  let totalDist = 0, gain = 0, loss = 0;
  let minEle = Infinity, maxEle = -Infinity;

  for (let i = 0; i < coords.length; i++) {
    if (coords[i].ele < minEle) minEle = coords[i].ele;
    if (coords[i].ele > maxEle) maxEle = coords[i].ele;
  }

  segments.forEach(segment => {
    for (let i = 1; i < segment.length; i++) {
      totalDist += haversineDistance(segment[i - 1], segment[i]);
      const eleDiff = segment[i].ele - segment[i - 1].ele;
      if (eleDiff > 0) gain += eleDiff;
      else loss += Math.abs(eleDiff);
    }
  });

  const distKm = totalDist / 1000;
  const estimatedHours = (distKm / 5) + (gain / 600);

  return {
    distance: parseFloat(distKm.toFixed(2)),
    elevationGain: Math.round(gain),
    elevationLoss: Math.round(loss),
    minElevation: Math.round(minEle === Infinity ? 0 : minEle),
    maxElevation: Math.round(maxEle === -Infinity ? 0 : maxEle),
    startElevation: Math.round(coords[0]?.ele || 0),
    endElevation: Math.round(coords[coords.length - 1]?.ele || 0),
    estimatedHours: parseFloat(estimatedHours.toFixed(1)),
    pointCount: coords.length,
  };
}

function buildElevationProfile(segments: Coordinate[][], maxPoints: number) {
  const pointsWithDistance: { coord: Coordinate; distance: number }[] = [];
  let runningDistanceKm = 0;

  segments.forEach(segment => {
    if (!segment.length) return;
    pointsWithDistance.push({ coord: segment[0], distance: runningDistanceKm });
    for (let i = 1; i < segment.length; i++) {
      runningDistanceKm += haversineDistance(segment[i - 1], segment[i]) / 1000;
      pointsWithDistance.push({ coord: segment[i], distance: runningDistanceKm });
    }
  });

  const sampled = sampleArray(pointsWithDistance, maxPoints);
  return {
    elevationProfile: sampled.map((p, i) => ({
      distance: parseFloat(p.distance.toFixed(2)),
      elevation: Math.round(p.coord.ele),
      index: i,
    })),
    sampledCoords: sampled.map(p => p.coord),
  };
}

export function simplifyLineSegments(segments: Coordinate[][], maxTotalPoints: number): Coordinate[][] {
  const totalPoints = segments.reduce((sum, seg) => sum + seg.length, 0);
  if (totalPoints <= maxTotalPoints) return segments;

  const ratio = maxTotalPoints / totalPoints;
  return segments.map(segment => {
    if (segment.length <= 2) return segment;
    const targetCount = Math.max(2, Math.floor(segment.length * ratio));
    return sampleSegmentPreserveEnds(segment, targetCount);
  });
}

function sampleSegmentPreserveEnds(segment: Coordinate[], targetCount: number): Coordinate[] {
  if (segment.length <= targetCount) return segment;
  if (targetCount <= 2) return [segment[0], segment[segment.length - 1]];

  const sampled = [segment[0]];
  const interiorCount = targetCount - 2;
  const interiorLength = segment.length - 2;
  const step = interiorLength / interiorCount;

  for (let i = 0; i < interiorCount; i++) {
    const idx = 1 + Math.floor(i * step);
    sampled.push(segment[idx]);
  }

  sampled.push(segment[segment.length - 1]);
  return sampled;
}

function getDifficulty(stats: RouteStats): 'Easy' | 'Moderate' | 'Hard' | 'Extreme' {
  const score = (stats.distance * 0.5) + (stats.elevationGain / 100);
  if (score < 8) return 'Easy';
  if (score < 20) return 'Moderate';
  if (score < 40) return 'Hard';
  return 'Extreme';
}

function sampleArray<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => arr[Math.floor(i * step)]);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function calculateBounds(coords: Coordinate[]): [[number, number], [number, number]] {
  if (!coords || coords.length === 0) {
    return [[27.6, 85.2], [27.8, 85.5]];
  }

  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (c.lat < minLat) minLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

export function parseRouteFile(fileText: string, fileName: string, nameOverride = ''): ParsedRoute | null {
  if (!fileText || typeof fileText !== 'string' || !fileText.trim()) return null;

  const cleanText = fileText.trim().replace(/^\uFEFF/, '');
  const lower = cleanText.toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase();

  // If text contains GPX markers or extension is .gpx
  if (lower.includes('<gpx') || lower.includes('<trk') || lower.includes('<trkpt') || ext === 'gpx') {
    try {
      const gpxResult = parseGPX(cleanText, fileName, nameOverride);
      if (gpxResult && gpxResult.coordinates && gpxResult.coordinates.length > 0) {
        return gpxResult;
      }
    } catch (_) {}
  }

  // Try KML
  try {
    const kmlResult = parseKML(cleanText, fileName, nameOverride);
    if (kmlResult && kmlResult.coordinates && kmlResult.coordinates.length > 0) {
      return kmlResult;
    }
  } catch (_) {}

  // Fallback try GPX if KML didn't match
  try {
    const fallbackGpx = parseGPX(cleanText, fileName, nameOverride);
    if (fallbackGpx && fallbackGpx.coordinates && fallbackGpx.coordinates.length > 0) {
      return fallbackGpx;
    }
  } catch (_) {}

  return null;
}
