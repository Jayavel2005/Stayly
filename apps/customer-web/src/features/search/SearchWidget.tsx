import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Users,
  Search,
  ChevronDown,
  Plus,
  Minus,
} from 'lucide-react';
import { SearchFilterState } from '../../types';
import { Button } from '../../components/ui/Button';
import { calculateNights } from '../../lib/utils';

interface SearchWidgetProps {
  filters: SearchFilterState;
  onSearch: (updated: Partial<SearchFilterState>) => void;
  className?: string;
  isCompact?: boolean;
}

const POPULAR_DESTINATIONS = [
  { city: 'Chennai', state: 'Tamil Nadu', subtitle: 'Urban coastal resorts & heritage' },
  { city: 'Mumbai', state: 'Maharashtra', subtitle: 'Iconic Arabian Sea waterfronts' },
  { city: 'Udaipur', state: 'Rajasthan', subtitle: 'Historic Lake Pichola royal palaces' },
  { city: 'Goa', state: 'Goa', subtitle: 'Majorda beaches & emerald paddy retreats' },
  { city: 'Bengaluru', state: 'Karnataka', subtitle: 'Regal Mysore-style garden sanctuaries' },
  { city: 'Jaipur', state: 'Rajasthan', subtitle: 'Rajput royal maharaja palaces' },
];

export const SearchWidget: React.FC<SearchWidgetProps> = ({
  filters,
  onSearch,
  className,
  isCompact = false,
}) => {
  const [city, setCity] = useState(filters.city);
  const [checkIn, setCheckIn] = useState(filters.checkIn);
  const [checkOut, setCheckOut] = useState(filters.checkOut);
  const [adults, setAdults] = useState(filters.adults);
  const [children, setChildren] = useState(filters.children);
  const [rooms, setRooms] = useState(filters.rooms);

  const [locationOpen, setLocationOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  const locationRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setLocationOpen(false);
      }
      if (guestsRef.current && !guestsRef.current.contains(e.target as Node)) {
        setGuestsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const nights = calculateNights(checkIn, checkOut);

  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocationOpen(false);
    setGuestsOpen(false);
    onSearch({
      city,
      checkIn,
      checkOut,
      adults,
      children,
      rooms,
    });
  };

  const handleSelectDestination = (destCity: string) => {
    setCity(destCity);
    setLocationOpen(false);
  };

  return (
    <form
      onSubmit={handleExecuteSearch}
      className={`rounded-xl border border-border bg-card shadow-xs p-1.5 sm:p-2 transition-all ${className}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 sm:gap-2 items-center">
        {/* Destination Selector (Col 1-4) */}
        <div ref={locationRef} className="relative md:col-span-4">
          <div
            onClick={() => {
              setLocationOpen(!locationOpen);
              setGuestsOpen(false);
            }}
            className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
              locationOpen
                ? 'border-primary ring-2 ring-primary/20 bg-background'
                : 'border-border hover:border-muted-foreground/30 bg-secondary/30'
            }`}
          >
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
              <MapPin size={15} className="stroke-[2]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Destination
              </span>
              <input
                type="text"
                placeholder="Where would you like to stay?"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => setLocationOpen(true)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none truncate mt-0.5"
              />
            </div>
            {city && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCity('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {locationOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-3 animate-fade-in max-h-72 overflow-y-auto">
              <div className="text-[11px] font-mono font-semibold uppercase text-muted-foreground px-2 py-1 mb-1">
                Featured Sanctuaries & Cities
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelectDestination('')}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary flex items-center justify-between text-xs font-medium transition-colors"
                >
                  <span className="font-semibold text-primary">All Destinations</span>
                  <span className="text-[10px] text-muted-foreground">Show all hotels</span>
                </button>
                {POPULAR_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.city}
                    type="button"
                    onClick={() => handleSelectDestination(dest.city)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary flex items-start gap-2.5 transition-colors text-xs"
                  >
                    <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {dest.city}, <span className="font-normal text-muted-foreground">{dest.state}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{dest.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date Range Picker (Col 5-8) */}
        <div className="md:col-span-4 grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* Check-In */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-border hover:border-muted-foreground/30 bg-secondary/30 transition-colors flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 hidden sm:block">
              <Calendar size={14} className="stroke-[2]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Check-In
              </span>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-foreground focus:outline-none cursor-pointer mt-0.5"
              />
            </div>
          </div>

          {/* Check-Out */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-border hover:border-muted-foreground/30 bg-secondary/30 transition-colors flex items-center gap-2 relative">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                  Check-Out
                </span>
                <span className="text-[9px] font-mono text-primary font-bold bg-primary/10 px-1 py-0.2 rounded">
                  {nights} {nights === 1 ? 'nt' : 'nts'}
                </span>
              </div>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-foreground focus:outline-none cursor-pointer mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Guests & Room Popover (Col 9-10) */}
        <div ref={guestsRef} className="relative md:col-span-2">
          <div
            onClick={() => {
              setGuestsOpen(!guestsOpen);
              setLocationOpen(false);
            }}
            className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
              guestsOpen
                ? 'border-primary ring-2 ring-primary/20 bg-background'
                : 'border-border hover:border-muted-foreground/30 bg-secondary/30'
            }`}
          >
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
              <Users size={14} className="stroke-[2]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Guests
              </span>
              <div className="text-xs font-semibold text-foreground truncate mt-0.5">
                {adults + children} {adults + children === 1 ? 'Guest' : 'Guests'}, {rooms} {rooms === 1 ? 'Rm' : 'Rms'}
              </div>
            </div>
            <ChevronDown size={13} className="text-muted-foreground shrink-0" />
          </div>

          {/* Guests Popover Stepper */}
          {guestsOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-4 animate-fade-in space-y-4">
              {/* Adults */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Adults</div>
                  <div className="text-[11px] text-muted-foreground">Ages 13 and above</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={adults <= 1}
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="font-mono text-sm font-semibold w-4 text-center">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">Children</div>
                  <div className="text-[11px] text-muted-foreground">Ages 0–12</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={children <= 0}
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="font-mono text-sm font-semibold w-4 text-center">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Rooms */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <div className="text-xs font-semibold text-foreground">Rooms</div>
                  <div className="text-[11px] text-muted-foreground">Total rooms required</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={rooms <= 1}
                    onClick={() => setRooms(Math.max(1, rooms - 1))}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary disabled:opacity-40 cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="font-mono text-sm font-semibold w-4 text-center">{rooms}</span>
                  <button
                    type="button"
                    onClick={() => setRooms(rooms + 1)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setGuestsOpen(false)}
                size="sm"
                className="w-full text-xs font-semibold"
              >
                Apply Selection
              </Button>
            </div>
          )}
        </div>

        {/* Search Submit CTA (Col 11-12) */}
        <div className="md:col-span-2">
          <Button
            type="submit"
            size="default"
            className="w-full h-10 font-semibold text-xs sm:text-sm tracking-wide rounded-lg shadow-2xs group"
            leftIcon={<Search size={15} className="stroke-[2.2] group-hover:scale-110 transition-transform" />}
          >
            {isCompact ? 'Search' : 'Search Hotels'}
          </Button>
        </div>
      </div>
    </form>
  );
};
