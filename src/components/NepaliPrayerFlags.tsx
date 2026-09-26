import React, { useState, useEffect, useRef, useMemo } from 'react';

type FlagType = 'syllable' | 'woodblock';

interface FlagConfig {
  id: number;
  type: FlagType;
  colorName: string;
  syllable?: string;
  tibetanChar?: string;
  bgColor: string;
  inkColor: string;
  borderColor: string;
  accentColor?: string;
}

// 10 Vibrant Mixed Flags alternating between:
// 1. Bold Om-Mani-Padme-Hum syllable flags with traditional meander borders
// 2. Intricate Woodblock Deity & Mantra script flags from the traditional Himalayan prints
const MIXED_VIBRANT_FLAGS: FlagConfig[] = [
  // 1. Blue: OM Syllable Flag
  {
    id: 1,
    type: 'syllable',
    colorName: 'Blue',
    syllable: 'OM',
    tibetanChar: 'ཨོཾ',
    bgColor: '#1D4ED8', // Vibrant Lapis Blue
    inkColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  // 2. White: Woodblock Deity & Script Flag (Deep Indigo print on crisp white, as in photo)
  {
    id: 2,
    type: 'woodblock',
    colorName: 'White',
    bgColor: '#FFFFFF', // Crisp White
    inkColor: '#1E3A8A', // Deep Indigo Woodblock Ink
    borderColor: '#2563EB',
  },
  // 3. Red: NI Syllable Flag
  {
    id: 3,
    type: 'syllable',
    colorName: 'Red',
    syllable: 'NI',
    tibetanChar: 'ཎི',
    bgColor: '#DC2626', // Vibrant Scarlet Red
    inkColor: '#FACC15', // Radiant Gold
    borderColor: '#FACC15',
  },
  // 4. Green: Woodblock Deity & Script Flag (Rich forest ink on vibrant emerald green)
  {
    id: 4,
    type: 'woodblock',
    colorName: 'Green',
    bgColor: '#059669', // Vibrant Emerald Green
    inkColor: '#064E3B', // Deep Forest Ink
    borderColor: '#34D399',
  },
  // 5. Yellow: HUM Syllable Flag
  {
    id: 5,
    type: 'syllable',
    colorName: 'Yellow',
    syllable: 'HUM',
    tibetanChar: 'ཧཱུྃ',
    bgColor: '#F59E0B', // Vibrant Saffron Gold
    inkColor: '#1E40AF', // Royal Indigo Blue
    borderColor: '#1E40AF',
  },
  // 6. Blue: Woodblock Deity & Script Flag (Golden ink on deep sapphire blue)
  {
    id: 6,
    type: 'woodblock',
    colorName: 'Blue',
    bgColor: '#2563EB', // Vibrant Royal Blue
    inkColor: '#DBEAFE', // Sky White-Blue Ink
    borderColor: '#93C5FD',
  },
  // 7. White: MA Syllable Flag
  {
    id: 7,
    type: 'syllable',
    colorName: 'White',
    syllable: 'MA',
    tibetanChar: 'མ',
    bgColor: '#FFFFFF', // Pure Crisp White
    inkColor: '#059669', // Vibrant Jade Green
    borderColor: '#059669',
  },
  // 8. Red: Woodblock Deity & Script Flag (Dark crimson ink on vivid vermilion)
  {
    id: 8,
    type: 'woodblock',
    colorName: 'Red',
    bgColor: '#EF4444', // Vibrant Vermilion Red
    inkColor: '#7F1D1D', // Deep Maroon Woodblock Ink
    borderColor: '#FCA5A5',
  },
  // 9. Green: PADME Syllable Flag
  {
    id: 9,
    type: 'syllable',
    colorName: 'Green',
    syllable: 'PADME',
    tibetanChar: 'པདྨེ',
    bgColor: '#10B981', // Vibrant Mountain Green
    inkColor: '#38BDF8', // Vivid Sky Blue
    borderColor: '#38BDF8',
    accentColor: '#EF4444',
  },
  // 10. Yellow: Woodblock Deity & Script Flag (Mahogany-amber ink on golden saffron)
  {
    id: 10,
    type: 'woodblock',
    colorName: 'Yellow',
    bgColor: '#EAB308', // Vibrant Marigold Yellow
    inkColor: '#78350F', // Rich Amber Brown Ink
    borderColor: '#B45309',
  },
];

/**
 * Style A: Bold Om-Mani-Padme-Hum Syllable Flag with corner meander keys
 */
const SyllableFlagSVG: React.FC<{ flag: FlagConfig }> = ({ flag }) => {
  const { syllable, tibetanChar, bgColor, inkColor, borderColor, accentColor } = flag;

  return (
    <svg
      viewBox="0 0 100 128"
      className="w-full h-full select-none pointer-events-none drop-shadow-xs"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Vibrant Base Cloth */}
      <rect x="0" y="0" width="100" height="128" fill={bgColor} rx="2" />

      {/* Subtle fine weave overlay */}
      <rect
        x="0"
        y="0"
        width="100"
        height="128"
        fill="none"
        stroke="rgba(0,0,0,0.06)"
        strokeWidth="1"
      />

      {/* Outer Border with Traditional Meander Key Corners */}
      <rect
        x="8"
        y="8"
        width="84"
        height="112"
        fill="none"
        stroke={borderColor}
        strokeWidth="1.6"
        opacity="0.9"
        rx="1"
      />
      <rect
        x="11"
        y="11"
        width="78"
        height="106"
        fill="none"
        stroke={borderColor}
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* 4 Traditional Corner Key Patterns */}
      <path d="M 8 20 L 16 20 L 16 14 L 12 14 L 12 17 L 8 17" fill="none" stroke={borderColor} strokeWidth="1.2" />
      <path d="M 92 20 L 84 20 L 84 14 L 88 14 L 88 17 L 92 17" fill="none" stroke={borderColor} strokeWidth="1.2" />
      <path d="M 8 108 L 16 108 L 16 114 L 12 114 L 12 111 L 8 111" fill="none" stroke={borderColor} strokeWidth="1.2" />
      <path d="M 92 108 L 84 108 L 84 114 L 88 114 L 88 111 L 92 111" fill="none" stroke={borderColor} strokeWidth="1.2" />

      {/* Center Large Tibetan Syllable */}
      <text
        x="50"
        y={syllable === 'PADME' ? '68' : '71'}
        textAnchor="middle"
        dominantBaseline="central"
        fill={inkColor}
        fontSize={syllable === 'PADME' ? '37' : '44'}
        fontWeight="bold"
        fontFamily="'Noto Sans Tibetan', 'Tibetan Machine Uni', 'Jomolhari', serif"
        letterSpacing="-1.5"
      >
        {tibetanChar}
      </text>

      {/* Optional decorative accent dot for Padme */}
      {accentColor && <circle cx="56" cy="46" r="2.2" fill={accentColor} />}

      {/* English transliteration at bottom */}
      <text
        x="50"
        y="110"
        textAnchor="middle"
        dominantBaseline="auto"
        fill={inkColor}
        fontSize={syllable === 'PADME' ? '9.5' : '11'}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing={syllable === 'PADME' ? '0.8' : '1.5'}
      >
        {syllable}
      </text>

      {/* Top Hem Stitch line */}
      <line x1="0" y1="3" x2="100" y2="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeDasharray="3,2" />
    </svg>
  );
};

/**
 * Style B: Traditional Woodblock Deity & Script Flag (from second uploaded image)
 * Features central seated Buddhist deity (Tara/Buddha) with aura halo and surrounding prayer texts
 */
const WoodblockDeityFlagSVG: React.FC<{ flag: FlagConfig }> = ({ flag }) => {
  const { bgColor, inkColor } = flag;

  return (
    <svg
      viewBox="0 0 100 128"
      className="w-full h-full select-none pointer-events-none drop-shadow-xs"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Vibrant Base Cloth */}
      <rect x="0" y="0" width="100" height="128" fill={bgColor} rx="2" />

      {/* Fine inner frame */}
      <rect
        x="6"
        y="6"
        width="88"
        height="116"
        fill="none"
        stroke={inkColor}
        strokeWidth="1.2"
        opacity="0.85"
      />
      <rect
        x="9"
        y="9"
        width="82"
        height="110"
        fill="none"
        stroke={inkColor}
        strokeWidth="0.6"
        strokeDasharray="2.5,1.5"
        opacity="0.6"
      />

      {/* Top Mantra Lines */}
      <g opacity="0.88" fill={inkColor}>
        <text x="50" y="16" fontSize="4.6" fontFamily="'Noto Sans Tibetan', serif" textAnchor="middle" fontWeight="bold">
          ཨོཾ་ཨཱཿཧཱུྃ་བཛྲ་གུ་རུ་པདྨ་སིདྡྷི
        </text>
        <line x1="12" y1="20" x2="88" y2="20" stroke={inkColor} strokeWidth="0.5" strokeDasharray="3,1.5" opacity="0.5" />
        <text x="50" y="26" fontSize="4.2" fontFamily="'Noto Sans Tibetan', serif" textAnchor="middle">
          ཏདྱཐཱ། ཨོཾ་ག་ཏེ་ག་ཏེ་པཱ་ར་ག་ཏེ།
        </text>
        <line x1="14" y1="30" x2="86" y2="30" stroke={inkColor} strokeWidth="0.5" strokeDasharray="2,1.5" opacity="0.5" />
      </g>

      {/* Left side prayer text column */}
      <g opacity="0.8" fill={inkColor} fontSize="3.8" fontFamily="'Noto Sans Tibetan', serif">
        <text x="12" y="42">ཨོཾ་ཏཱ་</text>
        <text x="12" y="52">རེ་ཏུཏྟཱ</text>
        <text x="12" y="62">རེ་ཏུ་</text>
        <text x="12" y="72">རེ་སྭཱ</text>
        <text x="12" y="82">ཧཱ།</text>
      </g>

      {/* Right side prayer text column */}
      <g opacity="0.8" fill={inkColor} fontSize="3.8" fontFamily="'Noto Sans Tibetan', serif" textAnchor="end">
        <text x="88" y="42">སངས་</text>
        <text x="88" y="52">རྒྱས་ཆོས</text>
        <text x="88" y="62">དང་ཚོག</text>
        <text x="88" y="72">ཀྱི་མཆོ</text>
        <text x="88" y="82">ག</text>
      </g>

      {/* Central Seated Deity (Bodhisattva / Tara in meditation on lotus with radiant aura) */}
      <g transform="translate(27, 33) scale(0.92)" stroke={inkColor} fill={inkColor}>
        {/* Radiant Mandorla / Aureole Flame border */}
        <path
          d="M 25 2 C 10 2, 2 16, 2 32 C 2 45, 12 52, 25 54 C 38 52, 48 45, 48 32 C 48 16, 40 2, 25 2 Z"
          fill="none"
          strokeWidth="1.2"
          opacity="0.9"
        />
        <path
          d="M 25 6 C 14 6, 6 18, 6 32 C 6 43, 14 49, 25 50 C 36 49, 44 43, 44 32 C 44 18, 36 6, 25 6 Z"
          fill="none"
          strokeWidth="0.6"
          strokeDasharray="2,1"
          opacity="0.65"
        />

        {/* Halo circle */}
        <circle cx="25" cy="19" r="8.5" fill="none" strokeWidth="0.8" opacity="0.85" />
        {/* Head */}
        <circle cx="25" cy="18" r="4.2" fill={inkColor} opacity="0.85" />
        {/* Ushnisha / Crown */}
        <path d="M 23 14 L 25 10 L 27 14 Z" fill={inkColor} />
        {/* Neck & Shoulders */}
        <path d="M 22 22 L 28 22 L 31 27 L 19 27 Z" fill={inkColor} opacity="0.85" />
        {/* Torso */}
        <path
          d="M 19 27 C 18 33, 20 40, 25 41 C 30 40, 32 33, 31 27 Z"
          fill={inkColor}
          opacity="0.8"
        />
        {/* Crossed Legs (Padmasana) */}
        <path
          d="M 11 44 C 13 39, 18 38, 25 39 C 32 38, 37 39, 39 44 C 35 48, 15 48, 11 44 Z"
          fill={inkColor}
          opacity="0.9"
        />
        {/* Lotus Throne */}
        <path
          d="M 8 47 C 12 52, 20 53, 25 53 C 30 53, 38 52, 42 47 C 38 51, 30 55, 25 55 C 20 55, 12 51, 8 47 Z"
          fill={inkColor}
          opacity="0.9"
        />
        <path
          d="M 12 48 Q 16 52 20 49 Q 25 53 29 49 Q 34 52 38 48"
          fill="none"
          strokeWidth="0.8"
        />
      </g>

      {/* Bottom Auspicious Dedication Mantras */}
      <g opacity="0.88" fill={inkColor}>
        <line x1="12" y1="88" x2="88" y2="88" stroke={inkColor} strokeWidth="0.5" strokeDasharray="3,1.5" opacity="0.5" />
        <text x="50" y="95" fontSize="4.2" fontFamily="'Noto Sans Tibetan', serif" textAnchor="middle">
          ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ་ཧྲཱིཿ
        </text>
        <line x1="14" y1="99" x2="86" y2="99" stroke={inkColor} strokeWidth="0.4" strokeDasharray="2,1.5" opacity="0.5" />
        <text x="50" y="106" fontSize="4" fontFamily="'Noto Sans Tibetan', serif" textAnchor="middle">
          དགེ་བ་འདི་ཡིས་མྱུར་དུ་བདག
        </text>
        <text x="50" y="113" fontSize="3.6" fontFamily="'Noto Sans Tibetan', serif" textAnchor="middle" opacity="0.75">
          སྭཱ་ཧཱ། བཀྲ་ཤིས་ཤོག
        </text>
      </g>

      {/* Top Hem Stitch line */}
      <line x1="0" y1="3" x2="100" y2="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeDasharray="3,2" />
    </svg>
  );
};

export const NepaliPrayerFlags: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth || 1024;
    }
    return 1024;
  });

  // Track container width to dynamically supply enough flags to fill the entire bar on desktop
  useEffect(() => {
    if (!containerRef.current) return;

    const measureWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    measureWidth();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute number of flags needed to fill the entire bar edge-to-edge
  const flagCount = useMemo(() => {
    if (containerWidth <= 420) return 10;
    if (containerWidth <= 560) return 12;
    // On desktop, each flag + gap takes ~52px to 56px
    const targetSlot = 52;
    const calculated = Math.round(containerWidth / targetSlot);
    // Ensure at least 10 flags, up to 32 flags on wide desktop screens
    return Math.max(10, Math.min(calculated, 32));
  }, [containerWidth]);

  // Straight horizontal alignment across the entire bar
  const flags = useMemo(() => {
    const list: (FlagConfig & {
      key: string;
      index: number;
      sagY: number;
      naturalTilt: number;
    })[] = [];

    for (let i = 0; i < flagCount; i++) {
      const base = MIXED_VIBRANT_FLAGS[i % MIXED_VIBRANT_FLAGS.length];
      const sagY = 0;
      const naturalTilt = 0;

      list.push({
        ...base,
        key: `vibrant-flag-${i}-${base.type}-${base.colorName}`,
        index: i,
        sagY,
        naturalTilt,
      });
    }
    return list;
  }, [flagCount]);

  // Physics-based scroll reactivity & waving animation
  const flagElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const ropeSvgRef = useRef<SVGSVGElement | null>(null);
  const lastScrollY = useRef(0);
  const lastTime = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let decayTimer: any;
    let idleAngle = 0;
    let currentVel = 0;
    let targetVel = 0;
    let currentDirection = 1;
    let currentOpacity = 1;

    const handleScroll = () => {
      const now = performance.now();
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const deltaY = currentY - lastScrollY.current;
      const dt = Math.max(now - lastTime.current, 16);

      const instantaneousVel = Math.abs(deltaY) / dt;
      // Cap max velocity to avoid excessive spinning, reduced by 80% (20% of original)
      targetVel = Math.min(instantaneousVel * 0.56, 0.7);

      if (Math.abs(deltaY) > 1) {
        currentDirection = deltaY > 0 ? 1 : -1;
      }

      lastScrollY.current = currentY;
      lastTime.current = now;

      clearTimeout(decayTimer);
      decayTimer = setTimeout(() => {
        targetVel = 0;
      }, 180);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const animate = () => {
      // Smooth velocity interpolation (inertia decay)
      currentVel += (targetVel - currentVel) * 0.08;

      // Gentle continuous ambient Himalayan breeze when idle (speed reduced by 80%)
      idleAngle += 0.0076 + currentVel * 0.016;

      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      // Direct scroll displacement wave (speed reduced by 80%)
      const scrollWavePhase = (currentY * 0.009) + idleAngle;

      // Update each flag with high performance direct transform
      const count = flagElementsRef.current.length;
      for (let i = 0; i < count; i++) {
        const el = flagElementsRef.current[i];
        if (!el) continue;

        // Wave phase offset along the garland from left to right
        const flagPhase = scrollWavePhase + (i * 0.44);
        const naturalTilt = flags[i]?.naturalTilt || 0;

        // Dynamic wave physics:
        // 1. Lateral flutter (rotateZ): waves side to side, amplified by scroll velocity and direction
        const waveZ = Math.sin(flagPhase);
        const rotZ = naturalTilt + (waveZ * (3.8 + currentVel * 16) * currentDirection);

        // 2. Vertical fabric lift (rotateX): wind lifts the bottom edge outward toward viewer
        const waveX = (Math.cos(flagPhase * 1.1) + 1) * 0.5; // 0 to 1
        const rotX = 6 + (waveX * (11 + currentVel * 30)) + (currentVel * 14);

        // 3. Fabric wrinkle & shear (skewX): realistic ripple of fabric along hem
        const skew = Math.sin(flagPhase * 0.95) * (2 + currentVel * 7) * currentDirection;

        // 4. Subtle vertical lift (translateY)
        const transY = Math.sin(flagPhase * 1.2) * (0.8 + currentVel * 3);

        el.style.transform = `perspective(500px) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg) skewX(${skew.toFixed(1)}deg) translateY(${transY.toFixed(1)}px)`;
      }

      // Dynamic sway on the arched hanging rope
      if (ropeSvgRef.current) {
        const ropeSway = Math.sin(scrollWavePhase * 0.7) * (0.6 + currentVel * 2.2);
        ropeSvgRef.current.style.transform = `translateY(${ropeSway.toFixed(1)}px)`;
      }

      // Smooth transparency transition: 100% (1.0) when in original place at top, reduced to 1/3 when page is scrolled
      const targetOpacity = currentY > 20 ? (1 / 3) : 1;
      currentOpacity += (targetOpacity - currentOpacity) * 0.08;
      if (containerRef.current) {
        containerRef.current.style.opacity = currentOpacity.toFixed(3);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(decayTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flags]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none pt-0 pb-0.5 pointer-events-none will-change-opacity ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        opacity: 1,
      }}
    >
      {/* Garland container (no scrollbars, flex fits dynamically across full width) */}
      <div className="relative w-full h-[38px] xs:h-[46px] sm:h-[54px] md:h-[62px] flex items-start justify-center">
        {/* Straight Top Rope SVG */}
        <svg
          ref={ropeSvgRef}
          className="absolute top-0 left-0 w-full h-2 pointer-events-none z-10 overflow-visible will-change-transform"
          preserveAspectRatio="none"
          viewBox="0 0 1000 6"
        >
          {/* Subtle rope drop shadow */}
          <path
            d="M 0,2.5 L 1000,2.5"
            fill="none"
            stroke="rgba(0,0,0,0.09)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Main White Cord as in the uploaded photos */}
          <path
            d="M 0,1.5 L 1000,1.5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 0,1.5 L 1000,1.5"
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="1.2"
            strokeDasharray="4,3"
            strokeLinecap="round"
          />
        </svg>

        {/* Dynamic Vibrant Mixed Flags seamlessly filling the entire bar with NO scrollbar */}
        <div className="w-full flex items-start justify-between gap-0.5 sm:gap-1 md:gap-1.5 px-0.5 sm:px-1.5 z-20 overflow-hidden">
          {flags.map((flag) => {
            return (
              <div
                key={flag.key}
                className="shrink-0 flex flex-col items-center select-none"
                style={{
                  marginTop: `${flag.sagY}px`,
                  transformOrigin: 'top center',
                  transform: `rotateZ(${flag.naturalTilt}deg)`,
                  transition: 'margin-top 0.2s ease',
                }}
              >
                {/* Small white stitch loop at rope */}
                <div className="w-2 h-1 bg-white/95 rounded-full shadow-2xs -mb-0.5 z-30 border border-stone-300" />

                {/* The Flag with dynamic scroll waving physics */}
                <div
                  ref={(el) => {
                    flagElementsRef.current[flag.index] = el;
                  }}
                  className="w-[26px] xs:w-[32px] sm:w-[38px] md:w-[44px] lg:w-[48px] h-[34px] xs:h-[42px] sm:h-[50px] md:h-[58px] lg:h-[62px] will-change-transform"
                  style={{
                    transformOrigin: 'top center',
                  }}
                >
                  {flag.type === 'syllable' ? (
                    <SyllableFlagSVG flag={flag} />
                  ) : (
                    <WoodblockDeityFlagSVG flag={flag} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface MiniPrayerFlagsProps {
  variant?: 'draped' | 'card';
  count?: number;
  className?: string;
  withMountain?: boolean;
}

/**
 * Smaller version of the Nepali Prayer Flags designed to be placed in
 * other parts of the page or draped over cards as an authentic Himalayan touch.
 */
export const MiniPrayerFlags: React.FC<MiniPrayerFlagsProps> = ({
  variant = 'draped',
  count = 5,
  className = '',
  withMountain = false,
}) => {
  const flags = useMemo(() => {
    const list: (FlagConfig & {
      key: string;
      index: number;
      sagY: number;
      naturalTilt: number;
    })[] = [];
    const n = Math.max(3, Math.min(count, 12));

    for (let i = 0; i < n; i++) {
      const base = MIXED_VIBRANT_FLAGS[i % MIXED_VIBRANT_FLAGS.length];
      const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const sagY = Math.round((1 - t * t) * (variant === 'draped' ? 7 : 9));
      const naturalTilt = Number((-t * 9).toFixed(1));

      list.push({
        ...base,
        key: `mini-flag-${i}-${base.type}-${base.colorName}`,
        index: i,
        sagY,
        naturalTilt,
      });
    }
    return list;
  }, [count, variant]);

  if (variant === 'draped') {
    return (
      <div className={`relative flex items-start select-none pointer-events-none ${className}`}>
        {/* Delicate Arched Cord SVG */}
        <svg
          className="absolute top-0.5 left-0 w-full h-3 pointer-events-none z-10 overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 14"
        >
          <path
            d="M 1,2 Q 50,13 99,2"
            fill="none"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 1,1.5 Q 50,12.5 99,1.5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>

        {/* Miniature Flags Row */}
        <div className="w-full flex items-start justify-between gap-0.5 px-0.5 z-20">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className="shrink-0 flex flex-col items-center"
              style={{
                marginTop: `${flag.sagY}px`,
                transformOrigin: 'top center',
                transform: `rotateZ(${flag.naturalTilt}deg)`,
              }}
            >
              <div className="w-1 h-0.5 bg-white rounded-full -mb-0.5 z-30 shadow-2xs border border-stone-300" />
              <div
                className="w-[17px] xs:w-[19px] sm:w-[21px] h-[22px] xs:h-[24px] sm:h-[27px] drop-shadow-xs"
                style={{
                  transformOrigin: 'top center',
                  animation: `subtleFlagFlutter 2.6s ease-in-out infinite`,
                  animationDelay: `calc(${flag.index} * 0.12s)`,
                }}
              >
                {flag.type === 'syllable' ? (
                  <SyllableFlagSVG flag={flag} />
                ) : (
                  <WoodblockDeityFlagSVG flag={flag} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // variant === 'card' (compact version with optional mountain range)
  return (
    <div className={`relative w-full overflow-hidden select-none py-0.5 ${className}`}>
      {withMountain && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-200/20 via-sky-100/10 to-transparent" />
          <svg
            className="absolute bottom-0 left-0 w-full h-[85%] pointer-events-none opacity-75"
            preserveAspectRatio="none"
            viewBox="0 0 600 60"
          >
            <path
              d="M 0,60 L 50,30 L 110,12 L 160,34 L 220,18 L 290,6 L 360,22 L 430,10 L 490,28 L 560,14 L 600,60 Z"
              fill="#CBD5E1"
              opacity="0.6"
            />
            <path d="M 95,16 L 110,12 L 125,18 L 110,14 Z" fill="#FFFFFF" opacity="0.9" />
            <path d="M 275,10 L 290,6 L 305,12 L 290,8 Z" fill="#FFFFFF" opacity="0.9" />
            <path d="M 415,14 L 430,10 L 445,16 L 430,12 Z" fill="#FFFFFF" opacity="0.9" />
          </svg>
        </div>
      )}

      <div className="relative w-full h-[40px] xs:h-[46px] sm:h-[50px] flex items-start justify-center">
        <svg
          className="absolute top-1 left-0 w-full h-4 pointer-events-none z-10 overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 500 20"
        >
          <path
            d="M 5,3 Q 250,16 495,3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        <div className="w-full flex items-start justify-between gap-0.5 sm:gap-1 px-1 sm:px-2 z-20">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className="shrink-0 flex flex-col items-center"
              style={{
                marginTop: `${flag.sagY}px`,
                transformOrigin: 'top center',
                transform: `rotateZ(${flag.naturalTilt}deg)`,
              }}
            >
              <div className="w-1.5 h-0.5 bg-white rounded-full -mb-0.5 z-30 border border-stone-300" />
              <div
                className="w-[18px] xs:w-[22px] sm:w-[24px] h-[23px] xs:h-[28px] sm:h-[31px]"
                style={{
                  transformOrigin: 'top center',
                  animation: `subtleFlagFlutter 2.6s ease-in-out infinite`,
                  animationDelay: `calc(${flag.index} * 0.09s)`,
                }}
              >
                {flag.type === 'syllable' ? (
                  <SyllableFlagSVG flag={flag} />
                ) : (
                  <WoodblockDeityFlagSVG flag={flag} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
