import React from 'react';
import {
  Users,
  Bed,
  Maximize2,
  CheckCircle2,
  Sparkles,
  Coffee,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { RoomType, PriceBreakdown } from '../../types';
import { PriceDisplay } from '../../components/ui/PriceDisplay';
import { Button } from '../../components/ui/Button';

interface RoomCardProps {
  roomType: RoomType;
  priceBreakdown: PriceBreakdown;
  checkIn: string;
  checkOut: string;
  onReserve: (roomType: RoomType) => void;
  isHolding?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  roomType,
  priceBreakdown,
  checkIn,
  checkOut,
  onReserve,
  isHolding = false,
}) => {
  const isLowInventory = roomType.availableRooms <= 3 && roomType.availableRooms > 0;

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col lg:flex-row">
      {/* 4:3 Room Gallery Thumbnail per Design System line 819 */}
      <div className="relative w-full lg:w-72 aspect-[4/3] lg:aspect-auto overflow-hidden bg-muted shrink-0">
        <img
          src={roomType.images[0] || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80'}
          alt={roomType.name}
          loading="lazy"
          className="w-full h-full object-cover object-center"
        />

        {/* Low inventory alert badge per Design System line 543 */}
        {isLowInventory && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-amber-500/90 text-amber-950 text-[11px] font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
            <AlertTriangle size={13} className="stroke-[2.5]" />
            <span>Only {roomType.availableRooms} {roomType.availableRooms === 1 ? 'room' : 'rooms'} left</span>
          </div>
        )}
      </div>

      {/* Room Details & Folio Specs */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          {/* Header Row: Room Title & Capacity */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
            <div>
              <h4 className="text-lg font-bold font-serif text-foreground tracking-tight">
                {roomType.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                {roomType.description}
              </p>
            </div>

            <div className="shrink-0 self-start">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                {roomType.availableRooms} available
              </span>
            </div>
          </div>

          {/* Physical Room Specs Matrix (Bed, Capacity, Size) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-3 my-2 border-y border-border/70 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Users size={15} className="text-primary shrink-0" />
              <span>Up to {roomType.maxGuests} Guests</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Bed size={15} className="text-primary shrink-0" />
              <span>{roomType.bedType}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Maximize2 size={15} className="text-primary shrink-0" />
              <span>{roomType.roomSize}</span>
            </div>
          </div>

          {/* Inclusions & Guarantees */}
          <div className="space-y-1.5 mt-2 text-xs">
            {roomType.hasFreeCancellation && (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 size={14} className="stroke-[2] shrink-0" />
                <span>Free cancellation up to 48 hours prior to check-in</span>
              </div>
            )}
            {roomType.breakfastIncluded && (
              <div className="flex items-center gap-2 text-brand-700 dark:text-brand-300 font-medium">
                <Coffee size={14} className="stroke-[2] shrink-0" />
                <span>Complimentary Gourmet Breakfast included for all guests</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles size={14} className="text-primary shrink-0" />
              <span>Features: {roomType.amenities.join(' • ')}</span>
            </div>
          </div>
        </div>

        {/* Pricing & Reservation CTA */}
        <div className="pt-4 mt-4 border-t border-border flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <PriceDisplay
            amount={roomType.basePrice}
            perNight={true}
            totalAmount={priceBreakdown.grandTotal}
            totalNights={priceBreakdown.nights}
            size="lg"
            includeTaxesLabel={true}
          />

          <Button
            size="lg"
            onClick={() => onReserve(roomType)}
            disabled={roomType.availableRooms <= 0 || isHolding}
            className="shrink-0 font-semibold px-6 shadow-sm"
            rightIcon={<ArrowRight size={16} />}
          >
            {isHolding ? 'Hold Reserved' : 'Reserve Room'}
          </Button>
        </div>
      </div>
    </div>
  );
};
