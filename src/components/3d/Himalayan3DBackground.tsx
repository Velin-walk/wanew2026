import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Himalayan3DBackgroundProps {
  opacity?: number;
}

export const Himalayan3DBackground: React.FC<Himalayan3DBackgroundProps> = ({ opacity = 0.85 }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [contrastMode, setContrastMode] = useState<'balanced' | 'vibrant'>('balanced');

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    // --- 1. SCENE, CAMERA, RENDERER ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c111d, 0.008); // Deep atmospheric dark twilight fog

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 11, 36);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountNode.appendChild(renderer.domElement);

    // --- 2. LIGHTING (Cool Alpine Moonlight & Warm Stupa Lantern Glow) ---
    const ambientLight = new THREE.AmbientLight(0x7c93b6, 0.75);
    scene.add(ambientLight);

    // Silver Moonlight on Snow Peaks
    const sunLight = new THREE.DirectionalLight(0xe2e8f0, 2.0);
    sunLight.position.set(40, 60, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Cyan Atmospheric Rim Light
    const skyLight = new THREE.DirectionalLight(0x38bdf8, 1.3);
    skyLight.position.set(-30, 40, 20);
    scene.add(skyLight);

    // Warm Golden Stupa Lantern Light
    const templeLight = new THREE.PointLight(0xffa834, 5.0, 32);
    templeLight.position.set(0, 7, 8);
    scene.add(templeLight);

    // --- 3. MOUNTAIN TERRAIN GENERATION (White Snow Peaks on Dark Slate) ---
    const terrainWidth = 160;
    const terrainDepth = 160;
    const terrainSegments = 130;
    const terrainGeo = new THREE.PlaneGeometry(terrainWidth, terrainDepth, terrainSegments, terrainSegments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const colors: number[] = [];

    const getTerrainHeight = (x: number, z: number) => {
      let h = 0;
      h += Math.sin(x * 0.04) * Math.cos(z * 0.04) * 9;
      h += Math.sin(x * 0.1 + 1.2) * Math.sin(z * 0.08) * 5;
      h += Math.cos(x * 0.22) * Math.sin(z * 0.18) * 2.5;

      // Ridge lift in back center for Everest-style peaks
      const distFromCenter = Math.sqrt(x * x + z * z);
      const ridgeFactor = Math.max(0, 1 - distFromCenter / 100);
      h += Math.pow(ridgeFactor, 1.7) * 26;
      return h;
    };

    const colorSnow = new THREE.Color(0xffffff); // Pure crisp white snow caps catching moonlight
    const colorRock = new THREE.Color(0x1a2332); // Dark Himalayan granite slate
    const colorValley = new THREE.Color(0x0f172a); // Deep night alpine valley
    const colorGlow = new THREE.Color(0x0b0f19);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const h = getTerrainHeight(x, z);
      posAttr.setY(i, h);

      // Height-based color gradient: pure white snow caps -> dark rock -> deep valley
      const vertexColor = new THREE.Color();
      if (h > 12) {
        // High snow peak cap
        vertexColor.lerpColors(colorRock, colorSnow, Math.min(1, (h - 12) / 10));
      } else if (h > 4) {
        // Mid-altitude rocky mountain face
        vertexColor.lerpColors(colorValley, colorRock, (h - 4) / 8);
      } else {
        // Alpine valley
        vertexColor.lerpColors(colorGlow, colorValley, Math.min(1, h / 4));
      }
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      metalness: 0.12,
      flatShading: true,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    terrainMesh.position.set(0, -6, -20);
    scene.add(terrainMesh);

    // --- 3B. DISTANT BACKDROP SNOW PEAKS ---
    const bgMountainGeo = new THREE.PlaneGeometry(240, 80, 60, 20);
    const bgPos = bgMountainGeo.attributes.position;
    for (let i = 0; i < bgPos.count; i++) {
      const x = bgPos.getX(i);
      const y = bgPos.getY(i);
      const noise = Math.sin(x * 0.08) * 8 + Math.cos(x * 0.15) * 4;
      bgPos.setY(i, y + Math.max(0, noise));
    }
    bgMountainGeo.computeVertexNormals();

    const bgMountainMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const bgMountainMesh = new THREE.Mesh(bgMountainGeo, bgMountainMat);
    bgMountainMesh.position.set(0, 18, -75);
    scene.add(bgMountainMesh);

    // --- 4. SACRED NEPALI STUPA (BOUDHANATH / SWAYAMBHUNATH) ---
    const stupaGroup = new THREE.Group();

    // Square Base Plinth
    const baseGeo = new THREE.BoxGeometry(6.5, 1.3, 6.5);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xeae4d8, roughness: 0.85 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.65;
    stupaGroup.add(baseMesh);

    // White Hemispherical Dome (Kumbha)
    const domeGeo = new THREE.SphereGeometry(2.6, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xfffcf7, roughness: 0.65 });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 1.3;
    stupaGroup.add(domeMesh);

    // Red Harmika (Cubical Structure)
    const harmikaGeo = new THREE.BoxGeometry(1.7, 1.3, 1.7);
    const harmikaMat = new THREE.MeshStandardMaterial({ color: 0xba2419, roughness: 0.5 });
    const harmikaMesh = new THREE.Mesh(harmikaGeo, harmikaMat);
    harmikaMesh.position.y = 3.8;
    stupaGroup.add(harmikaMesh);

    // Golden Eyes of Wisdom Band
    const eyesBandGeo = new THREE.BoxGeometry(1.75, 0.42, 1.75);
    const eyesBandMat = new THREE.MeshStandardMaterial({ color: 0xf5b018, metalness: 0.7, roughness: 0.25 });
    const eyesBandMesh = new THREE.Mesh(eyesBandGeo, eyesBandMat);
    eyesBandMesh.position.y = 3.8;
    stupaGroup.add(eyesBandMesh);

    // Golden Conical Spire (13 Rings to Enlightenment)
    const spireGeo = new THREE.ConeGeometry(1.2, 3.5, 16);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xedaa18, metalness: 0.85, roughness: 0.18 });
    const spireMesh = new THREE.Mesh(spireGeo, spireMat);
    spireMesh.position.y = 6.2;
    stupaGroup.add(spireMesh);

    // Golden Gajur Pinnacle
    const pinnacleGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const pinnacleMesh = new THREE.Mesh(pinnacleGeo, spireMat);
    pinnacleMesh.position.y = 8.1;
    stupaGroup.add(pinnacleMesh);

    stupaGroup.position.set(0, 1.2, 8);
    scene.add(stupaGroup);

    // --- 5. HIMALAYAN PRAYER FLAGS (LUNGTA) ---
    // 5 Sacred Flag Colors: Blue (Sky), White (Air), Red (Fire), Green (Water), Yellow (Earth)
    const flagColors = [0x0055c4, 0xffffff, 0xdd1111, 0x008833, 0xffbb00];
    const flagCount = 42;
    const flagLinesGroup = new THREE.Group();

    const anchors = [
      { start: new THREE.Vector3(0, 9.2, 8), end: new THREE.Vector3(-32, 22, -15) },
      { start: new THREE.Vector3(0, 9.2, 8), end: new THREE.Vector3(32, 20, -12) },
      { start: new THREE.Vector3(0, 9.2, 8), end: new THREE.Vector3(0, 18, -32) },
      { start: new THREE.Vector3(-28, 15, 16), end: new THREE.Vector3(28, 10, -6) },
      { start: new THREE.Vector3(-24, 9, -10), end: new THREE.Vector3(26, 16, 14) }
    ];

    const animatedFlags: { mesh: THREE.Mesh; phase: number }[] = [];

    anchors.forEach((anchor) => {
      const lineCurve = new THREE.QuadraticBezierCurve3(
        anchor.start,
        new THREE.Vector3(
          (anchor.start.x + anchor.end.x) / 2,
          (anchor.start.y + anchor.end.y) / 2 - 3.4,
          (anchor.start.z + anchor.end.z) / 2
        ),
        anchor.end
      );

      const points = lineCurve.getPoints(40);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x998877, transparent: true, opacity: 0.75 });
      const rope = new THREE.Line(lineGeo, lineMat);
      flagLinesGroup.add(rope);

      for (let f = 1; f < flagCount; f++) {
        const t = f / flagCount;
        const pos = lineCurve.getPoint(t);

        const flagGeo = new THREE.PlaneGeometry(1.0, 0.75);
        flagGeo.translate(0, -0.375, 0);
        const colorHex = flagColors[f % flagColors.length];
        const flagMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          side: THREE.DoubleSide,
          roughness: 0.4,
          metalness: 0.1,
          emissive: colorHex,
          emissiveIntensity: 0.38,
        });

        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        flagMesh.position.copy(pos);
        flagMesh.rotation.y = Math.atan2(anchor.end.x - anchor.start.x, anchor.end.z - anchor.start.z) + Math.PI / 2;

        flagLinesGroup.add(flagMesh);
        animatedFlags.push({
          mesh: flagMesh,
          phase: f * 0.28 + Math.random() * 2,
        });
      }
    });

    scene.add(flagLinesGroup);

    // --- 6. 3D HIMALAYAN YAKS (🦬 YAK HERD) ---
    const createYak = (): THREE.Group => {
      const yak = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b221c, roughness: 0.9, flatShading: true });
      const furMat = new THREE.MeshStandardMaterial({ color: 0x1f1712, roughness: 0.95, flatShading: true });
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xdfcfb0, roughness: 0.35, metalness: 0.15 });
      const saddleMat = new THREE.MeshStandardMaterial({ color: 0xc8281d, roughness: 0.6 });
      const bellMat = new THREE.MeshStandardMaterial({ color: 0xe0a020, metalness: 0.8, roughness: 0.2 });
      const hoofMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

      // Torso
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 2.4), bodyMat);
      bodyMesh.position.y = 1.1;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      yak.add(bodyMesh);

      // High Himalayan Shoulder Hump
      const humpMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.1), bodyMat);
      humpMesh.position.set(0, 1.7, 0.4);
      humpMesh.castShadow = true;
      yak.add(humpMesh);

      // Long Shaggy Fur Skirt
      const skirtMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 2.5), furMat);
      skirtMesh.position.y = 0.65;
      skirtMesh.castShadow = true;
      yak.add(skirtMesh);

      // 4 Legs & Hooves
      const legPositions = [
        [-0.58, 0.45, 0.8],
        [0.58, 0.45, 0.8],
        [-0.58, 0.45, -0.8],
        [0.58, 0.45, -0.8],
      ];

      const legGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.9, 8);
      const hoofGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.15, 8);

      legPositions.forEach(([lx, ly, lz]) => {
        const legMesh = new THREE.Mesh(legGeo, bodyMat);
        legMesh.position.set(lx, ly, lz);
        legMesh.castShadow = true;
        yak.add(legMesh);

        const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
        hoofMesh.position.set(lx, 0.08, lz);
        yak.add(hoofMesh);
      });

      // Head & Neck
      const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), bodyMat);
      neckMesh.position.set(0, 1.45, 1.25);
      neckMesh.rotation.x = -Math.PI / 6;
      yak.add(neckMesh);

      const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.1), bodyMat);
      headMesh.position.set(0, 1.45, 1.75);
      headMesh.castShadow = true;
      yak.add(headMesh);

      // Snout
      const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.38), furMat);
      snoutMesh.position.set(0, 1.25, 2.25);
      yak.add(snoutMesh);

      // Iconic Curved Horns
      [-1, 1].forEach((dir) => {
        const hornCurve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(dir * 0.3, 1.75, 1.75),
          new THREE.Vector3(dir * 1.3, 1.95, 1.75),
          new THREE.Vector3(dir * 1.5, 2.45, 1.95),
          new THREE.Vector3(dir * 1.1, 2.75, 2.15)
        );
        const hornGeo = new THREE.TubeGeometry(hornCurve, 12, 0.12, 8, false);
        const hornMesh = new THREE.Mesh(hornGeo, hornMat);
        hornMesh.castShadow = true;
        yak.add(hornMesh);
      });

      // Tibetan Saddle Cloth & Bell
      const saddleMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 1.3), saddleMat);
      saddleMesh.position.set(0, 1.72, -0.2);
      yak.add(saddleMesh);

      const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bellMat);
      bellMesh.position.set(0, 1.0, 1.65);
      yak.add(bellMesh);

      // Tail
      const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.0, 8), furMat);
      tailMesh.position.set(0, 0.85, -1.25);
      tailMesh.rotation.x = Math.PI / 8;
      yak.add(tailMesh);

      yak.scale.set(1.1, 1.1, 1.1);
      return yak;
    };

    // Herd of Yaks along trail and slopes
    const yakHerdGroup = new THREE.Group();
    const yakConfigs = [
      { pos: new THREE.Vector3(-9, 1.2, 14), rotY: Math.PI * 0.15, phase: 0 },
      { pos: new THREE.Vector3(11, 2.8, 11), rotY: -Math.PI * 0.25, phase: 1.5 },
      { pos: new THREE.Vector3(-18, 4.5, 2), rotY: Math.PI * 0.4, phase: 3.0 },
      { pos: new THREE.Vector3(22, 6.2, -5), rotY: -Math.PI * 0.6, phase: 4.2 }
    ];

    const animatedYaks: { group: THREE.Group; initialY: number; phase: number }[] = [];

    yakConfigs.forEach((cfg) => {
      const yakInstance = createYak();
      yakInstance.position.copy(cfg.pos);
      yakInstance.rotation.y = cfg.rotY;
      yakHerdGroup.add(yakInstance);

      animatedYaks.push({
        group: yakInstance,
        initialY: cfg.pos.y,
        phase: cfg.phase,
      });
    });

    scene.add(yakHerdGroup);

    // --- 7. GOLDEN TRAIL & ATMOSPHERIC DUST ---
    const trailPoints: THREE.Vector3[] = [];
    const trailSegments = 60;
    for (let i = 0; i <= trailSegments; i++) {
      const t = i / trailSegments;
      const angle = t * Math.PI * 2.2;
      const radius = 8 + t * 25;
      const x = Math.sin(angle) * radius;
      const z = 18 - t * 46;
      const y = getTerrainHeight(x, z - 20) - 5.8;
      trailPoints.push(new THREE.Vector3(x, y + 0.15, z));
    }

    const trailCurve = new THREE.CatmullRomCurve3(trailPoints);
    const trailGeo = new THREE.TubeGeometry(trailCurve, 100, 0.35, 8, false);
    const trailMat = new THREE.MeshStandardMaterial({
      color: 0xd68122,
      emissive: 0x9e4700,
      emissiveIntensity: 0.45,
      roughness: 0.9,
    });
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    scene.add(trailMesh);

    // Floating sparkle dust particles
    const particleCount = 110;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 60;
      particlePositions[p + 1] = Math.random() * 25 + 1;
      particlePositions[p + 2] = (Math.random() - 0.5) * 60;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffe090,
      size: 0.32,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // --- 8. ANIMATION LOOP & SCROLL PARALLAX ---
    let animationFrameId: number;
    let clock = new THREE.Clock();

    let targetCamY = 11;
    let targetCamZ = 36;
    let targetCamX = 0;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight || 1000;
      const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

      targetCamX = Math.sin(progress * Math.PI * 1.4) * 10;
      targetCamY = 11 + progress * 16;
      targetCamZ = 36 - progress * 24;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (isPaused) return;

      const time = clock.getElapsedTime();

      // Camera lerp
      camera.position.x += (targetCamX - camera.position.x) * 0.04;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;
      camera.position.z += (targetCamZ - camera.position.z) * 0.04;

      camera.lookAt(0, 4, -4);

      // Prayer flags flutter
      animatedFlags.forEach((flag) => {
        const wave = Math.sin(time * 3.6 + flag.phase) * 0.32 + Math.cos(time * 5.0 + flag.phase) * 0.14;
        flag.mesh.rotation.z = wave * 0.45;
        flag.mesh.rotation.x = Math.sin(time * 2.6 + flag.phase) * 0.22;
      });

      // Stupa slow idle rotation for 3D depth
      stupaGroup.rotation.y = Math.sin(time * 0.25) * 0.07;

      // Yak grazing idle movement
      animatedYaks.forEach((yak) => {
        yak.group.rotation.z = Math.sin(time * 1.2 + yak.phase) * 0.03;
        yak.group.position.y = yak.initialY + Math.sin(time * 1.8 + yak.phase) * 0.08;
      });

      // Floating dust particles
      const pArr = particleGeo.attributes.position.array as Float32Array;
      for (let i = 1; i < particleCount * 3; i += 3) {
        pArr[i] += Math.sin(time + i) * 0.012 + 0.018;
        if (pArr[i] > 28) pArr[i] = 1;
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountNode && renderer.domElement) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isPaused]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{ opacity }}>
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* High-legibility Contrast Balancing Overlay */}
      <div
        className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
          contrastMode === 'balanced'
            ? 'bg-gradient-to-b from-[#0a0f1d]/80 via-[#0f172a]/60 to-[#0a0f1d]/85 backdrop-blur-[1px]'
            : 'bg-gradient-to-b from-[#0a0f1d]/45 via-transparent to-[#0a0f1d]/65'
        }`}
      />

      {/* Floating 3D Environment Control Badge */}
      <div className="absolute bottom-4 right-4 pointer-events-auto flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-[10px] text-amber-200 shadow-xl z-20">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="font-extrabold uppercase tracking-wider hidden sm:inline">3D Himalaya (Peaks, Flags, Stupa & Yaks)</span>
        <button
          onClick={() => setContrastMode(contrastMode === 'balanced' ? 'vibrant' : 'balanced')}
          className="ml-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white font-bold transition-colors cursor-pointer"
          title="Toggle text contrast overlay"
        >
          {contrastMode === 'balanced' ? 'High Contrast' : 'Full 3D'}
        </button>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white font-bold transition-colors cursor-pointer"
        >
          {isPaused ? 'Play' : 'Pause'}
        </button>
      </div>
    </div>
  );
};
