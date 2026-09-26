import React, { useMemo } from 'react';
import { Calendar, Footprints, Award, Trophy, Compass } from 'lucide-react';

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
  const sortedPoints = useMemo(() => {
    return [...points].sort((a, b) => {
      return (a.total_km || 0) - (b.total_km || 0);
    });
  }, [points]);

  const chartData = useMemo(() => {
    if (sortedPoints.length === 0) return { coords: [], dLine: '', dArea: '', maxKm: 1 };

    const maxKm = Math.max(...sortedPoints.map(p => p.total_km), 1);
    const minKm = 0;
    const kmSpan = maxKm - minKm;

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

  if (sortedPoints.length === 0) {
    return (
      <div className="bg-stone-50 rounded-2xl p-8 border border-stone-200 text-center text-stone-500 text-xs">
        No journey points to plot.
      </div>
    );
  }

  const { coords, dLine, dArea, maxKm, floorY, paddingLeft, chartWidth } = chartData;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-4">
      {/* Chart Title / Caption */}
      <div className="flex justify-between items-center text-xs text-stone-600 font-semibold px-1">
        <span className="flex items-center gap-1.5">
          <Footprints className="w-4 h-4 text-[#7ABA42]" />
          <span>Cumulative Distance Progress Curve</span>
        </span>
        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
          Peak: {maxKm.toLocaleString()} km
        </span>
      </div>

      {/* SVG Chart Container */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="min-w-[650px] w-full relative">
          <svg
            viewBox="0 0 1000 300"
            className="w-full h-auto select-none overflow-visible"
            style={{ minHeight: '220px' }}
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
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Data Points */}
            {coords.map((coord, idx) => {
              const isActive = activePoint && (String(activePoint.event_no) === String(coord.pt.event_no) || activePoint.date === coord.pt.date);
              
              return (
                <g
                  key={idx}
                  className="cursor-pointer group"
                  onClick={() => onSelectPoint(coord.pt)}
                  onMouseEnter={() => onSelectPoint(coord.pt)}
                >
                  {/* Larger Invisible Tap Area */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="15"
                    fill="transparent"
                  />

                  {/* Pulsing Active Highlight */}
                  {isActive && (
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r="10"
                      fill="#7ABA42"
                      opacity="0.3"
                      className="animate-ping"
                    />
                  )}

                  {/* Core Node Circle */}
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isActive ? "6" : "4.5"}
                    fill={isActive ? "#E08828" : "#7ABA42"}
                    stroke="white"
                    strokeWidth="2"
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
                    {coords[Math.floor(coords.length / 2)].pt.date ? coords[Math.floor(coords.length / 2)].pt.date.slice(2) : ''}
                  </text>
                )}

                {/* Last Point Label */}
                <text
                  x={coords[coords.length - 1].x}
                  y={floorY + 20}
                  textAnchor="end"
                  className="text-[10px] font-black fill-stone-500 font-mono"
                >
                  {coords[coords.length - 1].pt.date ? coords[coords.length - 1].pt.date.slice(2) : 'Current'}
                </text>
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
