import React, { useState, useMemo } from 'react';
import {
  Grid3X3,
  Plus,
  Filter,
  CheckCircle2,
  LogIn,
  Sparkles,
  Wrench,
  AlertTriangle,
  User,
  Clock,
  Layers,
  Search,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { Room, RoomOperationalStatus } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { SafetyDialog } from '../../components/shared/SafetyDialog';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatTime, cn } from '../../lib/utils';
import { toast } from 'sonner';

export const RoomInventoryView: React.FC = () => {
  const {
    currentHotelId,
    hotels,
    rooms,
    roomTypes,
    updateRoomStatus,
    provisionRoom,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const hotelRooms = useMemo(() => rooms.filter((r) => r.hotelId === currentHotelId), [rooms, currentHotelId]);
  const hotelRoomTypes = useMemo(() => roomTypes.filter((rt) => rt.hotelId === currentHotelId), [roomTypes, currentHotelId]);

  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Provision Room Modal State
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState(1);
  const [newRoomTypeId, setNewRoomTypeId] = useState(hotelRoomTypes[0]?.id || '');
  const [newRoomNotes, setNewRoomNotes] = useState('');

  // Maintenance Safety Dialog State
  const [roomToSetMaintenance, setRoomToSetMaintenance] = useState<Room | null>(null);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');

  // Distinct floors
  const floors = useMemo(() => {
    const set = new Set(hotelRooms.map((r) => r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [hotelRooms]);

  // Filtering
  const filteredRooms = useMemo(() => {
    return hotelRooms.filter((room) => {
      if (selectedFloor !== 'ALL' && room.floor !== Number(selectedFloor)) return false;
      if (selectedStatus !== 'ALL' && room.operationalStatus !== selectedStatus) return false;
      if (selectedRoomType !== 'ALL' && room.roomTypeId !== selectedRoomType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          room.roomNumber.toLowerCase().includes(q) ||
          (room.currentGuestName && room.currentGuestName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [hotelRooms, selectedFloor, selectedStatus, selectedRoomType, searchQuery]);

  // Group by floor
  const roomsByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    filteredRooms.forEach((r) => {
      const list = map.get(r.floor) || [];
      list.push(r);
      map.set(r.floor, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredRooms]);

  // Fast status mutation
  const handleQuickStatusChange = (room: Room, targetStatus: RoomOperationalStatus) => {
    if (targetStatus === 'MAINTENANCE') {
      setRoomToSetMaintenance(room);
      return;
    }

    updateRoomStatus(room.id, targetStatus);
    toast.success(`Room ${room.roomNumber} Status Changed to ${targetStatus}`, {
      description: `Physical room operational state updated in system.`,
    });
  };

  const handleConfirmMaintenance = () => {
    if (!roomToSetMaintenance) return;
    updateRoomStatus(roomToSetMaintenance.id, 'MAINTENANCE', maintenanceNotes || 'HVAC inspection & maintenance logged');
    toast.warning(`Room ${roomToSetMaintenance.roomNumber} Placed in MAINTENANCE`, {
      description: 'Room has been temporarily excluded from bookable inventory calculations.',
    });
    setRoomToSetMaintenance(null);
    setMaintenanceNotes('');
  };

  const handleProvisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) {
      toast.error('Please enter a room number.');
      return;
    }

    // Check unique room number per hotel
    if (hotelRooms.some((r) => r.roomNumber.toLowerCase() === newRoomNumber.trim().toLowerCase())) {
      toast.error(`Room ${newRoomNumber} already exists in ${currentHotel.name}.`);
      return;
    }

    provisionRoom({
      roomNumber: newRoomNumber.trim(),
      floor: Number(newRoomFloor),
      roomTypeId: newRoomTypeId || hotelRoomTypes[0]?.id,
      notes: newRoomNotes.trim() || undefined,
    });

    toast.success(`Room ${newRoomNumber} Provisioned Successfully!`, {
      description: `Physical room door #${newRoomNumber} added to Floor ${newRoomFloor}. Initial status: AVAILABLE.`,
    });

    setIsProvisionModalOpen(false);
    setNewRoomNumber('');
    setNewRoomNotes('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
              Physical Room Inventory Matrix
            </h1>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-muted text-foreground">
              {hotelRooms.length} Units
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Operational statuses, floor-by-floor layout, and physical door management for {currentHotel.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsProvisionModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 text-xs font-semibold shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={14} />
          <span>Provision New Room</span>
        </button>
      </div>

      {/* Status Filter Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            selectedStatus === 'AVAILABLE'
              ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 ring-2 ring-emerald-500'
              : 'bg-card border-border hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 size={13} />
              Available
            </span>
            <span className="font-bold text-sm text-foreground">
              {hotelRooms.filter((r) => r.operationalStatus === 'AVAILABLE').length}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Inspected & clean
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            selectedStatus === 'OCCUPIED'
              ? 'bg-sky-50 border-sky-300 dark:bg-sky-950/40 dark:border-sky-800 ring-2 ring-sky-500'
              : 'bg-card border-border hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1">
              <LogIn size={13} />
              Occupied
            </span>
            <span className="font-bold text-sm text-foreground">
              {hotelRooms.filter((r) => r.operationalStatus === 'OCCUPIED').length}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Guests in residence
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'DIRTY' ? 'ALL' : 'DIRTY')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            selectedStatus === 'DIRTY'
              ? 'bg-stone-100 border-stone-300 dark:bg-stone-900 dark:border-stone-700 ring-2 ring-stone-400'
              : 'bg-card border-border hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
              <Sparkles size={13} />
              Dirty
            </span>
            <span className="font-bold text-sm text-foreground">
              {hotelRooms.filter((r) => r.operationalStatus === 'DIRTY').length}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Turnover required
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'MAINTENANCE' ? 'ALL' : 'MAINTENANCE')}
          className={cn(
            'p-3 rounded-xl border text-left transition-all',
            selectedStatus === 'MAINTENANCE'
              ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-800 ring-2 ring-orange-500'
              : 'bg-card border-border hover:bg-muted/40'
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1">
              <Wrench size={13} />
              Maintenance
            </span>
            <span className="font-bold text-sm text-foreground">
              {hotelRooms.filter((r) => r.operationalStatus === 'MAINTENANCE').length}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Out of inventory
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-subtle">
        <div className="flex-1 max-w-sm relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search room door number or guest name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Floor selector */}
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Floors</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>

          {/* Room Type Selector */}
          <select
            value={selectedRoomType}
            onChange={(e) => setSelectedRoomType(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Categories</option>
            {hotelRoomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floor by Floor Layout Grid */}
      {roomsByFloor.length === 0 ? (
        <EmptyState
          icon={Grid3X3}
          title="No rooms match filters"
          description="Try selecting a different floor, status, or clearing your search term."
          actionLabel="Reset Room Filters"
          onAction={() => {
            setSelectedFloor('ALL');
            setSelectedStatus('ALL');
            setSelectedRoomType('ALL');
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="space-y-6">
          {roomsByFloor.map(([floor, floorRooms]) => (
            <div key={floor} className="space-y-3">
              {/* Floor Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <h3 className="font-bold text-sm text-foreground">
                    Floor {floor} ({floor === 5 ? 'Penthouse Level' : `${floorRooms.length} Physical Rooms`})
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {floorRooms.filter((r) => r.operationalStatus === 'AVAILABLE').length} Available •{' '}
                  {floorRooms.filter((r) => r.operationalStatus === 'OCCUPIED').length} Occupied
                </span>
              </div>

              {/* Room Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {floorRooms.map((room) => {
                  const roomType = hotelRoomTypes.find((rt) => rt.id === room.roomTypeId);

                  return (
                    <div
                      key={room.id}
                      className={cn(
                        'p-4 rounded-xl border bg-card transition-all hover:shadow-subtle flex flex-col justify-between space-y-3 relative group',
                        room.operationalStatus === 'AVAILABLE' && 'border-emerald-200/80 dark:border-emerald-900/60',
                        room.operationalStatus === 'OCCUPIED' && 'border-sky-200/80 dark:border-sky-900/60',
                        room.operationalStatus === 'DIRTY' && 'border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/20',
                        room.operationalStatus === 'MAINTENANCE' && 'border-orange-200/80 dark:border-orange-900/60 bg-orange-50/30 dark:bg-orange-950/20'
                      )}
                    >
                      {/* Top Row: Door Number and Status */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold font-mono text-foreground">
                              #{room.roomNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Floor {room.floor}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium block truncate max-w-[140px]">
                            {roomType?.name || 'Standard'}
                          </span>
                        </div>
                        <StatusBadge status={room.operationalStatus} size="sm" />
                      </div>

                      {/* Middle: Occupant or Clean Status info */}
                      <div className="text-xs bg-muted/40 p-2.5 rounded-lg border border-border/60 min-h-[46px] flex flex-col justify-center">
                        {room.operationalStatus === 'OCCUPIED' && (
                          <div className="flex items-center gap-1.5 text-foreground font-semibold">
                            <User size={12} className="text-sky-600 shrink-0" />
                            <span className="truncate">{room.currentGuestName || 'Guest residing'}</span>
                          </div>
                        )}
                        {room.operationalStatus === 'AVAILABLE' && (
                          <div className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} className="shrink-0" />
                            <span>Ready for arrival assignment</span>
                          </div>
                        )}
                        {room.operationalStatus === 'DIRTY' && (
                          <div className="text-stone-700 dark:text-stone-300 font-medium flex items-center gap-1">
                            <Sparkles size={12} className="shrink-0 text-amber-500" />
                            <span className="truncate">{room.notes || 'Turnover requested'}</span>
                          </div>
                        )}
                        {room.operationalStatus === 'MAINTENANCE' && (
                          <div className="text-orange-700 dark:text-orange-400 font-medium flex items-center gap-1">
                            <Wrench size={12} className="shrink-0" />
                            <span className="truncate">{room.notes || 'Under maintenance'}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Quick Status Mutation Controls */}
                      <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Action:</span>
                        <div className="flex items-center gap-1">
                          {room.operationalStatus === 'DIRTY' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(room, 'AVAILABLE')}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                              title="Housekeeping inspected & ready"
                            >
                              Mark Ready
                            </button>
                          )}

                          {room.operationalStatus === 'AVAILABLE' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(room, 'MAINTENANCE')}
                              className="px-2 py-0.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
                              title="Mark for maintenance"
                            >
                              Maintenance
                            </button>
                          )}

                          {room.operationalStatus === 'MAINTENANCE' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(room, 'AVAILABLE')}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                              Resolve
                            </button>
                          )}

                          {room.operationalStatus === 'OCCUPIED' && (
                            <span className="text-[10px] text-muted-foreground italic">
                              Check-out at Front Desk
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Provision New Physical Room Modal */}
      <Modal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        title="Provision New Physical Room"
        description={`Add a new physical door number and floor allocation for ${currentHotel.name}.`}
        maxWidth="md"
      >
        <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-foreground font-semibold mb-1">
              Room Door Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 105, 206, 503"
              value={newRoomNumber}
              onChange={(e) => setNewRoomNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Must be unique across the hotel.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground font-semibold mb-1">
                Floor Level *
              </label>
              <input
                type="number"
                min={1}
                max={25}
                required
                value={newRoomFloor}
                onChange={(e) => setNewRoomFloor(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">
                Room Category *
              </label>
              <select
                value={newRoomTypeId}
                onChange={(e) => setNewRoomTypeId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {hotelRoomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-foreground font-semibold mb-1">
              Initial Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Corner unit with balcony, recently refurnished."
              value={newRoomNotes}
              onChange={(e) => setNewRoomNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsProvisionModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 font-semibold shadow-subtle transition-colors"
            >
              Provision Room
            </button>
          </div>
        </form>
      </Modal>

      {/* Maintenance Safety Dialog */}
      {roomToSetMaintenance && (
        <SafetyDialog
          isOpen={!!roomToSetMaintenance}
          onClose={() => setRoomToSetMaintenance(null)}
          onConfirm={handleConfirmMaintenance}
          title={`Mark Room ${roomToSetMaintenance.roomNumber} for Maintenance?`}
          impactMessage={`Putting Room #${roomToSetMaintenance.roomNumber} in MAINTENANCE state will immediately exclude it from the bookable inventory calculations in PostgreSQL. No customer will be able to book stays overlapping this unit until it is marked available.`}
          policyNote="Routine maintenance or repairs must be logged with notes for the engineering and front-desk teams."
          confirmLabel="Place in Maintenance"
          confirmVariant="warning"
        />
      )}
    </div>
  );
};
