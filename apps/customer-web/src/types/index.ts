export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type OperationalStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'CLEAN'
  | 'DIRTY'
  | 'MAINTENANCE';

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  description: string;
  basePrice: number;
  maxGuests: number;
  bedType: string;
  roomSize: string; // e.g. "45 m² / 485 sq ft"
  totalRooms: number;
  availableRooms: number;
  images: string[];
  amenities: string[];
  hasFreeCancellation: boolean;
  breakfastIncluded: boolean;
}

export interface Review {
  id: string;
  hotelId: string;
  bookingId: string;
  customerName: string;
  customerAvatar?: string;
  rating: number; // 1 to 5
  title: string;
  comment: string;
  stayDate: string; // e.g. "September 2026"
  roomTypeName: string;
  createdAt: string;
  categories?: {
    cleanliness: number;
    staff: number;
    comfort: number;
    value: number;
    location: number;
  };
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  city: string;
  state: string;
  country: string;
  address: string;
  postalCode: string;
  starRating: number; // 1 to 5
  averageRating: number; // e.g. 4.8
  totalReviews: number;
  heroImage: string;
  images: string[];
  amenities: string[];
  distanceToCenter: string;
  nearbyAttraction: string;
  minPrice: number; // calculated starting from
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  roomTypes: RoomType[];
  reviews: Review[];
}

export interface BookingGuest {
  fullName: string;
  email: string;
  phone: string;
  specialRequests?: string;
  estimatedArrival?: string;
}

export interface PriceBreakdown {
  nights: number;
  basePricePerNight: number;
  roomTotal: number;
  taxesAndGst: number; // 18% GST standard
  serviceFee: number;
  grandTotal: number;
}

export interface Booking {
  id: string;
  bookingReference: string; // BK-XXXXXX
  customerId: string;
  hotelId: string;
  hotelName: string;
  hotelAddress: string;
  hotelHeroImage: string;
  roomTypeId: string;
  roomTypeName: string;
  roomId?: string; // Physical assigned room
  roomNumber?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  guestsCount: number;
  guestInfo: BookingGuest;
  priceBreakdown: PriceBreakdown;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  transactionReference?: string;
  holdExpiresAt?: string; // ISO string
  createdAt: string;
  hasReview?: boolean;
  cancellationRefundAmount?: number;
  cancellationReason?: string;
}

export interface SearchFilterState {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  priceRange: [number, number];
  starRatings: number[];
  amenities: string[];
  freeCancellationOnly: boolean;
  breakfastIncludedOnly: boolean;
  sortBy: 'recommended' | 'price-asc' | 'price-desc' | 'rating-desc';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'CUSTOMER';
  avatar?: string;
  memberTier: 'Silver Guest' | 'Gold Tier' | 'Platinum Sanctuary';
  joinedDate: string;
}
