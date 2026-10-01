import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Calendar, User, BedDouble, ArrowRight, X } from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';

export const QuickSearchModal: React.FC = () => {
  const {
    isQuickSearchOpen,
    setQuickSearchOpen,
    currentHotelId,
    bookings,
    rooms,
    setActiveTab,
  } = useManagerStore();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isQuickSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isQuickSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isQuickSearchOpen) {
        setQuickSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickSearchOpen, setQuickSearchOpen]);

  const hotelBookings = useMemo(
    () => bookings.filter((b) => b.hotelId === currentHotelId),
    [bookings, currentHotelId]
  );
  const hotelRooms = useMemo(
    () => rooms.filter((r) => r.hotelId === currentHotelId),
    [rooms, currentHotelId]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return { bookings: [], rooms: [] };
    const q = query.toLowerCase();

    const matchedBookings = hotelBookings.filter(
      (b) =>
        b.bookingReference.toLowerCase().includes(q) ||
        b.customer.firstName.toLowerCase().includes(q) ||
        b.customer.lastName.toLowerCase().includes(q) ||
        (b.roomNumber && b.roomNumber.toLowerCase().includes(q))
    );

    const matchedRooms = hotelRooms.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(q) ||
        (r.currentGuestName && r.currentGuestName.toLowerCase().includes(q))
    );

    return {
      bookings: matchedBookings.slice(0, 5),
      rooms: matchedRooms.slice(0, 5),
    };
  }, [query, hotelBookings, hotelRooms]);

  if (!isQuickSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => setQuickSearchOpen(false)}
      />

      <div className="relative w-full max-w-xl rounded-xl bg-card border border-border shadow-elevated overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-background">
          <Search size={18} className="text-muted-foreground mr-2 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type guest name, BK-XXXX reference, or room #..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQuickSearchOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 text-xs">
          {!query.trim() ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="font-semibold text-foreground">Global Operations Quick Search</p>
              <p className="text-xs mt-1">Search through active guest reservations and physical room doors.</p>
            </div>
          ) : searchResults.bookings.length === 0 && searchResults.rooms.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No reservations or rooms matching "{query}".
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bookings */}
              {searchResults.bookings.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Matching Reservations ({searchResults.bookings.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.bookings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('front-desk');
                          setQuickSearchOpen(false);
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-muted/70 flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-300 flex items-center justify-center font-bold text-xs shrink-0">
                            <Calendar size={14} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">
                                {b.bookingReference}
                              </span>
                              <span className="font-semibold text-foreground">
                                {b.customer.firstName} {b.customer.lastName}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {b.roomTypeName} • Room {b.roomNumber || 'TBD'} • {formatDate(b.checkIn)} to {formatDate(b.checkOut)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} size="sm" />
                          <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rooms */}
              {searchResults.rooms.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-border/60 pt-2">
                    Matching Physical Rooms ({searchResults.rooms.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.rooms.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('rooms');
                          setQuickSearchOpen(false);
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-muted/70 flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            #{r.roomNumber}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">
                              Floor {r.floor} • Room {r.roomNumber}
                            </span>
                            {r.currentGuestName && (
                              <span className="text-[11px] text-muted-foreground block">
                                Occupied by {r.currentGuestName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.operationalStatus} size="sm" />
                          <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Navigate with <strong>↑</strong> <strong>↓</strong> and <strong>Enter</strong></span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono">
            ESC to close
          </kbd>
        </div>
      </div>
    </div>
  );
};
