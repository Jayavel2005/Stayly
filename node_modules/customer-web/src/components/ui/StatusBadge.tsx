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
import { cn } from '../../lib/utils';
import { BookingStatus, OperationalStatus } from '../../types';

interface StatusBadgeProps {
  status: BookingStatus | OperationalStatus;
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
}) => {
  const configMap: Record<
    string,
    { label: string; lightClasses: string; darkClasses: string; icon: React.ReactNode }
  > = {
    AVAILABLE: {
      label: 'Available',
      lightClasses: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      darkClasses: 'dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      icon: <CheckCircle2 size={13} className="shrink-0 stroke-[1.75]" />,
    },
    PENDING: {
      label: 'Hold Pending',
      lightClasses: 'bg-amber-50 text-amber-800 border-amber-200',
      darkClasses: 'dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      icon: <Clock size={13} className="shrink-0 stroke-[1.75]" />,
    },
    CONFIRMED: {
      label: 'Confirmed',
      lightClasses: 'bg-brand-50 text-brand-900 border-brand-200',
      darkClasses: 'dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800',
      icon: <ShieldCheck size={13} className="shrink-0 stroke-[1.75]" />,
    },
    CHECKED_IN: {
      label: 'Checked In',
      lightClasses: 'bg-sky-50 text-sky-800 border-sky-200',
      darkClasses: 'dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
      icon: <LogIn size={13} className="shrink-0 stroke-[1.75]" />,
    },
    COMPLETED: {
      label: 'Completed Stay',
      lightClasses: 'bg-neutral-100 text-neutral-800 border-neutral-200',
      darkClasses: 'dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
      icon: <Check size={13} className="shrink-0 stroke-[1.75]" />,
    },
    CANCELLED: {
      label: 'Cancelled',
      lightClasses: 'bg-rose-50 text-rose-800 border-rose-200',
      darkClasses: 'dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      icon: <Ban size={13} className="shrink-0 stroke-[1.75]" />,
    },
    REFUNDED: {
      label: 'Refunded',
      lightClasses: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      darkClasses: 'dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      icon: <CheckCircle2 size={13} className="shrink-0 stroke-[1.75]" />,
    },
    PAYMENT_FAILED: {
      label: 'Payment Failed',
      lightClasses: 'bg-red-50 text-red-800 border-red-200',
      darkClasses: 'dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
      icon: <XCircle size={13} className="shrink-0 stroke-[1.75]" />,
    },
    MAINTENANCE: {
      label: 'Maintenance',
      lightClasses: 'bg-orange-50 text-orange-800 border-orange-200',
      darkClasses: 'dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
      icon: <Wrench size={13} className="shrink-0 stroke-[1.75]" />,
    },
    DIRTY: {
      label: 'Cleaning Required',
      lightClasses: 'bg-stone-100 text-stone-700 border-stone-200',
      darkClasses: 'dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
      icon: <Sparkles size={13} className="shrink-0 stroke-[1.75]" />,
    },
  };

  const current = configMap[status] || {
    label: status,
    lightClasses: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    darkClasses: 'dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
    icon: null,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide uppercase',
        current.lightClasses,
        current.darkClasses,
        className
      )}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};
