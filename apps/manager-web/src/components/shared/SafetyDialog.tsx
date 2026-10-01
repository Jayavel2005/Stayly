import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from '../../lib/utils';

interface SafetyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  impactMessage: string;
  policyNote?: string;
  confirmLabel?: string;
  confirmVariant?: 'destructive' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const SafetyDialog: React.FC<SafetyDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  impactMessage,
  policyNote,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'destructive',
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <div
          className={cn(
            'flex gap-3 p-3.5 rounded-lg border text-sm',
            confirmVariant === 'destructive'
              ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200'
              : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200'
          )}
        >
          {confirmVariant === 'destructive' ? (
            <AlertCircle size={20} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          ) : (
            <AlertTriangle size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">Operational Impact Notice</p>
            <p className="text-xs leading-relaxed opacity-90">{impactMessage}</p>
          </div>
        </div>

        {policyNote && (
          <div className="bg-muted/60 p-3 rounded-lg border border-border text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Policy Guardrail: </span>
            {policyNote}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              confirmVariant === 'destructive'
                ? 'bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive'
                : confirmVariant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600'
                : 'bg-primary hover:bg-primary/90 focus-visible:ring-primary'
            )}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
