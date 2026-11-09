import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Footprints, Mountain, Sparkles, Trophy, RotateCcw, ZoomIn, ZoomOut, Info, Box } from 'lucide-react';
import { JourneyPoint } from './3d/LowPolyMountainTrailChart';
import { triggerHaptic } from '../utils/haptics';

interface SpiralDistanceBarChartProps {
  points: JourneyPoint[];
  activePoint: JourneyPoint | null;
  onSelectPoint: (pt: JourneyPoint) => void;
  milestones?: Array<{ km: number; trek: string }>;
  totalCommunityKm?: number;
}

// Ultra-vibrant 8-color jewel spectrum with high-chroma PBR metallic finishes
const VIBRANT_PALETTE = [
  '#f43f5e', // Crimson Rose
  '#f59e0b', // Electric Gold
  '#ff6b00', // Neon Blaze Orange
  '#00f2fe', // Cyan Aqua
  '#8b5cf6', // Royal Violet
  '#10b981', // Emerald Green
  '#ec4899', // Hot Pink
  '#3b82f6', // Sapphire Blue
];

export const SpiralDistanceBarChart: React.FC<SpiralDistanceBarChartProps> = ({
  points,
  activePoint,
  onSelectPoint,
  milestones = [],
  totalCommunityKm: propTotalCommunityKm,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // Derive per-event distance (e.g. 60km, 200km) so each 3D bar height is relative to one event total
  const { processedPoints, maxKm, totalCumKm } = useMemo(() => {
    let runningCum = 0;
    const items = sortedPoints.map((p, idx) => {
      let eventKm = 20;
      let eventHike = 0;
      let eventTrek = 0;

      if (typeof p.event_km === 'number' && p.event_km > 0) {
        eventKm = p.event_km;
        eventHike = p.event_hike_km ?? p.hike_km ?? 0;
        eventTrek = p.event_trek_km ?? p.trek_km ?? 0;
      } else {
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
        isTrek,
      };
    });

    let max = 25;
    let sum = 0;
    items.forEach((pt) => {
      if (pt.event_km > max) max = pt.event_km;
      sum += pt.event_km;
    });

    const totalCum = items.length > 0 ? items[items.length - 1].cum_total_km : sum;

    return {
      processedPoints: items,
      maxKm: max,
      totalCumKm: totalCum,
    };
  }, [sortedPoints]);

  // References for Three.js state management
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = useRef<{ mesh: THREE.Mesh; basePosY: number; targetPosY: number; point: any; index: number; colorHex: string }[]>([]);

  // Reset Camera View to isometric top-3/4 preset
  const handleResetCamera = useCallback(() => {
    triggerHaptic(12);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 16, 16);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    triggerHaptic(10);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(0.8);
      controlsRef.current.update();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    triggerHaptic(10);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(1.25);
      controlsRef.current.update();
    }
  }, []);

  // Three.js 3D Scene Initialization and Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container || processedPoints.length === 0) return;

    // Detect software rendering guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 560;

    // 1. Ultra-Premium Stage Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b0f19'); // Deep midnight studio environment
    scene.fog = new THREE.FogExp2('#0b0f19', 0.02);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 16, 16);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 35;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // 5. Studio Environment reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 6. High-Contrast Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight('#1e293b', 0.8);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0b0f19', 0.9);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff7ed', 1.8);
    keyLight.position.set(14, 20, 12);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 40;
      const d = 12;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Cyan Fill light from left
    const fillLight = new THREE.DirectionalLight('#00f2fe', 0.9);
    fillLight.position.set(-12, 12, -10);
    scene.add(fillLight);

    // Purple Rim light from back
    const rimLight = new THREE.DirectionalLight('#a855f7', 1.2);
    rimLight.position.set(0, 8, -16);
    scene.add(rimLight);

    // 7. Dark Metallic Stage Ground Plane & Soft Glow Disc
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.35,
      metalness: 0.6,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);

    // Soft Radial Glow Stage Disc under the spiral
    const shadowDiscGeo = new THREE.CircleGeometry(10.5, 64);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: '#1e1b4b',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.01;
    scene.add(shadowDisc);

    // 8. Generate 3D Glowing Archimedean Spiral Path Baseline
    const N = processedPoints.length;
    let windings = 2.75;
    if (N <= 15) windings = 1.2;
    else if (N <= 35) windings = 1.75;
    else if (N <= 70) windings = 2.25;
    else windings = 2.85;

    const rMin = 2.8;
    const rMax = 8.5;
    const maxBarHeight = 5.4;

    const startAngle = -Math.PI / 2;
    const totalAngle = windings * 2 * Math.PI;

    // Draw baseline spiral tube with glowing golden/cyan finish
    const spiralPoints: THREE.Vector3[] = [];
    const steps = 300;
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps;
      const angle = startAngle + frac * totalAngle;
      const r = rMin + frac * (rMax - rMin);
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      spiralPoints.push(new THREE.Vector3(x, 0.04, z));
    }
    const spiralCurve = new THREE.CatmullRomCurve3(spiralPoints);
    const spiralTubeGeo = new THREE.TubeGeometry(spiralCurve, 200, 0.05, 10, false);
    const spiralTubeMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8,
    });
    const spiralTubeMesh = new THREE.Mesh(spiralTubeGeo, spiralTubeMat);
    scene.add(spiralTubeMesh);

    // Concentric Neon Rings on stage floor
    [rMin, (rMin + rMax) / 2, rMax].forEach((r, ringIdx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.02, r + 0.02, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringIdx === 1 ? '#00f2fe' : '#38bdf8',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.015;
      scene.add(ringMesh);
    });

    // 9. Generate 3D Glossy Clearcoat Event Bar Columns
    const barMeshes: { mesh: THREE.Mesh; basePosY: number; targetPosY: number; point: any; index: number; colorHex: string }[] = [];
    
    processedPoints.forEach((p, idx) => {
      const frac = N === 1 ? 0.5 : idx / (N - 1);
      const angle = startAngle + frac * totalAngle;
      const r = rMin + frac * (rMax - rMin);

      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);

      // Height strictly proportional to event_km relative to maxKm
      const barH = Math.max(0.35, (Math.min(p.event_km, maxKm) / maxKm) * maxBarHeight);
      
      const circumferenceAtR = 2 * Math.PI * r;
      const slotWidth = (circumferenceAtR * windings) / N;
      const barWidth = Math.max(0.18, Math.min(0.55, slotWidth * 0.65));
      const barDepth = 0.36;

      const barGeo = new THREE.BoxGeometry(barWidth, barH, barDepth);

      const colorHex = VIBRANT_PALETTE[idx % VIBRANT_PALETTE.length];
      
      // High-grade glossy MeshPhysicalMaterial with clearcoat finish
      const barMat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.18,
        metalness: 0.35,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        emissive: colorHex,
        emissiveIntensity: 0.2,
      });

      const mesh = new THREE.Mesh(barGeo, barMat);
      
      // Anchor bottom flush to Y=0
      const basePosY = barH / 2 + 0.02;
      mesh.position.set(x, basePosY, z);
      
      // Rotate outward along spiral tangent
      mesh.rotation.y = -angle;

      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;

      mesh.userData = { index: idx, point: p, colorHex };

      scene.add(mesh);
      barMeshes.push({
        mesh,
        basePosY,
        targetPosY: basePosY,
        point: p,
        index: idx,
        colorHex,
      });
    });

    meshesRef.current = barMeshes;

    // 10. Raycasting & Interaction Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersections = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(barMeshes.map((b) => b.mesh));
      return intersects;
    };

    const handlePointerMove = (e: MouseEvent) => {
      const intersects = getIntersections(e);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const idx = hit.userData.index;
        if (typeof idx === 'number') {
          setHoveredIndex(idx);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredIndex(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const intersects = getIntersections(e);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const idx = hit.userData.index;
        const pt = hit.userData.point;
        if (pt) {
          triggerHaptic(12);
          onSelectPoint(pt);
          setHoveredIndex(idx);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousemove', handlePointerMove);
    domElem.addEventListener('click', handleClick);

    // Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 11. Animation Render Loop
    let animationFrameId: number;
    let isRunning = true;

    const animate = () => {
      if (!isRunning) return;

      controls.update();

      // Smooth hover elevation and radiant glow transition
      meshesRef.current.forEach((item) => {
        const isHover = item.index === hoveredIndex;
        item.targetPosY = isHover ? item.basePosY + 0.5 : item.basePosY;
        
        // Lerp position
        item.mesh.position.y += (item.targetPosY - item.mesh.position.y) * 0.18;

        // Lerp radiant emissive glow
        const mat = item.mesh.material as THREE.MeshPhysicalMaterial;
        const targetEmissive = isHover ? 0.85 : 0.2;
        mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.18;
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        setTimeout(() => {
          if (isRunning) animationFrameId = requestAnimationFrame(animate);
        }, 30);
      } else {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();

    // Clean disposal on unmount
    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      domElem.removeEventListener('mousemove', handlePointerMove);
      domElem.removeEventListener('click', handleClick);

      barMeshes.forEach((item) => {
        item.mesh.geometry.dispose();
        (item.mesh.material as THREE.Material).dispose();
      });

      groundGeo.dispose();
      groundMat.dispose();
      shadowDiscGeo.dispose();
      shadowDiscMat.dispose();
      spiralTubeGeo.dispose();
      spiralTubeMat.dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [processedPoints, maxKm, onSelectPoint]);

  // Sync activePoint selection highlight into 3D meshes
  useEffect(() => {
    if (!activePoint || meshesRef.current.length === 0) return;
    const match = meshesRef.current.find(
      (m) =>
        String(m.point.event_no) === String(activePoint.event_no) ||
        (m.point.date && m.point.date === activePoint.date && m.point.cum_total_km === activePoint.total_km)
    );
    if (match) {
      setHoveredIndex(match.index);
    }
  }, [activePoint]);

  // Selected or hovered display point for center hub
  const currentInspectPoint = useMemo(() => {
    if (hoveredIndex !== null && processedPoints[hoveredIndex]) {
      const pt = processedPoints[hoveredIndex];
      const colorHex = VIBRANT_PALETTE[hoveredIndex % VIBRANT_PALETTE.length];
      return {
        ...pt,
        barColor: colorHex,
      };
    }
    if (activePoint) {
      const idx = processedPoints.findIndex(
        (p) =>
          String(p.event_no) === String(activePoint.event_no) ||
          (p.date && p.date === activePoint.date && p.cum_total_km === activePoint.total_km)
      );
      const colorHex = idx >= 0 ? VIBRANT_PALETTE[idx % VIBRANT_PALETTE.length] : '#3b82f6';
      return {
        ...activePoint,
        event_km: activePoint.event_km || (activePoint.hike_km + activePoint.trek_km) || 20,
        cum_total_km: activePoint.cum_total_km || activePoint.total_km,
        barColor: colorHex,
      };
    }
    return null;
  }, [hoveredIndex, activePoint, processedPoints]);

  if (processedPoints.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-300">
        <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
        <p className="text-xs font-bold">No journey points recorded for this timeframe</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 3D Header Controls & Radiant Spectrum Legend */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 px-2 pb-2 text-[11px] font-bold text-slate-600">
        {/* Vibrant Spectrum Swatches */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f43f5e]" title="Crimson Rose" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" title="Electric Gold" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#ff6b00]" title="Blaze Orange" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#00f2fe]" title="Cyan Aqua" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" title="Royal Violet" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" title="Emerald" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#ec4899]" title="Hot Pink" />
              <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" title="Sapphire" />
            </div>
            <span className="text-slate-800 font-extrabold ml-1">Vibrant Metallic Spectrum</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
            <Box className="w-3.5 h-3.5 text-cyan-600" />
            <span>Interactive 3D Stage & Elevation</span>
          </div>
        </div>

        {/* 3D Camera Controls & Event Count Badge */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-[#f0f4f9] border border-slate-200/90 rounded-xl p-0.5 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetCamera}
              className="px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-black text-slate-700 hover:text-blue-600 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              title="Reset 3D View Angle"
            >
              <RotateCcw className="w-3 h-3 text-blue-600" />
              <span>Reset 3D</span>
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 sm:px-1.5 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <span>{processedPoints.length} 3D Columns</span>
            <span>&bull;</span>
            <span>Max: {maxKm} km</span>
          </div>
        </div>
      </div>

      {/* Main 3D WebGL Canvas Stage Container - Fully Unobstructed Viewport */}
      <div className="relative w-full h-[480px] sm:h-[540px] rounded-3xl overflow-hidden border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.35)] bg-[#0b0f19]">
        {/* Three.js Canvas Mount - 100% Unobstructed Center View for 3D Orbit Rotation */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Non-Intrusive Bottom Glassmorphic Stats Dock (Pinned at bottom, leaving center 100% clear) */}
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none flex justify-center">
          <div className="w-full max-w-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)] pointer-events-auto transition-all">
            {currentInspectPoint ? (
              <div className="flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border"
                    style={{ backgroundColor: `${(currentInspectPoint as any).barColor || '#00f2fe'}20`, borderColor: `${(currentInspectPoint as any).barColor || '#00f2fe'}60` }}
                  >
                    <Footprints className="w-5 h-5" style={{ color: (currentInspectPoint as any).barColor || '#00f2fe' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Event #{currentInspectPoint.event_no}
                      </span>
                      {currentInspectPoint.date && (
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {currentInspectPoint.date}
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-black text-white block truncate">
                      {currentInspectPoint.title || 'Hike Milestone'}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base sm:text-lg font-black text-white leading-none">
                    {currentInspectPoint.event_km}
                    <span className="text-xs font-bold text-slate-400 ml-0.5">km</span>
                  </div>
                  <span className="text-[9.5px] text-emerald-400 font-extrabold block mt-0.5">
                    Cum: {(currentInspectPoint.cum_total_km || currentInspectPoint.total_km)?.toLocaleString()} km
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-wider">
                      Community Total Distance
                    </span>
                    <span className="text-xs sm:text-sm font-black text-white block">
                      {totalCumKm.toLocaleString()} km <span className="text-[10px] font-normal text-slate-400">across {processedPoints.length} 3D Events</span>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <span className="text-[9.5px] text-cyan-400 font-bold block bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded-lg">
                    Click / Drag to Orbit 3D
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Helpful Guidance Hint */}
      <div className="w-full flex items-center justify-between pt-2 px-1 text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          <span>Click & drag to orbit 3D stage freely. Scroll to zoom. Tap any column to inspect.</span>
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

