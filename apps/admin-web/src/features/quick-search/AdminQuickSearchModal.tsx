import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Users,
  Building2,
  Receipt,
  Scale,
  MessageSquare,
  Sliders,
  LayoutDashboard,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { AdminTab } from '../../types';

export const AdminQuickSearchModal: React.FC = () => {
  const {
    isQuickSearchOpen,
    setQuickSearchOpen,
    setActiveTab,
    users,
    hotels,
    transactions,
    disputes,
  } = useAdminStore();

  const [query, setQuery] = useState('');

  // Global Keyboard Shortcut ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen(!isQuickSearchOpen);
      }
      if (e.key === 'Escape' && isQuickSearchOpen) {
        setQuickSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickSearchOpen, setQuickSearchOpen]);

  if (!isQuickSearchOpen) return null;

  const navigateTo = (tab: AdminTab) => {
    setActiveTab(tab);
    setQuickSearchOpen(false);
    setQuery('');
  };

  const navItems: { label: string; tab: AdminTab; icon: React.ReactNode }[] = [
    { label: 'Overview & Vital Signals', tab: 'dashboard', icon: <LayoutDashboard size={15} /> },
    { label: 'User Directory & Governance', tab: 'users', icon: <Users size={15} /> },
    { label: 'Hotel Portfolio & Approvals', tab: 'properties', icon: <Building2 size={15} /> },
    { label: 'Manager Assignments', tab: 'managers', icon: <ShieldCheck size={15} /> },
    { label: 'Financial Ledger & Audit', tab: 'ledger', icon: <Receipt size={15} /> },
    { label: 'Dispute & Refund Queue', tab: 'refunds', icon: <Scale size={15} /> },
    { label: 'Review Moderation', tab: 'reviews', icon: <MessageSquare size={15} /> },
    { label: 'Platform Settings & Governance', tab: 'settings', icon: <Sliders size={15} /> },
  ];

  const matchedNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const matchedUsers = query.trim()
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase()) ||
          u.id.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4)
    : [];

  const matchedHotels = query.trim()
    ? hotels.filter(
        (h) =>
          h.name.toLowerCase().includes(query.toLowerCase()) ||
          h.city.toLowerCase().includes(query.toLowerCase()) ||
          h.id.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4)
    : [];

  const matchedTxns = query.trim()
    ? transactions.filter(
        (t) =>
          t.id.toLowerCase().includes(query.toLowerCase()) ||
          t.bookingId.toLowerCase().includes(query.toLowerCase()) ||
          t.guestName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-elevated w-full max-w-xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-border bg-card">
          <Search size={18} className="text-muted-foreground mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search users, hotels, ledger TXN IDs..."
            className="w-full bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setQuickSearchOpen(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
              ESC
            </kbd>
          </button>
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto p-3 space-y-4 text-xs">
          {/* Navigation Section */}
          {matchedNav.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Navigation Commands
              </div>
              <div className="space-y-0.5">
                {matchedNav.map((item) => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => navigateTo(item.tab)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-foreground transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-primary dark:text-brand-300">{item.icon}</span>
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hotels Matches */}
          {matchedHotels.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Hotel Properties
              </div>
              <div className="space-y-0.5">
                {matchedHotels.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => navigateTo('properties')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-foreground transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 size={15} className="text-primary" />
                      <div>
                        <span className="font-semibold text-foreground">{h.name}</span>
                        <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">({h.city})</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{h.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Users Matches */}
          {matchedUsers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Users & Managers
              </div>
              <div className="space-y-0.5">
                {matchedUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => navigateTo('users')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-foreground transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users size={15} className="text-primary" />
                      <div>
                        <span className="font-semibold text-foreground">{u.name}</span>
                        <span className="text-muted-foreground ml-1.5 text-[10px]">({u.role})</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transactions Matches */}
          {matchedTxns.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Ledger Transactions
              </div>
              <div className="space-y-0.5">
                {matchedTxns.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigateTo('ledger')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted text-foreground transition-colors text-left font-mono"
                  >
                    <div className="flex items-center gap-2.5 font-sans">
                      <Receipt size={15} className="text-primary" />
                      <div>
                        <span className="font-bold text-foreground font-mono">{t.id}</span>
                        <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">({t.bookingId})</span>
                      </div>
                    </div>
                    <span className="font-bold text-foreground">₹{t.grossAmount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
