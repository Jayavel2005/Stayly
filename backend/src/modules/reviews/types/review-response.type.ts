export interface ReviewerSummary {
  id: string;
  displayName: string;
}

export interface ReviewResponse {
  id: string;
  bookingId: string;
  hotelId: string;
  rating: number;
  title: string | null;
  comment: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  reviewer: ReviewerSummary;
}

export interface RatingDistribution {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
}

export interface ReviewRatingSummary {
  averageRating: number;
  reviewCount: number;
  ratingDistribution: RatingDistribution;
}

export interface PaginatedReviewsResponse {
  items: ReviewResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: ReviewRatingSummary;
}

export interface ReviewEligibilityResponse {
  eligible: boolean;
  bookingId: string;
  reason: string | null;
}
