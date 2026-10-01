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
} from 'lucide-react';
import { UserProfile } from '../../types';
import { Button } from '../ui/Button';

interface NavbarProps {
  currentView: 'search' | 'detail' | 'checkout' | 'confirmation' | 'bookings';
  onNavigate: (view: 'search' | 'bookings') => void;
  user: UserProfile;
  bookingCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  user,
  bookingCount,
  isDarkMode,
  onToggleTheme,
  onOpenProfile,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-colors">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <div
          onClick={() => onNavigate('search')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:bg-brand-600 transition-colors">
            <Hotel className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              Stayora
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold -mt-1">
              Luxury Sanctuaries
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            onClick={() => onNavigate('search')}
            className={`px-3.5 py-2 rounded-md transition-colors flex items-center gap-2 ${
              currentView === 'search' || currentView === 'detail'
                ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Compass size={16} className="stroke-[1.75]" />
            <span>Discover Stays</span>
          </button>

          <button
            onClick={() => onNavigate('bookings')}
            className={`px-3.5 py-2 rounded-md transition-colors flex items-center gap-2 relative ${
              currentView === 'bookings'
                ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <CalendarCheck2 size={16} className="stroke-[1.75]" />
            <span>My Bookings</span>
            {bookingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold bg-primary text-primary-foreground">
                {bookingCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Currency Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-muted-foreground bg-secondary/80 border border-border">
            <span>INR (₹)</span>
          </div>

          {/* Theme Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isDarkMode ? (
              <Sun size={18} className="text-amber-400 stroke-[1.75]" />
            ) : (
              <Moon size={18} className="stroke-[1.75]" />
            )}
          </button>

          {/* User Account Trigger */}
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 p-1.5 pl-2 sm:pr-3 rounded-lg border border-border hover:bg-secondary/80 cursor-pointer transition-all select-none"
          >
            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-900 dark:text-brand-100 flex items-center justify-center font-bold text-xs overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User size={14} />
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {user.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                <ShieldCheck size={10} className="text-emerald-600" />
                {user.memberTier}
              </span>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
          <Button
            variant="outline"
            className="w-full justify-start text-sm"
            leftIcon={<User size={18} />}
            onClick={() => {
              onOpenProfile();
              setMobileMenuOpen(false);
            }}
          >
            Guest Profile & Preferences
          </Button>
        </div>
      )}
    </header>
  );
};
