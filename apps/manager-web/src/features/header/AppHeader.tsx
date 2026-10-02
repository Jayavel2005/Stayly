import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Search,
  Bell,
  CheckCheck,
  AlertCircle,
  CalendarCheck,
  Wrench,
  Sparkles,
  User,
  Shield,
  Hotel as HotelIcon,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { cn } from '../../lib/utils';

export const AppHeader: React.FC = () => {
  const {
    currentHotelId,
    setCurrentHotelId,
    hotels,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    user,
    setQuickSearchOpen,
    setActiveTab,
  } = useManagerStore();

  const [isHotelDropdownOpen, setIsHotelDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const hotelDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hotelDropdownRef.current && !hotelDropdownRef.current.contains(e.target as Node)) {
        setIsHotelDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for Quick Search (Ctrl+K or ⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setQuickSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setQuickSearchOpen]);

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN_DUE':
        return <CalendarCheck size={15} className="text-sky-600 dark:text-sky-400" />;
      case 'ROOM_MAINTENANCE':
        return <Wrench size={15} className="text-amber-600 dark:text-amber-400" />;
      case 'NEW_BOOKING':
        return <Building2 size={15} className="text-emerald-600 dark:text-emerald-400" />;
      case 'NEW_REVIEW':
        return <Sparkles size={15} className="text-purple-600 dark:text-purple-400" />;
      default:
        return <AlertCircle size={15} className="text-primary" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 w-full shrink-0 border-b border-border bg-card/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left: Property Switcher & Shift Status */}
      <div className="flex items-center gap-4">
        {/* Mobile Logo Monogram */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm shadow-subtle">
            S
          </div>
        </div>

        {/* Property Switcher Dropdown */}
        <div className="relative" ref={hotelDropdownRef}>
          <button
            type="button"
            onClick={() => setIsHotelDropdownOpen(!isHotelDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={isHotelDropdownOpen}
          >
            <div className="w-6 h-6 rounded bg-brand-50 text-brand-900 dark:bg-brand-900/60 dark:text-brand-300 flex items-center justify-center shrink-0">
              <HotelIcon size={14} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                  {currentHotel?.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 rounded">
                  {currentHotel?.starRating}★
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground block -mt-0.5">
                {currentHotel?.city}, {currentHotel?.state}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-muted-foreground ml-1 transition-transform duration-200',
                isHotelDropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Switcher Menu */}
          {isHotelDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-card border border-border shadow-elevated py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
                Assigned Managed Properties
              </div>
              {hotels.map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  onClick={() => {
                    setCurrentHotelId(hotel.id);
                    setIsHotelDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-muted transition-colors',
                    hotel.id === currentHotelId && 'bg-accent/60 font-medium'
                  )}
                >
                  <div className="w-7 h-7 rounded bg-brand-100 text-brand-900 dark:bg-brand-900/50 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
                    <HotelIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {hotel.name}
                      </span>
                      {hotel.id === currentHotelId && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      {hotel.city} • {hotel.starRating} Stars
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Operations Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          <span>Front-Desk Live Ops</span>
          <span className="text-emerald-400">•</span>
          <span className="text-muted-foreground font-normal">Oct 1, 2026</span>
        </div>
      </div>

      {/* Center: Global Search Bar Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <button
          type="button"
          onClick={() => setQuickSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg border border-input bg-background/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground text-xs transition-colors shadow-subtle group"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="text-muted-foreground group-hover:text-primary" />
            <span>Search guest, booking ref (BK-XXXX), or room #...</span>
          </div>
          <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Quick Search (Mobile), Notifications, Theme, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={() => setQuickSearchOpen(true)}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Search"
        >
          <Search size={18} />
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-card">
              2
            </span>
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-card border border-border shadow-elevated py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Operational Alerts</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No active notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationAsRead(notif.id)}
                      className={cn(
                        'p-3.5 flex items-start gap-3 hover:bg-muted/60 transition-colors cursor-pointer',
                        !notif.isRead && 'bg-brand-50/50 dark:bg-brand-950/20'
                      )}
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-card border border-border shrink-0 shadow-subtle">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {notif.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-border bg-muted/30 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('front-desk');
                    setIsNotificationsOpen(false);
                  }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  View Front-Desk Manifest →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manager User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border focus-visible:outline-none"
          >
            <img
              src={user.avatarUrl}
              alt={user.firstName}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-border shadow-subtle"
            />
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-foreground block leading-tight">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Shield size={10} className="text-emerald-600" />
                Hotel Manager
              </span>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-elevated py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-bold text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-300 text-[10px] font-semibold">
                  Role: {user.role}
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('property');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Building2 size={14} className="text-muted-foreground" />
                  Property Configuration
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <User size={14} className="text-muted-foreground" />
                  Manager Profile Settings
                </button>
              </div>

              <div className="border-t border-border pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium"
                >
                  Sign Out of Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
