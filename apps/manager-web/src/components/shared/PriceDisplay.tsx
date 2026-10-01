import React from 'react';
import { formatCurrency, cn } from '../../lib/utils';

interface PriceDisplayProps {
  amount: number;
  currency?: string;
  perNight?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  currency = 'INR',
  perNight = false,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-semibold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-bold tracking-tight',
  }[size];

  return (
    <span className={cn('tabular-nums inline-flex items-baseline gap-1', className)}>
      <span className={cn('text-foreground', sizeClasses)}>
        {formatCurrency(amount, currency)}
      </span>
      {perNight && (
        <span className="text-xs font-normal text-muted-foreground">/ night</span>
      )}
    </span>
  );
};
