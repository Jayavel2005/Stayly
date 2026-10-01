export interface AvailableRoomTypeResult {
  id: string;
  roomTypeId: string;
  name: string;
  slug: string;
  description: string;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  basePriceCents: string | number | bigint;
  currency: string;
  bedType: string;
  sizeSqMeters: number | null;
  availableRooms: number;
  totalRooms: number;
  totalOperationalRooms: number;
  amenities?: Array<{
    id: string;
    name: string;
    iconKey: string;
  }>;
}

export interface AvailableHotelResult {
  id: string;
  hotelId: string;
  name: string;
  hotelName: string;
  slug: string;
  description: string;
  starRating: number;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  checkInTime: string | Date;
  checkOutTime: string | Date;
  minPriceCents: string | number | bigint;
  totalAvailableRooms: number;
  roomTypes: AvailableRoomTypeResult[];
}

export interface PaginatedSearchResults<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    checkIn: string;
    checkOut: string;
    totalNights: number;
    guests: number;
    rooms: number;
  };
}

export interface RoomTypeAvailabilitySummary {
  roomTypeId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  totalOperationalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  hasAvailability: boolean;
  availableRoomIds: string[];
}
