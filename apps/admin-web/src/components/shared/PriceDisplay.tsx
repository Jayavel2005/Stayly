import React from 'react';
import { formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';

export interface PriceDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  currency = 'INR',
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'text-xs font-medium',
    md: 'text-sm font-semibold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-extrabold',
  }[size];

  return (
    <span
      className={cn(
        'tabular-nums font-mono tracking-tight text-foreground inline-flex items-center',
        sizeClasses,
        className
      )}
    >
      {formatCurrency(amount, currency)}
    </span>
  );
};
