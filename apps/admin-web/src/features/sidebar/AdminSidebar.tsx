import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Network,
  Receipt,
  Scale,
  MessageSquare,
  Sliders,
  Server,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { AdminTab } from '../../types';
import { cn } from '../../lib/utils';

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  badgeVariant?: 'warning' | 'info' | 'danger';
}

export const AdminSidebar: React.FC = () => {
  const { activeTab, setActiveTab, hotels, disputes, reviews } = useAdminStore();

  const pendingApprovalsCount = hotels.filter((h) => h.status === 'PENDING_APPROVAL').length;
  const pendingDisputesCount = disputes.filter((d) => d.disputeStatus === 'PENDING_ADMIN_REVIEW').length;
  const flaggedReviewsCount = reviews.filter((r) => r.moderationStatus === 'FLAGGED').length;

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Overview & Vital Signals',
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: 'users',
      label: 'User Directory & Roles',
      icon: <Users size={18} />,
    },
    {
      id: 'properties',
      label: 'Hotel Portfolio',
      icon: <Building2 size={18} />,
      badgeCount: pendingApprovalsCount,
      badgeVariant: 'warning',
    },
    {
      id: 'managers',
      label: 'Manager Assignments',
      icon: <Network size={18} />,
    },
    {
      id: 'ledger',
      label: 'Financial Ledger',
      icon: <Receipt size={18} />,
    },
    {
      id: 'refunds',
      label: 'Dispute & Refund Queue',
      icon: <Scale size={18} />,
      badgeCount: pendingDisputesCount,
      badgeVariant: 'danger',
    },
    {
      id: 'reviews',
      label: 'Review Moderation',
      icon: <MessageSquare size={18} />,
      badgeCount: flaggedReviewsCount,
      badgeVariant: 'warning',
    },
    {
      id: 'settings',
      label: 'Platform Governance',
      icon: <Sliders size={18} />,
    },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Navigation Links */}
      <div className="space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Platform Administration
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group text-left',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'transition-colors',
                        isActive
                          ? 'text-teal-300'
                          : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeVariant === 'danger'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      )}
                    >
                      {item.badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Infrastructure Telemetry Footer Widget */}
      <div className="pt-4 border-t border-border mt-auto">
        <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Server size={14} className="text-primary dark:text-brand-400" />
              <span>Infra Matrix</span>
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
              PORT 3002
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1 font-mono">
            <div className="flex justify-between">
              <span>API Gateway:</span>
              <span className="text-foreground font-semibold">4000 (/api/v1)</span>
            </div>
            <div className="flex justify-between">
              <span>PostgreSQL:</span>
              <span className="text-foreground font-semibold">5432 (Prisma)</span>
            </div>
            <div className="flex justify-between">
              <span>Redis Engine:</span>
              <span className="text-foreground font-semibold">6379 (Healthy)</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
