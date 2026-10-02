import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  Percent,
  Clock,
  IndianRupee,
  CreditCard,
  Building2,
  Save,
  Activity,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '../../store/adminStore';
import { SafetyDialog } from '../../components/shared/SafetyDialog';
import { formatDateTime } from '../../lib/utils';

export const PlatformSettingsView: React.FC = () => {
  const { settings, updateSettings, auditEvents } = useAdminStore();

  const [formState, setFormState] = useState(settings);
  const [maintenanceDialog, setMaintenanceDialog] = useState(false);

  const handleChange = (key: keyof typeof settings, value: any) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formState);
    toast.success('Platform operational configuration parameters committed successfully.');
  };

  const handleToggleMaintenance = () => {
    const nextVal = !formState.maintenanceMode;
    if (nextVal) {
      setMaintenanceDialog(true);
    } else {
      handleChange('maintenanceMode', false);
      updateSettings({ maintenanceMode: false });
      toast.success('Platform maintenance mode disabled. Public search restored.');
    }
  };

  const handleConfirmMaintenance = () => {
    handleChange('maintenanceMode', true);
    updateSettings({ maintenanceMode: true });
    toast.error('EMERGENCY: Platform maintenance mode enabled. All public checkouts locked.');
    setMaintenanceDialog(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Platform Governance & Parameters
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global business rules, inventory hold timers, commission rates, and emergency kill-switches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-muted rounded-lg text-muted-foreground">
            Configuration State: <strong className="text-emerald-600 dark:text-emerald-400">Synchronized</strong>
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Row 1: Commission & Financial Take-Rate */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Percent size={18} className="text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Commission & Commercial Fee Schedule</h2>
              <p className="text-xs text-muted-foreground">Platform percentage take-rate applied across all booking settlements.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">
                Platform Commission Take-Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={formState.commissionPercentage}
                onChange={(e) => handleChange('commissionPercentage', Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Default 12.0% standard contract rate.</p>
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">
                Hotel Taxes & GST Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={formState.taxPercentage}
                onChange={(e) => handleChange('taxPercentage', Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Statutory 18.0% GST for luxury accommodations.</p>
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">
                Auto-Refund Limit Threshold (₹)
              </label>
              <input
                type="number"
                step="500"
                min="0"
                value={formState.autoRefundThreshold}
                onChange={(e) => handleChange('autoRefundThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Cancellations above this trigger admin arbitration queue.</p>
            </div>
          </div>
        </div>

        {/* Row 2: Concurrency & Booking Lifecycle Guardrails */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Clock size={18} className="text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Concurrency & Booking Lifecycle Rules</h2>
              <p className="text-xs text-muted-foreground">Mathematical double-booking prevention parameters backed by Redis distributed locks.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">
                Atomic Inventory Hold Timeout (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={formState.inventoryHoldTimeoutMinutes}
                onChange={(e) => handleChange('inventoryHoldTimeoutMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Redis ephemeral hold key expiry. Unpaid rooms return to catalog after this duration.
              </p>
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">
                Default Free Cancellation Window (Hours Prior to Check-in)
              </label>
              <input
                type="number"
                min="0"
                max="168"
                value={formState.cancellationGraceHours}
                onChange={(e) => handleChange('cancellationGraceHours', Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Standard cancellation cutoff applied when property does not specify custom terms.
              </p>
            </div>
          </div>
        </div>

        {/* Row 3: Active Payment Gateway Selection */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <CreditCard size={18} className="text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Pluggable Payment Gateway Integration</h2>
              <p className="text-xs text-muted-foreground">Select runtime settlement adapter per Section: Payment Architecture.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { id: 'RAZORPAY', name: 'Razorpay PG', desc: 'Primary gateway supporting UPI, NetBanking, Cards.' },
              { id: 'STRIPE', name: 'Stripe International', desc: 'Global card processing and multi-currency intent.' },
              { id: 'MOCK_GATEWAY', name: 'Mock Sandbox Adapter', desc: 'Zero-latency local simulation for end-to-end testing.' },
            ].map((gw) => (
              <label
                key={gw.id}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  formState.activePaymentGateway === gw.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <input
                    type="radio"
                    name="gateway"
                    value={gw.id}
                    checked={formState.activePaymentGateway === gw.id}
                    onChange={() => handleChange('activePaymentGateway', gw.id)}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-bold text-foreground">{gw.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{gw.desc}</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">{gw.id}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Row 4: Emergency Maintenance Kill-Switch */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Emergency Maintenance Mode Kill-Switch</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                  Enabling maintenance mode intercepts all consumer search and reservation checkout endpoints with HTTP 503 Service Unavailable, while preserving Admin Dashboard accessibility.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMaintenance}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                formState.maintenanceMode
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : 'border border-destructive/40 text-destructive hover:bg-destructive/10'
              }`}
            >
              {formState.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
            </button>
          </div>
        </div>

        {/* Submit Commit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 text-xs"
          >
            <Save size={15} />
            <span>Commit Platform Configuration Changes</span>
          </button>
        </div>
      </form>

      {/* Safety Dialog: Strict Typed Confirmation "CONFIRM" for Maintenance Mode */}
      <SafetyDialog
        isOpen={maintenanceDialog}
        onClose={() => setMaintenanceDialog(false)}
        onConfirm={handleConfirmMaintenance}
        title="Activate Platform Maintenance Mode"
        description="WARNING: Enabling maintenance mode will block all traveler reservations, freeze availability queries, and return 503 errors across customer-web."
        confirmKeyword="CONFIRM"
        confirmButtonText="Activate Maintenance Mode"
        variant="danger"
      />
    </div>
  );
};
