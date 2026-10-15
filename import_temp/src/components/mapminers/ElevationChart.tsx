import { useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { MapPin } from 'lucide-react';

interface ElevationChartProps {
  route: any;
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const distanceKm = Number(label).toFixed(2);
    const elevationM = Number(payload[0].value).toLocaleString();
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-2 text-xs shadow-md">
        <div className="text-neutral-500 mb-1 flex items-center gap-1">
          <MapPin size={11} /> {distanceKm}km
        </div>
        <div className="text-[#f97316] font-bold">{elevationM}m elevation</div>
      </div>
    );
  }
  return null;
};

export default function ElevationChart({ route, color = '#f97316' }: ElevationChartProps) {
  if (!route?.elevationProfile?.length) return null;

  const data = route.elevationProfile;
  const minEle = Math.min(...data.map((d: any) => d.elevation));
  const maxEle = Math.max(...data.map((d: any) => d.elevation));
  const domain = [Math.max(0, minEle - 200), maxEle + 200];
  const peakPoint = data.reduce((peak: any, point: any) => (point.elevation > peak.elevation ? point : peak), data[0]);

  // Dispatch hover coordinate via DOM event (bypasses React for performance)
  const dispatchCoord = (index: number | null) => {
    if (index != null && route.sampledCoords && route.sampledCoords[index]) {
      const coord = route.sampledCoords[index];
      window.dispatchEvent(new CustomEvent('chart-hover', { detail: { lat: coord.lat, lng: coord.lng } }));
    }
  };

  const dispatchClear = () => {
    window.dispatchEvent(new CustomEvent('chart-hover', { detail: null }));
  };

  // Desktop: Recharts onMouseMove
  const handleMouseMove = (state: any) => {
    if (state && state.activeTooltipIndex != null) {
      dispatchCoord(state.activeTooltipIndex);
    }
  };

  return (
    <ChartTouchWrapper data={data} sampledCoords={route.sampledCoords} onClear={dispatchClear}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={dispatchClear}
        >
          <defs>
            <linearGradient id={`grad-${route.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="distance"
            tick={{ fill: '#8b8680', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}km`}
            interval={Math.ceil(data.length / 5) - 1}
            minTickGap={40}
          />
          <YAxis
            domain={domain}
            tick={{ fill: '#8b8680', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            width={38}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={5000}
            stroke="#60a5fa"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: '5000m', fill: '#60a5fa', fontSize: 9, position: 'insideTopRight' }}
          />
          <ReferenceDot
            x={peakPoint.distance}
            y={peakPoint.elevation}
            r={3.5}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${route.id})`}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartTouchWrapper>
  );
}

// Transparent overlay that handles touch events manually,
// mapping finger X position → data index → GPS coordinate
interface ChartTouchWrapperProps {
  data: any[];
  sampledCoords: any[];
  onClear: () => void;
  children: React.ReactNode;
}

function ChartTouchWrapper({ data, sampledCoords, onClear, children }: ChartTouchWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || !sampledCoords || !data?.length) return;
    
    const touch = e.touches[0];
    if (!touch) return;

    const rect = containerRef.current.getBoundingClientRect();
    const chartLeft = rect.left + 15;
    const chartRight = rect.right - 10;
    const chartWidth = chartRight - chartLeft;

    const x = touch.clientX - chartLeft;
    const ratio = Math.max(0, Math.min(1, x / chartWidth));
    const index = Math.round(ratio * (data.length - 1));

    if (sampledCoords[index]) {
      const coord = sampledCoords[index];
      window.dispatchEvent(new CustomEvent('chart-hover', { detail: { lat: coord.lat, lng: coord.lng } }));
    }
  }, [data, sampledCoords]);

  return (
    <div
      ref={containerRef}
      onTouchMove={handleTouch}
      onTouchEnd={onClear}
      className="w-full h-full"
    >
      {children}
    </div>
  );
}
