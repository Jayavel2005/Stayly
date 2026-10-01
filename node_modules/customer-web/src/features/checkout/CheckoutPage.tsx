import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  Calendar,
  Users,
  MapPin,
  Clock,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Booking, Hotel, RoomType } from '../../types';
import { formatCurrency, formatDateRange, generateIdempotencyKey } from '../../lib/utils';
import { Button } from '../../components/ui/Button';

interface CheckoutPageProps {
  bookingHold: Booking;
  hotel: Hotel;
  roomType: RoomType;
  onBack: () => void;
  onCompletePayment: (paymentMethod: string, idempotencyKey: string) => Promise<void>;
  isProcessing: boolean;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  bookingHold,
  hotel,
  roomType,
  onBack,
  onCompletePayment,
  isProcessing,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(2); // Step 1 is review, Step 2 is guest info, Step 3 is payment

  // Guest details form state
  const [fullName, setFullName] = useState(bookingHold.guestInfo.fullName);
  const [email, setEmail] = useState(bookingHold.guestInfo.email);
  const [phone, setPhone] = useState(bookingHold.guestInfo.phone);
  const [specialRequests, setSpecialRequests] = useState(bookingHold.guestInfo.specialRequests || '');
  const [estimatedArrival, setEstimatedArrival] = useState('14:30');

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Payment method selection
  const [paymentType, setPaymentType] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [cardName, setCardName] = useState(fullName);
  const [upiId, setUpiId] = useState('ananya@okhdfcbank');

  const validateGuestInfo = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full guest name is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email address is required';
    if (!phone.trim() || phone.length < 8) errs.phone = 'Contact phone number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateGuestInfo()) {
      setCurrentStep(3);
    }
  };

  const handleExecutePayment = async () => {
    const idempotencyKey = generateIdempotencyKey();
    let methodDesc = '';
    if (paymentType === 'card') {
      methodDesc = `Visa Card (•••• ${cardNumber.slice(-4)})`;
    } else if (paymentType === 'upi') {
      methodDesc = `UPI (${upiId})`;
    } else {
      methodDesc = 'HDFC NetBanking';
    }

    await onCompletePayment(methodDesc, idempotencyKey);
  };

  const { priceBreakdown } = bookingHold;

  // Calculate 48h deadline date string
  const checkInDate = new Date(`${bookingHold.checkIn}T00:00:00`);
  const deadlineDate = new Date(checkInDate.getTime() - 48 * 60 * 60 * 1000);
  const cancellationDeadlineStr = deadlineDate.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Top Breadcrumb & Step Progression Bar per Design System line 553 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Hotel Overview</span>
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className={`flex items-center gap-1.5 ${currentStep >= 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
              1
            </span>
            <span>Review Stay</span>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
              2
            </span>
            <span>Guest Details</span>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
              3
            </span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left (7 cols), Sticky Folio Breakdown on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Steps */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 2: Guest Information Form */}
          {currentStep === 2 && (
            <form onSubmit={handleProceedToPayment} className="rounded-xl border border-border bg-card p-6 sm:p-7 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h2 className="text-xl font-bold font-serif text-foreground">
                    Primary Guest Information
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your reservation receipt and arrival coordinates will be dispatched here.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded font-semibold">
                  Autofilled
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Full Name (as per Passport / National ID) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {errors.fullName && <p className="text-[11px] text-destructive">{errors.fullName}</p>}
              </div>

              {/* Contact Grid: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Contact Phone Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                  {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
                </div>
              </div>

              {/* Estimated Arrival Schedule */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Estimated Arrival Time
                </label>
                <select
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                >
                  <option value="14:00">14:00 – 15:00 (Standard Check-in)</option>
                  <option value="15:00">15:00 – 18:00 (Afternoon Arrival)</option>
                  <option value="18:00">18:00 – 22:00 (Evening Arrival)</option>
                  <option value="late">After 22:00 (Late Night Arrival)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Front desk staff will hold your room regardless of arrival time.</p>
              </div>

              {/* Special Requests */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Special Requests & Dietary Preferences (Optional)
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                  placeholder="e.g., Quiet high-floor room away from elevators, feather pillows, airport pickup coordination..."
                  className="w-full p-3 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full font-semibold h-12 shadow-sm text-sm"
                rightIcon={<ArrowRight size={16} />}
              >
                Proceed to Payment Settlement
              </Button>
            </form>
          )}

          {/* Step 3: Payment Settlement Gateway */}
          {currentStep === 3 && (
            <div className="rounded-xl border border-border bg-card p-6 sm:p-7 space-y-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h2 className="text-xl font-bold font-serif text-foreground">
                    Secure Payment Settlement
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Authorized mock gateway provider with instant cryptographic settlement.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 text-xs font-semibold">
                  <Lock size={14} />
                  <span>256-Bit TLS</span>
                </div>
              </div>

              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-secondary/80 rounded-xl border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPaymentType('card')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    paymentType === 'card'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CreditCard size={15} />
                  <span>Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('upi')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    paymentType === 'upi'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <QrCode size={15} />
                  <span>Instant UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('netbanking')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    paymentType === 'netbanking'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building size={15} />
                  <span>Net Banking</span>
                </button>
              </div>

              {/* Credit Card Form Fields */}
              {paymentType === 'card' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <CreditCard size={18} className="absolute left-3 top-3 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-foreground">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-foreground">
                        Security CVV
                      </label>
                      <input
                        type="password"
                        value={cardCvv}
                        maxLength={4}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Name on Card
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* UPI Form */}
              {paymentType === 'upi' && (
                <div className="space-y-4 animate-fade-in p-4 rounded-lg bg-secondary/50 border border-border">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Virtual Payment Address (VPA / UPI ID)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@okhdfcbank"
                      className="w-full h-11 px-3.5 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A notification will be dispatched to your UPI application (Google Pay, PhonePe, Paytm) for instant 1-click authorization.
                  </p>
                </div>
              )}

              {/* NetBanking Form */}
              {paymentType === 'netbanking' && (
                <div className="space-y-4 animate-fade-in p-4 rounded-lg bg-secondary/50 border border-border text-xs">
                  <label className="block font-semibold text-foreground">Select Institution</label>
                  <select className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer">
                    <option>HDFC Bank (Instant Transfer)</option>
                    <option>ICICI Bank</option>
                    <option>State Bank of India (SBI)</option>
                    <option>Axis Bank</option>
                  </select>
                </div>
              )}

              {/* Security Safeguard Banner per Design System line 568 */}
              <div className="p-3.5 rounded-lg bg-secondary/60 border border-border/80 flex items-start gap-3 text-xs">
                <Lock size={16} className="text-primary shrink-0 mt-0.5" />
                <p className="text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Zero Risk Guarantee:</strong> All payment execution is verified using unique client idempotency keys, eliminating accidental double charges.
                </p>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setCurrentStep(2)}
                  className="w-1/3 text-xs"
                >
                  Edit Details
                </Button>

                <Button
                  type="button"
                  size="lg"
                  isLoading={isProcessing}
                  onClick={handleExecutePayment}
                  className="flex-1 font-semibold text-sm shadow-md h-12"
                >
                  Authorize Payment of {formatCurrency(priceBreakdown.grandTotal)}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Reservation Folio & Price Breakdown per Design System line 560 */}
        <div className="lg:col-span-5 sticky top-22 space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <h3 className="text-base font-bold font-serif text-foreground pb-3 border-b border-border">
              Reservation Summary
            </h3>

            {/* Hotel & Room Mini Card */}
            <div className="flex items-start gap-3.5">
              <div className="w-20 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                <img
                  src={hotel.heroImage}
                  alt={hotel.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground truncate">
                  {hotel.name}
                </h4>
                <div className="text-xs text-primary font-medium mt-0.5">
                  {roomType.name}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                  <MapPin size={11} className="shrink-0" />
                  {hotel.city}, {hotel.state}
                </div>
              </div>
            </div>

            {/* Stay Dates Box */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-secondary/50 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
                  Check-In
                </span>
                <span className="font-semibold text-foreground block mt-0.5">
                  {new Date(bookingHold.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[11px] text-muted-foreground">From {hotel.checkInTime}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
                  Check-Out
                </span>
                <span className="font-semibold text-foreground block mt-0.5">
                  {new Date(bookingHold.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[11px] text-muted-foreground">Until {hotel.checkOutTime}</span>
              </div>
            </div>

            {/* Transparent Price Table per Design System lines 561-566 */}
            <div className="space-y-2.5 pt-2 border-t border-border text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Room Rate ({priceBreakdown.nights} {priceBreakdown.nights === 1 ? 'night' : 'nights'} × {formatCurrency(priceBreakdown.basePricePerNight)})</span>
                <span className="font-mono text-foreground">{formatCurrency(priceBreakdown.roomTotal)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Hospitality GST (18%)</span>
                <span className="font-mono text-foreground">{formatCurrency(priceBreakdown.taxesAndGst)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Resort & Sanitization Fee</span>
                <span className="font-mono text-foreground">{formatCurrency(priceBreakdown.serviceFee)}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-foreground pt-3 border-t border-border items-baseline">
                <span>Total Due Now</span>
                <span className="font-mono text-xl text-primary font-extrabold tabular-nums">
                  {formatCurrency(priceBreakdown.grandTotal)}
                </span>
              </div>
            </div>

            {/* Cancellation Rule Trust Pill per Design System line 567 */}
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="shrink-0 stroke-[2.5]" />
                <span>Flexible Cancellation Guaranteed</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-normal">
                Free 100% cancellation before <strong>{cancellationDeadlineStr}</strong>. Non-refundable 1-night penalty after this date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
