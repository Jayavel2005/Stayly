import React from 'react';
import {
  MapPin,
  ArrowRight,
  Wifi,
  Waves,
  Sparkles,
  Coffee,
  CheckCircle2,
  Utensils,
  Car,
} from 'lucide-react';
import { Hotel } from '../../types';
import { HotelRating } from '../../components/ui/HotelRating';
import { PriceDisplay } from '../../components/ui/PriceDisplay';
import { Button } from '../../components/ui/Button';

interface HotelCardProps {
  hotel: Hotel;
  checkIn: string;
  checkOut: string;
  onSelectHotel: (hotel: Hotel) => void;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  checkIn,
  checkOut,
  onSelectHotel,
}) => {
  // Map amenity string to corresponding Lucide icon
  const getAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi')) return <Wifi size={13} className="shrink-0" />;
    if (lower.includes('pool') || lower.includes('water')) return <Waves size={13} className="shrink-0" />;
    if (lower.includes('breakfast')) return <Coffee size={13} className="shrink-0" />;
    if (lower.includes('spa')) return <Sparkles size={13} className="shrink-0" />;
    if (lower.includes('restaurant') || lower.includes('dining')) return <Utensils size={13} className="shrink-0" />;
    if (lower.includes('limousine') || lower.includes('parking')) return <Car size={13} className="shrink-0" />;
    return <Sparkles size={13} className="shrink-0" />;
  };

  // Check if any room has free cancellation
  const hasFreeCancel = hotel.roomTypes.some((r) => r.hasFreeCancellation);

  return (
    <div
      onClick={() => onSelectHotel(hotel)}
      className="group relative flex flex-col md:flex-row rounded-xl border border-border bg-card text-card-foreground shadow-xs hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* 16:10 Thumbnail Container with lazy loading & hover zoom per Design System line 515 */}
      <div className="relative w-full md:w-80 aspect-[16/10] md:aspect-auto md:min-h-[240px] overflow-hidden bg-muted shrink-0">
        <img
          src={hotel.heroImage}
          alt={hotel.name}
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-out"
        />

        {/* Free Cancellation floating badge */}
        {hasFreeCancel && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-emerald-900/90 text-emerald-100 text-[11px] font-semibold tracking-wide backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 size={12} className="stroke-[2.5]" />
            <span>Free 48h Cancellation</span>
          </div>
        )}

        {/* Photo count indicator */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wide backdrop-blur-xs">
          +{hotel.images.length} photos
        </div>
      </div>

      {/* Card Content & Folio Information */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
        <div>
          {/* Header Row: Title & Star Rating */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1.5">
            <div>
              <h3 className="text-xl font-bold font-serif text-foreground group-hover:text-primary transition-colors tracking-tight">
                {hotel.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin size={13} className="text-primary shrink-0" />
                <span className="font-medium text-foreground">{hotel.city}</span>
                <span>•</span>
                <span>{hotel.distanceToCenter}</span>
              </div>
            </div>

            {/* Rating Pill */}
            <div className="shrink-0 self-start">
              <HotelRating
                score={hotel.averageRating}
                totalReviews={hotel.totalReviews}
                starClass={hotel.starRating}
                size="sm"
              />
            </div>
          </div>

          {/* Tagline / Subtitle description */}
          <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
            {hotel.tagline}
          </p>

          {/* Amenities Strip (Max 4 icons per Design System line 518) */}
          <div className="flex items-center gap-2 flex-wrap mt-3.5">
            {hotel.amenities.slice(0, 4).map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/80 text-[11px] font-medium text-foreground/85 border border-border/60"
              >
                {getAmenityIcon(amenity)}
                <span>{amenity}</span>
              </span>
            ))}
            {hotel.amenities.length > 4 && (
              <span className="text-[11px] text-muted-foreground font-mono">
                +{hotel.amenities.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Bottom Commercial Row: Pricing & CTA */}
        <div className="pt-4 mt-4 border-t border-border flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Price display with transparent taxes note */}
          <div>
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
              Starting from
            </div>
            <PriceDisplay
              amount={hotel.minPrice}
              perNight={true}
              size="lg"
              includeTaxesLabel={true}
            />
          </div>

          {/* Primary View Rooms CTA */}
          <Button
            size="default"
            className="group-hover:bg-brand-600 shadow-sm shrink-0 font-semibold"
            rightIcon={<ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />}
            onClick={(e) => {
              e.stopPropagation();
              onSelectHotel(hotel);
            }}
          >
            View Rooms
          </Button>
        </div>
      </div>
    </div>
  );
};
