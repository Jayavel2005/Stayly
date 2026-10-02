import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { Booking } from '../../types';
import { Button } from '../ui/Button';

interface HoldBannerProps {
  holdBooking: Booking | null;
  onResumeCheckout: () => void;
  onDismiss: () => void;
}

export const HoldBanner: React.FC<HoldBannerProps> = ({
  holdBooking,
  onResumeCheckout,
  onDismiss,
}) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!holdBooking?.holdExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const expires = new Date(holdBooking.holdExpiresAt!).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diffSeconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdBooking]);

  if (!holdBooking || timeLeft === null || timeLeft <= 0) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 180; // Under 3 minutes

  return (
    <div
      className={`sticky top-0 z-40 px-4 py-2.5 transition-colors border-b flex items-center justify-between gap-4 text-xs md:text-sm ${
        isUrgent
          ? 'bg-amber-500 text-amber-950 border-amber-600 font-medium'
          : 'bg-brand-900 text-white border-brand-800'
      }`}
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1 flex-wrap justify-center sm:justify-start">
        {isUrgent ? (
          <ShieldAlert className="w-4 h-4 shrink-0 animate-bounce" />
        ) : (
          <Clock className="w-4 h-4 shrink-0 text-brand-300" />
        )}
        <span>
          Inventory hold reserved for <strong>{holdBooking.roomTypeName}</strong> at <strong>{holdBooking.hotelName}</strong>.
        </span>
        <span className="font-mono bg-black/20 px-2 py-0.5 rounded-sm font-semibold tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} remaining
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={onResumeCheckout}
          size="sm"
          variant={isUrgent ? 'destructive' : 'default'}
          className={
            isUrgent
              ? 'bg-amber-950 text-amber-100 hover:bg-black h-7 text-xs'
              : 'bg-white text-brand-900 hover:bg-brand-50 h-7 text-xs shadow-xs font-semibold'
          }
          rightIcon={<ArrowRight size={13} />}
        >
          Complete Checkout
        </Button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
