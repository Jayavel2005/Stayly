import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  UserCheck,
  Building2,
  Calendar,
  IndianRupee,
  MoreHorizontal,
  Eye,
  AlertTriangle,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { AdminUser, UserRole, UserStatus } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { SafetyDialog } from '../../components/shared/SafetyDialog';
import { Modal } from '../../components/shared/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, formatDateTime } from '../../lib/utils';

export const UserDirectoryView: React.FC = () => {
  const { users, hotels, updateUserRole, updateUserStatus } = useAdminStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [inspectUser, setInspectUser] = useState<AdminUser | null>(null);

  // Safety Dialog state for suspending accounts (Destructive Guardrail per Design System Section 38)
  const [suspendingUser, setSuspendingUser] = useState<AdminUser | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('Terms of Service Violation');

  // Role Mutation Modal state
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('CUSTOMER');

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleConfirmSuspension = () => {
    if (!suspendingUser) return;
    updateUserStatus(suspendingUser.id, 'SUSPENDED', suspensionReason);
    toast.error(`Account ${suspendingUser.name} has been suspended.`);
    setSuspendingUser(null);
  };

  const handleReactivate = (user: AdminUser) => {
    updateUserStatus(user.id, 'ACTIVE');
    toast.success(`Account ${user.name} restored to ACTIVE status.`);
  };

  const handleUpdateRole = () => {
    if (!roleModalUser) return;
    updateUserRole(roleModalUser.id, selectedNewRole);
    toast.success(`User ${roleModalUser.name} permissions updated to ${selectedNewRole}.`);
    setRoleModalUser(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            User Lifecycle & Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global directory of Customers, Hotel Managers, and System Administrators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-muted rounded-lg text-muted-foreground">
            Total Accounts: <strong className="text-foreground">{users.length}</strong>
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
            placeholder="Search by name, email, phone, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter size={14} />
            <span>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Roles</option>
              <option value="CUSTOMER">Travelers (Customers)</option>
              <option value="MANAGER">Hotel Managers</option>
              <option value="ADMIN">Super Admins</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Directory Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users match your criteria"
          description="Try broadening your search term or clearing the active role/status filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setRoleFilter('ALL');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">User & Contact</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Context / Spend</th>
                  <th className="px-5 py-3">Registered</th>
                  <th className="px-5 py-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    {/* User & Contact */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
                        />
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            <span>{user.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({user.id})</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{user.email}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{user.phone}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.role} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.status} size="sm" />
                      {user.status === 'SUSPENDED' && user.suspensionReason && (
                        <div className="text-[10px] text-destructive max-w-xs truncate mt-0.5" title={user.suspensionReason}>
                          Reason: {user.suspensionReason}
                        </div>
                      )}
                    </td>

                    {/* Context / Spend / Assigned Hotels */}
                    <td className="px-5 py-3.5">
                      {user.role === 'CUSTOMER' ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">
                            {user.totalBookings || 0} reservations
                          </div>
                          <div className="text-muted-foreground">
                            Spend: <PriceDisplay amount={user.totalSpent || 0} size="sm" />
                          </div>
                        </div>
                      ) : user.role === 'MANAGER' ? (
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {user.assignedHotelIds?.length || 0} assigned hotels
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Platform Superuser</span>
                      )}
                    </td>

                    {/* Registered Date */}
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectUser(user)}
                          className="px-2.5 py-1 rounded border border-border text-foreground hover:bg-muted font-semibold transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRoleModalUser(user);
                            setSelectedNewRole(user.role);
                          }}
                          className="px-2.5 py-1 rounded border border-border text-foreground hover:bg-muted font-semibold transition-colors"
                        >
                          Role
                        </button>

                        {user.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => setSuspendingUser(user)}
                            className="px-2.5 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 font-semibold transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(user)}
                            className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 font-semibold transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Inspect Modal */}
      {inspectUser && (
        <Modal
          isOpen={!!inspectUser}
          onClose={() => setInspectUser(null)}
          title={`User Profile: ${inspectUser.name}`}
          subtitle={`Platform Identity ID: ${inspectUser.id}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border">
              <img
                src={inspectUser.avatarUrl}
                alt={inspectUser.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20"
              />
              <div className="space-y-1">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>{inspectUser.name}</span>
                  <StatusBadge status={inspectUser.role} size="sm" />
                  <StatusBadge status={inspectUser.status} size="sm" />
                </div>
                <div className="text-xs text-muted-foreground">{inspectUser.email} • {inspectUser.phone}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Registered: {formatDateTime(inspectUser.createdAt)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-card border border-border rounded-lg">
                <span className="text-muted-foreground font-semibold">Total Completed Bookings</span>
                <div className="text-lg font-bold text-foreground font-mono mt-1">
                  {inspectUser.totalBookings || 0}
                </div>
              </div>
              <div className="p-3.5 bg-card border border-border rounded-lg">
                <span className="text-muted-foreground font-semibold">Lifetime Total Spend</span>
                <div className="mt-1">
                  <PriceDisplay amount={inspectUser.totalSpent || 0} size="lg" />
                </div>
              </div>
            </div>

            {inspectUser.assignedHotelIds && inspectUser.assignedHotelIds.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Assigned Hotel Properties ({inspectUser.assignedHotelIds.length})
                </h4>
                <div className="space-y-2">
                  {inspectUser.assignedHotelIds.map((hId) => {
                    const hotel = hotels.find((h) => h.id === hId);
                    return (
                      <div
                        key={hId}
                        className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2 size={16} className="text-primary" />
                          <span className="font-bold text-foreground">{hotel?.name || hId}</span>
                          <span className="text-muted-foreground font-mono">({hId})</span>
                        </div>
                        <StatusBadge status={hotel?.status || 'ACTIVE'} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Role Mutation Modal */}
      {roleModalUser && (
        <Modal
          isOpen={!!roleModalUser}
          onClose={() => setRoleModalUser(null)}
          title={`Update Permissions: ${roleModalUser.name}`}
          subtitle="Modifying access role alters route-level guards on NestJS API (/api/v1)"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Select the new security clearance role for <strong className="text-foreground">{roleModalUser.name}</strong>.
            </p>

            <div className="space-y-2">
              {(['CUSTOMER', 'MANAGER', 'ADMIN'] as UserRole[]).map((role) => (
                <label
                  key={role}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNewRole === role
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={selectedNewRole === role}
                      onChange={() => setSelectedNewRole(role)}
                      className="text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-foreground">{role}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {role === 'ADMIN'
                          ? 'Unrestricted platform-wide read/write permissions.'
                          : role === 'MANAGER'
                          ? 'Scoped strictly to assigned hotel property inventory.'
                          : 'Standard consumer search, booking, and reviews.'}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={role} size="sm" />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors shadow-sm"
              >
                Commit Role Change
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Safety Dialog: Strict Typed Confirmation "SUSPEND" per Design System Section 38 */}
      <SafetyDialog
        isOpen={!!suspendingUser}
        onClose={() => setSuspendingUser(null)}
        onConfirm={handleConfirmSuspension}
        title={`Suspend Account: ${suspendingUser?.name}`}
        description={`This action immediately invalidates all active JWT session tokens and prevents ${suspendingUser?.name} (${suspendingUser?.email}) from authenticating. Any active inventory holds will be forfeited.`}
        confirmKeyword="SUSPEND"
        confirmButtonText="Suspend User Account"
        variant="danger"
      />
    </div>
  );
};
