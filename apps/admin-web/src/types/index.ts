export type UserRole = 'CUSTOMER' | 'MANAGER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
}

export interface AuthLoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; reason?: string }>;
  };
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
  totalBookings?: number;
  totalSpent?: number;
  assignedHotelIds?: string[];
  suspensionReason?: string;
}

export type HotelStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'DELISTED';

export interface AdminHotel {
  id: string;
  name: string;
  brand?: string;
  description: string;
  city: string;
  state: string;
  country: string;
  address: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  starRating: number;
  amenities: string[];
  images: string[];
  status: HotelStatus;
  totalRooms: number;
  occupancyRate: number;
  monthlyRevenue: number;
  managerCount: number;
  createdAt: string;
  cancellationPolicy: string;
  basePrice: number;
}

export type ManagerAssignmentRole = 'GENERAL_MANAGER' | 'OPERATIONS_DIRECTOR' | 'FRONT_DESK_LEAD';

export interface ManagerAssignment {
  id: string;
  managerId: string;
  managerName: string;
  managerEmail: string;
  hotelId: string;
  hotelName: string;
  role: ManagerAssignmentRole;
  assignedAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

export type PaymentMethod = 'CREDIT_CARD' | 'UPI' | 'NET_BANKING' | 'DEBIT_CARD';
export type TransactionStatus = 'SETTLED' | 'PENDING' | 'REFUNDED' | 'DISPUTED' | 'FAILED';

export interface PlatformTransaction {
  id: string; // e.g. TXN-8849-01
  bookingId: string; // e.g. BK-2026-9041
  guestName: string;
  guestEmail: string;
  hotelId: string;
  hotelName: string;
  grossAmount: number;
  commissionRate: number; // e.g. 0.12 (12%)
  platformFee: number;
  netPayout: number;
  paymentGateway: 'RAZORPAY' | 'STRIPE' | 'MOCK_GATEWAY';
  gatewayRef: string;
  method: PaymentMethod;
  status: TransactionStatus;
  createdAt: string;
  settledAt?: string;
}

export type DisputeStatus = 'PENDING_ADMIN_REVIEW' | 'APPROVED_FULL' | 'APPROVED_PARTIAL' | 'REJECTED';

export interface RefundDispute {
  id: string; // e.g. REF-4091
  bookingId: string;
  guestName: string;
  guestEmail: string;
  hotelId: string;
  hotelName: string;
  bookingTotal: number;
  requestedRefundAmount: number;
  cancellationPolicy: string;
  reason: string;
  guestStatement: string;
  hotelStatement?: string;
  disputeStatus: DisputeStatus;
  adminOverrideReason?: string;
  approvedRefundAmount?: number;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type ModerationStatus = 'PUBLISHED' | 'FLAGGED' | 'HIDDEN' | 'UNDER_REVIEW';

export interface AdminReview {
  id: string;
  bookingId: string;
  hotelId: string;
  hotelName: string;
  guestName: string;
  guestEmail: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  sentiment: SentimentType;
  isPublished: boolean;
  flagged: boolean;
  flagReason?: string;
  moderationStatus: ModerationStatus;
  stayDate: string;
  createdAt: string;
}

export interface PlatformSettings {
  commissionPercentage: number;
  cancellationGraceHours: number;
  inventoryHoldTimeoutMinutes: number;
  defaultCurrency: string;
  taxPercentage: number;
  maintenanceMode: boolean;
  requireAdminHotelApproval: boolean;
  autoRefundThreshold: number;
  activePaymentGateway: 'RAZORPAY' | 'STRIPE' | 'MOCK_GATEWAY';
}

export interface AuditEvent {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AdminKPISummary {
  grossMerchandiseValue: number;
  gmvGrowthPercent: number;
  platformNetRevenue: number;
  revenueGrowthPercent: number;
  totalActiveBookings: number;
  bookingsGrowthPercent: number;
  averageOccupancyRate: number;
  occupancyGrowthPercent: number;
  totalProperties: number;
  pendingPropertyApprovals: number;
  totalUsers: number;
  activeDisputesCount: number;
  pendingReviewFlagsCount: number;
  systemHealthScore: number;
}

export type AdminTab =
  | 'dashboard'
  | 'users'
  | 'properties'
  | 'managers'
  | 'ledger'
  | 'refunds'
  | 'reviews'
  | 'settings';
