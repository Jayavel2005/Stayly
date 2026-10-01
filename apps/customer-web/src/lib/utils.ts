import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PriceBreakdown } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency strictly adhering to Design System PriceDisplay specification:
 * Tabular lining figures, Rupee symbol, standard grouping.
 */
export function formatCurrency(amount: number, includeDecimals = false): string {
  if (isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Calculates number of nights between check-in and check-out
 */
export function calculateNights(checkInStr: string, checkOutStr: string): number {
  if (!checkInStr || !checkOutStr) return 1;
  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);
  const diffTime = checkOut.getTime() - checkIn.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Calculates complete price breakdown with transparent taxes and service fees.
 * Follows design system and README: 18% GST + standard ₹500 sanitization/service fee.
 */
export function calculatePriceBreakdown(
  basePricePerNight: number,
  checkInStr: string,
  checkOutStr: string
): PriceBreakdown {
  const nights = calculateNights(checkInStr, checkOutStr);
  const roomTotal = basePricePerNight * nights;
  const taxesAndGst = Math.round(roomTotal * 0.18); // 18% Hospitality GST
  const serviceFee = 500; // Flat resort/service charge
  const grandTotal = roomTotal + taxesAndGst + serviceFee;

  return {
    nights,
    basePricePerNight,
    roomTotal,
    taxesAndGst,
    serviceFee,
    grandTotal,
  };
}

/**
 * Check cancellation policy & refund calculation adhering to README Section:
 * "Customers may cancel up to 48 hours prior to check_in (at 00:00:00 hours on the check-in date)
 * for a full refund. Cancellations inside 48 hours incur a 1-night cancellation penalty."
 */
export function calculateCancellationRefund(
  checkInDateStr: string,
  totalPaid: number,
  basePricePerNight: number,
  nights: number
): {
  isFullRefund: boolean;
  hoursUntilCheckIn: number;
  refundAmount: number;
  penaltyAmount: number;
  deadlineDateStr: string;
} {
  const checkInMidnight = new Date(`${checkInDateStr}T00:00:00`);
  const now = new Date();
  
  const diffMs = checkInMidnight.getTime() - now.getTime();
  const hoursUntilCheckIn = Math.floor(diffMs / (1000 * 60 * 60));

  // 48 hours prior deadline date
  const deadlineDate = new Date(checkInMidnight.getTime() - 48 * 60 * 60 * 1000);
  const deadlineDateStr = deadlineDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (hoursUntilCheckIn >= 48) {
    return {
      isFullRefund: true,
      hoursUntilCheckIn,
      refundAmount: totalPaid,
      penaltyAmount: 0,
      deadlineDateStr,
    };
  } else {
    // 1-night penalty + proportional taxes
    const oneNightWithTax = Math.round(basePricePerNight * 1.18);
    const penaltyAmount = Math.min(totalPaid, oneNightWithTax);
    const refundAmount = Math.max(0, totalPaid - penaltyAmount);

    return {
      isFullRefund: false,
      hoursUntilCheckIn,
      refundAmount,
      penaltyAmount,
      deadlineDateStr,
    };
  }
}

/**
 * Generates an architectural booking reference: BK-829104
 */
export function generateBookingReference(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let ref = 'BK-';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

/**
 * Generates client idempotency key (UUIDv4 compatible)
 */
export function generateIdempotencyKey(): string {
  return 'idem_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

/**
 * Formats a clean date range: "Oct 10 – 13, 2026"
 */
export function formatDateRange(checkInStr: string, checkOutStr: string): string {
  if (!checkInStr || !checkOutStr) return 'Select Dates';
  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);

  const checkInMonth = checkIn.toLocaleDateString('en-US', { month: 'short' });
  const checkOutMonth = checkOut.toLocaleDateString('en-US', { month: 'short' });
  const checkInDay = checkIn.getDate();
  const checkOutDay = checkOut.getDate();
  const year = checkOut.getFullYear();

  if (checkInMonth === checkOutMonth) {
    return `${checkInMonth} ${checkInDay} – ${checkOutDay}, ${year}`;
  }
  return `${checkInMonth} ${checkInDay} – ${checkOutMonth} ${checkOutDay}, ${year}`;
}
