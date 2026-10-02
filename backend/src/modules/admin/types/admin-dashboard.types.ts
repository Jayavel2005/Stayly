export interface DashboardUserStats {
  totalUsers: number;
  activeUsers: number;
  totalCustomers: number;
  totalManagers: number;
  suspendedUsers: number;
}

export interface DashboardHotelStats {
  totalHotels: number;
  activeHotels: number;
  inactiveHotels: number;
}

export interface DashboardInventoryStats {
  totalRoomTypes: number;
  totalRooms: number;
}

export interface DashboardBookingStats {
  totalBookings: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  noShow: number;
}

export interface DashboardPaymentStats {
  totalPayments: number;
  completed: number;
  failed: number;
  pending: number;
  totalRevenueCents: number;
}

export interface DashboardReviewStats {
  totalReviews: number;
  publishedReviews: number;
  averageRating: number | null;
}

export interface DashboardNotificationStats {
  totalNotifications: number;
  unreadNotifications: number;
}

export interface AdminDashboardResponse {
  dateRange: {
    from: string | null;
    to: string | null;
  };
  users: DashboardUserStats;
  hotels: DashboardHotelStats;
  inventory: DashboardInventoryStats;
  bookings: DashboardBookingStats;
  payments: DashboardPaymentStats;
  reviews: DashboardReviewStats;
  notifications: DashboardNotificationStats;
}
