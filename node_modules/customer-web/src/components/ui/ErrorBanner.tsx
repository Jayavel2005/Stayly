import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface ErrorBannerProps {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title,
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-destructive/20 bg-destructive/5 p-4 md:p-5 flex flex-col sm:flex-row items-start gap-4 text-foreground',
        className
      )}
    >
      <div className="p-2 rounded-full bg-destructive/10 text-destructive shrink-0 mt-0.5">
        <AlertCircle className="w-5 h-5 stroke-[1.75]" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-destructive mb-1">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground leading-normal">
          {message}
        </p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-center border-destructive/30 hover:bg-destructive/10 text-destructive"
          leftIcon={<RefreshCw size={14} />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
