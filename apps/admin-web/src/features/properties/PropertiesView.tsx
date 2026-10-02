import React, { useState } from 'react';
import {
  Building2,
  Search,
  Filter,
  PlusCircle,
  MapPin,
  Star,
  Users,
  Grid,
  List,
  CheckCircle,
  XCircle,
  Eye,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { AdminHotel, HotelStatus } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { Modal } from '../../components/shared/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { OnboardHotelModal } from './OnboardHotelModal';
import { formatDate } from '../../lib/utils';

export const PropertiesView: React.FC = () => {
  const {
    hotels,
    updateHotelStatus,
    setOnboardHotelModalOpen,
    setActiveTab,
  } = useAdminStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | HotelStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [inspectHotel, setInspectHotel] = useState<AdminHotel | null>(null);

  const cities = ['ALL', 'Chennai', 'Bengaluru', 'Mumbai', 'Goa', 'Udaipur', 'Manali'];

  const filteredHotels = hotels.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCity = cityFilter === 'ALL' || h.city === cityFilter;
    const matchesStatus = statusFilter === 'ALL' || h.status === statusFilter;

    return matchesSearch && matchesCity && matchesStatus;
  });

  const handleApproveHotel = (hotel: AdminHotel) => {
    updateHotelStatus(hotel.id, 'ACTIVE');
    toast.success(`Property "${hotel.name}" approved and activated across public search.`);
  };

  const handleSuspendHotel = (hotel: AdminHotel) => {
    updateHotelStatus(hotel.id, 'SUSPENDED');
    toast.error(`Property "${hotel.name}" listing has been suspended.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Hotel Portfolio & Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit partner properties, approve new onboarding submissions, and oversee property managers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOnboardHotelModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
        >
          <PlusCircle size={15} />
          <span>+ Onboard New Property</span>
        </button>
      </div>

      {/* Filter and View Controls */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hotel name, brand, city..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* City Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={14} />
            <span>City:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Live)</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 ml-2">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${
                viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Hotel Cards Grid / Table */}
      {filteredHotels.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hotels match your filters"
          description="Try selecting a different city or status, or onboard a new property listing."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery('');
            setCityFilter('ALL');
            setStatusFilter('ALL');
          }}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotels.map((hotel) => (
            <div
              key={hotel.id}
              className="bg-card text-card-foreground border border-border rounded-xl overflow-hidden shadow-card hover:shadow-elevated transition-shadow flex flex-col justify-between"
            >
              {/* Image & Status Badge */}
              <div className="relative aspect-[16/10] overflow-hidden group">
                <img
                  src={hotel.images[0]}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3">
                  <StatusBadge status={hotel.status} size="sm" />
                </div>
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span>{hotel.starRating} Stars</span>
                </div>
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur text-white text-xs font-mono px-2 py-0.5 rounded">
                  {hotel.id}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {hotel.brand || 'Independent'}
                  </div>
                  <h3 className="text-base font-bold text-foreground mt-0.5 leading-snug">
                    {hotel.name}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin size={13} className="text-primary shrink-0" />
                    <span>{hotel.address}, {hotel.city}</span>
                  </p>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Physical Inventory:</span>
                    <span className="font-mono font-bold text-foreground">{hotel.totalRooms} rooms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Live Occupancy:</span>
                    <span className="font-mono font-bold text-foreground">{hotel.occupancyRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Monthly Revenue:</span>
                    <PriceDisplay amount={hotel.monthlyRevenue} size="sm" />
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectHotel(hotel)}
                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground transition-colors flex items-center gap-1"
                  >
                    <Eye size={13} />
                    <span>Inspect</span>
                  </button>

                  {hotel.status === 'PENDING_APPROVAL' ? (
                    <button
                      type="button"
                      onClick={() => handleApproveHotel(hotel)}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle size={13} />
                      <span>Approve Listing</span>
                    </button>
                  ) : hotel.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => handleSuspendHotel(hotel)}
                      className="px-3 py-1.5 text-xs font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApproveHotel(hotel)}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tabular Layout */
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Property</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Units</th>
                  <th className="px-5 py-3">Occupancy</th>
                  <th className="px-5 py-3">Monthly GMV</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHotels.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={h.images[0]}
                          alt={h.name}
                          className="w-10 h-10 rounded-lg object-cover ring-1 ring-border"
                        />
                        <div>
                          <div className="font-bold text-foreground">{h.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{h.brand}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {h.city}, {h.state}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-foreground font-bold">
                      {h.totalRooms}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-foreground">
                      {h.occupancyRate}%
                    </td>
                    <td className="px-5 py-3.5">
                      <PriceDisplay amount={h.monthlyRevenue} size="sm" />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={h.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectHotel(h)}
                          className="px-2.5 py-1 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground"
                        >
                          View
                        </button>
                        {h.status === 'PENDING_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => handleApproveHotel(h)}
                            className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hotel Inspect Modal */}
      {inspectHotel && (
        <Modal
          isOpen={!!inspectHotel}
          onClose={() => setInspectHotel(null)}
          title={`Property Audit: ${inspectHotel.name}`}
          subtitle={`Hotel ID: ${inspectHotel.id} • ${inspectHotel.city}, ${inspectHotel.state}`}
          size="xl"
        >
          <div className="space-y-6 text-xs">
            {/* Gallery */}
            <div className="grid grid-cols-2 gap-3 h-48 rounded-xl overflow-hidden">
              {inspectHotel.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${inspectHotel.name} view ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ))}
            </div>

            {/* Description & Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={inspectHotel.status} />
                <span className="font-bold text-amber-500 flex items-center gap-1">
                  <Star size={14} className="fill-amber-400" />
                  <span>{inspectHotel.starRating} Stars Classification</span>
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{inspectHotel.description}</p>
            </div>

            {/* Operational Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-muted/40 border border-border rounded-lg">
                <span className="text-muted-foreground font-semibold">Total Physical Inventory</span>
                <div className="text-lg font-bold text-foreground font-mono mt-1">
                  {inspectHotel.totalRooms} rooms
                </div>
              </div>
              <div className="p-3.5 bg-muted/40 border border-border rounded-lg">
                <span className="text-muted-foreground font-semibold">Average Live Occupancy</span>
                <div className="text-lg font-bold text-foreground font-mono mt-1">
                  {inspectHotel.occupancyRate}%
                </div>
              </div>
              <div className="p-3.5 bg-muted/40 border border-border rounded-lg">
                <span className="text-muted-foreground font-semibold">Monthly Gross Volume</span>
                <div className="mt-1">
                  <PriceDisplay amount={inspectHotel.monthlyRevenue} size="lg" />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h4 className="font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Certified Amenities
              </h4>
              <div className="flex flex-wrap gap-2">
                {inspectHotel.amenities.map((a) => (
                  <span
                    key={a}
                    className="px-2.5 py-1 bg-muted rounded-full font-medium text-foreground text-xs"
                  >
                    ✓ {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Policy */}
            <div className="p-3.5 bg-card border border-border rounded-lg">
              <span className="font-bold text-foreground block mb-1">Standard Cancellation Clause</span>
              <p className="text-muted-foreground">{inspectHotel.cancellationPolicy}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Onboard Hotel Modal */}
      <OnboardHotelModal />
    </div>
  );
};
