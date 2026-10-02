import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Building2,
  UserCheck,
  HelpCircle,
  EyeOff,
  Eye,
  Flag,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const normalized = (status || '').toUpperCase();

  let label = status;
  let icon = <HelpCircle size={size === 'sm' ? 12 : 14} />;
  let colorClasses =
    'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700';

  switch (normalized) {
    // Active / Success / Settled / Approved / Published
    case 'ACTIVE':
    case 'SETTLED':
    case 'APPROVED_FULL':
    case 'PUBLISHED':
      label =
        normalized === 'APPROVED_FULL'
          ? 'Full Refund Approved'
          : normalized === 'SETTLED'
          ? 'Settled'
          : normalized === 'PUBLISHED'
          ? 'Published'
          : 'Active';
      icon = <CheckCircle2 size={size === 'sm' ? 12 : 14} className="text-emerald-600 dark:text-emerald-400" />;
      colorClasses =
        'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
      break;

    // Partial Approval / Operations / Manager
    case 'APPROVED_PARTIAL':
      label = 'Partial Refund Approved';
      icon = <CheckCircle2 size={size === 'sm' ? 12 : 14} className="text-teal-600 dark:text-teal-400" />;
      colorClasses =
        'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60';
      break;

    // Pending / Review / Holds
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_ADMIN_REVIEW':
    case 'PENDING_VERIFICATION':
    case 'UNDER_REVIEW':
      label =
        normalized === 'PENDING_ADMIN_REVIEW'
          ? 'Dispute Under Review'
          : normalized === 'PENDING_APPROVAL'
          ? 'Pending Onboarding'
          : 'Pending';
      icon = <Clock size={size === 'sm' ? 12 : 14} className="text-amber-600 dark:text-amber-400" />;
      colorClasses =
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
      break;

    // Flagged / Disputed / Caution
    case 'DISPUTED':
    case 'FLAGGED':
      label = normalized === 'DISPUTED' ? 'Disputed' : 'Flagged Violation';
      icon = <Flag size={size === 'sm' ? 12 : 14} className="text-amber-600 dark:text-amber-400" />;
      colorClasses =
        'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700';
      break;

    // Suspended / Failed / Cancelled / Rejected / Hidden
    case 'SUSPENDED':
    case 'FAILED':
    case 'CANCELLED':
    case 'REJECTED':
    case 'HIDDEN':
      label =
        normalized === 'SUSPENDED'
          ? 'Suspended'
          : normalized === 'REJECTED'
          ? 'Rejected'
          : normalized === 'HIDDEN'
          ? 'Hidden'
          : 'Failed';
      icon =
        normalized === 'HIDDEN' ? (
          <EyeOff size={size === 'sm' ? 12 : 14} className="text-red-600 dark:text-red-400" />
        ) : (
          <XCircle size={size === 'sm' ? 12 : 14} className="text-red-600 dark:text-red-400" />
        );
      colorClasses =
        'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60';
      break;

    // Roles: ADMIN
    case 'ADMIN':
      label = 'Super Admin';
      icon = <ShieldCheck size={size === 'sm' ? 12 : 14} className="text-purple-600 dark:text-purple-400" />;
      colorClasses =
        'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60';
      break;

    // Roles: MANAGER
    case 'MANAGER':
      label = 'Hotel Manager';
      icon = <Building2 size={size === 'sm' ? 12 : 14} className="text-brand-700 dark:text-brand-300" />;
      colorClasses =
        'bg-brand-50 text-brand-900 border-brand-200 dark:bg-brand-950/60 dark:text-brand-200 dark:border-brand-800/60';
      break;

    // Roles: CUSTOMER
    case 'CUSTOMER':
      label = 'Traveler';
      icon = <UserCheck size={size === 'sm' ? 12 : 14} className="text-slate-600 dark:text-slate-400" />;
      colorClasses =
        'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
      break;

    // Refunded
    case 'REFUNDED':
      label = 'Refunded';
      icon = <Clock size={size === 'sm' ? 12 : 14} className="text-blue-600 dark:text-blue-400" />;
      colorClasses =
        'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60';
      break;

    default:
      label = status;
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors select-none',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        colorClasses,
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
