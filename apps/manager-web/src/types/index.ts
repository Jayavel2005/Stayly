export type UserRole = 'CUSTOMER' | 'MANAGER' | 'ADMIN';

export type RoomOperationalStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'EXPIRED';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface ManagerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'MANAGER';
  avatarUrl?: string;
  assignedHotelIds: string[];
}

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  starRating: number;
  isActive: boolean;
  phone: string;
  email: string;
  checkInTime: string; // e.g. "14:00"
  checkOutTime: string; // e.g. "11:00"
  cancellationGraceHours: number; // e.g. 48
  images: string[];
}

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  description: string;
  maxGuests: number;
  basePricePerNight: number;
  bedType: string;
  sizeSqm: number;
  amenities: string[];
  images: string[];
  totalRoomsCount: number;
}

export interface Room {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number;
  operationalStatus: RoomOperationalStatus;
  currentBookingId?: string;
  currentGuestName?: string;
  notes?: string;
  lastCleanedAt?: string;
  updatedAt: string;
}

export interface BookingGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idVerified: boolean;
  idDocumentType?: 'PASSPORT' | 'DRIVING_LICENSE' | 'NATIONAL_ID';
  idDocumentNumber?: string;
}

export interface Booking {
  id: string;
  bookingReference: string; // e.g. BK-9481
  hotelId: string;
  customer: BookingGuest;
  roomTypeId: string;
  roomTypeName: string;
  roomId?: string; // Assigned physical room
  roomNumber?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  totalGuests: number;
  totalNights: number;
  basePricePerNight: number;
  subtotal: number;
  taxesAndFees: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  specialRequests?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  hotelId: string;
  bookingId: string;
  guestName: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  cleanlinessRating: number;
  serviceRating: number;
  locationRating: number;
  createdAt: string;
  roomTypeName: string;
  managerResponse?: {
    respondedAt: string;
    responseText: string;
    managerName: string;
  };
}

export interface Notification {
  id: string;
  hotelId: string;
  type: 'NEW_BOOKING' | 'CHECK_IN_DUE' | 'CHECK_OUT_DUE' | 'ROOM_MAINTENANCE' | 'CANCELLATION' | 'NEW_REVIEW';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface KPISummary {
  totalRevenueThisMonth: number;
  revenueGrowthPercent: number;
  targetRevenue: number;
  occupancyRatePercent: number;
  availableRoomsCount: number;
  occupiedRoomsCount: number;
  dirtyRoomsCount: number;
  maintenanceRoomsCount: number;
  totalPhysicalRooms: number;
  pendingArrivalsToday: number;
  pendingDeparturesToday: number;
  inHouseGuestsCount: number;
  activeReservationsCount: number;
  averageDailyRate: number;
}
