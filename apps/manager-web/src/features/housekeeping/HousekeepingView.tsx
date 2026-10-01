import React, { useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Clock,
  User,
  BedDouble,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatTime } from '../../lib/utils';
import { toast } from 'sonner';

export const HousekeepingView: React.FC = () => {
  const {
    currentHotelId,
    hotels,
    rooms,
    roomTypes,
    bookings,
    updateRoomStatus,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const hotelRooms = useMemo(() => rooms.filter((r) => r.hotelId === currentHotelId), [rooms, currentHotelId]);
  const hotelRoomTypes = useMemo(() => roomTypes.filter((rt) => rt.hotelId === currentHotelId), [roomTypes, currentHotelId]);

  // Dirty rooms needing cleaning
  const dirtyRooms = useMemo(() => {
    return hotelRooms.filter((r) => r.operationalStatus === 'DIRTY');
  }, [hotelRooms]);

  // Maintenance rooms
  const maintenanceRooms = useMemo(() => {
    return hotelRooms.filter((r) => r.operationalStatus === 'MAINTENANCE');
  }, [hotelRooms]);

  // Fast turnover: Mark room Clean & Available
  const handleMarkReady = (roomId: string, roomNumber: string) => {
    updateRoomStatus(roomId, 'AVAILABLE', undefined);
    toast.success(`Room ${roomNumber} Inspected & Ready!`, {
      description: 'Room operational status changed to AVAILABLE. Ready for guest check-in.',
    });
  };

  const handleResolveMaintenance = (roomId: string, roomNumber: string) => {
    updateRoomStatus(roomId, 'AVAILABLE', undefined);
    toast.success(`Maintenance Resolved on Room ${roomNumber}!`, {
      description: 'Room returned to active bookable inventory.',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
              Housekeeping Turnover & Maintenance Log
            </h1>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {dirtyRooms.length} Pending Turnovers
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Operational turnover queue and engineering logs for {currentHotel.name}.
          </p>
        </div>

        {/* Quick Batch Action */}
        {dirtyRooms.length > 0 && (
          <button
            type="button"
            onClick={() => {
              dirtyRooms.forEach((r) => updateRoomStatus(r.id, 'AVAILABLE'));
              toast.success(`All ${dirtyRooms.length} dirty rooms marked cleaned and available!`);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-subtle transition-colors"
          >
            <Check size={14} />
            <span>Mark All Turnovers Complete</span>
          </button>
        )}
      </div>

      {/* 1. Housekeeping Turnover Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">
              Dirty Rooms Pending Linen & Turnover Inspection ({dirtyRooms.length})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Standard turnover target: &lt; 45 mins
          </span>
        </div>

        {dirtyRooms.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="All rooms are clean & ready"
            description="Zero pending housekeeping turnovers. All non-occupied rooms have been sanitized and inspected."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dirtyRooms.map((room) => {
              const rt = hotelRoomTypes.find((t) => t.id === room.roomTypeId);

              // Check if there is an incoming arrival today for this room
              const hasIncomingArrival = bookings.some(
                (b) => b.roomId === room.id && b.checkIn === '2026-10-01' && b.status === 'CONFIRMED'
              );

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-xl border bg-card shadow-subtle flex flex-col justify-between space-y-3 ${
                    hasIncomingArrival
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold font-mono text-foreground">
                          Room #{room.roomNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">Floor {room.floor}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium block">
                        {rt?.name}
                      </span>
                    </div>

                    {hasIncomingArrival ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 animate-pulse border border-amber-300">
                        ⚡ Priority: Arrival Today
                      </span>
                    ) : (
                      <StatusBadge status="DIRTY" size="sm" />
                    )}
                  </div>

                  <div className="text-xs p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <p className="text-foreground font-medium leading-relaxed">
                      {room.notes || 'Guest departed. Clean linens, refresh bathroom amenities, and vacuum carpet.'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <Clock size={11} />
                      <span>Last inspected: {formatTime(room.lastCleanedAt)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Housekeeping Task</span>
                    <button
                      type="button"
                      onClick={() => handleMarkReady(room.id, room.roomNumber)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      <span>Mark Inspected & Ready</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Engineering & Maintenance Log */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-orange-600 dark:text-orange-400" />
            <h2 className="text-sm font-bold text-foreground">
              Rooms Out of Service / Under Maintenance ({maintenanceRooms.length})
            </h2>
          </div>
          <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
            Excluded from availability engine
          </span>
        </div>

        {maintenanceRooms.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
            Zero physical rooms under maintenance. All units are in full operational service.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {maintenanceRooms.map((room) => {
              const rt = hotelRoomTypes.find((t) => t.id === room.roomTypeId);

              return (
                <div
                  key={room.id}
                  className="p-4 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/20 dark:bg-orange-950/10 shadow-subtle flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold font-mono text-foreground">
                          Room #{room.roomNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">Floor {room.floor}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium block">
                        {rt?.name}
                      </span>
                    </div>
                    <StatusBadge status="MAINTENANCE" size="sm" />
                  </div>

                  <div className="text-xs p-2.5 rounded-lg bg-card border border-border space-y-1">
                    <p className="font-semibold text-foreground">Engineering Log:</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {room.notes || 'HVAC filter cleaning and thermostat calibration.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Locked out of public reservations
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResolveMaintenance(room.id, room.roomNumber)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      <span>Resolve & Return to Service</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
