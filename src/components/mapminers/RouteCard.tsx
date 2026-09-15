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
      className={`route-card rounded-xl p-2.5 cursor-pointer relative group ${
        isActive ? 'active bg-[#7ABA42]/5 border-[#7ABA42]/30 shadow-xs' : 'hover:bg-neutral-50 border-neutral-100'
      } border transition-all duration-200 mb-2 w-full max-w-full overflow-hidden`}
      onClick={handleClick}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
    >
      {/* Accent color bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          background: color,
          borderRadius: '0 2px 2px 0',
          opacity: isActive ? 1 : 0.6,
          transition: 'opacity 0.2s',
        }}
      />

      <div className="pl-2 min-w-0 w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          {/* Main Title & Stats - Bends and wraps cleanly within card size */}
          <div className="flex-1 min-w-0 text-xs text-neutral-800 leading-snug">
            {/* Map Title - Bends gracefully to fit card size */}
            <div className="font-bold text-neutral-900 break-words [overflow-wrap:anywhere] leading-snug mb-1 pr-1">
              {route.name}
            </div>

            {/* Colored stats inline badges/text */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold">
              <span className="font-bold" style={{ color: '#f97316' }}>
                {route.stats?.distance ?? 0}km
              </span>
              <span className="text-neutral-300">•</span>
              <span style={{ color: '#ef4444' }}>
                +{route.stats?.elevationGain ?? 0}m
              </span>
              <span className="text-neutral-300">•</span>
              <span style={{ color: '#10b981' }}>
                -{route.stats?.elevationLoss ?? 0}m
              </span>
              {route.difficulty && (
                <>
                  <span className="text-neutral-300">•</span>
                  <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.2 rounded">
                    {route.difficulty}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 self-start pt-0.5">
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md text-red-500 transition-opacity duration-200 flex items-center justify-center shrink-0 cursor-pointer"
              title="Delete Route"
              aria-label="Delete route"
            >
              <Trash2 size={12} />
            </button>
            <ChevronRight
              size={14}
              style={{ color: isActive ? color : '#8B8680', transition: 'color 0.2s' }}
              className="shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default RouteCard;

