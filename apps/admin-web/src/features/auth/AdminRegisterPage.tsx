import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Building2,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full legal name'),
  email: z
    .string()
    .email('Please enter a valid organization email')
    .refine(
      (val) => val.endsWith('@stayora.internal') || val.endsWith('@stayora.com'),
      'Administrative registration requires an authorized @stayora.internal or @stayora.com corporate domain'
    ),
  department: z.string().min(2, 'Please specify your department or property affiliation'),
  reason: z.string().min(10, 'Please provide an administrative operational justification (minimum 10 characters)'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface AdminRegisterPageProps {
  onBackToLogin: () => void;
}

export const AdminRegisterPage: React.FC<AdminRegisterPageProps> = ({ onBackToLogin }) => {
  const { theme, toggleTheme } = useAdminStore();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (data: RegisterFormData) => {
    // Simulate API registration request dispatch
    await new Promise((r) => setTimeout(r, 600));
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-brand-100 selection:text-brand-900 transition-colors duration-200">
      {/* Top Utility Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20">
            <ShieldCheck size={20} strokeWidth={1.75} className="text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-foreground tracking-tight leading-none">
                Stayora
              </span>
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                Admin
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="p-2 rounded-md border border-border hover:bg-muted text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {theme === 'dark' ? (
            <Sun size={17} strokeWidth={1.75} className="text-amber-400" />
          ) : (
            <Moon size={17} strokeWidth={1.75} className="text-slate-600" />
          )}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-card p-6 sm:p-8">
            {isSubmitted ? (
              <div className="text-center space-y-4 py-4 animate-in fade-in duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} strokeWidth={1.75} />
                </div>
                <h2 className="text-2xl font-bold leading-8 tracking-tight text-foreground">
                  Invitation Request Dispatched
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your administrative credentials petition has been queued for Superadmin audit. You will receive an invitation token with RSA-signed credentials once verified.
                </p>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="w-full h-10 bg-primary text-primary-foreground font-bold rounded-md hover:bg-primary/90 transition-all text-sm"
                  >
                    Return to Admin Login
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
                    <UserPlus size={24} strokeWidth={1.75} />
                  </div>
                  <h2 className="text-2xl font-bold leading-8 tracking-tight text-foreground">
                    Admin Access Registration
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Request Platform Governance and Ledger Audit clearance.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Full Legal Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Devansh Mehta"
                      {...register('fullName')}
                      className="w-full px-3 h-12 sm:h-10 bg-background text-foreground border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {errors.fullName && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle size={12} />
                        <span>{errors.fullName.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Corporate Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Corporate Administrative Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="username@stayora.internal"
                      {...register('email')}
                      className="w-full px-3 h-12 sm:h-10 bg-background text-foreground border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle size={12} />
                        <span>{errors.email.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Department / Operations Division <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Platform Trust & Safety / Financial Audit"
                      {...register('department')}
                      className="w-full px-3 h-12 sm:h-10 bg-background text-foreground border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {errors.department && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle size={12} />
                        <span>{errors.department.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Justification */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">
                      Security & Operational Justification <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Explain your operational responsibilities requiring platform admin role..."
                      {...register('reason')}
                      className="w-full p-2.5 bg-background text-foreground border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {errors.reason && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                        <AlertCircle size={12} />
                        <span>{errors.reason.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-[44px] h-12 sm:h-10 bg-primary text-primary-foreground font-bold rounded-md hover:bg-primary/90 transition-all text-sm shadow-sm flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Transmitting Petition...' : 'Submit Clearance Petition'}
                    </button>
                  </div>
                </form>

                <div className="mt-5 pt-4 border-t border-border text-center">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="text-xs font-semibold text-primary dark:text-brand-300 hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft size={13} strokeWidth={1.75} />
                    <span>Back to Administrator Login</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
        <p>Stayora Hospitality Operations Platform • Superadmin Verification Gateway</p>
      </footer>
    </div>
  );
};
