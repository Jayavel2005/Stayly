import React from 'react';
import { SlidersHorizontal, RotateCcw, Star, Check } from 'lucide-react';
import { SearchFilterState } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

interface FilterSidebarProps {
  filters: SearchFilterState;
  onChange: (updated: Partial<SearchFilterState>) => void;
  onReset: () => void;
  className?: string;
}

const AVAILABLE_AMENITIES = [
  'Free High-Speed WiFi',
  'Outdoor Lagoon Pool',
  'Full-Service Wellness Spa',
  'Complimentary Gourmet Breakfast',
  'Arabian Sea Views',
  'Heritage Architecture',
  'Butler Service',
  'Fitness Center 24/7',
  'Airport Limousine Transfer',
];

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onChange,
  onReset,
  className,
}) => {
  const toggleStar = (star: number) => {
    const current = filters.starRatings || [];
    const next = current.includes(star)
      ? current.filter((s) => s !== star)
      : [...current, star];
    onChange({ starRatings: next });
  };

  const toggleAmenity = (amenity: string) => {
    const current = filters.amenities || [];
    const next = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    onChange({ amenities: next });
  };

  return (
    <aside className={`space-y-6 text-sm ${className}`}>
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <SlidersHorizontal size={16} className="text-primary" />
          <span>Filter Sanctuaries</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          title="Reset all filters"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      {/* Guarantee Toggles */}
      <div className="space-y-3 pb-4 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Reservation Policies
        </h4>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.freeCancellationOnly}
            onChange={(e) => onChange({ freeCancellationOnly: e.target.checked })}
            className="w-4 h-4 rounded-sm border-border text-primary focus:ring-primary/30"
          />
          <span className="text-xs text-foreground font-medium">Free 48h Cancellation</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.breakfastIncludedOnly}
            onChange={(e) => onChange({ breakfastIncludedOnly: e.target.checked })}
            className="w-4 h-4 rounded-sm border-border text-primary focus:ring-primary/30"
          />
          <span className="text-xs text-foreground font-medium">Breakfast Included</span>
        </label>
      </div>

      {/* Price Range Slider */}
      <div className="space-y-3 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Nightly Base Rate
          </h4>
          <span className="font-mono text-xs font-semibold text-foreground">
            Up to {formatCurrency(filters.priceRange[1])}
          </span>
        </div>
        <input
          type="range"
          min="5000"
          max="40000"
          step="1000"
          value={filters.priceRange[1]}
          onChange={(e) =>
            onChange({ priceRange: [filters.priceRange[0], parseInt(e.target.value, 10)] })
          }
          className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>{formatCurrency(5000)}</span>
          <span>{formatCurrency(40000)}+</span>
        </div>
      </div>

      {/* Star Classification */}
      <div className="space-y-3 pb-4 border-b border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Property Classification
        </h4>
        <div className="space-y-2">
          {[5, 4, 3].map((star) => {
            const isChecked = filters.starRatings.includes(star);
            return (
              <div
                key={star}
                onClick={() => toggleStar(star)}
                className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-secondary/60 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background'
                    }`}
                  >
                    {isChecked && <Check size={11} className="stroke-[3]" />}
                  </div>
                  <div className="flex items-center text-amber-500 gap-0.5">
                    {Array.from({ length: star }).map((_, i) => (
                      <Star key={i} size={12} className="fill-amber-400 stroke-amber-500" />
                    ))}
                    <span className="text-xs text-foreground ml-1.5 font-medium">
                      {star} Star Luxury
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Curated Amenities */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Signature Amenities
        </h4>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {AVAILABLE_AMENITIES.map((amenity) => {
            const isChecked = filters.amenities.includes(amenity);
            return (
              <div
                key={amenity}
                onClick={() => toggleAmenity(amenity)}
                className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-secondary/60 cursor-pointer select-none"
              >
                <div
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                    isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background'
                  }`}
                >
                  {isChecked && <Check size={11} className="stroke-[3]" />}
                </div>
                <span className="text-xs text-foreground leading-tight">
                  {amenity}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
