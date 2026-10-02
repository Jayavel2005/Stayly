import React from 'react';
import { formatCurrency, cn } from '../../lib/utils';

interface PriceDisplayProps {
  amount: number;
  perNight?: boolean;
  totalAmount?: number;
  totalNights?: number;
  includeTaxesLabel?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  perNight = true,
  totalAmount,
  totalNights,
  includeTaxesLabel = true,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'text-base font-semibold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-extrabold',
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={cn('font-mono tabular-nums text-foreground tracking-tight', sizeClasses[size])}>
          {formatCurrency(amount)}
        </span>
        {perNight && (
          <span className="text-xs text-muted-foreground font-normal">
            / night
          </span>
        )}
      </div>

      {includeTaxesLabel && (
        <span className="text-[11px] text-muted-foreground font-normal mt-0.5">
          {totalAmount && totalNights ? (
            <>
              Total <strong className="font-mono text-foreground font-semibold">{formatCurrency(totalAmount)}</strong> for {totalNights} {totalNights === 1 ? 'night' : 'nights'} (incl. taxes & fees)
            </>
          ) : (
            'Excl. 18% taxes & charges at checkout'
          )}
        </span>
      )}
    </div>
  );
};
