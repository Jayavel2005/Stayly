import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Ban,
  Star,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Booking, BookingStatus } from '../../types';
import { formatCurrency, formatDateRange, calculateCancellationRefund } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';

interface MyBookingsPageProps {
  bookings: Booking[];
  onCancelBooking: (bookingId: string, reason?: string) => Promise<void>;
  onSubmitReview: (params: {
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
  }) => Promise<void>;
  onExploreHotels: () => void;
}

export const MyBookingsPage: React.FC<MyBookingsPageProps> = ({
  bookings,
  onCancelBooking,
  onSubmitReview,
  onExploreHotels,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  // Modal states
  const [selectedBookingForFolio, setSelectedBookingForFolio] = useState<Booking | null>(null);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);

  // Cancellation form state
  const [cancelReason, setCancelReason] = useState('Change in personal travel plans');
  const [isCancelling, setIsCancelling] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [cleanlinessScore, setCleanlinessScore] = useState(5);
  const [staffScore, setStaffScore] = useState(5);
  const [comfortScore, setComfortScore] = useState(5);
  const [valueScore, setValueScore] = useState(5);
  const [locationScore, setLocationScore] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Filter bookings by tab
  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'upcoming') {
      return b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'CHECKED_IN';
    }
    if (activeTab === 'completed') {
      return b.status === 'COMPLETED';
    }
    if (activeTab === 'cancelled') {
      return b.status === 'CANCELLED';
    }
    return true;
  });

  const handleConfirmCancellation = async () => {
    if (!selectedBookingForCancel) return;
    setIsCancelling(true);
    try {
      await onCancelBooking(selectedBookingForCancel.id, cancelReason);
      setSelectedBookingForCancel(null);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForReview || !reviewTitle.trim() || !reviewComment.trim()) return;
    setIsSubmittingReview(true);
    try {
      await onSubmitReview({
        bookingId: selectedBookingForReview.id,
        hotelId: selectedBookingForReview.hotelId,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
        categories: {
          cleanliness: cleanlinessScore,
          staff: staffScore,
          comfort: comfortScore,
          value: valueScore,
          location: locationScore,
        },
      });
      setSelectedBookingForReview(null);
      setReviewTitle('');
      setReviewComment('');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-foreground tracking-tight">
            My Reservation Folios
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage active sanctuary stays, inspect payment receipts, and submit verified post-stay feedback.
          </p>
        </div>

        <Button onClick={onExploreHotels} size="sm" variant="outline" className="text-xs shrink-0">
          Book Another Sanctuary
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-border text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 transition-colors relative flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Upcoming & Active</span>
          <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-secondary">
            {bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'CHECKED_IN').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-3 transition-colors relative flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Completed Stays</span>
          <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-secondary">
            {bookings.filter((b) => b.status === 'COMPLETED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cancelled')}
          className={`pb-3 transition-colors relative flex items-center gap-2 ${
            activeTab === 'cancelled'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Cancelled & Refunded</span>
          <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-secondary">
            {bookings.filter((b) => b.status === 'CANCELLED').length}
          </span>
        </button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          title={`No ${activeTab} reservations found`}
          description={
            activeTab === 'upcoming'
              ? 'You do not have any active or upcoming reservations scheduled.'
              : activeTab === 'completed'
              ? 'No completed stays found in your history yet.'
              : 'You have not cancelled any bookings.'
          }
          actionLabel="Explore Sanctuaries"
          onAction={onExploreHotels}
        />
      ) : (
        <div className="space-y-5">
          {filteredBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
            >
              {/* Left Hotel & Room Thumbnail */}
              <div className="flex items-start gap-4">
                <div className="w-24 sm:w-28 h-20 sm:h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img
                    src={b.hotelHeroImage}
                    alt={b.hotelName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {b.bookingReference}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>

                  <h3 className="text-base sm:text-lg font-bold font-serif text-foreground">
                    {b.hotelName}
                  </h3>

                  <div className="text-xs text-primary font-medium">
                    {b.roomTypeName} {b.roomNumber ? `• Room ${b.roomNumber}` : ''}
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <Calendar size={13} className="shrink-0" />
                    <span>{formatDateRange(b.checkIn, b.checkOut)} ({b.nights} {b.nights === 1 ? 'night' : 'nights'})</span>
                    <span>•</span>
                    <span>{b.guestInfo.fullName}</span>
                  </div>
                </div>
              </div>

              {/* Right Folio Actions & Amount */}
              <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-end justify-between w-full md:w-auto gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-border">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Settled Amount
                  </div>
                  <div className="font-mono text-lg font-extrabold text-foreground tabular-nums">
                    {formatCurrency(b.priceBreakdown.grandTotal)}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {b.paymentMethod || 'Authorized Card'}
                  </div>
                </div>

                {/* Actions Per Booking Role */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Folio Modal */}
                  <Button
                    onClick={() => setSelectedBookingForFolio(b)}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    leftIcon={<FileText size={13} />}
                  >
                    Folio Receipt
                  </Button>

                  {/* Cancel Button (Strictly for CONFIRMED stays per README) */}
                  {b.status === 'CONFIRMED' && (
                    <Button
                      onClick={() => setSelectedBookingForCancel(b)}
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                      leftIcon={<Ban size={13} />}
                    >
                      Cancel Stay
                    </Button>
                  )}

                  {/* Verified Post-Stay Review (Strictly for COMPLETED stays per README lines 1103-1108!) */}
                  {b.status === 'COMPLETED' && (
                    b.hasReview ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={13} /> Verified Review Submitted
                      </span>
                    ) : (
                      <Button
                        onClick={() => setSelectedBookingForReview(b)}
                        size="sm"
                        variant="default"
                        className="text-xs font-semibold"
                        leftIcon={<Star size={13} className="fill-current" />}
                      >
                        Submit Verified Review
                      </Button>
                    )
                  )}

                  {/* Cancelled badge details */}
                  {b.status === 'CANCELLED' && b.cancellationRefundAmount !== undefined && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Refund: {formatCurrency(b.cancellationRefundAmount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Folio / Receipt View */}
      {selectedBookingForFolio && (
        <Modal
          isOpen={!!selectedBookingForFolio}
          onClose={() => setSelectedBookingForFolio(null)}
          title={`Booking Folio — ${selectedBookingForFolio.bookingReference}`}
          description={`Issued for stay at ${selectedBookingForFolio.hotelName}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-xl bg-secondary/50 border border-border grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-muted-foreground block font-mono">Status:</span>
                <StatusBadge status={selectedBookingForFolio.status} className="mt-1" />
              </div>
              <div>
                <span className="text-muted-foreground block font-mono">Assigned Room:</span>
                <span className="font-semibold text-foreground block mt-1">
                  {selectedBookingForFolio.roomNumber || 'Room 304'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-mono">Dates:</span>
                <span className="font-semibold text-foreground block mt-1">
                  {formatDateRange(selectedBookingForFolio.checkIn, selectedBookingForFolio.checkOut)}
                </span>
              </div>
            </div>

            {/* Financial Ledger */}
            <div className="p-4 rounded-xl border border-border space-y-2">
              <div className="font-semibold text-foreground mb-1">Payment Folio Ledger</div>
              <div className="flex justify-between text-muted-foreground">
                <span>Room Charges ({selectedBookingForFolio.nights} nights)</span>
                <span className="font-mono text-foreground">{formatCurrency(selectedBookingForFolio.priceBreakdown.roomTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Hospitality GST (18%)</span>
                <span className="font-mono text-foreground">{formatCurrency(selectedBookingForFolio.priceBreakdown.taxesAndGst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Service & Sanitization Fee</span>
                <span className="font-mono text-foreground">{formatCurrency(selectedBookingForFolio.priceBreakdown.serviceFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border text-sm">
                <span>Net Amount Paid</span>
                <span className="font-mono text-primary font-extrabold">{formatCurrency(selectedBookingForFolio.priceBreakdown.grandTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => window.print()} variant="outline" size="sm">
                Print Folio
              </Button>
              <Button onClick={() => setSelectedBookingForFolio(null)} size="sm">
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: 48-Hour Cancellation Engine Modal */}
      {selectedBookingForCancel && (
        <Modal
          isOpen={!!selectedBookingForCancel}
          onClose={() => setSelectedBookingForCancel(null)}
          title="Cancel Reservation & Calculate Refund"
          description="Governed by the Stayora 48-hour cancellation rules engine."
          maxWidth="lg"
        >
          {(() => {
            const refundCalc = calculateCancellationRefund(
              selectedBookingForCancel.checkIn,
              selectedBookingForCancel.priceBreakdown.grandTotal,
              selectedBookingForCancel.priceBreakdown.basePricePerNight,
              selectedBookingForCancel.nights
            );

            return (
              <div className="space-y-5 text-xs">
                {/* Cancellation Policy Engine Evaluation Box */}
                <div
                  className={`p-4 rounded-xl border ${
                    refundCalc.isFullRefund
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {refundCalc.isFullRefund ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    )}
                    <span>
                      {refundCalc.isFullRefund
                        ? '100% Full Refund Eligible'
                        : '1-Night Cancellation Penalty Applied'}
                    </span>
                  </div>

                  <p className="leading-relaxed text-[11px] mb-2">
                    {refundCalc.isFullRefund
                      ? `Your cancellation request is being submitted more than 48 hours before check-in (at 00:00:00 on ${selectedBookingForCancel.checkIn}). You are entitled to an immediate 100% refund.`
                      : `Your check-in is within 48 hours. Per hotel policy, a 1-night penalty of ${formatCurrency(refundCalc.penaltyAmount)} is withheld, and the remainder is refunded.`}
                  </p>

                  <div className="pt-2 border-t border-current/20 flex justify-between font-mono font-bold text-sm">
                    <span>Refund Amount back to card:</span>
                    <span>{formatCurrency(refundCalc.refundAmount)}</span>
                  </div>
                </div>

                {/* Reason Selection */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-foreground">
                    Reason for Cancellation
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground cursor-pointer text-xs"
                  >
                    <option value="Change in personal travel plans">Change in personal travel plans</option>
                    <option value="Emergency medical or family reason">Emergency medical or family reason</option>
                    <option value="Flight delay or transit alteration">Flight delay or transit alteration</option>
                    <option value="Found alternative accommodation">Found alternative accommodation</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    onClick={() => setSelectedBookingForCancel(null)}
                    variant="outline"
                    size="sm"
                  >
                    Keep My Stay
                  </Button>

                  <Button
                    onClick={handleConfirmCancellation}
                    variant="destructive"
                    size="sm"
                    isLoading={isCancelling}
                  >
                    Confirm Cancellation & Refund
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Modal 3: Verified Post-Stay Review Submission */}
      {selectedBookingForReview && (
        <Modal
          isOpen={!!selectedBookingForReview}
          onClose={() => setSelectedBookingForReview(null)}
          title={`Verified Stay Review — ${selectedBookingForReview.hotelName}`}
          description={`Submit authentic feedback for your completed stay in the ${selectedBookingForReview.roomTypeName}.`}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmReview} className="space-y-4 text-xs">
            {/* Overall Rating Star Picker */}
            <div className="space-y-1">
              <label className="block font-semibold text-foreground">Overall Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 hover:scale-110 transition-transform text-amber-500"
                  >
                    <Star
                      size={24}
                      className={
                        star <= reviewRating
                          ? 'fill-amber-400 stroke-amber-500'
                          : 'fill-transparent stroke-muted-foreground/40'
                      }
                    />
                  </button>
                ))}
                <span className="font-mono font-bold ml-2 text-sm text-foreground">
                  {reviewRating} of 5 Stars
                </span>
              </div>
            </div>

            {/* Sub-Category Ratings */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Cleanliness & Hygiene:</span>
                <select
                  value={cleanlinessScore}
                  onChange={(e) => setCleanlinessScore(Number(e.target.value))}
                  className="w-full h-8 px-2 rounded bg-background border border-border text-xs"
                >
                  <option value={5}>5 - Spotless</option>
                  <option value={4}>4 - Very Clean</option>
                  <option value={3}>3 - Acceptable</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Staff & Hospitality:</span>
                <select
                  value={staffScore}
                  onChange={(e) => setStaffScore(Number(e.target.value))}
                  className="w-full h-8 px-2 rounded bg-background border border-border text-xs"
                >
                  <option value={5}>5 - Outstanding</option>
                  <option value={4}>4 - Polite & Prompt</option>
                  <option value={3}>3 - Average</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Room Comfort & Bed:</span>
                <select
                  value={comfortScore}
                  onChange={(e) => setComfortScore(Number(e.target.value))}
                  className="w-full h-8 px-2 rounded bg-background border border-border text-xs"
                >
                  <option value={5}>5 - Luxurious Rest</option>
                  <option value={4}>4 - Comfortable</option>
                  <option value={3}>3 - Adequate</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-foreground">Value for Investment:</span>
                <select
                  value={valueScore}
                  onChange={(e) => setValueScore(Number(e.target.value))}
                  className="w-full h-8 px-2 rounded bg-background border border-border text-xs"
                >
                  <option value={5}>5 - Excellent Value</option>
                  <option value={4}>4 - Worth Price</option>
                  <option value={3}>3 - Fair</option>
                </select>
              </div>
            </div>

            {/* Review Headline */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Review Headline *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Unparalleled hospitality and breathtaking sea vistas"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Review Comment */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Your Detailed Stay Feedback *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe your check-in experience, room acoustics, breakfast buffet, and service highlights..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setSelectedBookingForReview(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                isLoading={isSubmittingReview}
                className="font-semibold"
              >
                Publish Verified Review
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
