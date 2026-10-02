import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  CreditCard,
  Building2,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { PlatformTransaction, TransactionStatus, PaymentMethod } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { Modal } from '../../components/shared/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDate, formatDateTime, exportToCSV } from '../../lib/utils';

export const FinancialLedgerView: React.FC = () => {
  const { transactions } = useAdminStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [gatewayFilter, setGatewayFilter] = useState('ALL');
  const [inspectTxn, setInspectTxn] = useState<PlatformTransaction | null>(null);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.bookingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.hotelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.gatewayRef.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesGateway = gatewayFilter === 'ALL' || t.paymentGateway === gatewayFilter;

    return matchesSearch && matchesStatus && matchesGateway;
  });

  const totalGrossSettled = transactions
    .filter((t) => t.status === 'SETTLED')
    .reduce((sum, t) => sum + t.grossAmount, 0);

  const totalPlatformFees = transactions
    .filter((t) => t.status === 'SETTLED')
    .reduce((sum, t) => sum + t.platformFee, 0);

  const handleExportCSV = () => {
    exportToCSV(
      filteredTransactions.map((t) => ({
        Transaction_ID: t.id,
        Booking_ID: t.bookingId,
        Guest_Name: t.guestName,
        Hotel: t.hotelName,
        Gross_Amount: t.grossAmount,
        Commission_Rate: `${t.commissionRate * 100}%`,
        Platform_Fee: t.platformFee,
        Net_Payout: t.netPayout,
        Gateway: t.paymentGateway,
        Gateway_Ref: t.gatewayRef,
        Method: t.method,
        Status: t.status,
        Created_At: t.createdAt,
      })),
      `stayora_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast.success('Platform ledger exported to CSV successfully.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Financial Ledger & Transactions (GET /api/v1/admin/ledger)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global payment gateway audit logs, 12% platform commission cut, and partner hotel disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all shadow-subtle"
        >
          <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Financial Health Mini Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl shadow-subtle">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Settled Volume (This Batch)</span>
          <div className="mt-1">
            <PriceDisplay amount={totalGrossSettled} size="xl" />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">100% gateway verified</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-subtle">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Platform Take (12% Commission)</span>
          <div className="mt-1">
            <PriceDisplay amount={totalPlatformFees} size="xl" className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Real-time settlement split</span>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-subtle">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Gateways</span>
          <div className="mt-1 text-lg font-bold text-foreground font-mono">
            Razorpay • Stripe • Mock
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">Idempotent checkout pipeline</span>
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
            placeholder="Search TXN ID, Booking Ref, Guest, Gateway..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground font-mono"
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
              <option value="ALL">All Statuses</option>
              <option value="SETTLED">Settled</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>

          {/* Gateway Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <span>Gateway:</span>
            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              className="bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All Gateways</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="STRIPE">Stripe</option>
              <option value="MOCK_GATEWAY">Mock Sandbox</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table with Tabular Numbers per Design System Section 38 */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transaction records match criteria"
          description="Try clearing search filters or changing the gateway dropdown."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('ALL');
            setGatewayFilter('ALL');
          }}
        />
      ) : (
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-mono">TXN Reference</th>
                  <th className="px-4 py-3">Booking & Guest</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3 font-mono">Gross Total</th>
                  <th className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">Take (12%)</th>
                  <th className="px-4 py-3 font-mono">Net Settlement</th>
                  <th className="px-4 py-3">Gateway / Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                    {/* TXN Reference */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-foreground">{txn.id}</div>
                      <div className="text-[10px] text-muted-foreground font-sans">
                        {formatDateTime(txn.createdAt)}
                      </div>
                    </td>

                    {/* Booking & Guest */}
                    <td className="px-4 py-3.5 font-sans">
                      <div className="font-bold text-foreground">{txn.guestName}</div>
                      <div className="text-[11px] font-mono text-primary dark:text-brand-300">
                        {txn.bookingId}
                      </div>
                    </td>

                    {/* Property */}
                    <td className="px-4 py-3.5 font-sans">
                      <div className="text-foreground font-medium">{txn.hotelName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{txn.hotelId}</div>
                    </td>

                    {/* Gross Total */}
                    <td className="px-4 py-3.5 font-bold text-foreground">
                      <PriceDisplay amount={txn.grossAmount} size="sm" />
                    </td>

                    {/* Platform Cut (12%) */}
                    <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <PriceDisplay amount={txn.platformFee} size="sm" className="text-emerald-600 dark:text-emerald-400" />
                    </td>

                    {/* Net Settlement */}
                    <td className="px-4 py-3.5 font-bold text-muted-foreground">
                      <PriceDisplay amount={txn.netPayout} size="sm" />
                    </td>

                    {/* Gateway / Method */}
                    <td className="px-4 py-3.5 font-sans">
                      <div className="font-semibold text-foreground text-[11px]">
                        {txn.paymentGateway}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {txn.method.replace(/_/g, ' ')} • {txn.gatewayRef.slice(0, 14)}...
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 font-sans">
                      <StatusBadge status={txn.status} size="sm" />
                    </td>

                    {/* Audit Inspect */}
                    <td className="px-4 py-3.5 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setInspectTxn(txn)}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground transition-colors inline-flex items-center gap-1"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Inspection Modal */}
      {inspectTxn && (
        <Modal
          isOpen={!!inspectTxn}
          onClose={() => setInspectTxn(null)}
          title={`Transaction Audit: ${inspectTxn.id}`}
          subtitle={`Booking Reference: ${inspectTxn.bookingId}`}
          size="lg"
        >
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className="text-muted-foreground font-semibold">Settlement Status</span>
                <div className="mt-1">
                  <StatusBadge status={inspectTxn.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground font-semibold">Settled Timestamp</span>
                <div className="font-mono text-foreground font-bold mt-1">
                  {formatDateTime(inspectTxn.settledAt || inspectTxn.createdAt)}
                </div>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Deterministic Settlement Breakdown
              </h4>
              <div className="divide-y divide-border/60">
                <div className="py-2 flex justify-between font-mono">
                  <span className="text-muted-foreground">Gross Booking Consideration:</span>
                  <PriceDisplay amount={inspectTxn.grossAmount} size="sm" />
                </div>
                <div className="py-2 flex justify-between font-mono text-emerald-600 dark:text-emerald-400">
                  <span>Stayora Platform Commission ({inspectTxn.commissionRate * 100}% standard):</span>
                  <PriceDisplay amount={inspectTxn.platformFee} size="sm" className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="py-2 flex justify-between font-mono font-bold text-foreground">
                  <span>Net Hotel Settlement Disbursement:</span>
                  <PriceDisplay amount={inspectTxn.netPayout} size="sm" />
                </div>
              </div>
            </div>

            {/* Gateway Telemetry */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2 font-mono text-[11px]">
              <div className="font-bold text-foreground font-sans">Payment Intent Gateway Logs</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <span className="text-foreground">{inspectTxn.paymentGateway}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">External Gateway Reference:</span>
                <span className="text-foreground font-bold">{inspectTxn.gatewayRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Instrument:</span>
                <span className="text-foreground">{inspectTxn.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guest Payer:</span>
                <span className="text-foreground font-sans">{inspectTxn.guestName} ({inspectTxn.guestEmail})</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
