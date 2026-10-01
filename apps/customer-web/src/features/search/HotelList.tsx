import React from 'react';
import { ArrowUpDown, X, BedDouble } from 'lucide-react';
import { Hotel, SearchFilterState } from '../../types';
import { HotelCard } from './HotelCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

interface HotelListProps {
  hotels: Hotel[];
  isLoading: boolean;
  filters: SearchFilterState;
  onFilterChange: (updated: Partial<SearchFilterState>) => void;
  onResetFilters: () => void;
  onSelectHotel: (hotel: Hotel) => void;
}

export const HotelList: React.FC<HotelListProps> = ({
  hotels,
  isLoading,
  filters,
  onFilterChange,
  onResetFilters,
  onSelectHotel,
}) => {
  return (
    <div className="space-y-4">
      {/* Header bar: Result counts & Sorting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground font-serif">
            {isLoading ? (
              <Skeleton className="h-6 w-48 inline-block" />
            ) : (
              <>
                Available Sanctuaries{' '}
                <span className="text-sm font-normal text-muted-foreground font-sans">
                  ({hotels.length} {hotels.length === 1 ? 'property' : 'properties'} found)
                </span>
              </>
            )}
          </h2>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <ArrowUpDown size={13} />
            Sort by:
          </span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as SearchFilterState['sortBy'],
              })
            }
            className="text-xs font-semibold bg-secondary/80 border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="recommended">Stayora Recommended</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating-desc">Guest Rating: High to Low</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(filters.city ||
        filters.starRatings.length > 0 ||
        filters.amenities.length > 0 ||
        filters.freeCancellationOnly ||
        filters.breakfastIncludedOnly) && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground font-mono text-[11px]">Active filters:</span>

          {filters.city && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              City: {filters.city}
              <button
                onClick={() => onFilterChange({ city: '' })}
                className="hover:opacity-75 ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.freeCancellationOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
              Free 48h Cancellation
              <button
                onClick={() => onFilterChange({ freeCancellationOnly: false })}
                className="hover:opacity-75 ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.breakfastIncludedOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-medium">
              Breakfast Included
              <button
                onClick={() => onFilterChange({ breakfastIncludedOnly: false })}
                className="hover:opacity-75 ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.starRatings.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border text-[11px]"
            >
              {s} Stars
              <button
                onClick={() =>
                  onFilterChange({
                    starRatings: filters.starRatings.filter((star) => star !== s),
                  })
                }
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <button
            onClick={onResetFilters}
            className="text-[11px] text-primary hover:underline font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Skeletons while loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex flex-col md:flex-row rounded-xl border border-border bg-card p-5 gap-6"
            >
              <Skeleton className="w-full md:w-80 h-52 rounded-lg shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-14 w-full" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && hotels.length === 0 && (
        <EmptyState
          icon={<BedDouble className="w-12 h-12 text-muted-foreground stroke-[1.5]" />}
          title="No sanctuary retreats found"
          description={`We couldn't find any luxury properties matching your criteria in "${filters.city || 'all destinations'}". Try widening your price range or clearing active filters.`}
          actionLabel="Clear All Filters"
          onAction={onResetFilters}
        />
      )}

      {/* Loaded Hotel Cards List */}
      {!isLoading && hotels.length > 0 && (
        <div className="space-y-5">
          {hotels.map((hotel) => (
            <HotelCard
              key={hotel.id}
              hotel={hotel}
              checkIn={filters.checkIn}
              checkOut={filters.checkOut}
              onSelectHotel={onSelectHotel}
            />
          ))}
        </div>
      )}
    </div>
  );
};
