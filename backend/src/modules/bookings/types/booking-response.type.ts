import { BookingStatus } from './booking-status.enum';

export interface BookingAllocatedRoom {
  id: string;
  roomNumber: string;
  floor: number;
}

export interface BookingPriceSnapshotResponse {
  baseRate: string;
  baseRateCents: string;
  totalNights: number;
  grossAmount: string;
  grossRoomCents: string;
  taxAmount: string;
  taxCents: string;
  serviceFeeAmount: string;
  serviceFeeCents: string;
  discountAmount: string;
  discountCents: string;
  netAmount: string;
  netAmountCents: string;
  currency: string;
}

export interface BookingCustomerResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export interface BookingResponse {
  id: string;
  bookingReference: string;
  status: BookingStatus | string;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  totalGuests: number;
  roomsCount: number;
  totalAmount: string;
  totalAmountCents: string;
  currency: string;
  holdExpiresAt: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
  };
  roomType: {
    id: string;
    name: string;
    slug: string;
  };
  allocatedRooms: BookingAllocatedRoom[];
  priceSnapshot?: BookingPriceSnapshotResponse;
  customer?: BookingCustomerResponse;
  message?: string;
}

export interface PaginatedBookingsResponse {
  items: BookingResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
