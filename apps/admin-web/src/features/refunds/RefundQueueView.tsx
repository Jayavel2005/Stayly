import React, { useState } from 'react';
import {
  Scale,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Building2,
  User,
  ShieldCheck,
  FileText,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { RefundDispute, DisputeStatus } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { Modal } from '../../components/shared/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDateTime, formatDate } from '../../lib/utils';

export const RefundQueueView: React.FC = () => {
  const { disputes, resolveDispute } = useAdminStore();

  const [statusFilter, setStatusFilter] = useState<'ALL' | DisputeStatus>('ALL');
  const [arbitratingDispute, setArbitratingDispute] = useState<RefundDispute | null>(null);

  // Arbitration Form State
  const [resolutionChoice, setResolutionChoice] = useState<'APPROVED_FULL' | 'APPROVED_PARTIAL' | 'REJECTED'>('APPROVED_FULL');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState('');

  const filteredDisputes = disputes.filter((d) => {
    if (statusFilter === 'ALL') return true;
    return d.disputeStatus === statusFilter;
  });

  const pendingCount = disputes.filter((d) => d.disputeStatus === 'PENDING_ADMIN_REVIEW').length;

  const handleOpenArbitration = (dispute: RefundDispute) => {
    setArbitratingDispute(dispute);
    setResolutionChoice('APPROVED_FULL');
    setPartialAmount(Math.round(dispute.requestedRefundAmount / 2));
    setOverrideReason('');
  };

  const handleExecuteArbitration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arbitratingDispute) return;
    if (!overrideReason.trim()) {
      toast.error('Administrative compliance requires entering an audit override reason.');
      return;
    }

    const approvedAmount =
      resolutionChoice === 'APPROVED_FULL'
        ? arbitratingDispute.requestedRefundAmount
        : resolutionChoice === 'APPROVED_PARTIAL'
        ? partialAmount
        : 0;

    resolveDispute(arbitratingDispute.id, resolutionChoice, overrideReason, approvedAmount);
    toast.success(
      resolutionChoice === 'REJECTED'
        ? `Dispute ${arbitratingDispute.id} rejected. Hotel cancellation policy upheld.`
        : `Dispute ${arbitratingDispute.id} approved (₹${approvedAmount}). Payout reversal queued.`
    );
    setArbitratingDispute(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Dispute Arbitration & Refund Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            RolesGuard(ADMIN) discretionary override queue for disputed cancellations and medical exceptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-lg">
            Pending Resolution: <strong className="font-mono">{pendingCount}</strong>
          </span>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter size={14} />
          <span>Dispute Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">All Claims ({disputes.length})</option>
            <option value="PENDING_ADMIN_REVIEW">Under Review ({pendingCount})</option>
            <option value="APPROVED_FULL">Full Refund Approved</option>
            <option value="APPROVED_PARTIAL">Partial Refund Approved</option>
            <option value="REJECTED">Claim Rejected</option>
          </select>
        </div>
      </div>

      {/* Disputes Cards List */}
      {filteredDisputes.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No disputes matching filter"
          description="The arbitration queue is currently clear of pending customer appeals."
        />
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((dispute) => (
            <div
              key={dispute.id}
              className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Scale size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground font-mono">{dispute.id}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs font-mono font-bold text-primary dark:text-brand-300">
                        {dispute.bookingId}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      Filed {formatDateTime(dispute.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={dispute.disputeStatus} size="sm" />
                </div>
              </div>

              {/* Dispute Body */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 py-4 text-xs">
                {/* Column 1: Financial & Entity Specs */}
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Guest Claimant:</span>
                    <div className="font-bold text-foreground">{dispute.guestName}</div>
                    <div className="text-[11px] text-muted-foreground">{dispute.guestEmail}</div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Hotel Property:</span>
                    <div className="font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                      <Building2 size={13} className="text-primary" />
                      <span>{dispute.hotelName}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Original Total:</span>
                      <PriceDisplay amount={dispute.bookingTotal} size="sm" />
                    </div>
                    <div className="flex justify-between text-destructive font-bold">
                      <span>Requested Refund:</span>
                      <PriceDisplay amount={dispute.requestedRefundAmount} size="sm" className="text-destructive" />
                    </div>
                  </div>
                </div>

                {/* Column 2: Guest Statement */}
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    <span>Claim Reason: {dispute.reason}</span>
                  </div>
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{dispute.guestStatement}"
                  </p>
                </div>

                {/* Column 3: Hotel Policy & Hotel Response */}
                <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2">
                  <span className="font-bold text-foreground block">
                    Property Policy Constraint
                  </span>
                  <p className="text-muted-foreground">{dispute.cancellationPolicy}</p>

                  {dispute.hotelStatement && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="font-semibold text-foreground text-[11px]">Hotel Response:</span>
                      <p className="text-muted-foreground mt-0.5 italic">"{dispute.hotelStatement}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resolved Audit Section OR Action Trigger */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                {dispute.disputeStatus !== 'PENDING_ADMIN_REVIEW' ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-3 w-full space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        <span>Resolution Arbitrated by {dispute.reviewedBy}</span>
                      </span>
                      <span className="font-mono text-emerald-800 dark:text-emerald-300">
                        {formatDateTime(dispute.reviewedAt)}
                      </span>
                    </div>
                    <p className="text-emerald-900 dark:text-emerald-200">
                      <strong>Audit Note:</strong> {dispute.adminOverrideReason}
                    </p>
                    {dispute.approvedRefundAmount !== undefined && (
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300 font-mono">
                        Disbursed Refund: ₹{dispute.approvedRefundAmount}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="text-muted-foreground italic text-[11px]">
                      Awaiting administrative adjudication.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenArbitration(dispute)}
                      className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Scale size={14} className="text-teal-300" />
                      <span>Arbitrate & Override Policy</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Arbitration Modal */}
      {arbitratingDispute && (
        <Modal
          isOpen={!!arbitratingDispute}
          onClose={() => setArbitratingDispute(null)}
          title={`Arbitrate Dispute: ${arbitratingDispute.id}`}
          subtitle={`RolesGuard(ADMIN) Authority Override on Booking ${arbitratingDispute.bookingId}`}
          size="lg"
        >
          <form onSubmit={handleExecuteArbitration} className="space-y-5 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <div className="font-bold text-foreground">
                {arbitratingDispute.guestName} vs. {arbitratingDispute.hotelName}
              </div>
              <div className="text-muted-foreground mt-0.5">
                Claim: {arbitratingDispute.reason} • Total: ₹{arbitratingDispute.bookingTotal}
              </div>
            </div>

            {/* Arbitration Choice */}
            <div className="space-y-2">
              <label className="block font-bold text-foreground">
                Select Administrative Decision
              </label>

              {/* Full Refund */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  resolutionChoice === 'APPROVED_FULL'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="arbitration"
                  value="APPROVED_FULL"
                  checked={resolutionChoice === 'APPROVED_FULL'}
                  onChange={() => setResolutionChoice('APPROVED_FULL')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-foreground">
                    Approve 100% Full Refund (₹{arbitratingDispute.requestedRefundAmount})
                  </div>
                  <div className="text-muted-foreground text-[11px] mt-0.5">
                    Discretionary policy override. 100% refund credited back to guest original payment method.
                  </div>
                </div>
              </label>

              {/* Partial Refund */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  resolutionChoice === 'APPROVED_PARTIAL'
                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="arbitration"
                  value="APPROVED_PARTIAL"
                  checked={resolutionChoice === 'APPROVED_PARTIAL'}
                  onChange={() => setResolutionChoice('APPROVED_PARTIAL')}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="w-full">
                  <div className="font-bold text-foreground">Approve Partial Settlement Refund</div>
                  <div className="text-muted-foreground text-[11px] mt-0.5 mb-2">
                    Compromise settlement dividing loss between guest and hotel.
                  </div>
                  {resolutionChoice === 'APPROVED_PARTIAL' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-foreground">Approved Amount: ₹</span>
                      <input
                        type="number"
                        min={100}
                        max={arbitratingDispute.bookingTotal}
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(Number(e.target.value))}
                        className="px-2 py-1 bg-background border border-input rounded text-foreground font-mono text-xs w-32"
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* Reject */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  resolutionChoice === 'REJECTED'
                    ? 'border-destructive bg-destructive/5 dark:bg-destructive/10 ring-1 ring-destructive'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="arbitration"
                  value="REJECTED"
                  checked={resolutionChoice === 'REJECTED'}
                  onChange={() => setResolutionChoice('REJECTED')}
                  className="mt-0.5 text-destructive focus:ring-destructive"
                />
                <div>
                  <div className="font-bold text-foreground">
                    Reject Dispute (Enforce Hotel Cancellation Terms)
                  </div>
                  <div className="text-muted-foreground text-[11px] mt-0.5">
                    No refund issued. Guest claim does not qualify for platform policy override.
                  </div>
                </div>
              </label>
            </div>

            {/* Mandatory Override Reason */}
            <div>
              <label className="block font-bold text-foreground mb-1">
                Administrative Audit & Compliance Note <span className="text-destructive">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Enter mandatory justification for this arbitration (e.g. verified hospital certificate, airline DGCA grounding notice, etc.)..."
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setArbitratingDispute(null)}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm"
              >
                Submit Adjudication
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
