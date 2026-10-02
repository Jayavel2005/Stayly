import React from 'react';
import {
  ShieldCheck,
  Search,
  PlusCircle,
  Sun,
  Moon,
  Activity,
  Layers,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { useAuthStore } from '../../store/authStore';

export const AdminHeader: React.FC = () => {
  const {
    theme,
    toggleTheme,
    setQuickSearchOpen,
    setOnboardHotelModalOpen,
    setActiveTab,
  } = useAdminStore();
  const { user: currentUser, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 w-full bg-card/95 backdrop-blur border-b border-border transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Platform Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <ShieldCheck size={22} className="text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-foreground tracking-tight leading-none">
                  Stayora
                </span>
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-none mt-1">
                Global Platform Governance
              </p>
            </div>
          </button>
        </div>

        {/* Global Search Bar (⌘K Affordance) */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={() => setQuickSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-input rounded-lg transition-all shadow-subtle group"
          >
            <div className="flex items-center gap-2.5">
              <Search size={15} className="group-hover:text-foreground transition-colors" />
              <span>Search users, hotels, ledger TXNs, disputes...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-1 font-mono text-[10px] font-semibold bg-background px-1.5 py-0.5 border border-border rounded text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Header Right Action Group */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Onboard Property CTA */}
          <button
            type="button"
            onClick={() => setOnboardHotelModalOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <PlusCircle size={15} />
            <span>Onboard Hotel</span>
          </button>

          {/* System Health Pulse Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity size={13} />
            <span>99.98% Online</span>
          </div>

          {/* Theme Toggle (Light / Dark) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400" />
            ) : (
              <Moon size={17} className="text-slate-600" />
            )}
          </button>

          {/* Superadmin User Profile & Logout */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-border">
            <div className="relative">
              <img
                src={
                  currentUser?.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                }
                alt={currentUser?.name || 'Administrator'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-foreground leading-none">
                {currentUser?.name || 'Devansh Mehta'}
              </div>
              <div className="text-[10px] font-semibold text-primary dark:text-brand-300 leading-none mt-1">
                {currentUser?.role || 'ADMIN'}
              </div>
            </div>

            {/* Logout Action */}
            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out of Admin Console"
              aria-label="Sign Out"
              className="p-1.5 ml-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

