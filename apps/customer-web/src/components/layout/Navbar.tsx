import React, { useState } from 'react';
import {
  Hotel,
  Sun,
  Moon,
  CalendarCheck2,
  Compass,
  User,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';

interface NavbarProps {
  currentView: 'search' | 'detail' | 'checkout' | 'confirmation' | 'bookings' | 'login' | 'register';
  onNavigate: (view: 'search' | 'bookings' | 'login' | 'register') => void;
  user: UserProfile | null;
  isAuthenticated: boolean;
  bookingCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  user,
  isAuthenticated,
  bookingCount,
  isDarkMode,
  onToggleTheme,
  onOpenProfile,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <div
          onClick={() => onNavigate('search')}
          className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-2xs group-hover:bg-brand-600 transition-colors">
            <Hotel className="w-4.5 h-4.5 stroke-[2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-none">
              Stayora
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">
              Luxury Sanctuaries
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            onClick={() => onNavigate('search')}
            className={`px-3 py-1.5 rounded-lg h-9 transition-colors flex items-center gap-2 text-xs font-semibold ${
              currentView === 'search' || currentView === 'detail'
                ? 'bg-secondary text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Compass size={15} className="stroke-[1.75]" />
            <span>Discover Stays</span>
          </button>

          <button
            onClick={() => onNavigate('bookings')}
            className={`px-3 py-1.5 rounded-lg h-9 transition-colors flex items-center gap-2 text-xs font-semibold relative ${
              currentView === 'bookings'
                ? 'bg-secondary text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <CalendarCheck2 size={15} className="stroke-[1.75]" />
            <span>My Bookings</span>
            {bookingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary text-primary-foreground">
                {bookingCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Action Icons & Profile / Login Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Currency Pill */}
          <div className="hidden lg:flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-mono font-medium text-muted-foreground bg-secondary/70 border border-border">
            <span>INR (₹)</span>
          </div>

          {/* Theme Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isDarkMode ? (
              <Sun size={17} className="text-amber-400 stroke-[1.75]" />
            ) : (
              <Moon size={17} className="stroke-[1.75]" />
            )}
          </button>

          {/* Auth State: Profile Pill if authenticated, Sign In button if not */}
          {isAuthenticated && user ? (
            <div
              onClick={onOpenProfile}
              className="flex items-center gap-2 h-9 p-1 pl-1.5 sm:pr-2.5 rounded-lg border border-border hover:bg-secondary/80 cursor-pointer transition-all select-none"
            >
              <div className="w-6.5 h-6.5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-900 dark:text-brand-100 flex items-center justify-center font-bold text-xs overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={13} />
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {user.name.split(' ')[0]}
                </span>
                <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-medium">
                  <ShieldCheck size={9} className="text-emerald-600" />
                  {user.memberTier}
                </span>
              </div>
              <ChevronDown size={13} className="text-muted-foreground hidden sm:block" />
            </div>
          ) : (
            <Button
              onClick={() => onNavigate('login')}
              size="sm"
              variant="default"
              leftIcon={<LogIn size={13} />}
              className="text-xs font-semibold h-9 px-3.5 shadow-2xs"
            >
              Sign In
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-2 animate-fade-in">
          <Button
            variant={currentView === 'search' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-sm"
            leftIcon={<Compass size={18} />}
            onClick={() => {
              onNavigate('search');
              setMobileMenuOpen(false);
            }}
          >
            Discover Hotels
          </Button>
          <Button
            variant={currentView === 'bookings' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-sm"
            leftIcon={<CalendarCheck2 size={18} />}
            onClick={() => {
              onNavigate('bookings');
              setMobileMenuOpen(false);
            }}
          >
            My Bookings {bookingCount > 0 ? `(${bookingCount})` : ''}
          </Button>

          {isAuthenticated && user ? (
            <Button
              variant="outline"
              className="w-full justify-start text-sm"
              leftIcon={<User size={18} />}
              onClick={() => {
                onOpenProfile();
                setMobileMenuOpen(false);
              }}
            >
              Guest Profile & Preferences ({user.name})
            </Button>
          ) : (
            <Button
              variant="default"
              className="w-full justify-start text-sm font-semibold"
              leftIcon={<LogIn size={18} />}
              onClick={() => {
                onNavigate('login');
                setMobileMenuOpen(false);
              }}
            >
              Sign In / Register
            </Button>
          )}
        </div>
      )}
    </header>
  );
};
