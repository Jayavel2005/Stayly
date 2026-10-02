import React, { useState } from 'react';
import {
  Network,
  Building2,
  UserCheck,
  PlusCircle,
  Trash2,
  ShieldAlert,
  Search,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { ManagerAssignment, ManagerAssignmentRole } from '../../types';
import { SafetyDialog } from '../../components/shared/SafetyDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';

export const ManagerAssignmentView: React.FC = () => {
  const {
    users,
    hotels,
    managerAssignments,
    assignManager,
    revokeManagerAssignment,
  } = useAdminStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [assignmentRole, setAssignmentRole] = useState<ManagerAssignmentRole>('GENERAL_MANAGER');

  // Safety confirmation dialog for revoking assignment
  const [revokingAssignment, setRevokingAssignment] = useState<ManagerAssignment | null>(null);

  const managerUsers = users.filter((u) => u.role === 'MANAGER' && u.status === 'ACTIVE');
  const activeHotels = hotels.filter((h) => h.status === 'ACTIVE');

  const filteredAssignments = managerAssignments.filter((a) => {
    return (
      a.managerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.managerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.hotelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.hotelId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManagerId || !selectedHotelId) {
      toast.error('Please select both a verified manager and a target hotel property.');
      return;
    }

    // Check if already assigned
    const exists = managerAssignments.find(
      (a) => a.managerId === selectedManagerId && a.hotelId === selectedHotelId
    );
    if (exists) {
      toast.error('This manager is already assigned to this property.');
      return;
    }

    assignManager(selectedManagerId, selectedHotelId, assignmentRole);
    toast.success('Manager assigned successfully. Resource scoping permissions activated.');
    setSelectedManagerId('');
    setSelectedHotelId('');
  };

  const handleConfirmRevoke = () => {
    if (!revokingAssignment) return;
    revokeManagerAssignment(revokingAssignment.id);
    toast.warning(`Operational clearance for ${revokingAssignment.managerName} at ${revokingAssignment.hotelName} revoked.`);
    setRevokingAssignment(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Hotel Manager Assignment Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Delegate multi-tenant operational credentials. Managers can only inspect and mutate assigned property inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-muted rounded-lg text-muted-foreground">
            Active Assignments: <strong className="text-foreground">{managerAssignments.length}</strong>
          </span>
        </div>
      </div>

      {/* Assignment Control Box */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card">
        <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <PlusCircle size={16} className="text-primary" />
          <span>Provision New Property Operational Assignment (POST /api/v1/admin/managers/assign)</span>
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Authorizes a hotel manager to access front-desk manifests, update rates, and handle cancellations for a specific property.
        </p>

        <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Select Manager */}
          <div>
            <label className="block font-bold text-foreground mb-1">
              Select Verified Manager <span className="text-destructive">*</span>
            </label>
            <select
              required
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring font-medium"
            >
              <option value="">-- Choose Manager --</option>
              {managerUsers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          {/* Select Hotel */}
          <div>
            <label className="block font-bold text-foreground mb-1">
              Target Property <span className="text-destructive">*</span>
            </label>
            <select
              required
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring font-medium"
            >
              <option value="">-- Choose Hotel Property --</option>
              {activeHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {h.city} ({h.id})
                </option>
              ))}
            </select>
          </div>

          {/* Select Role */}
          <div>
            <label className="block font-bold text-foreground mb-1">Operational Role Scope</label>
            <select
              value={assignmentRole}
              onChange={(e) => setAssignmentRole(e.target.value as any)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring font-medium"
            >
              <option value="GENERAL_MANAGER">General Manager (Full Control)</option>
              <option value="OPERATIONS_DIRECTOR">Operations Lead (Inventory & Rates)</option>
              <option value="FRONT_DESK_LEAD">Front Desk Supervisor (Arrivals/Check-ins)</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-1.5 h-[38px]"
            >
              <UserCheck size={16} className="text-teal-300" />
              <span>Authorize Assignment</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assignments by manager, hotel, or city..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Active Assignments Matrix Table */}
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Manager Identity</th>
                <th className="px-5 py-3">Assigned Property</th>
                <th className="px-5 py-3">Operational Role</th>
                <th className="px-5 py-3">Assigned Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Revocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-muted/30 transition-colors">
                  {/* Manager Identity */}
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-foreground">{assignment.managerName}</div>
                    <div className="text-[11px] text-muted-foreground">{assignment.managerEmail}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{assignment.managerId}</div>
                  </td>

                  {/* Assigned Property */}
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <Building2 size={13} className="text-primary" />
                      <span>{assignment.hotelName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{assignment.hotelId}</div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-foreground bg-muted px-2 py-1 rounded">
                      {assignment.role.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3.5 font-mono text-muted-foreground">
                    {formatDate(assignment.assignedAt)}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <StatusBadge status={assignment.status} size="sm" />
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setRevokingAssignment(assignment)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>De-allocate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Dialog: Strict Typed Confirmation "CONFIRM" per Design System Section 38 */}
      <SafetyDialog
        isOpen={!!revokingAssignment}
        onClose={() => setRevokingAssignment(null)}
        onConfirm={handleConfirmRevoke}
        title={`De-allocate Manager: ${revokingAssignment?.managerName}`}
        description={`This action revokes ${revokingAssignment?.managerName}'s operational management credentials for ${revokingAssignment?.hotelName} (${revokingAssignment?.hotelId}). The manager will no longer be permitted to inspect manifests, modify room types, or execute front-desk operations.`}
        confirmKeyword="CONFIRM"
        confirmButtonText="Revoke Operational Assignment"
        variant="danger"
      />
    </div>
  );
};
