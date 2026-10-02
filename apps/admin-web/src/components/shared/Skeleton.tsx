import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/80 dark:bg-muted/50',
        className
      )}
    />
  );
};
