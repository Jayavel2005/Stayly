import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  Hotel,
  RoomType,
  Booking,
  SearchFilterState,
  UserProfile,
} from './types';
import { api, getStoredUser, saveUser } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HoldBanner } from './components/layout/HoldBanner';
import { SearchWidget } from './features/search/SearchWidget';
import { FilterSidebar } from './features/search/FilterSidebar';
import { HotelList } from './features/search/HotelList';
import { HotelDetailPage } from './features/hotel-detail/HotelDetailPage';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { ConfirmationPage } from './features/confirmation/ConfirmationPage';
import { MyBookingsPage } from './features/bookings/MyBookingsPage';
import { UserProfileModal } from './components/user/UserProfileModal';
import { ErrorBanner } from './components/ui/ErrorBanner';

// Helper for initial default check-in and check-out dates (e.g., today + 7 days, 3 nights)
function getDefaultDates() {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 10);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  return {
    checkIn: checkIn.toISOString().split('T')[0],
    checkOut: checkOut.toISOString().split('T')[0],
  };
}

export const App: React.FC = () => {
  // Navigation View State
  const [currentView, setCurrentView] = useState<
    'search' | 'detail' | 'checkout' | 'confirmation' | 'bookings'
  >('search');

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('stayora_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('stayora_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('stayora_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Authenticated User
  const [user, setUser] = useState<UserProfile>(getStoredUser);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Search Criteria State
  const defaultDates = getDefaultDates();
  const [filters, setFilters] = useState<SearchFilterState>({
    city: '',
    checkIn: defaultDates.checkIn,
    checkOut: defaultDates.checkOut,
    adults: 2,
    children: 0,
    rooms: 1,
    priceRange: [5000, 40000],
    starRatings: [],
    amenities: [],
    freeCancellationOnly: false,
    breakfastIncludedOnly: false,
    sortBy: 'recommended',
  });

  // Hotel Discovery Data State
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isHotelsLoading, setIsHotelsLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  // Active Hold & Checkout State
  const [activeHoldBooking, setActiveHoldBooking] = useState<Booking | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [lastConfirmedBooking, setLastConfirmedBooking] = useState<Booking | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Customer Bookings
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);

  // Load Initial Hotels & Bookings
  const loadHotels = async (activeFilters = filters) => {
    setIsHotelsLoading(true);
    try {
      const { hotels: results } = await api.searchHotels(activeFilters);
      setHotels(results);
    } catch {
      setErrorNotice('Unable to load hotels at this moment. Please check your connection.');
    } finally {
      setIsHotelsLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const b = await api.getCustomerBookings();
      setCustomerBookings(b);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHotels(filters);
    loadBookings();
  }, []);

  // Update filters and reload
  const handleFilterChange = (updated: Partial<SearchFilterState>) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    loadHotels(next);
  };

  const handleResetFilters = () => {
    const next: SearchFilterState = {
      ...filters,
      city: '',
      priceRange: [5000, 40000],
      starRatings: [],
      amenities: [],
      freeCancellationOnly: false,
      breakfastIncludedOnly: false,
      sortBy: 'recommended',
    };
    setFilters(next);
    loadHotels(next);
  };

  // Select Hotel to view details
  const handleSelectHotel = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reserve Room => Creates atomic 15-minute hold and moves to checkout
  const handleReserveRoom = async (roomType: RoomType) => {
    if (!selectedHotel) return;
    setErrorNotice(null);
    try {
      setSelectedRoomType(roomType);
      const hold = await api.createBookingHold({
        hotelId: selectedHotel.id,
        roomTypeId: roomType.id,
        checkIn: filters.checkIn,
        checkOut: filters.checkOut,
        guestsCount: filters.adults + filters.children,
        guestInfo: {
          fullName: user.name,
          email: user.email,
          phone: user.phone,
        },
      });
      setActiveHoldBooking(hold);
      setCurrentView('checkout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to create room hold. Inventory may be exhausted.');
    }
  };

  // Complete Payment Settlement
  const handleCompletePayment = async (paymentMethod: string, idempotencyKey: string) => {
    if (!activeHoldBooking) return;
    setIsProcessingPayment(true);
    setErrorNotice(null);
    try {
      const confirmed = await api.settlePayment({
        booking: activeHoldBooking,
        paymentMethod,
        idempotencyKey,
      });

      setActiveHoldBooking(null);
      setLastConfirmedBooking(confirmed);
      setCurrentView('confirmation');
      await loadBookings();
      await loadHotels(filters);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorNotice(err.message || 'Payment processing failed. Your card was not charged.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string, reason?: string) => {
    try {
      await api.cancelBooking(bookingId, reason);
      await loadBookings();
      await loadHotels(filters);
    } catch (err: any) {
      setErrorNotice(err.message || 'Unable to cancel booking.');
    }
  };

  // Submit Verified Post-Stay Review
  const handleSubmitReview = async (params: {
    bookingId: string;
    hotelId: string;
    rating: number;
    title: string;
    comment: string;
    categories: {
      cleanliness: number;
      staff: number;
      comfort: number;
      value: number;
      location: number;
    };
  }) => {
    try {
      await api.submitVerifiedReview(params);
      await loadBookings();
      await loadHotels(filters);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to submit review.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      {/* Sticky 15-Minute Hold Countdown Banner */}
      <HoldBanner
        holdBooking={activeHoldBooking}
        onResumeCheckout={() => {
          if (activeHoldBooking) {
            setCurrentView('checkout');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onDismiss={() => setActiveHoldBooking(null)}
      />

      {/* Global Navigation Header */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        user={user}
        bookingCount={customerBookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN').length}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Global Error Banner */}
      {errorNotice && (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <ErrorBanner
            title="Notification Notice"
            message={errorNotice}
            onRetry={() => setErrorNotice(null)}
          />
        </div>
      )}

      {/* Main View Switcher */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW 1: SEARCH & DISCOVERY */}
        {currentView === 'search' && (
          <div className="space-y-10">
            {/* Luxury Hero Banner per Design System lines 276 & 319 */}
            <div className="relative rounded-3xl overflow-hidden bg-brand-950 text-white p-8 sm:p-12 md:p-16 shadow-xl border border-border/20">
              {/* Subtle background luxury photography overlay */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage:
                    'url(https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=80)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/80 to-transparent" />

              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide bg-brand-500/20 text-brand-200 border border-brand-400/30 backdrop-blur-xs">
                  <Sparkles size={13} className="text-brand-300" />
                  <span>Verified Hospitality Sanctuaries</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif tracking-tight leading-tight">
                  Where Sanctuary Meets Precision
                </h1>

                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
                  Discover peerless luxury resorts, heritage palaces, and coastal retreats across India. Enjoy guaranteed reservations with atomic room holds and zero deceptive fees.
                </p>

                {/* Popular Quick Destinations Chips */}
                <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-neutral-400 font-mono text-[11px]">Popular:</span>
                  {['Chennai', 'Mumbai', 'Udaipur', 'Goa', 'Bengaluru', 'Jaipur'].map((cityName) => (
                    <button
                      key={cityName}
                      onClick={() => handleFilterChange({ city: cityName })}
                      className={`px-3 py-1 rounded-full transition-all border ${
                        filters.city.toLowerCase() === cityName.toLowerCase()
                          ? 'bg-white text-brand-950 font-bold border-white'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      {cityName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prominent Search Widget Strip */}
            <div className="-mt-8 sm:-mt-12 relative z-20">
              <SearchWidget
                filters={filters}
                onSearch={(updated) => handleFilterChange(updated)}
              />
            </div>

            {/* Split Content: Filters Sidebar (Col 1-3) & Hotel List (Col 4-12) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
              <div className="hidden lg:block lg:col-span-3 sticky top-22">
                <FilterSidebar
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={handleResetFilters}
                />
              </div>

              <div className="lg:col-span-9">
                <HotelList
                  hotels={hotels}
                  isLoading={isHotelsLoading}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onResetFilters={handleResetFilters}
                  onSelectHotel={handleSelectHotel}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: HOTEL DETAIL & ROOM MATRIX */}
        {currentView === 'detail' && selectedHotel && (
          <HotelDetailPage
            hotel={selectedHotel}
            filters={filters}
            onBack={() => {
              setCurrentView('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectRoomToReserve={handleReserveRoom}
            onChangeDates={() => {
              setCurrentView('search');
              window.scrollTo({ top: 200, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 3: CHECKOUT & MOCK PAYMENT */}
        {currentView === 'checkout' && activeHoldBooking && selectedHotel && selectedRoomType && (
          <CheckoutPage
            bookingHold={activeHoldBooking}
            hotel={selectedHotel}
            roomType={selectedRoomType}
            onBack={() => {
              setCurrentView('detail');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onCompletePayment={handleCompletePayment}
            isProcessing={isProcessingPayment}
          />
        )}

        {/* VIEW 4: CONFIRMATION RECEIPT */}
        {currentView === 'confirmation' && lastConfirmedBooking && (
          <ConfirmationPage
            booking={lastConfirmedBooking}
            onViewMyBookings={() => {
              setCurrentView('bookings');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onExploreMore={() => {
              setCurrentView('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 5: MY BOOKINGS LIFECYCLE */}
        {currentView === 'bookings' && (
          <MyBookingsPage
            bookings={customerBookings}
            onCancelBooking={handleCancelBooking}
            onSubmitReview={handleSubmitReview}
            onExploreHotels={() => {
              setCurrentView('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Global Footer with Trust Guarantees */}
      <Footer />

      {/* User Profile & Demo Switcher Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onSwitchUser={(newUser) => {
          setUser(newUser);
          saveUser(newUser);
        }}
      />
    </div>
  );
};

export default App;
