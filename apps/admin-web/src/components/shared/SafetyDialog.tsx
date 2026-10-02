import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SafetyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmKeyword?: string; // Default: 'CONFIRM'
  confirmButtonText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export const SafetyDialog: React.FC<SafetyDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmKeyword = 'CONFIRM',
  confirmButtonText = 'Proceed with Action',
  variant = 'danger',
  isLoading = false,
}) => {
  const [typedInput, setTypedInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const isConfirmedMatch = typedInput.trim().toUpperCase() === confirmKeyword.toUpperCase();

  const handleConfirm = () => {
    if (!isConfirmedMatch) {
      setErrorMessage(`Please type exactly "${confirmKeyword}" to authorize.`);
      return;
    }
    setErrorMessage('');
    onConfirm();
    setTypedInput('');
  };

  const handleClose = () => {
    setTypedInput('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-elevated max-w-md w-full p-6 relative overflow-hidden">
        {/* Accent Bar */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5',
            variant === 'danger' ? 'bg-destructive' : 'bg-warning'
          )}
        />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                variant === 'danger'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-warning/15 text-warning'
              )}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground leading-tight">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Admin Security Verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{description}</p>

        {/* Confirmation Keyword Requirement */}
        <div className="bg-muted/50 border border-border/80 rounded-lg p-3.5 mb-4">
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Type <span className="font-mono text-destructive font-bold">{confirmKeyword}</span> to confirm this action:
          </label>
          <input
            type="text"
            value={typedInput}
            onChange={(e) => {
              setTypedInput(e.target.value);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder={confirmKeyword}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          {errorMessage && (
            <p className="text-xs text-destructive mt-1.5 font-medium">{errorMessage}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmedMatch || isLoading}
            className={cn(
              'px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all shadow-sm',
              variant === 'danger'
                ? 'bg-destructive hover:bg-destructive/90 disabled:bg-destructive/40'
                : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/40',
              'disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? 'Executing...' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};
