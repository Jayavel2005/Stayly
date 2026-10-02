import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, X, BedDouble, ChevronLeft, ChevronRight } from 'lucide-react';
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
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(3);
  const listTopRef = useRef<HTMLDivElement>(null);

  // Reset to page 1 whenever filters or hotel list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [hotels.length, filters.sortBy, filters.city, filters.starRatings.length, filters.freeCancellationOnly, filters.breakfastIncludedOnly]);

  // Pagination Calculations
  const totalItems = hotels.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedHotels = hotels.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === activePage) return;
    setCurrentPage(newPage);
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Helper to generate numbered page array with ellipsis if many pages
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (activePage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (activePage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div ref={listTopRef} className="space-y-4">
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
                  ({totalItems} {totalItems === 1 ? 'property' : 'properties'} found
                  {totalPages > 1 && totalItems > 0 ? ` • Page ${activePage} of ${totalPages}` : ''})
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
      {!isLoading && totalItems === 0 && (
        <EmptyState
          icon={<BedDouble className="w-12 h-12 text-muted-foreground stroke-[1.5]" />}
          title="No sanctuary retreats found"
          description={`We couldn't find any luxury properties matching your criteria in "${filters.city || 'all destinations'}". Try widening your price range or clearing active filters.`}
          actionLabel="Clear All Filters"
          onAction={onResetFilters}
        />
      )}

      {/* Loaded Hotel Cards List */}
      {!isLoading && totalItems > 0 && (
        <div className="space-y-5">
          {paginatedHotels.map((hotel) => (
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

      {/* Pagination Controls Footer */}
      {!isLoading && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border mt-6">
          {/* Information & Per-page selector */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>
              Showing{' '}
              <span className="font-semibold text-foreground">
                {startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-foreground">{totalItems}</span>{' '}
              sanctuaries
            </span>

            {totalItems > 3 && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-border">
                <span>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-card border border-border rounded-md px-2 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  aria-label="Sanctuaries per page"
                >
                  <option value={3}>3 per page</option>
                  <option value={6}>6 per page</option>
                  <option value={12}>12 per page</option>
                </select>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav
              aria-label="Hotel listings pagination"
              className="flex items-center gap-1.5 select-none"
            >
              <button
                onClick={() => handlePageChange(activePage - 1)}
                disabled={activePage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) =>
                  typeof page === 'number' ? (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(page)}
                      className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                        page === activePage
                          ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                          : 'bg-card border border-border text-foreground hover:bg-secondary'
                      }`}
                      aria-current={page === activePage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ) : (
                    <span
                      key={idx}
                      className="px-1 text-xs text-muted-foreground select-none"
                    >
                      …
                    </span>
                  )
                )}
              </div>

              <button
                onClick={() => handlePageChange(activePage + 1)}
                disabled={activePage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
};

