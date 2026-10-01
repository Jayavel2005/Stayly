import { Hotel, Booking, Review, BookingGuest, SearchFilterState, UserProfile } from '../types';
import { MOCK_HOTELS, INITIAL_BOOKINGS, INITIAL_USER } from './mockData';
import { calculatePriceBreakdown, calculateCancellationRefund, generateBookingReference } from '../lib/utils';

const STORAGE_KEYS = {
  HOTELS: 'stayora_hotels_v1',
  BOOKINGS: 'stayora_bookings_v1',
  USER: 'stayora_user_v1',
  ACTIVE_HOLD: 'stayora_active_hold_v1',
};

// Initialize LocalStorage with seed data if empty
function getStoredHotels(): Hotel[] {
  const stored = localStorage.getItem(STORAGE_KEYS.HOTELS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(STORAGE_KEYS.HOTELS, JSON.stringify(MOCK_HOTELS));
  return MOCK_HOTELS;
}

function saveHotels(hotels: Hotel[]): void {
  localStorage.setItem(STORAGE_KEYS.HOTELS, JSON.stringify(hotels));
}

function getStoredBookings(): Booking[] {
  const stored = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(INITIAL_BOOKINGS));
  return INITIAL_BOOKINGS;
}

function saveBookings(bookings: Booking[]): void {
  localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
}

export function getStoredUser(): UserProfile {
  const stored = localStorage.getItem(STORAGE_KEYS.USER);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(INITIAL_USER));
  return INITIAL_USER;
}

export function saveUser(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Service API layer conforming to Stayora RESTful conventions
 */
export const api = {
  // Discovery & Search (GET /api/v1/hotels/search)
  async searchHotels(filters: Partial<SearchFilterState>): Promise<{ hotels: Hotel[]; totalCount: number }> {
    // Artificial slight network latency for realistic UX feel
    await new Promise((resolve) => setTimeout(resolve, 180));
    const allHotels = getStoredHotels();

    const filtered = allHotels.filter((hotel) => {
      // City matching
      if (filters.city && filters.city.trim() !== '') {
        const query = filters.city.toLowerCase().trim();
        const matchesCity = hotel.city.toLowerCase().includes(query);
        const matchesName = hotel.name.toLowerCase().includes(query);
        const matchesState = hotel.state.toLowerCase().includes(query);
        if (!matchesCity && !matchesName && !matchesState) return false;
      }

      // Star Ratings
      if (filters.starRatings && filters.starRatings.length > 0) {
        if (!filters.starRatings.includes(hotel.starRating)) return false;
      }

      // Price Range
      if (filters.priceRange) {
        const [min, max] = filters.priceRange;
        if (hotel.minPrice < min || hotel.minPrice > max) return false;
      }

      // Amenities filter
      if (filters.amenities && filters.amenities.length > 0) {
        const hasAllAmenities = filters.amenities.every((amenity) =>
          hotel.amenities.some((a) => a.toLowerCase().includes(amenity.toLowerCase()))
        );
        if (!hasAllAmenities) return false;
      }

      // Free cancellation filter
      if (filters.freeCancellationOnly) {
        const hasFreeCancelRoom = hotel.roomTypes.some((r) => r.hasFreeCancellation);
        if (!hasFreeCancelRoom) return false;
      }

      // Breakfast included filter
      if (filters.breakfastIncludedOnly) {
        const hasBreakfastRoom = hotel.roomTypes.some((r) => r.breakfastIncluded);
        if (!hasBreakfastRoom) return false;
      }

      return true;
    });

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case 'price-asc':
          return a.minPrice - b.minPrice;
        case 'price-desc':
          return b.minPrice - a.minPrice;
        case 'rating-desc':
          return b.averageRating - a.averageRating;
        case 'recommended':
        default:
          return b.starRating - a.starRating || b.averageRating - a.averageRating;
      }
    });

    return {
      hotels: sorted,
      totalCount: sorted.length,
    };
  },

  // GET /api/v1/hotels/:id
  async getHotelById(id: string): Promise<Hotel | null> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const hotels = getStoredHotels();
    return hotels.find((h) => h.id === id || h.slug === id) || null;
  },

  // POST /api/v1/bookings (Create a 15-minute booking hold)
  async createBookingHold(params: {
    hotelId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guestsCount: number;
    guestInfo: BookingGuest;
  }): Promise<Booking> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const hotels = getStoredHotels();
    const hotel = hotels.find((h) => h.id === params.hotelId);
    if (!hotel) throw new Error('Hotel not found');

    const roomType = hotel.roomTypes.find((rt) => rt.id === params.roomTypeId);
    if (!roomType) throw new Error('Room type not found');

    if (roomType.availableRooms <= 0) {
      throw new Error('Selected room type is no longer available for these dates.');
    }

    const priceBreakdown = calculatePriceBreakdown(roomType.basePrice, params.checkIn, params.checkOut);
    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes hold

    const newBooking: Booking = {
      id: 'bkg_' + Math.random().toString(36).substring(2, 9),
      bookingReference: generateBookingReference(),
      customerId: getStoredUser().id,
      hotelId: hotel.id,
      hotelName: hotel.name,
      hotelAddress: hotel.address,
      hotelHeroImage: hotel.heroImage,
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      roomNumber: 'TBD upon check-in',
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights: priceBreakdown.nights,
      guestsCount: params.guestsCount,
      guestInfo: params.guestInfo,
      priceBreakdown,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      holdExpiresAt,
      createdAt: new Date().toISOString(),
    };

    // Store active hold in local storage
    localStorage.setItem(STORAGE_KEYS.ACTIVE_HOLD, JSON.stringify(newBooking));

    return newBooking;
  },

  // POST /api/v1/bookings/:id/pay (Submit payment and confirm reservation)
  async settlePayment(params: {
    booking: Booking;
    paymentMethod: string;
    idempotencyKey: string;
  }): Promise<Booking> {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const confirmedBooking: Booking = {
      ...params.booking,
      status: 'CONFIRMED',
      paymentStatus: 'COMPLETED',
      paymentMethod: params.paymentMethod,
      transactionReference: 'txn_' + Math.random().toString(36).substring(2, 11).toUpperCase(),
      roomNumber: `${Math.floor(Math.random() * 4) + 1}0${Math.floor(Math.random() * 8) + 1}`,
      holdExpiresAt: undefined,
    };

    const bookings = getStoredBookings();
    saveBookings([confirmedBooking, ...bookings]);

    // Clear active hold
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_HOLD);

    // Decrement available room in hotel inventory
    const hotels = getStoredHotels();
    const updatedHotels = hotels.map((h) => {
      if (h.id === confirmedBooking.hotelId) {
        return {
          ...h,
          roomTypes: h.roomTypes.map((rt) => {
            if (rt.id === confirmedBooking.roomTypeId) {
              return { ...rt, availableRooms: Math.max(0, rt.availableRooms - 1) };
            }
            return rt;
          }),
        };
      }
      return h;
    });
    saveHotels(updatedHotels);

    return confirmedBooking;
  },

  // GET /api/v1/bookings (Customer's personal bookings list)
  async getCustomerBookings(): Promise<Booking[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return getStoredBookings();
  },

  // GET /api/v1/bookings/:id
  async getBookingById(id: string): Promise<Booking | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const bookings = getStoredBookings();
    return bookings.find((b) => b.id === id || b.bookingReference === id) || null;
  },

  // POST /api/v1/bookings/:id/cancel
  async cancelBooking(bookingId: string, reason?: string): Promise<{ booking: Booking; refundAmount: number }> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const bookings = getStoredBookings();
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) throw new Error('Booking not found');

    if (target.status !== 'CONFIRMED') {
      throw new Error('Only confirmed bookings can be cancelled.');
    }

    const { refundAmount } = calculateCancellationRefund(
      target.checkIn,
      target.priceBreakdown.grandTotal,
      target.priceBreakdown.basePricePerNight,
      target.nights
    );

    const updatedBooking: Booking = {
      ...target,
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      cancellationRefundAmount: refundAmount,
      cancellationReason: reason || 'Guest initiated cancellation',
    };

    const updatedBookings = bookings.map((b) => (b.id === bookingId ? updatedBooking : b));
    saveBookings(updatedBookings);

    // Restore room inventory to hotel
    const hotels = getStoredHotels();
    const updatedHotels = hotels.map((h) => {
      if (h.id === target.hotelId) {
        return {
          ...h,
          roomTypes: h.roomTypes.map((rt) => {
            if (rt.id === target.roomTypeId) {
              return { ...rt, availableRooms: rt.availableRooms + 1 };
            }
            return rt;
          }),
        };
      }
      return h;
    });
    saveHotels(updatedHotels);

    return { booking: updatedBooking, refundAmount };
  },

  // POST /api/v1/bookings/:id/review (Post-Stay Verified Review)
  // Strict invariants: only completed bookings, exactly 1 review per booking!
  async submitVerifiedReview(params: {
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
  }): Promise<Review> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const bookings = getStoredBookings();
    const booking = bookings.find((b) => b.id === params.bookingId);
    if (!booking) throw new Error('Reservation not found');

    if (booking.status !== 'COMPLETED') {
      throw new Error('Reviews can only be submitted for completed stays.');
    }
    if (booking.hasReview) {
      throw new Error('A review has already been submitted for this reservation.');
    }

    const user = getStoredUser();
    const newReview: Review = {
      id: 'rev_' + Math.random().toString(36).substring(2, 9),
      hotelId: params.hotelId,
      bookingId: params.bookingId,
      customerName: user.name,
      customerAvatar: user.avatar,
      rating: params.rating,
      title: params.title,
      comment: params.comment,
      stayDate: new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      roomTypeName: booking.roomTypeName,
      createdAt: new Date().toISOString().split('T')[0],
      categories: params.categories,
    };

    // Update booking record
    const updatedBookings = bookings.map((b) => (b.id === params.bookingId ? { ...b, hasReview: true } : b));
    saveBookings(updatedBookings);

    // Update hotel reviews and recalculate average rating
    const hotels = getStoredHotels();
    const updatedHotels = hotels.map((h) => {
      if (h.id === params.hotelId) {
        const allReviews = [newReview, ...h.reviews];
        const newAvg = Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(2));
        return {
          ...h,
          reviews: allReviews,
          totalReviews: allReviews.length,
          averageRating: newAvg,
        };
      }
      return h;
    });
    saveHotels(updatedHotels);

    return newReview;
  },
};
