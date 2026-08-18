import React, { useState } from 'react';
import { 
  BADGE_DEFINITIONS, 
  BadgeId, 
  evaluateUserBadges, 
  getPublicBadges, 
  EvaluationSubject 
} from '../lib/badges';

export interface UserBadgeProps {
  /** User or Creator object to calculate badges from */
  subject?: EvaluationSubject | null;
  /** Or explicit list of badge IDs */
  badges?: BadgeId[] | string[];
  /** Whether to allow showing internal Admin Badge (ONLY true in Admin Dashboard/internal UI!) */
  showInternalAdmin?: boolean;
  /** Maximum number of badges to display inline (defaults to 2) */
  maxVisible?: number;
  /** Optional custom size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Extra container class */
  className?: string;
}

export default function UserBadge({
  subject,
  badges: explicitBadges,
  showInternalAdmin = false,
  maxVisible = 2,
  size = 'sm',
  className = ''
}: UserBadgeProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Determine raw list of badge IDs
  let rawBadgeIds: BadgeId[] = [];
  if (explicitBadges && explicitBadges.length > 0) {
    rawBadgeIds = explicitBadges as BadgeId[];
  } else if (subject) {
    rawBadgeIds = evaluateUserBadges(subject);
  }

  // Filter public vs internal
  // TUYỆT ĐỐI KHÔNG hiển thị Admin Badge công khai!
  const filteredBadgeIds = rawBadgeIds.filter((id) => {
    const def = BADGE_DEFINITIONS[id];
    if (!def) return false;
    if (def.isInternalOnly && !showInternalAdmin) return false;
    return true;
  });

  if (filteredBadgeIds.length === 0) return null;

  const visibleBadges = filteredBadgeIds.slice(0, maxVisible);
  const hiddenCount = filteredBadgeIds.length - maxVisible;

  // Size styling classes
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs font-medium gap-1.5'
  }[size];

  const iconSize = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5'
  }[size];

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap select-none ${className}`}>
      {visibleBadges.map((badgeId) => {
        const def = BADGE_DEFINITIONS[badgeId];
        if (!def) return null;
        const Icon = def.icon;
        const isTooltipOpen = activeTooltip === badgeId;

        return (
          <div
            key={badgeId}
            className="relative inline-flex items-center"
            onMouseEnter={() => setActiveTooltip(badgeId)}
            onMouseLeave={() => setActiveTooltip(null)}
            onFocus={() => setActiveTooltip(badgeId)}
            onBlur={() => setActiveTooltip(null)}
            tabIndex={0}
            role="status"
            aria-label={`Huy hiệu: ${def.name}. ${def.shortDescription}`}
          >
            <span
              className={`inline-flex items-center font-medium rounded-full border transition-all ${sizeClasses} ${def.bgClass} ${def.colorClass} ${def.borderClass} cursor-help`}
            >
              <Icon className={`${iconSize} ${def.iconColorClass} flex-shrink-0`} aria-hidden="true" />
              <span>{def.name}</span>
            </span>

            {/* Accessible Tooltip */}
            {isTooltipOpen && (
              <div
                className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 w-52 p-2.5 bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100 text-xs rounded-xl shadow-xl border border-neutral-700/50 pointer-events-none animate-in fade-in duration-150"
                role="tooltip"
              >
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-white">
                  <Icon className={`w-3.5 h-3.5 ${def.iconColorClass}`} />
                  <span>{def.name}</span>
                  {def.isInternalOnly && (
                    <span className="ml-auto text-[10px] px-1 py-0.2 bg-red-500/20 text-red-300 rounded">Nội bộ</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 dark:text-neutral-400 leading-relaxed font-normal">
                  {def.shortDescription}
                </p>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
              </div>
            )}
          </div>
        );
      })}

      {/* Overflow Badge Counter */}
      {hiddenCount > 0 && (
        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setActiveTooltip('overflow')}
          onMouseLeave={() => setActiveTooltip(null)}
          onFocus={() => setActiveTooltip('overflow')}
          onBlur={() => setActiveTooltip(null)}
          tabIndex={0}
          role="status"
          aria-label={`Còn ${hiddenCount} huy hiệu khác`}
        >
          <span
            className={`inline-flex items-center font-semibold rounded-full border ${sizeClasses} bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 cursor-help`}
          >
            +{hiddenCount}
          </span>

          {activeTooltip === 'overflow' && (
            <div
              className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 w-56 p-2.5 bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100 text-xs rounded-xl shadow-xl border border-neutral-700/50 pointer-events-none animate-in fade-in duration-150"
              role="tooltip"
            >
              <div className="font-semibold text-white mb-1.5 pb-1 border-b border-neutral-800 dark:border-neutral-700">
                Tất cả huy hiệu ({filteredBadgeIds.length})
              </div>
              <div className="space-y-1.5">
                {filteredBadgeIds.map((id) => {
                  const def = BADGE_DEFINITIONS[id];
                  if (!def) return null;
                  const Icon = def.icon;
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${def.iconColorClass}`} />
                      <span className="font-medium text-neutral-200 text-[11px]">{def.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
