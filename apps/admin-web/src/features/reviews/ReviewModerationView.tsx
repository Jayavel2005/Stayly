import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  Star,
  Building2,
  Calendar,
  AlertTriangle,
  EyeOff,
  Eye,
  Flag,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { AdminReview, ModerationStatus } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, formatDateTime } from '../../lib/utils';

export const ReviewModerationView: React.FC = () => {
  const { reviews, moderateReview } = useAdminStore();

  const [statusFilter, setStatusFilter] = useState<'ALL' | ModerationStatus>('ALL');
  const [starFilter, setStarFilter] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.hotelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.comment.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || r.moderationStatus === statusFilter;
    const matchesStar = starFilter === 'ALL' || r.rating === starFilter;

    return matchesSearch && matchesStatus && matchesStar;
  });

  const flaggedCount = reviews.filter((r) => r.moderationStatus === 'FLAGGED').length;

  const handleHideReview = (review: AdminReview) => {
    moderateReview(review.id, 'HIDDEN', false);
    toast.error(`Review ${review.id} hidden from public guest discovery.`);
  };

  const handlePublishReview = (review: AdminReview) => {
    moderateReview(review.id, 'PUBLISHED', true);
    toast.success(`Review ${review.id} published and verified.`);
  };

  const handleFlagReview = (review: AdminReview) => {
    moderateReview(review.id, 'FLAGGED', false);
    toast.warning(`Review ${review.id} marked as FLAGGED for content audit.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Content & Review Moderation (PATCH /api/v1/admin/reviews/:id/moderate)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit post-stay verified guest reviews, suppress toxic profanity, and prevent competitor sabotage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded-lg">
            Flagged for Moderation: <strong className="font-mono">{flaggedCount}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search review content, hotel, guest..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter size={14} />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Reviews ({reviews.length})</option>
              <option value="FLAGGED">Flagged for Audit ({flaggedCount})</option>
              <option value="PUBLISHED">Published Live</option>
              <option value="HIDDEN">Hidden / Suppressed</option>
            </select>
          </div>

          {/* Star Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span>Rating:</span>
            <select
              value={starFilter}
              onChange={(e) => setStarFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Stars</option>
              <option value={5}>★★★★★ (5 Stars)</option>
              <option value={4}>★★★★ (4 Stars)</option>
              <option value={3}>★★★ (3 Stars)</option>
              <option value={2}>★★ (2 Stars)</option>
              <option value={1}>★ (1 Star)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Cards List */}
      {filteredReviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews match your filters"
          description="Try selecting a different rating or moderation status."
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className={`bg-card text-card-foreground border rounded-xl p-5 shadow-card transition-all ${
                rev.moderationStatus === 'FLAGGED'
                  ? 'border-amber-400/80 bg-amber-500/5'
                  : rev.moderationStatus === 'HIDDEN'
                  ? 'border-red-400/60 opacity-80'
                  : 'border-border'
              }`}
            >
              {/* Review Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={15}
                        className={star <= rev.rating ? 'fill-amber-400' : 'text-muted-foreground/30'}
                      />
                    ))}
                  </div>
                  <h3 className="font-bold text-foreground text-sm leading-none">{rev.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={rev.moderationStatus} size="sm" />
                </div>
              </div>

              {/* Review Card Body */}
              <div className="py-4 space-y-3 text-xs">
                {/* Flag Alert Banner */}
                {rev.flagged && rev.flagReason && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Automated / Manual Flag: </span>
                      <span>{rev.flagReason}</span>
                    </div>
                  </div>
                )}

                <p className="text-foreground/90 text-sm leading-relaxed font-sans">{rev.comment}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Building2 size={13} className="text-primary" />
                    <span>{rev.hotelName}</span>
                  </span>
                  <span>•</span>
                  <span>Guest: <strong className="text-foreground">{rev.guestName}</strong> ({rev.guestEmail})</span>
                  <span>•</span>
                  <span>Stay Date: {formatDate(rev.stayDate)}</span>
                  <span>•</span>
                  <span className="font-mono">Ref: {rev.bookingId}</span>
                </div>
              </div>

              {/* Moderation Actions Bar */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Submitted {formatDateTime(rev.createdAt)}
                </span>

                <div className="flex items-center gap-2">
                  {rev.moderationStatus !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => handlePublishReview(rev)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={13} />
                      <span>Publish Review</span>
                    </button>
                  )}

                  {rev.moderationStatus !== 'HIDDEN' && (
                    <button
                      type="button"
                      onClick={() => handleHideReview(rev)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors flex items-center gap-1"
                    >
                      <EyeOff size={13} />
                      <span>Hide (Violates Terms)</span>
                    </button>
                  )}

                  {rev.moderationStatus === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => handleFlagReview(rev)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Flag size={13} />
                      <span>Flag for Audit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
