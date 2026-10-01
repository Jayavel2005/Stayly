import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Hotel,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { loginSchema, LoginFormValues } from './loginSchema';
import { api, ApiError } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';

interface LoginPageProps {
  onSuccessRedirect: () => void;
  onNavigateToRegister: () => void;
  onBackToDiscovery?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccessRedirect,
  onNavigateToRegister,
  onBackToDiscovery,
}) => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  // Countdown timer for rate limiting (429 response)
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  // TanStack Query Mutation for POST /api/v1/auth/login
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormValues) =>
      api.login({ email: data.email, password: data.password }),
    onSuccess: (response) => {
      // Store 15-minute JWT accessToken & 7-day refreshToken in Zustand with localStorage persistence
      setAuth(
        {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        },
        response.user
      );
      // Redirect to target customer view
      onSuccessRedirect();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 429 && err.retryAfterSeconds) {
          setRateLimitCountdown(err.retryAfterSeconds);
        }
        if (err.details && err.details.length > 0) {
          err.details.forEach((d) => {
            if (d.field === 'email' || d.field === 'password') {
              setError(d.field, { message: d.reason });
            }
          });
        }
      }
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    clearErrors();
    loginMutation.mutate(values);
  };

  const fillDemoAccount = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password@123', { shouldValidate: true });
    clearErrors();
  };

  const isThrottled = rateLimitCountdown !== null && rateLimitCountdown > 0;
  const isPending = loginMutation.isPending || isSubmitting;
  const apiError = loginMutation.error as ApiError | null;

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link to Hotel Discovery */}
        {onBackToDiscovery && (
          <button
            onClick={onBackToDiscovery}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group select-none"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span>Return to Hotel Discovery</span>
          </button>
        )}

        {/* Card Container adhering to 8pt grid & 8px border radius per Design System */}
        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-md p-6 sm:p-8 space-y-6 transition-colors">
          {/* Brand & Heading: H2 at 24/32px per Design System Section 8 line 278 */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-sm">
              <Hotel className="w-6 h-6 stroke-[2]" />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground font-serif leading-8">
              Sign In to Stayora
            </h2>

            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Enter your credentials to access your verified bookings, loyalty folios, and exclusive sanctuary rates.
            </p>
          </div>

          {/* Inline Critical Error State: No Toasts for Critical Errors per Design System line 1043 */}
          {apiError && (
            <div
              role="alert"
              aria-live="assertive"
              className={`rounded-md p-4 text-xs flex items-start gap-3 border transition-all ${
                apiError.status === 429
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-destructive/10 border-destructive/20 text-destructive dark:text-rose-300'
              }`}
            >
              {apiError.status === 429 ? (
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 animate-pulse" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-semibold">
                  {apiError.code === 'RATE_LIMIT_EXCEEDED'
                    ? 'Security Lockout: Rate Limit Exceeded'
                    : 'Authentication Failed'}
                </div>
                <p className="leading-relaxed opacity-90">
                  {apiError.message}
                </p>
                {isThrottled && (
                  <div className="pt-1 font-mono font-bold text-amber-700 dark:text-amber-300">
                    Retry available in: {rateLimitCountdown} seconds
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form with React Hook Form & Zod Validation */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Field 1: Email Address */}
            <div className="space-y-1.5">
              <label
                htmlFor="customer-email"
                className="block text-xs font-semibold text-foreground select-none"
              >
                Email Address <span className="text-destructive">*</span>
              </label>

              <div className="relative">
                <input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  disabled={isPending || isThrottled}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'customer-email-error' : undefined}
                  placeholder="ananya.sharma@example.com"
                  {...register('email')}
                  className={`w-full h-12 sm:h-10 pl-10 pr-3.5 rounded-md border bg-background text-sm text-foreground transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
                    errors.email
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none stroke-[1.75]"
                />
              </div>

              {errors.email && (
                <p
                  id="customer-email-error"
                  role="alert"
                  className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1"
                >
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{errors.email.message}</span>
                </p>
              )}
            </div>

            {/* Field 2: Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="customer-password"
                  className="block text-xs font-semibold text-foreground select-none"
                >
                  Password <span className="text-destructive">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert('Password reset link simulation dispatched to your email address.')}
                  className="text-[11px] font-medium text-primary hover:underline transition-colors select-none"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="relative">
                <input
                  id="customer-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isPending || isThrottled}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'customer-password-error' : undefined}
                  placeholder="••••••••••••"
                  {...register('password')}
                  className={`w-full h-12 sm:h-10 pl-10 pr-11 rounded-md border bg-background text-sm text-foreground transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
                    errors.password
                      ? 'border-destructive focus-visible:ring-destructive'
                      : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none stroke-[1.75]"
                />

                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  {showPassword ? (
                    <EyeOff size={16} className="stroke-[1.75]" />
                  ) : (
                    <Eye size={16} className="stroke-[1.75]" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p
                  id="customer-password-error"
                  role="alert"
                  className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1"
                >
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{errors.password.message}</span>
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1 select-none">
              <input
                id="remember-me"
                type="checkbox"
                {...register('rememberMe')}
                className="w-4 h-4 rounded-sm border-input text-primary focus:ring-primary/30"
              />
              <label
                htmlFor="remember-me"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Keep me signed in for 7 days
              </label>
            </div>

            {/* Exactly ONE Primary Action Button per Design System Button Hierarchy */}
            <Button
              type="submit"
              size="lg"
              disabled={isPending || isThrottled}
              isLoading={isPending}
              className="w-full font-semibold text-sm tracking-wide h-12 rounded-md shadow-sm mt-2"
              rightIcon={!isPending ? <ArrowRight size={16} /> : undefined}
            >
              Sign In to Sanctuary
            </Button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="p-3.5 rounded-md bg-secondary/60 border border-border/80 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <KeyRound size={13} className="text-primary" />
              <span>One-Click Demo Guest Credentials</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Select a pre-configured guest profile to autofill and verify authentication instantly:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fillDemoAccount('ananya.sharma@example.com')}
                className="p-2 rounded border border-border bg-card hover:bg-accent hover:text-accent-foreground text-left transition-colors"
              >
                <div className="font-semibold text-foreground text-[11px] truncate">Ananya Sharma</div>
                <div className="text-[10px] text-muted-foreground truncate">Platinum Member</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('siddharth.roy@example.com')}
                className="p-2 rounded border border-border bg-card hover:bg-accent hover:text-accent-foreground text-left transition-colors"
              >
                <div className="font-semibold text-foreground text-[11px] truncate">Siddharth Roy</div>
                <div className="text-[10px] text-muted-foreground truncate">Gold Member</div>
              </button>
            </div>
          </div>

          {/* Secondary Action: Registration Link per Integration Requirements */}
          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              New to Stayora?{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
              >
                Create a guest account
              </button>
            </p>
          </div>
        </div>

        {/* Security Trust Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground text-center">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
          <span>Protected by NestJS rate limiting & 15-minute signed JWT verification</span>
        </div>
      </div>
    </div>
  );
};
