import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Share2,
  Bookmark,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Info,
  Images,
  Star,
  Check,
} from 'lucide-react';
import { Hotel, RoomType, SearchFilterState } from '../../types';
import { calculatePriceBreakdown, formatDateRange } from '../../lib/utils';
import { HotelRating } from '../../components/ui/HotelRating';
import { RoomCard } from './RoomCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

interface HotelDetailPageProps {
  hotel: Hotel;
  filters: SearchFilterState;
  onBack: () => void;
  onSelectRoomToReserve: (roomType: RoomType) => void;
  onChangeDates: () => void;
}

export const HotelDetailPage: React.FC<HotelDetailPageProps> = ({
  hotel,
  filters,
  onBack,
  onSelectRoomToReserve,
  onChangeDates,
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'amenities' | 'reviews' | 'policies'>('rooms');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Sanctuaries</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            leftIcon={copiedLink ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
            className="text-xs"
          >
            {copiedLink ? 'Link Copied' : 'Share'}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Bookmark size={14} />} className="text-xs">
            Save
          </Button>
        </div>
      </div>

      {/* Editorial Header Section per Design System lines 270-290 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {hotel.starRating} Star Luxury Sanctuary
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-medium">{hotel.city}, {hotel.state}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif text-foreground tracking-tight">
            {hotel.name}
          </h1>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <MapPin size={15} className="text-primary shrink-0" />
              <span>{hotel.address}</span>
            </div>
            <span>•</span>
            <span>{hotel.nearbyAttraction}</span>
          </div>
        </div>

        {/* Ratings pill */}
        <div className="shrink-0 self-start md:self-end">
          <HotelRating
            score={hotel.averageRating}
            totalReviews={hotel.totalReviews}
            starClass={hotel.starRating}
            size="lg"
          />
        </div>
      </div>

      {/* Photo Gallery Grid Layout */}
      <div className="relative rounded-2xl overflow-hidden shadow-md border border-border">
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 h-[340px] sm:h-[420px] md:h-[480px]">
          {/* Main Hero Photo (Spans 2 cols, 2 rows) */}
          <div
            onClick={() => {
              setSelectedPhotoIndex(0);
              setGalleryOpen(true);
            }}
            className="md:col-span-2 md:row-span-2 relative cursor-pointer overflow-hidden bg-muted group"
          >
            <img
              src={hotel.images[0] || hotel.heroImage}
              alt={hotel.name}
              className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-300"
            />
          </div>

          {/* 4 Supporting Thumbnails */}
          {hotel.images.slice(1, 5).map((img, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSelectedPhotoIndex(idx + 1);
                setGalleryOpen(true);
              }}
              className="hidden md:block relative cursor-pointer overflow-hidden bg-muted group"
            >
              <img
                src={img}
                alt={`${hotel.name} view ${idx + 2}`}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>

        {/* View All Photos Trigger */}
        <button
          onClick={() => {
            setSelectedPhotoIndex(0);
            setGalleryOpen(true);
          }}
          className="absolute bottom-4 right-4 px-3.5 py-2 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-semibold backdrop-blur-md flex items-center gap-2 shadow-lg transition-colors"
        >
          <Images size={15} />
          <span>View all {hotel.images.length} photos</span>
        </button>
      </div>

      {/* Stay Parameters Banner & Date Changer */}
      <div className="rounded-xl border border-border bg-secondary/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Calendar size={18} className="stroke-[2]" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-muted-foreground font-mono">
              Your Reservation Interval
            </div>
            <div className="text-sm font-bold text-foreground">
              {formatDateRange(filters.checkIn, filters.checkOut)} ({calculatePriceBreakdown(100, filters.checkIn, filters.checkOut).nights} nights)
              {' • '}
              {filters.adults + filters.children} Guests, {filters.rooms} Room
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onChangeDates}
          className="text-xs font-semibold bg-background shrink-0"
        >
          Change Stay Dates
        </Button>
      </div>

      {/* Quick Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'rooms'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Accommodations & Rates ({hotel.roomTypes.length})
        </button>

        <button
          onClick={() => setActiveTab('amenities')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'amenities'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sanctuary Amenities
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'reviews'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Verified Guest Reviews ({hotel.reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'policies'
              ? 'text-primary border-b-2 border-primary font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Policies & Arrival
        </button>
      </div>

      {/* Tab 1: Available Room Types */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-serif text-foreground">
              Available Room Suites & Categories
            </h2>
            <p className="text-xs text-muted-foreground">
              All reservations feature guaranteed atomic room holds with transparent taxes & flexible cancellation.
            </p>
          </div>

          <div className="space-y-6">
            {hotel.roomTypes.map((room) => {
              const breakdown = calculatePriceBreakdown(room.basePrice, filters.checkIn, filters.checkOut);
              return (
                <RoomCard
                  key={room.id}
                  roomType={room}
                  priceBreakdown={breakdown}
                  checkIn={filters.checkIn}
                  checkOut={filters.checkOut}
                  onReserve={onSelectRoomToReserve}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Amenities */}
      {activeTab === 'amenities' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-serif text-foreground">
              Property Features & Guest Privileges
            </h2>
            <p className="text-xs text-muted-foreground">
              Immerse yourself in world-class amenities curated for deep rest, wellbeing, and effortless hospitality.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {hotel.amenities.map((amenity) => (
              <div
                key={amenity}
                className="p-4 rounded-xl border border-border bg-card flex items-center gap-3"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Sparkles size={16} />
                </div>
                <span className="text-sm font-semibold text-foreground">{amenity}</span>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-xl border border-border bg-card/60 space-y-3">
            <h3 className="text-sm font-bold text-foreground">About {hotel.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hotel.description}
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Verified Guest Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-8">
          {/* Review Score Breakdown */}
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 text-center md:text-left border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-6">
                <div className="text-4xl font-extrabold font-mono text-foreground tabular-nums">
                  {hotel.averageRating.toFixed(2)}
                </div>
                <div className="text-sm font-bold text-foreground mt-1">
                  Exceptional Guest Experience
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Based on {hotel.totalReviews} verified post-stay reviews
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-md">
                  <ShieldCheck size={14} />
                  <span>100% Verified Stays Only</span>
                </div>
              </div>

              {/* Category Breakdown Bars */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                {[
                  { label: 'Cleanliness & Hygiene', score: 4.9 },
                  { label: 'Staff & Hospitality', score: 4.95 },
                  { label: 'Room Comfort & Bedding', score: 4.88 },
                  { label: 'Facilities & Spa', score: 4.82 },
                  { label: 'Location & Scenic Views', score: 4.92 },
                  { label: 'Value for Investment', score: 4.75 },
                ].map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground">{cat.label}</span>
                      <span className="font-mono text-muted-foreground">{cat.score} / 5</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(cat.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Individual Reviews List */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-serif text-foreground">
              Recent Verified Reviews
            </h3>

            {hotel.reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                No verified reviews submitted yet. Completed guests may submit a post-stay review.
              </div>
            ) : (
              hotel.reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-5 sm:p-6 rounded-xl border border-border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {review.customerName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          <CheckCircle2 size={11} /> Verified Stay
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Stayed in {review.roomTypeName} • {review.stayDate}
                      </div>
                    </div>

                    {/* Star Score */}
                    <div className="flex items-center text-amber-500 gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          className={
                            i < review.rating
                              ? 'fill-amber-400 stroke-amber-500'
                              : 'fill-transparent stroke-muted-foreground/40'
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-foreground">
                    "{review.title}"
                  </h4>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Policies & Arrival */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h3 className="text-base font-bold font-serif text-foreground">
              Stayora Property Policies & Operational Timing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  <span>Check-In Schedule</span>
                </div>
                <p className="text-muted-foreground">From {hotel.checkInTime} onwards. Early check-in subject to inventory availability.</p>
              </div>

              <div className="p-4 rounded-lg bg-secondary/50 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  <span>Check-Out Schedule</span>
                </div>
                <p className="text-muted-foreground">Until {hotel.checkOutTime}. Late check-out may be coordinated with front desk.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Info size={14} className="text-primary" />
                <span>48-Hour Free Cancellation Policy Engine</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Guests may cancel up to 48 hours prior to check-in (at 00:00:00 on the check-in date) for a full 100% refund.
                Cancellations within 48 hours incur a 1-night cancellation penalty with the remaining amount automatically refunded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      <Modal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={`${hotel.name} — Photography`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="relative aspect-[16/10] bg-black rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={hotel.images[selectedPhotoIndex] || hotel.heroImage}
              alt="Selected hotel photo"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Thumbnails strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {hotel.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedPhotoIndex(i)}
                className={`relative w-20 h-14 rounded-md overflow-hidden shrink-0 border-2 transition-all ${
                  selectedPhotoIndex === i ? 'border-primary scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
