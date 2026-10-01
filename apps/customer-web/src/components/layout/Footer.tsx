import React from 'react';
import { Hotel, ShieldCheck, Lock, CheckCircle2, Clock, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-neutral-100/60 dark:bg-neutral-900/60 mt-16 transition-colors">
      {/* 4 Trust Anchors Banner per Design System Section 19 */}
      <div className="border-b border-border/70 py-8 bg-background/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                <CheckCircle2 size={20} className="stroke-[1.75]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Guaranteed Reservations</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Real-time atomic holds prevent mid-checkout inventory loss and double bookings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                <ShieldCheck size={20} className="stroke-[1.75]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">100% Price Transparency</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Zero surprise fees at checkout. All base rates, GST, and taxes are clearly disclosed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shrink-0">
                <Clock size={20} className="stroke-[1.75]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">48-Hour Cancellation Rule</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Cancel up to 48h before check-in for an immediate full refund back to your account.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 shrink-0">
                <Lock size={20} className="stroke-[1.75]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Bank-Grade 256-Bit TLS</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Card and UPI credentials are cryptographically tokenized and never stored in plain text.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <Hotel className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-foreground">
                Stayora
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Curating architectural hospitality sanctuaries, luxury heritage palaces, and coastal resorts across India.
            </p>
            <div className="text-xs text-muted-foreground font-mono">
              Designed with hospitality precision & modern UX psychology.
            </div>
          </div>

          {/* Quick Destinations */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Signature Destinations
            </h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="hover:text-foreground cursor-pointer">Chennai Coastal & Urban</li>
              <li className="hover:text-foreground cursor-pointer">Mumbai Historic Waterfront</li>
              <li className="hover:text-foreground cursor-pointer">Udaipur Royal Lake Sanctuaries</li>
              <li className="hover:text-foreground cursor-pointer">Goa Emerald Paddy & Beach</li>
              <li className="hover:text-foreground cursor-pointer">Bengaluru Palace Garden Retreats</li>
              <li className="hover:text-foreground cursor-pointer">Jaipur Rajput Heritage Estates</li>
            </ul>
          </div>

          {/* Guest Lifecycle */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Guest Care & Policies
            </h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="hover:text-foreground cursor-pointer">48-Hour Cancellation Policy</li>
              <li className="hover:text-foreground cursor-pointer">Verified Post-Stay Reviews Invariant</li>
              <li className="hover:text-foreground cursor-pointer">15-Minute Hold Protection</li>
              <li className="hover:text-foreground cursor-pointer">Guest Folio & Digital Receipts</li>
              <li className="hover:text-foreground cursor-pointer">Special Requests & Concierge</li>
              <li className="hover:text-foreground cursor-pointer">Accessibility Compliance (WCAG AA)</li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Customer Support
            </h5>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Need assistance with an active reservation or arrival coordination? Our guest desk is available 24/7.
            </p>
            <div className="p-3 rounded-lg bg-background border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground">Concierge Desk</div>
              <div className="text-muted-foreground font-mono">+91 1800-STAYORA (Toll-Free)</div>
              <div className="text-primary font-mono text-[11px]">concierge@stayora.luxury</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} Stayora Hospitality Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span>Crafted for exquisite traveler peace of mind</span>
            <Heart size={12} className="text-rose-500 fill-rose-500 inline ml-1" />
          </div>
        </div>
      </div>
    </footer>
  );
};
