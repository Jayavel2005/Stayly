import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Printer,
  Compass,
  ArrowRight,
  ShieldCheck,
  QrCode,
  FileText,
} from 'lucide-react';
import { Booking } from '../../types';
import { formatCurrency, formatDateRange } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';

interface ConfirmationPageProps {
  booking: Booking;
  onViewMyBookings: () => void;
  onExploreMore: () => void;
}

export const ConfirmationPage: React.FC<ConfirmationPageProps> = ({
  booking,
  onViewMyBookings,
  onExploreMore,
}) => {
  useEffect(() => {
    // Launch celebratory confetti burst
    try {
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#163952', '#3884b5', '#15803d', '#f4f2ec'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Success Celebration Banner */}
      <div className="text-center space-y-3 pt-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm ring-8 ring-emerald-50/50 dark:ring-emerald-950/50">
          <CheckCircle2 size={36} className="stroke-[2]" />
        </div>

        <h1 className="text-3xl font-extrabold font-serif text-foreground tracking-tight">
          Reservation Guaranteed!
        </h1>

        <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Your payment was successfully settled and your room inventory is locked with zero risk of double booking.
        </p>

        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-xs text-muted-foreground font-mono">Reference Code:</span>
          <span className="font-mono text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded-md border border-primary/20 tracking-wider">
            {booking.bookingReference}
          </span>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      {/* Printable Digital Folio / Receipt Card */}
      <div className="rounded-2xl border border-border bg-card shadow-md p-6 sm:p-8 space-y-6 print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b border-border pb-4 gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">
              Stayora Guest Folio & Receipt
            </div>
            <h2 className="text-xl font-bold font-serif text-foreground mt-0.5">
              {booking.hotelName}
            </h2>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin size={13} className="text-primary shrink-0" />
              <span>{booking.hotelAddress}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="w-14 h-14 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground p-1.5">
              <QrCode size={40} className="stroke-[1.5]" />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              Digital Pass
            </div>
          </div>
        </div>

        {/* Stay & Room Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-secondary/40 border border-border/80 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
              Dates of Stay
            </span>
            <span className="font-semibold text-foreground block mt-1">
              {formatDateRange(booking.checkIn, booking.checkOut)}
            </span>
            <span className="text-muted-foreground">({booking.nights} nights)</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
              Room & Category
            </span>
            <span className="font-semibold text-foreground block mt-1">
              {booking.roomTypeName}
            </span>
            <span className="text-muted-foreground font-mono">Assigned: {booking.roomNumber || 'Room 304'}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
              Registered Guest
            </span>
            <span className="font-semibold text-foreground block mt-1">
              {booking.guestInfo.fullName}
            </span>
            <span className="text-muted-foreground">{booking.guestsCount} Guests</span>
          </div>
        </div>

        {/* Financial Breakdown Table */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText size={14} />
            <span>Financial Transaction Ledger</span>
          </h3>

          <div className="p-4 rounded-xl border border-border bg-background space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Nightly Rate ({booking.nights} nights × {formatCurrency(booking.priceBreakdown.basePricePerNight)})</span>
              <span className="font-mono text-foreground">{formatCurrency(booking.priceBreakdown.roomTotal)}</span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Hospitality Goods & Service Tax (18% GST)</span>
              <span className="font-mono text-foreground">{formatCurrency(booking.priceBreakdown.taxesAndGst)}</span>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Sanitization & Resort Infrastructure Fee</span>
              <span className="font-mono text-foreground">{formatCurrency(booking.priceBreakdown.serviceFee)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-foreground pt-3 border-t border-border">
              <span>Total Paid via {booking.paymentMethod || 'Authorized Card'}</span>
              <span className="font-mono text-base text-primary">
                {formatCurrency(booking.priceBreakdown.grandTotal)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
            <span>Transaction Ref: {booking.transactionReference || 'txn_mock_98214'}</span>
            <span>Settled at: {new Date(booking.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Arrival Reassurance */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-3">
          <ShieldCheck size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold">Check-In Arrival Instructions</div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
              Upon arriving at {booking.hotelName}, present your booking reference code <strong>{booking.bookingReference}</strong> or national identity document at the front desk for immediate physical key dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 print:hidden">
        <Button
          onClick={() => window.print()}
          variant="outline"
          size="lg"
          leftIcon={<Printer size={16} />}
          className="w-full sm:w-auto text-xs"
        >
          Print Itinerary Folio
        </Button>

        <Button
          onClick={onViewMyBookings}
          variant="default"
          size="lg"
          rightIcon={<ArrowRight size={16} />}
          className="w-full sm:w-auto font-semibold text-xs"
        >
          View in My Bookings
        </Button>

        <Button
          onClick={onExploreMore}
          variant="ghost"
          size="lg"
          leftIcon={<Compass size={16} />}
          className="w-full sm:w-auto text-xs"
        >
          Discover More Sanctuaries
        </Button>
      </div>
    </div>
  );
};
