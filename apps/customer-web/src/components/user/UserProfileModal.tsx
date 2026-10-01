import React from 'react';
import {
  User,
  ShieldCheck,
  Award,
  Phone,
  Mail,
  Calendar,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSwitchUser: (newUser: UserProfile) => void;
}

const DEMO_USERS: UserProfile[] = [
  {
    id: 'usr_cust_01',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    role: 'CUSTOMER',
    memberTier: 'Platinum Sanctuary',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    joinedDate: 'January 2025',
  },
  {
    id: 'usr_cust_02',
    name: 'Siddharth Roy',
    email: 'siddharth.roy@example.com',
    phone: '+91 91234 56789',
    role: 'CUSTOMER',
    memberTier: 'Gold Tier',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    joinedDate: 'May 2025',
  },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSwitchUser,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guest Profile & Sanctuary Club"
      description="Manage your traveler identity, membership tier, and verified bookings access."
      maxWidth="md"
    >
      <div className="space-y-5 text-xs">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/50">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-brand-200 shrink-0 border-2 border-primary/20">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <User size={24} className="m-auto text-primary" />
            )}
          </div>
          <div className="space-y-0.5">
            <h4 className="text-base font-bold font-serif text-foreground">
              {user.name}
            </h4>
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
              <ShieldCheck size={13} />
              <span>{user.memberTier}</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Member since {user.joinedDate}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-2 p-3.5 rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Mail size={13} /> Email:
            </span>
            <span className="font-semibold text-foreground font-mono">{user.email}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Phone size={13} /> Phone:
            </span>
            <span className="font-semibold text-foreground font-mono">{user.phone}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Award size={13} /> Platform Role:
            </span>
            <span className="font-mono uppercase font-bold text-primary">{user.role}</span>
          </div>
        </div>

        {/* Member Privileges */}
        <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200 space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5 text-xs">
            <Sparkles size={14} className="text-brand-600 dark:text-brand-400" />
            <span>Active Platinum Privileges</span>
          </div>
          <ul className="space-y-1 text-[11px] list-disc list-inside text-muted-foreground dark:text-brand-300">
            <li>Complimentary priority high-floor room assignment</li>
            <li>Guaranteed 14:00 early check-in when available</li>
            <li>Direct concierge line & express check-out</li>
          </ul>
        </div>

        {/* Switch Persona for Demo/Testing */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
            Switch Demo Guest Identity
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onSwitchUser(u);
                  onClose();
                }}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  user.id === u.id
                    ? 'border-primary bg-primary/10 font-bold'
                    : 'border-border hover:bg-secondary/80'
                }`}
              >
                <div className="font-semibold text-foreground">{u.name}</div>
                <div className="text-[10px] text-muted-foreground">{u.memberTier}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} size="sm" variant="outline">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
