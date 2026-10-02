import { create } from 'zustand';
import {
  AdminTab,
  AdminUser,
  AdminHotel,
  ManagerAssignment,
  PlatformTransaction,
  RefundDispute,
  AdminReview,
  PlatformSettings,
  AuditEvent,
  UserRole,
  UserStatus,
  HotelStatus,
  DisputeStatus,
  ModerationStatus,
  ManagerAssignmentRole,
} from '../types';
import {
  initialUsers,
  initialHotels,
  initialManagerAssignments,
  initialTransactions,
  initialRefundDisputes,
  initialReviews,
  initialPlatformSettings,
  initialAuditEvents,
  initialKPISummary,
} from '../data/mockAdminData';

interface AdminState {
  // Navigation & Theme
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isQuickSearchOpen: boolean;
  setQuickSearchOpen: (open: boolean) => void;
  isOnboardHotelModalOpen: boolean;
  setOnboardHotelModalOpen: (open: boolean) => void;

  // Selected Entities for Inspect Drawers / Modals
  selectedUser: AdminUser | null;
  setSelectedUser: (user: AdminUser | null) => void;
  selectedHotel: AdminHotel | null;
  setSelectedHotel: (hotel: AdminHotel | null) => void;
  selectedTransaction: PlatformTransaction | null;
  setSelectedTransaction: (txn: PlatformTransaction | null) => void;
  selectedDispute: RefundDispute | null;
  setSelectedDispute: (dispute: RefundDispute | null) => void;

  // Domain Data Collections
  users: AdminUser[];
  hotels: AdminHotel[];
  managerAssignments: ManagerAssignment[];
  transactions: PlatformTransaction[];
  disputes: RefundDispute[];
  reviews: AdminReview[];
  settings: PlatformSettings;
  auditEvents: AuditEvent[];

  // User Actions
  updateUserRole: (userId: string, newRole: UserRole) => void;
  updateUserStatus: (userId: string, newStatus: UserStatus, reason?: string) => void;

  // Hotel Actions
  addOnboardedHotel: (hotel: Omit<AdminHotel, 'id' | 'createdAt' | 'occupancyRate' | 'monthlyRevenue' | 'managerCount'>) => void;
  updateHotelStatus: (hotelId: string, status: HotelStatus) => void;

  // Manager Assignment Actions
  assignManager: (managerId: string, hotelId: string, role: ManagerAssignmentRole) => void;
  revokeManagerAssignment: (assignmentId: string) => void;

  // Dispute Actions
  resolveDispute: (
    disputeId: string,
    status: DisputeStatus,
    overrideReason: string,
    approvedAmount?: number
  ) => void;

  // Review Actions
  moderateReview: (reviewId: string, status: ModerationStatus, isPublished: boolean) => void;

  // Settings Actions
  updateSettings: (partial: Partial<PlatformSettings>) => void;

  // Audit Log Action
  logAuditEvent: (action: string, target: string, details: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;

  // Dynamic KPI Computed Getters
  getKPISummary: () => typeof initialKPISummary;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Navigation & Theme
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  theme: (localStorage.getItem('stayora-admin-theme') as 'light' | 'dark') || 'light',
  toggleTheme: () => {
    const currentTheme = get().theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('stayora-admin-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme: newTheme });
  },
  isQuickSearchOpen: false,
  setQuickSearchOpen: (open) => set({ isQuickSearchOpen: open }),
  isOnboardHotelModalOpen: false,
  setOnboardHotelModalOpen: (open) => set({ isOnboardHotelModalOpen: open }),

  // Selected Entities
  selectedUser: null,
  setSelectedUser: (user) => set({ selectedUser: user }),
  selectedHotel: null,
  setSelectedHotel: (hotel) => set({ selectedHotel: hotel }),
  selectedTransaction: null,
  setSelectedTransaction: (txn) => set({ selectedTransaction: txn }),
  selectedDispute: null,
  setSelectedDispute: (dispute) => set({ selectedDispute: dispute }),

  // Domain Collections
  users: initialUsers,
  hotels: initialHotels,
  managerAssignments: initialManagerAssignments,
  transactions: initialTransactions,
  disputes: initialRefundDisputes,
  reviews: initialReviews,
  settings: initialPlatformSettings,
  auditEvents: initialAuditEvents,

  // User Actions
  updateUserRole: (userId, newRole) => {
    const user = get().users.find((u) => u.id === userId);
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    }));
    get().logAuditEvent(
      'USER_ROLE_UPDATED',
      `${user?.name || userId} (${userId})`,
      `Role updated to ${newRole}. Action authorized by Superadmin.`
    );
  },

  updateUserStatus: (userId, newStatus, reason) => {
    const user = get().users.find((u) => u.id === userId);
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId
          ? {
              ...u,
              status: newStatus,
              suspensionReason: newStatus === 'SUSPENDED' ? reason : undefined,
            }
          : u
      ),
    }));
    get().logAuditEvent(
      newStatus === 'SUSPENDED' ? 'USER_ACCOUNT_SUSPENDED' : 'USER_ACCOUNT_ACTIVATED',
      `${user?.name || userId} (${userId})`,
      `Status mutated to ${newStatus}.${reason ? ` Reason: ${reason}` : ''}`,
      newStatus === 'SUSPENDED' ? 'CRITICAL' : 'INFO'
    );
  },

  // Hotel Actions
  addOnboardedHotel: (hotelInput) => {
    const newId = `HTL-${String(get().hotels.length + 1).padStart(3, '0')}`;
    const newHotel: AdminHotel = {
      ...hotelInput,
      id: newId,
      createdAt: new Date().toISOString(),
      occupancyRate: 0,
      monthlyRevenue: 0,
      managerCount: 0,
    };
    set((state) => ({
      hotels: [newHotel, ...state.hotels],
    }));
    get().logAuditEvent(
      'HOTEL_LISTING_ONBOARDED',
      `${newHotel.name} (${newId})`,
      `New hotel property submitted by Platform Admin in ${newHotel.city}. Status: ${newHotel.status}.`
    );
  },

  updateHotelStatus: (hotelId, status) => {
    const hotel = get().hotels.find((h) => h.id === hotelId);
    set((state) => ({
      hotels: state.hotels.map((h) => (h.id === hotelId ? { ...h, status } : h)),
    }));
    get().logAuditEvent(
      'HOTEL_STATUS_MUTATED',
      `${hotel?.name || hotelId} (${hotelId})`,
      `Listing status altered to ${status}.`
    );
  },

  // Manager Assignment Actions
  assignManager: (managerId, hotelId, role) => {
    const manager = get().users.find((u) => u.id === managerId);
    const hotel = get().hotels.find((h) => h.id === hotelId);
    if (!manager || !hotel) return;

    const newAssignment: ManagerAssignment = {
      id: `ASN-${String(get().managerAssignments.length + 1).padStart(3, '0')}`,
      managerId,
      managerName: manager.name,
      managerEmail: manager.email,
      hotelId,
      hotelName: hotel.name,
      role,
      assignedAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    set((state) => ({
      managerAssignments: [newAssignment, ...state.managerAssignments],
      hotels: state.hotels.map((h) =>
        h.id === hotelId ? { ...h, managerCount: h.managerCount + 1 } : h
      ),
      users: state.users.map((u) =>
        u.id === managerId
          ? { ...u, assignedHotelIds: [...(u.assignedHotelIds || []), hotelId] }
          : u
      ),
    }));

    get().logAuditEvent(
      'MANAGER_ASSIGNED_TO_HOTEL',
      `${manager.name} -> ${hotel.name}`,
      `Assigned as ${role}. Property scoping permissions granted.`
    );
  },

  revokeManagerAssignment: (assignmentId) => {
    const assignment = get().managerAssignments.find((a) => a.id === assignmentId);
    if (!assignment) return;

    set((state) => ({
      managerAssignments: state.managerAssignments.filter((a) => a.id !== assignmentId),
      hotels: state.hotels.map((h) =>
        h.id === assignment.hotelId ? { ...h, managerCount: Math.max(0, h.managerCount - 1) } : h
      ),
      users: state.users.map((u) =>
        u.id === assignment.managerId
          ? {
              ...u,
              assignedHotelIds: (u.assignedHotelIds || []).filter((id) => id !== assignment.hotelId),
            }
          : u
      ),
    }));

    get().logAuditEvent(
      'MANAGER_ASSIGNMENT_REVOKED',
      `${assignment.managerName} -> ${assignment.hotelName}`,
      `De-allocated operational credentials for property ${assignment.hotelId}.`,
      'WARNING'
    );
  },

  // Dispute Actions
  resolveDispute: (disputeId, status, overrideReason, approvedAmount) => {
    const dispute = get().disputes.find((d) => d.id === disputeId);
    if (!dispute) return;

    set((state) => ({
      disputes: state.disputes.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              disputeStatus: status,
              adminOverrideReason: overrideReason,
              approvedRefundAmount: approvedAmount,
              reviewedAt: new Date().toISOString(),
              reviewedBy: 'Devansh Mehta (Admin)',
            }
          : d
      ),
    }));

    get().logAuditEvent(
      'DISPUTE_ARBITRATION_RESOLVED',
      `${dispute.id} (${dispute.bookingId})`,
      `Resolution: ${status}.${approvedAmount ? ` Approved Refund: ₹${approvedAmount}.` : ''} Note: ${overrideReason}`,
      status === 'APPROVED_FULL' ? 'CRITICAL' : 'INFO'
    );
  },

  // Review Actions
  moderateReview: (reviewId, status, isPublished) => {
    const review = get().reviews.find((r) => r.id === reviewId);
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              moderationStatus: status,
              isPublished,
              flagged: status === 'FLAGGED',
            }
          : r
      ),
    }));

    get().logAuditEvent(
      'REVIEW_MODERATION_ACTION',
      `${reviewId} (${review?.hotelName})`,
      `Review status set to ${status}, isPublished=${isPublished}.`
    );
  },

  // Settings Actions
  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
    get().logAuditEvent(
      'PLATFORM_SETTINGS_UPDATED',
      'System Configuration',
      `Parameters updated: ${Object.keys(partial).join(', ')}.`
    );
  },

  // Audit Log Action
  logAuditEvent: (action, target, details, severity = 'INFO') => {
    const newEvent: AuditEvent = {
      id: `EVT-${Date.now().toString().slice(-6)}`,
      actor: 'Devansh Mehta',
      actorRole: 'ADMIN',
      action,
      target,
      details,
      ipAddress: '103.21.244.12',
      timestamp: new Date().toISOString(),
      severity,
    };
    set((state) => ({
      auditEvents: [newEvent, ...state.auditEvents],
    }));
  },

  // Computed KPIs
  getKPISummary: () => {
    const { hotels, users, transactions, disputes, reviews } = get();
    const totalProperties = hotels.length;
    const pendingPropertyApprovals = hotels.filter((h) => h.status === 'PENDING_APPROVAL').length;
    const activeHotels = hotels.filter((h) => h.status === 'ACTIVE');
    const averageOccupancyRate =
      activeHotels.length > 0
        ? Math.round(
            activeHotels.reduce((sum, h) => sum + h.occupancyRate, 0) / activeHotels.length
          )
        : 85;

    const settledTxns = transactions.filter((t) => t.status === 'SETTLED');
    const grossMerchandiseValue = settledTxns.reduce((sum, t) => sum + t.grossAmount, 0) + 28200000;
    const platformNetRevenue = Math.round(grossMerchandiseValue * 0.12);

    const activeDisputesCount = disputes.filter((d) => d.disputeStatus === 'PENDING_ADMIN_REVIEW').length;
    const pendingReviewFlagsCount = reviews.filter((r) => r.moderationStatus === 'FLAGGED').length;

    return {
      grossMerchandiseValue,
      gmvGrowthPercent: 18.4,
      platformNetRevenue,
      revenueGrowthPercent: 18.4,
      totalActiveBookings: 184,
      bookingsGrowthPercent: 12.8,
      averageOccupancyRate,
      occupancyGrowthPercent: 4.2,
      totalProperties,
      pendingPropertyApprovals,
      totalUsers: users.length,
      activeDisputesCount,
      pendingReviewFlagsCount,
      systemHealthScore: 99.98,
    };
  },
}));
