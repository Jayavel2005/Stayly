import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HotelRatingProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

export const HotelRating: React.FC<HotelRatingProps> = ({
  rating,
  totalReviews,
  size = 'md',
  showCount = true,
  className,
}) => {
  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className="flex items-center text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={iconSize}
            className={cn(
              star <= Math.round(rating)
                ? 'fill-amber-500 text-amber-500'
                : 'text-neutral-300 dark:text-neutral-700'
            )}
          />
        ))}
      </div>
      <span className={cn('font-semibold tabular-nums text-foreground', textSize)}>
        {rating.toFixed(1)}
      </span>
      {showCount && totalReviews !== undefined && (
        <span className="text-xs text-muted-foreground">({totalReviews})</span>
      )}
    </div>
  );
};
