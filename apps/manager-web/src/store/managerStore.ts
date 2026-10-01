import { create } from 'zustand';
import {
  Hotel,
  RoomType,
  Room,
  Booking,
  Review,
  Notification,
  ManagerUser,
  RoomOperationalStatus,
} from '../types';
import {
  mockHotels,
  mockRoomTypes,
  mockRooms,
  mockBookings,
  mockReviews,
  mockNotifications,
  mockManagerUser,
} from '../data/mockData';

export type NavigationTab =
  | 'dashboard'
  | 'front-desk'
  | 'rooms'
  | 'room-types'
  | 'housekeeping'
  | 'reviews'
  | 'property';

interface ManagerState {
  currentHotelId: string;
  user: ManagerUser;
  hotels: Hotel[];
  roomTypes: RoomType[];
  rooms: Room[];
  bookings: Booking[];
  reviews: Review[];
  notifications: Notification[];
  theme: 'light' | 'dark';
  activeTab: NavigationTab;
  isQuickSearchOpen: boolean;

  // Actions
  setCurrentHotelId: (hotelId: string) => void;
  setActiveTab: (tab: NavigationTab) => void;
  toggleTheme: () => void;
  setQuickSearchOpen: (open: boolean) => void;

  // Front-Desk Operations
  checkInGuest: (bookingId: string) => void;
  checkOutGuest: (bookingId: string) => void;
  cancelBooking: (bookingId: string, reason: string) => void;

  // Inventory & Room Operations
  updateRoomStatus: (roomId: string, status: RoomOperationalStatus, notes?: string) => void;
  provisionRoom: (data: { roomNumber: string; floor: number; roomTypeId: string; notes?: string }) => void;

  // Room Type Catalog Operations
  updateRoomType: (roomType: RoomType) => void;
  addRoomType: (roomType: Omit<RoomType, 'id'>) => void;

  // Property Profile Operations
  updateHotelProfile: (updated: Partial<Hotel>) => void;

  // Reviews
  respondToReview: (reviewId: string, responseText: string) => void;

  // Notifications
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
}

export const useManagerStore = create<ManagerState>((set, get) => ({
  currentHotelId: 'hotel-hyatt-01',
  user: mockManagerUser,
  hotels: mockHotels,
  roomTypes: mockRoomTypes,
  rooms: mockRooms,
  bookings: mockBookings,
  reviews: mockReviews,
  notifications: mockNotifications,
  theme: 'light',
  activeTab: 'dashboard',
  isQuickSearchOpen: false,

  setCurrentHotelId: (hotelId) => set({ currentHotelId: hotelId }),
  setActiveTab: (activeTab) => set({ activeTab }),

  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme: nextTheme });
  },

  setQuickSearchOpen: (isQuickSearchOpen) => set({ isQuickSearchOpen }),

  checkInGuest: (bookingId: string) => {
    const state = get();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const nowIso = new Date().toISOString();

    // Find physical room to occupy
    const updatedRooms = state.rooms.map((room) => {
      if (booking.roomId && room.id === booking.roomId) {
        return {
          ...room,
          operationalStatus: 'OCCUPIED' as RoomOperationalStatus,
          currentBookingId: booking.id,
          currentGuestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
          updatedAt: nowIso,
        };
      }
      return room;
    });

    const updatedBookings = state.bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'CHECKED_IN' as const,
          checkedInAt: nowIso,
          updatedAt: nowIso,
        };
      }
      return b;
    });

    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      hotelId: state.currentHotelId,
      type: 'CHECK_IN_DUE',
      title: 'Guest Checked In',
      message: `${booking.customer.firstName} ${booking.customer.lastName} checked into Room ${booking.roomNumber || 'Assigned'} (${booking.bookingReference}).`,
      timestamp: 'Just now',
      isRead: false,
      priority: 'NORMAL',
    };

    set({
      rooms: updatedRooms,
      bookings: updatedBookings,
      notifications: [newNotification, ...state.notifications],
    });
  },

  checkOutGuest: (bookingId: string) => {
    const state = get();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const nowIso = new Date().toISOString();

    // Mark physical room as DIRTY for housekeeping turnover
    const updatedRooms = state.rooms.map((room) => {
      if (booking.roomId && room.id === booking.roomId) {
        return {
          ...room,
          operationalStatus: 'DIRTY' as RoomOperationalStatus,
          currentBookingId: undefined,
          currentGuestName: undefined,
          notes: `Turnover pending checkout for ${booking.customer.firstName} ${booking.customer.lastName}`,
          updatedAt: nowIso,
        };
      }
      return room;
    });

    const updatedBookings = state.bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'COMPLETED' as const,
          checkedOutAt: nowIso,
          updatedAt: nowIso,
        };
      }
      return b;
    });

    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      hotelId: state.currentHotelId,
      type: 'CHECK_OUT_DUE',
      title: 'Guest Checked Out (Housekeeping Alert)',
      message: `${booking.customer.firstName} ${booking.customer.lastName} departed. Room ${booking.roomNumber || ''} marked DIRTY for cleaning.`,
      timestamp: 'Just now',
      isRead: false,
      priority: 'HIGH',
    };

    set({
      rooms: updatedRooms,
      bookings: updatedBookings,
      notifications: [newNotification, ...state.notifications],
    });
  },

  cancelBooking: (bookingId: string, reason: string) => {
    const state = get();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const nowIso = new Date().toISOString();

    // Free the assigned room
    const updatedRooms = state.rooms.map((room) => {
      if (booking.roomId && room.id === booking.roomId) {
        return {
          ...room,
          operationalStatus: 'AVAILABLE' as RoomOperationalStatus,
          currentBookingId: undefined,
          currentGuestName: undefined,
          updatedAt: nowIso,
        };
      }
      return room;
    });

    const updatedBookings = state.bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'CANCELLED' as const,
          paymentStatus: 'REFUNDED' as const,
          cancellationReason: reason,
          cancelledAt: nowIso,
          updatedAt: nowIso,
        };
      }
      return b;
    });

    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      hotelId: state.currentHotelId,
      type: 'CANCELLATION',
      title: 'Reservation Cancelled',
      message: `Booking ${booking.bookingReference} for ${booking.customer.firstName} ${booking.customer.lastName} cancelled. Room ${booking.roomNumber || ''} unlocked.`,
      timestamp: 'Just now',
      isRead: false,
      priority: 'HIGH',
    };

    set({
      rooms: updatedRooms,
      bookings: updatedBookings,
      notifications: [newNotification, ...state.notifications],
    });
  },

  updateRoomStatus: (roomId: string, status: RoomOperationalStatus, notes?: string) => {
    const state = get();
    const nowIso = new Date().toISOString();

    const updatedRooms = state.rooms.map((room) => {
      if (room.id === roomId) {
        return {
          ...room,
          operationalStatus: status,
          notes: notes !== undefined ? notes : room.notes,
          lastCleanedAt: status === 'AVAILABLE' ? nowIso : room.lastCleanedAt,
          updatedAt: nowIso,
        };
      }
      return room;
    });

    set({ rooms: updatedRooms });
  },

  provisionRoom: (data) => {
    const state = get();
    const newRoom: Room = {
      id: `rm-${Date.now()}`,
      hotelId: state.currentHotelId,
      roomTypeId: data.roomTypeId,
      roomNumber: data.roomNumber,
      floor: data.floor,
      operationalStatus: 'AVAILABLE',
      notes: data.notes,
      lastCleanedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({ rooms: [...state.rooms, newRoom] });
  },

  updateRoomType: (updatedType) => {
    const state = get();
    const updated = state.roomTypes.map((rt) => (rt.id === updatedType.id ? updatedType : rt));
    set({ roomTypes: updated });
  },

  addRoomType: (typeData) => {
    const state = get();
    const newType: RoomType = {
      ...typeData,
      id: `rt-${Date.now()}`,
    };
    set({ roomTypes: [...state.roomTypes, newType] });
  },

  updateHotelProfile: (updatedData) => {
    const state = get();
    const updatedHotels = state.hotels.map((h) =>
      h.id === state.currentHotelId ? { ...h, ...updatedData } : h
    );
    set({ hotels: updatedHotels });
  },

  respondToReview: (reviewId: string, responseText: string) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const updatedReviews = state.reviews.map((r) => {
      if (r.id === reviewId) {
        return {
          ...r,
          managerResponse: {
            respondedAt: nowIso,
            responseText,
            managerName: `${state.user.firstName} ${state.user.lastName} (General Manager)`,
          },
        };
      }
      return r;
    });

    set({ reviews: updatedReviews });
  },

  markNotificationAsRead: (id: string) => {
    const state = get();
    const updated = state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    set({ notifications: updated });
  },

  markAllNotificationsAsRead: () => {
    const state = get();
    const updated = state.notifications.map((n) => ({ ...n, isRead: true }));
    set({ notifications: updated });
  },
}));
