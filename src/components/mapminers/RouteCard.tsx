import { memo } from 'react';
import { ChevronRight, Trash2, Bookmark } from 'lucide-react';

interface RouteCardProps {
  route: any;
  index: number;
  isActive: boolean;
  canDelete?: boolean;
  isSaved?: boolean;
  isContributed?: boolean;
  showMyMapsBadges?: boolean;
  onClick: (route: any) => void;
  onDelete: (id: string) => void;
  onToggleSave?: (id: string) => void;
}

const ROUTE_COLORS = [
  '#f97316', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa',
  '#fb7185', '#22d3ee', '#84cc16', '#e879f9', '#38bdf8',
];

export const RouteCard = memo(function RouteCard({
  route,
  index,
  isActive,
  canDelete = false,
  isSaved = false,
  isContributed = false,
  showMyMapsBadges = false,
  onClick,
  onDelete,
  onToggleSave,
}: RouteCardProps) {
  const color = ROUTE_COLORS[index % ROUTE_COLORS.length];

  const handleClick = () => onClick(route);
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) return;
    onDelete(route.id);
  };
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave?.(route.id);
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
              {showMyMapsBadges && isSaved && (
                <span className="text-[9.5px] font-bold text-[#5C942D] bg-[#7ABA42]/15 border border-[#7ABA42]/30 px-1.5 py-0.2 rounded">
                  Saved
                </span>
              )}
              {showMyMapsBadges && isContributed && (
                <span className="text-[9.5px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded">
                  Contributed
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 self-start">
            {onToggleSave && (
              <button
                type="button"
                onClick={handleSave}
                className={`p-1.5 min-h-[30px] min-w-[30px] rounded-lg border transition-all duration-150 active:scale-90 flex items-center justify-center shrink-0 cursor-pointer ${
                  isSaved
                    ? 'opacity-100 bg-[#7ABA42]/15 border-[#7ABA42]/40 text-[#5C942D]'
                    : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-[#7ABA42]'
                }`}
                title={isSaved ? 'Saved in My Maps (Click to remove)' : 'Save to My Maps'}
                aria-label={isSaved ? 'Unsave route' : 'Save route'}
              >
                <Bookmark size={14} className={isSaved ? 'fill-current' : ''} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 min-h-[30px] min-w-[30px] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-500 transition-all duration-150 active:scale-90 flex items-center justify-center shrink-0 cursor-pointer"
                title="Delete Route"
                aria-label="Delete route"
              >
                <Trash2 size={14} />
              </button>
            )}
            <ChevronRight
              size={16}
              style={{ color: isActive ? color : '#8B8680', transition: 'color 0.2s' }}
              className="shrink-0 ml-0.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default RouteCard;

