import React from 'react';
import {
  TrendingUp,
  DollarSign,
  BedDouble,
  UserCheck,
  CalendarDays,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wrench,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useManagerStore } from '../../store/managerStore';
import { computeHotelKPIs, formatCurrency, formatDate } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';

const trendData = [
  { day: 'Sep 25', occupancy: 70, revenue: 145000 },
  { day: 'Sep 26', occupancy: 75, revenue: 168000 },
  { day: 'Sep 27', occupancy: 82, revenue: 195000 },
  { day: 'Sep 28', occupancy: 78, revenue: 172000 },
  { day: 'Sep 29', occupancy: 85, revenue: 215000 },
  { day: 'Sep 30', occupancy: 88, revenue: 230000 },
  { day: 'Oct 01', occupancy: 84, revenue: 210000 },
];

export const DashboardView: React.FC = () => {
  const {
    currentHotelId,
    hotels,
    rooms,
    bookings,
    checkInGuest,
    setActiveTab,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const kpis = computeHotelKPIs(currentHotelId, rooms, bookings);

  // Today's incoming arrivals
  const todaysArrivals = bookings.filter(
    (b) => b.hotelId === currentHotelId && b.checkIn === '2026-10-01'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner / Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
            Operations Command Center
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time inventory status, guest arrivals, and front-desk execution for{' '}
            <strong className="text-foreground">{currentHotel.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('front-desk')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 transition-colors text-xs font-semibold shadow-subtle"
          >
            <CalendarDays size={14} />
            <span>Open Front-Desk Manifest</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 1. Top Row: 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle hover:border-brand-300 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Monthly Revenue (Oct)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {formatCurrency(kpis.totalRevenueThisMonth)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp size={13} />
              +{kpis.revenueGrowthPercent}%
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        </div>

        {/* KPI 2: Occupancy Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle hover:border-brand-300 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Occupancy Rate
            </span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <BedDouble size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {kpis.occupancyRatePercent}%
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{kpis.occupiedRoomsCount}</strong> / {kpis.totalPhysicalRooms} Rooms
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {kpis.availableRoomsCount} Ready
            </span>
          </div>
        </div>

        {/* KPI 3: Today's Pending Arrivals */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle hover:border-brand-300 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Arrivals Due Today
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {kpis.pendingArrivalsToday} Guests
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Departures today: <strong className="text-foreground">{kpis.pendingDeparturesToday}</strong></span>
            <button
              onClick={() => setActiveTab('front-desk')}
              className="text-primary font-semibold hover:underline"
            >
              Process →
            </button>
          </div>
        </div>

        {/* KPI 4: In-House Guests */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle hover:border-brand-300 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              In-House Guests
            </span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-300">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {kpis.inHouseGuestsCount} Active
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>ADR: <strong className="text-foreground">{formatCurrency(kpis.averageDailyRate)}</strong></span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              98.2% Satisfaction
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Analytical Split (Occupancy Trend + Room Status Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy & Revenue Timeline (2/3 Col) */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-border bg-card shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">7-Day Occupancy & Revenue Velocity</h2>
              <p className="text-xs text-muted-foreground">
                Daily stay percentage and settled booking receipts
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                Occupancy %
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[50, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-card p-3 shadow-elevated text-xs space-y-1">
                          <p className="font-bold text-foreground">{data.day}, 2026</p>
                          <p className="text-primary font-semibold">
                            Occupancy: {data.occupancy}%
                          </p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Daily Revenue: {formatCurrency(data.revenue)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#occupancyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Room Status Distribution (1/3 Col) */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Room Inventory Status</h2>
                <p className="text-xs text-muted-foreground">
                  Current physical room distribution
                </p>
              </div>
              <button
                onClick={() => setActiveTab('rooms')}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Matrix →
              </button>
            </div>

            {/* Visual Bars Breakdown */}
            <div className="space-y-3.5">
              {/* Available */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={13} />
                    Available (Clean & Inspected)
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {kpis.availableRoomsCount} ({Math.round((kpis.availableRoomsCount / kpis.totalPhysicalRooms) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${(kpis.availableRoomsCount / kpis.totalPhysicalRooms) * 100}%` }}
                  />
                </div>
              </div>

              {/* Occupied */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
                    <UserCheck size={13} />
                    Occupied by Guests
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {kpis.occupiedRoomsCount} ({Math.round((kpis.occupiedRoomsCount / kpis.totalPhysicalRooms) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full transition-all duration-300"
                    style={{ width: `${(kpis.occupiedRoomsCount / kpis.totalPhysicalRooms) * 100}%` }}
                  />
                </div>
              </div>

              {/* Dirty / Turnover */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
                    <Sparkles size={13} />
                    Dirty (Turnover Needed)
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {kpis.dirtyRoomsCount} ({Math.round((kpis.dirtyRoomsCount / kpis.totalPhysicalRooms) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-stone-500 rounded-full transition-all duration-300"
                    style={{ width: `${(kpis.dirtyRoomsCount / kpis.totalPhysicalRooms) * 100}%` }}
                  />
                </div>
              </div>

              {/* Maintenance */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-orange-700 dark:text-orange-300">
                    <Wrench size={13} />
                    Maintenance / Out of Order
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {kpis.maintenanceRoomsCount} ({Math.round((kpis.maintenanceRoomsCount / kpis.totalPhysicalRooms) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all duration-300"
                    style={{ width: `${(kpis.maintenanceRoomsCount / kpis.totalPhysicalRooms) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Units: <strong className="text-foreground">{kpis.totalPhysicalRooms}</strong></span>
            <button
              onClick={() => setActiveTab('housekeeping')}
              className="text-primary font-semibold hover:underline"
            >
              Open Housekeeping Queue →
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Actionable Front-Desk Quick Manifest */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Today's Arrival Manifest (Actionable)</h2>
            <p className="text-xs text-muted-foreground">
              Guests scheduled to check-in on October 1, 2026. 1-click check-in assigns key and updates room status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('front-desk')}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Full Front-Desk View ({bookings.length} reservations)</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Guest Name</th>
                <th className="py-2.5 px-3">Room Type</th>
                <th className="py-2.5 px-3">Assigned Room</th>
                <th className="py-2.5 px-3">Stay Dates</th>
                <th className="py-2.5 px-3">Total Fare</th>
                <th className="py-2.5 px-3">Booking Status</th>
                <th className="py-2.5 px-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {todaysArrivals.map((booking) => (
                <tr key={booking.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-primary">
                    {booking.bookingReference}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-foreground">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {booking.customer.phone}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-foreground">
                    {booking.roomTypeName}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-muted text-foreground">
                      Room {booking.roomNumber || 'Auto-assign'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    <div>{formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}</div>
                    <span className="text-[10px] text-muted-foreground">({booking.totalNights} nights, {booking.totalGuests} guests)</span>
                  </td>
                  <td className="py-3 px-3">
                    <PriceDisplay amount={booking.totalPrice} />
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={booking.status} size="sm" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    {booking.status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        onClick={() => checkInGuest(booking.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        <ShieldCheck size={13} />
                        <span>Check-In</span>
                      </button>
                    ) : booking.status === 'CHECKED_IN' ? (
                      <span className="text-sky-600 dark:text-sky-400 font-bold text-xs inline-flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        In-House
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{booking.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
