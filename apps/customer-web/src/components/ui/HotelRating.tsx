import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HotelRatingProps {
  score: number; // e.g. 4.85
  totalReviews?: number;
  starClass?: number; // e.g. 5 star hotel
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTextLabel?: boolean;
}

export const HotelRating: React.FC<HotelRatingProps> = ({
  score,
  totalReviews,
  starClass,
  size = 'md',
  className,
  showTextLabel = true,
}) => {
  const getLabel = (s: number) => {
    if (s >= 4.8) return 'Exceptional';
    if (s >= 4.5) return 'Wonderful';
    if (s >= 4.0) return 'Very Good';
    return 'Good';
  };

  const pillSizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Visual Stars if 5-star rating provided */}
      {starClass && (
        <div className="flex items-center text-amber-500 gap-0.5 mr-1" title={`${starClass} Star Hotel`}>
          {Array.from({ length: starClass }).map((_, i) => (
            <Star key={i} size={13} className="fill-amber-400 stroke-amber-500" />
          ))}
        </div>
      )}

      {/* High contrast score pill per Design System line 516 */}
      <div
        className={cn(
          'inline-flex items-center gap-1 font-semibold rounded-md bg-brand-50 text-brand-900 border border-brand-200 dark:bg-brand-950 dark:text-brand-200 dark:border-brand-800',
          pillSizes[size]
        )}
      >
        <Star size={12} className="fill-brand-600 stroke-brand-600 dark:fill-brand-400 dark:stroke-brand-400" />
        <span className="font-mono tabular-nums">{score.toFixed(1)}</span>
      </div>

      {showTextLabel && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="font-medium text-foreground">{getLabel(score)}</span>
          {typeof totalReviews === 'number' && (
            <>
              <span>•</span>
              <span>{totalReviews} verified {totalReviews === 1 ? 'review' : 'reviews'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
