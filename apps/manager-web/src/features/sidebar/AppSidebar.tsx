import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Grid3X3,
  Layers,
  Sparkles,
  Star,
  Settings,
  Hotel as HotelIcon,
  TrendingUp,
} from 'lucide-react';
import { useManagerStore, NavigationTab } from '../../store/managerStore';
import { computeHotelKPIs } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeVariant?: 'primary' | 'warning' | 'destructive' | 'neutral';
}

export const AppSidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentHotelId,
    hotels,
    rooms,
    bookings,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const kpis = computeHotelKPIs(currentHotelId, rooms, bookings);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Operations Hub',
      icon: LayoutDashboard,
    },
    {
      id: 'front-desk',
      label: 'Front Desk Manifest',
      icon: CalendarCheck,
      badge: kpis.pendingArrivalsToday > 0 ? `${kpis.pendingArrivalsToday} Due` : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'rooms',
      label: 'Room Inventory Matrix',
      icon: Grid3X3,
      badge: kpis.totalPhysicalRooms,
      badgeVariant: 'neutral',
    },
    {
      id: 'room-types',
      label: 'Room Types & Rates',
      icon: Layers,
    },
    {
      id: 'housekeeping',
      label: 'Housekeeping & Turnover',
      icon: Sparkles,
      badge: kpis.dirtyRoomsCount > 0 ? kpis.dirtyRoomsCount : undefined,
      badgeVariant: 'warning',
    },
    {
      id: 'reviews',
      label: 'Guest Reviews Audit',
      icon: Star,
      badge: '4.8 ★',
      badgeVariant: 'neutral',
    },
    {
      id: 'property',
      label: 'Property Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 h-full select-none">
      {/* Upper Navigation Block */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        {/* Brand Monogram & Hotel Identity */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-subtle tracking-tight font-serif">
            S
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-base tracking-tight text-foreground">
                Stayora
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-300 font-semibold">
                PMS v1.0
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              Property Manager Portal
            </p>
          </div>
        </div>

        {/* Managed Hotel Mini-Card */}
        <div className="p-3 rounded-lg border border-border bg-muted/40 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <HotelIcon size={14} className="text-primary shrink-0" />
            <span className="font-bold text-foreground truncate">
              {currentHotel.name}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {currentHotel.address}, {currentHotel.city}
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Management & Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-subtle'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={16}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors',
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeVariant === 'warning'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                        : item.badgeVariant === 'primary'
                        ? 'bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-300'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Live Occupancy Widget */}
      <div className="p-4 border-t border-border shrink-0 bg-card">
        <div className="p-3.5 rounded-xl border border-border bg-gradient-to-br from-brand-50/60 to-background dark:from-brand-950/20 dark:to-card space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
              Live Occupancy
            </span>
            <span className="text-xs font-extrabold text-foreground tabular-nums">
              {kpis.occupancyRatePercent}%
            </span>
          </div>

          {/* Progress track */}
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${kpis.occupancyRatePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <strong className="text-foreground font-semibold">{kpis.occupiedRoomsCount}</strong> occupied
            </span>
            <span>
              <strong className="text-foreground font-semibold">{kpis.availableRoomsCount}</strong> ready
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
