import React from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
  Ban,
  LogIn,
  Check,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { BookingStatus, RoomOperationalStatus, PaymentStatus } from '../../types';
import { cn } from '../../lib/utils';

type AnyStatus = BookingStatus | RoomOperationalStatus | PaymentStatus;

interface StatusBadgeProps {
  status: AnyStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const getStatusConfig = (s: AnyStatus) => {
    switch (s) {
      case 'AVAILABLE':
        return {
          label: 'Available',
          icon: CheckCircle2,
          styles: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'PENDING':
        return {
          label: 'Pending',
          icon: Clock,
          styles: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        };
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          icon: ShieldCheck,
          styles: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        };
      case 'PAYMENT_FAILED':
      case 'FAILED':
        return {
          label: 'Payment Failed',
          icon: XCircle,
          styles: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          icon: Ban,
          styles: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
        };
      case 'CHECKED_IN':
        return {
          label: 'Checked In',
          icon: LogIn,
          styles: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          icon: Check,
          styles: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
        };
      case 'OCCUPIED':
        return {
          label: 'Occupied',
          icon: LogIn,
          styles: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        };
      case 'MAINTENANCE':
        return {
          label: 'Maintenance',
          icon: Wrench,
          styles: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
        };
      case 'DIRTY':
        return {
          label: 'Dirty (Turnover)',
          icon: Sparkles,
          styles: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
        };
      case 'SUCCEEDED':
        return {
          label: 'Paid (Settled)',
          icon: CheckCircle2,
          styles: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'REFUNDED':
        return {
          label: 'Refunded',
          icon: Ban,
          styles: 'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
        };
      default:
        return {
          label: String(s),
          icon: Clock,
          styles: 'bg-neutral-100 text-neutral-700 border-neutral-200',
        };
    }
  };

  const { label, icon: Icon, styles } = getStatusConfig(status);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 12 : 13;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border tracking-wide select-none',
        styles,
        sizeClasses,
        className
      )}
    >
      <Icon size={iconSize} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
};
