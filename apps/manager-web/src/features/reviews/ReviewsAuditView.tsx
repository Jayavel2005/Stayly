import React, { useState, useMemo } from 'react';
import {
  Star,
  MessageSquare,
  ShieldCheck,
  Send,
  User,
  Calendar,
  CheckCircle,
  ThumbsUp,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { Review } from '../../types';
import { HotelRating } from '../../components/shared/HotelRating';
import { formatDate } from '../../lib/utils';
import { toast } from 'sonner';

export const ReviewsAuditView: React.FC = () => {
  const {
    currentHotelId,
    hotels,
    reviews,
    respondToReview,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const hotelReviews = useMemo(
    () => reviews.filter((r) => r.hotelId === currentHotelId),
    [reviews, currentHotelId]
  );

  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'ALL'>('ALL');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Overall Score Calculations
  const averageRating = useMemo(() => {
    if (hotelReviews.length === 0) return 5.0;
    const sum = hotelReviews.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / hotelReviews.length).toFixed(1));
  }, [hotelReviews]);

  const cleanlinessAvg = useMemo(() => {
    if (hotelReviews.length === 0) return 5.0;
    return (hotelReviews.reduce((acc, r) => acc + r.cleanlinessRating, 0) / hotelReviews.length).toFixed(1);
  }, [hotelReviews]);

  const serviceAvg = useMemo(() => {
    if (hotelReviews.length === 0) return 5.0;
    return (hotelReviews.reduce((acc, r) => acc + r.serviceRating, 0) / hotelReviews.length).toFixed(1);
  }, [hotelReviews]);

  const locationAvg = useMemo(() => {
    if (hotelReviews.length === 0) return 5.0;
    return (hotelReviews.reduce((acc, r) => acc + r.locationRating, 0) / hotelReviews.length).toFixed(1);
  }, [hotelReviews]);

  const filteredReviews = useMemo(() => {
    if (selectedRatingFilter === 'ALL') return hotelReviews;
    return hotelReviews.filter((r) => r.rating === selectedRatingFilter);
  }, [hotelReviews, selectedRatingFilter]);

  const handleSendReply = (reviewId: string) => {
    if (!replyText.trim()) {
      toast.error('Please type a response before submitting.');
      return;
    }

    respondToReview(reviewId, replyText.trim());
    toast.success('Official Manager Response Published!', {
      description: 'Your response is now publicly attached to this verified guest stay.',
    });
    setActiveReplyId(null);
    setReplyText('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
              Guest Feedback & Reputation Audit
            </h1>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Verified Stays Only
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Audit customer reviews strictly restricted to completed stays at {currentHotel.name}.
          </p>
        </div>
      </div>

      {/* 1. Scorecard Hero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Main Score */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-center items-center text-center">
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
            Overall Rating Score
          </span>
          <div className="text-4xl font-extrabold text-foreground font-serif my-1">
            {averageRating}
          </div>
          <HotelRating rating={averageRating} size="md" showCount={false} />
          <span className="text-xs text-muted-foreground mt-2">
            Based on <strong>{hotelReviews.length} verified stays</strong>
          </span>
        </div>

        {/* Cleanliness */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cleanliness & Sanitization
          </span>
          <div className="my-2">
            <span className="text-2xl font-bold text-foreground font-mono">{cleanlinessAvg}</span>
            <span className="text-xs text-muted-foreground"> / 5.0</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(Number(cleanlinessAvg) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Service */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Staff & Concierge Service
          </span>
          <div className="my-2">
            <span className="text-2xl font-bold text-foreground font-mono">{serviceAvg}</span>
            <span className="text-xs text-muted-foreground"> / 5.0</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(Number(serviceAvg) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Location */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Location & Accessibility
          </span>
          <div className="my-2">
            <span className="text-2xl font-bold text-foreground font-mono">{locationAvg}</span>
            <span className="text-xs text-muted-foreground"> / 5.0</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full"
              style={{ width: `${(Number(locationAvg) / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Rating Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Filter by:</span>
        <button
          type="button"
          onClick={() => setSelectedRatingFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            selectedRatingFilter === 'ALL'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground hover:bg-muted'
          }`}
        >
          All Stars ({hotelReviews.length})
        </button>
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = hotelReviews.filter((r) => r.rating === stars).length;
          return (
            <button
              key={stars}
              type="button"
              onClick={() => setSelectedRatingFilter(stars)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                selectedRatingFilter === stars
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <span>{stars} Stars</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 3. Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((rev) => (
          <div
            key={rev.id}
            className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-3.5 hover:border-brand-300 transition-colors"
          >
            {/* Top Row: Reviewer, Rating, Verified Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-300 flex items-center justify-center font-bold text-xs">
                  {rev.guestName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{rev.guestName}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                      <ShieldCheck size={10} />
                      Verified Stay
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Stayed in {rev.roomTypeName} • {formatDate(rev.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <HotelRating rating={rev.rating} size="sm" showCount={false} />
              </div>
            </div>

            {/* Review Title & Body */}
            <div>
              <h4 className="text-sm font-bold text-foreground mb-1">"{rev.title}"</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{rev.comment}</p>
            </div>

            {/* Micro Breakdown */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
              <span>
                Cleanliness: <strong className="text-foreground">{rev.cleanlinessRating}/5</strong>
              </span>
              <span>•</span>
              <span>
                Service: <strong className="text-foreground">{rev.serviceRating}/5</strong>
              </span>
              <span>•</span>
              <span>
                Location: <strong className="text-foreground">{rev.locationRating}/5</strong>
              </span>
            </div>

            {/* Existing Official Response if any */}
            {rev.managerResponse && (
              <div className="p-3.5 rounded-lg border border-brand-200/80 bg-brand-50/50 dark:bg-brand-950/20 dark:border-brand-900/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-primary" />
                    Official Hotel Management Response
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(rev.managerResponse.respondedAt)}
                  </span>
                </div>
                <p className="text-foreground text-xs leading-relaxed italic">
                  "{rev.managerResponse.responseText}"
                </p>
                <span className="text-[10px] text-muted-foreground font-semibold block">
                  — {rev.managerResponse.managerName}
                </span>
              </div>
            )}

            {/* Manager Response Form (if no response yet) */}
            {!rev.managerResponse && (
              <div className="pt-2 border-t border-border">
                {activeReplyId === rev.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-foreground">
                      Compose Official Response as General Manager:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Thank the guest, acknowledge their praise or resolve concerns with polite hospitality..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyId(null);
                          setReplyText('');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendReply(rev.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 text-xs font-semibold shadow-subtle"
                      >
                        <Send size={12} />
                        <span>Publish Response</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReplyId(rev.id);
                      setReplyText('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                  >
                    <MessageSquare size={13} />
                    <span>Post Official Response as Hotel Manager</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
