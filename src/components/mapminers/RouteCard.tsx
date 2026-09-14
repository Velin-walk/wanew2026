import { memo } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';

interface RouteCardProps {
  route: any;
  index: number;
  isActive: boolean;
  onClick: (route: any) => void;
  onDelete: (id: string) => void;
}

const ROUTE_COLORS = [
  '#f97316', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa',
  '#fb7185', '#22d3ee', '#84cc16', '#e879f9', '#38bdf8',
];

export const RouteCard = memo(function RouteCard({ route, index, isActive, onClick, onDelete }: RouteCardProps) {
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];

  const handleClick = () => onClick(route);
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(route.id);
  };

  return (
    <div
      className={`route-card rounded-lg p-2.5 cursor-pointer relative group ${isActive ? 'active bg-[#7ABA42]/5 border-[#7ABA42]/20' : 'hover:bg-neutral-50 border-neutral-100'} border transition-all duration-200 mb-1.5`}
      onClick={handleClick}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
    >
      {/* Accent color bar */}
      <div style={{
        position: 'absolute', left: 0, top: 8, bottom: 8, width: 2.5,
        background: color, borderRadius: '0 1.5px 1.5px 0',
        opacity: isActive ? 1 : 0.5,
        transition: 'opacity 0.2s',
      }} />

      <div className="pl-2">
        <div className="flex items-center justify-between">
          {/* Title with colored stats in elegant smaller font */}
          <div className="flex-1 min-w-0 text-xs font-bold text-neutral-800 leading-tight">
            <span>{route.name} : </span>
            <span style={{ color: '#f97316' }}>{route.stats.distance}km</span>
            <span>, </span>
            <span style={{ color: '#ef4444' }}>+{route.stats.elevationGain}m</span>
            <span>, </span>
            <span style={{ color: '#10b981' }}>-{route.stats.elevationLoss}m</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-1.5">
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 bg-red-50 hover:bg-red-100 border border-red-150 rounded-md text-red-500 transition-opacity duration-200 flex items-center justify-center shrink-0"
              title="Delete Route"
              aria-label="Delete route"
            >
              <Trash2 size={10} />
            </button>
            <ChevronRight size={12} style={{ color: isActive ? color : '#8B8680', transition: 'color 0.2s' }} className="shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
});

export default RouteCard;
