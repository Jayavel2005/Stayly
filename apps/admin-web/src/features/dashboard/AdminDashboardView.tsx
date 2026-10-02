import React from 'react';
import {
  TrendingUp,
  CreditCard,
  Building2,
  CalendarCheck,
  Scale,
  Users,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  Percent,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAdminStore } from '../../store/adminStore';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { revenueChartData, bookingStatusDistribution } from '../../data/mockAdminData';

export const AdminDashboardView: React.FC = () => {
  const {
    getKPISummary,
    hotels,
    disputes,
    reviews,
    auditEvents,
    setActiveTab,
    setOnboardHotelModalOpen,
  } = useAdminStore();

  const kpis = getKPISummary();
  const pendingApprovals = hotels.filter((h) => h.status === 'PENDING_APPROVAL');
  const pendingDisputes = disputes.filter((d) => d.disputeStatus === 'PENDING_ADMIN_REVIEW');

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Platform Vital Signals
            </h1>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Feed
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Global ecosystem oversight, gross transaction volume, occupancy trends, and dispute queues.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('refunds')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all shadow-subtle"
          >
            <Scale size={14} className="text-amber-500" />
            <span>Disputes ({pendingDisputes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setOnboardHotelModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <Sparkles size={14} className="text-teal-300" />
            <span>+ Onboard Property</span>
          </button>
        </div>
      </div>

      {/* Top Row: 4 Primary KPI Summary Cards per Design System Section 20 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Gross Merchandise Value (GMV) */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Volume (GMV)</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-primary dark:text-brand-300 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mb-2">
            {formatCurrency(kpis.grossMerchandiseValue)}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              +{kpis.gmvGrowthPercent}%
            </span>
            <span className="text-muted-foreground">vs previous month</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Monthly Target: ₹30.0M</span>
            <span className="font-semibold text-foreground">94.8% achieved</span>
          </div>
        </div>

        {/* KPI 2: Platform Net Revenue (12% take-rate) */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Platform Net Take</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mb-2">
            {formatCurrency(kpis.platformNetRevenue)}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              +18.4%
            </span>
            <span className="text-muted-foreground">Standard 12% cut</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Settled Payouts: 98.4%</span>
            <span className="font-semibold text-foreground">Automated</span>
          </div>
        </div>

        {/* KPI 3: Total Active Bookings */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Bookings</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <CalendarCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mb-2">
            {kpis.totalActiveBookings}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
              +{kpis.bookingsGrowthPercent}%
            </span>
            <span className="text-muted-foreground">104 Confirmed, 48 In-House</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Zero Double-Booking</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Guaranteed</span>
          </div>
        </div>

        {/* KPI 4: Portfolio Occupancy Rate */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Occupancy</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Percent size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight mb-2">
            {kpis.averageOccupancyRate}%
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
              +{kpis.occupancyGrowthPercent}%
            </span>
            <span className="text-muted-foreground">Across 5 active properties</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Top: Alila Diwa (94%)</span>
            <span className="font-semibold text-foreground">868 units live</span>
          </div>
        </div>
      </div>

      {/* Secondary Signal Alerts & Attention Banners */}
      {(pendingApprovals.length > 0 || pendingDisputes.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingApprovals.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {pendingApprovals.length} Properties Awaiting Listing Approval
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {pendingApprovals.map((h) => h.name).join(', ')} require administrative inspection.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('properties')}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0"
              >
                Review Listings ➔
              </button>
            </div>
          )}

          {pendingDisputes.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Scale size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {pendingDisputes.length} Booking Disputes Require Arbitration
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Hospitalization & weather disruption claims ready for override decisions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('refunds')}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shrink-0"
              >
                Resolve Queue ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytical Split Row: 2/3 Timeline Chart + 1/3 Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Timeline Area Chart */}
        <div className="lg:col-span-2 bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Gross Merchandise Value & Net Revenue Velocity
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly transactional volume in INR across all hospitality partners (2026).
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span>GMV Total</span>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>12% Commission</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover text-popover-foreground border border-border shadow-elevated rounded-lg p-3 text-xs space-y-1">
                          <div className="font-bold border-b border-border pb-1 mb-1.5">{data.month} 2026</div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">GMV Volume:</span>
                            <span className="font-bold tabular-nums font-mono">{formatCurrency(data.gmv)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-600 dark:text-emerald-400">Net Take (12%):</span>
                            <span className="font-bold tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(data.commission)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 text-muted-foreground pt-1 border-t border-border/50">
                            <span>Bookings Count:</span>
                            <span className="font-semibold">{data.bookings} stays</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gmvGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke="#15803d"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#commissionGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary: Booking Volume Distribution */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Booking State Distribution
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live lifecycle state across all concurrent reservations.
            </p>
          </div>

          <div className="h-48 w-full my-auto flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bookingStatusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {bookingStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-popover text-popover-foreground border border-border shadow-elevated rounded-lg p-2 text-xs font-semibold">
                          <span>{data.name}: </span>
                          <span className="font-bold">{data.value} bookings</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            {bookingStatusDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </span>
                <span className="font-bold text-foreground font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Performance Leaderboard Table */}
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Partner Hotel Portfolio Performance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Property inventory, occupancy rates, and revenue generation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className="text-xs font-semibold text-primary dark:text-brand-300 hover:underline flex items-center gap-1"
          >
            <span>Manage All Portfolio</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Property</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Inventory</th>
                <th className="px-5 py-3">Occupancy</th>
                <th className="px-5 py-3">Monthly GMV</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hotels.map((hotel) => (
                <tr key={hotel.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={hotel.images[0]}
                        alt={hotel.name}
                        className="w-10 h-10 rounded-lg object-cover ring-1 ring-border"
                      />
                      <div>
                        <div className="font-bold text-foreground">{hotel.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{hotel.brand}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {hotel.city}, {hotel.state}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-foreground">
                    {hotel.totalRooms} rooms
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${hotel.occupancyRate}%` }}
                        />
                      </div>
                      <span className="font-bold font-mono text-foreground">{hotel.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <PriceDisplay amount={hotel.monthlyRevenue} size="sm" />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={hotel.status} size="sm" />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setActiveTab('properties')}
                      className="px-2.5 py-1 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground transition-colors"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Platform Audit Trail Feed */}
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-primary dark:text-brand-300" />
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Live System Audit Trail
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">Immutable Log Feed</span>
        </div>

        <div className="space-y-3">
          {auditEvents.slice(0, 5).map((evt) => (
            <div
              key={evt.id}
              className="flex items-start justify-between gap-4 p-3 bg-muted/40 rounded-lg border border-border/60 text-xs"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase mt-0.5 ${
                    evt.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : evt.severity === 'WARNING'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {evt.severity}
                </span>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{evt.action}</span>
                    <span className="text-muted-foreground font-normal">• Target: {evt.target}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{evt.details}</p>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    Actor: {evt.actor} ({evt.actorRole}) • IP: {evt.ipAddress}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                {formatDateTime(evt.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
