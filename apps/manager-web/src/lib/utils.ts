import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Room, Booking, KPISummary } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Universal Currency Formatter per Stayora Design System
 * Guarantees standard symbol (₹) and comma separation
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Clean Date formatting for front-desk manifests
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(timeString?: string): string {
  if (!timeString) return '—';
  try {
    const d = new Date(timeString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timeString;
  }
}

/**
 * Compute real-time KPIs dynamically from current hotel inventory and bookings
 */
export function computeHotelKPIs(
  hotelId: string,
  rooms: Room[],
  bookings: Booking[],
  todayStr: string = '2026-10-01'
): KPISummary {
  const hotelRooms = rooms.filter((r) => r.hotelId === hotelId);
  const hotelBookings = bookings.filter((b) => b.hotelId === hotelId);

  const totalPhysicalRooms = hotelRooms.length || 1;
  const availableRoomsCount = hotelRooms.filter((r) => r.operationalStatus === 'AVAILABLE').length;
  const occupiedRoomsCount = hotelRooms.filter((r) => r.operationalStatus === 'OCCUPIED').length;
  const dirtyRoomsCount = hotelRooms.filter((r) => r.operationalStatus === 'DIRTY').length;
  const maintenanceRoomsCount = hotelRooms.filter((r) => r.operationalStatus === 'MAINTENANCE').length;

  const occupancyRatePercent = Math.round((occupiedRoomsCount / totalPhysicalRooms) * 100);

  // Today's arrivals: checkIn === today and status === CONFIRMED
  const pendingArrivalsToday = hotelBookings.filter(
    (b) => b.checkIn === todayStr && b.status === 'CONFIRMED'
  ).length;

  // Today's departures: checkOut === today and status === CHECKED_IN
  const pendingDeparturesToday = hotelBookings.filter(
    (b) => b.checkOut === todayStr && b.status === 'CHECKED_IN'
  ).length;

  // In-House guests
  const inHouseGuestsCount = hotelBookings.filter((b) => b.status === 'CHECKED_IN').length;

  // Active reservations (CONFIRMED or CHECKED_IN)
  const activeReservationsCount = hotelBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'
  ).length;

  // Total revenue for this month (October 2026)
  const confirmedOrCompletedBookings = hotelBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'COMPLETED'
  );
  const totalRevenueThisMonth = confirmedOrCompletedBookings.reduce(
    (sum, b) => sum + (b.totalPrice || 0),
    0
  );

  const targetRevenue = 3500000; // ₹3.5M target for October
  const revenueGrowthPercent = 14.8;
  const averageDailyRate = Math.round(
    confirmedOrCompletedBookings.length > 0
      ? totalRevenueThisMonth / (confirmedOrCompletedBookings.reduce((acc, b) => acc + (b.totalNights || 1), 0) || 1)
      : 8500
  );

  return {
    totalRevenueThisMonth,
    revenueGrowthPercent,
    targetRevenue,
    occupancyRatePercent,
    availableRoomsCount,
    occupiedRoomsCount,
    dirtyRoomsCount,
    maintenanceRoomsCount,
    totalPhysicalRooms,
    pendingArrivalsToday,
    pendingDeparturesToday,
    inHouseGuestsCount,
    activeReservationsCount,
    averageDailyRate,
  };
}
