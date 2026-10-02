import React from 'react';
import { BedDouble } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <BedDouble className="w-12 h-12 text-muted-foreground stroke-[1.5]" />,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-xl border border-dashed border-border bg-card/60 backdrop-blur-xs max-w-xl mx-auto my-6',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {actionLabel && onAction && (
            <Button onClick={onAction} variant="default" size="default">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button onClick={onSecondaryAction} variant="outline" size="default">
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
