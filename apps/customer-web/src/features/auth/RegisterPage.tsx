import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  Hotel,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { registerSchema, RegisterFormValues } from './loginSchema';
import { api, ApiError } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';

interface RegisterPageProps {
  onSuccessRedirect: () => void;
  onNavigateToLogin: () => void;
  onBackToDiscovery?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSuccessRedirect,
  onNavigateToLogin,
  onBackToDiscovery,
}) => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormValues) => api.register(data),
    onSuccess: (response) => {
      setAuth(
        {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        },
        response.user
      );
      onSuccessRedirect();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          err.details.forEach((d) => {
            if (d.field === 'email' || d.field === 'name' || d.field === 'phone' || d.field === 'password') {
              setError(d.field, { message: d.reason });
            }
          });
        }
      }
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    clearErrors();
    registerMutation.mutate(values);
  };

  const isPending = registerMutation.isPending || isSubmitting;
  const apiError = registerMutation.error as ApiError | null;

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        {onBackToDiscovery && (
          <button
            onClick={onBackToDiscovery}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group select-none"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span>Return to Hotel Discovery</span>
          </button>
        )}

        <div className="rounded-lg border border-border bg-card text-card-foreground shadow-md p-6 sm:p-8 space-y-6 transition-colors">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-sm">
              <Hotel className="w-6 h-6 stroke-[2]" />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground font-serif leading-8">
              Join the Sanctuary Club
            </h2>

            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Create your guest profile to enjoy seamless checkout, member-only rates, and verified stays.
            </p>
          </div>

          {apiError && (
            <div
              role="alert"
              className="rounded-md p-4 text-xs flex items-start gap-3 bg-destructive/10 border border-destructive/20 text-destructive dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold">Registration Issue</div>
                <p className="leading-relaxed opacity-90">{apiError.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="block text-xs font-semibold text-foreground">
                Full Name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Vikramaditya Verma"
                  {...register('name')}
                  disabled={isPending}
                  className={`w-full h-12 sm:h-10 pl-10 pr-3.5 rounded-md border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.name ? 'border-destructive' : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground stroke-[1.75]" />
              </div>
              {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block text-xs font-semibold text-foreground">
                Email Address <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-email"
                  type="email"
                  placeholder="name@domain.com"
                  {...register('email')}
                  disabled={isPending}
                  className={`w-full h-12 sm:h-10 pl-10 pr-3.5 rounded-md border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.email ? 'border-destructive' : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground stroke-[1.75]" />
              </div>
              {errors.email && <p className="text-[11px] text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-foreground">
                Phone Number <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  {...register('phone')}
                  disabled={isPending}
                  className={`w-full h-12 sm:h-10 pl-10 pr-3.5 rounded-md border bg-background text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.phone ? 'border-destructive' : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground stroke-[1.75]" />
              </div>
              {errors.phone && <p className="text-[11px] text-destructive mt-1">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-pass" className="block text-xs font-semibold text-foreground">
                Create Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  {...register('password')}
                  disabled={isPending}
                  className={`w-full h-12 sm:h-10 pl-10 pr-11 rounded-md border bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.password ? 'border-destructive' : 'border-input hover:border-muted-foreground/40'
                  }`}
                />
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground stroke-[1.75]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              isLoading={isPending}
              className="w-full font-semibold text-sm tracking-wide h-12 rounded-md shadow-sm mt-2"
              rightIcon={!isPending ? <ArrowRight size={16} /> : undefined}
            >
              Create Account & Sign In
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground text-center">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
          <span>Compliant with WCAG 2.2 AA accessibility and password standards</span>
        </div>
      </div>
    </div>
  );
};
