"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const currentYear = new Date().getFullYear();

const social = [
  { label: "Instagram", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "LinkedIn", href: "#" },
];

const listingsLinks = [
  { label: "Explore Listings", href: "/explore" },
  { label: "View All", href: "/explore?seeAll=All%20Listings" },
  { label: "Open Houses", href: "/open-houses" },
  { label: "Saved", href: "/saved" },
];

const companyLinks = [
  { label: "Market", href: "/market" },
  { label: "Valuation", href: "/valuation" },
  { label: "VIP Deals", href: "/vip" },
  { label: "Contact", href: "/profile" },
  { label: "Accessibility", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Use", href: "#" },
  { label: "Sitemap", href: "/explore" },
];

export default function Footer() {
  const { user, openAuthModal, isProtectedPath } = useAuth();

  const linkItem = (item) => {
    const protectedAndGuest = isProtectedPath(item.href) && !user;
    if (protectedAndGuest) {
      return (
        <li key={item.label}>
          <button
            type="button"
            onClick={() => openAuthModal(item.href)}
            className="hover:text-white transition-colors text-left"
          >
            {item.label}
          </button>
        </li>
      );
    }
    return (
      <li key={item.label}>
        <Link href={item.href} className="hover:text-white transition-colors">
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <footer className="bg-[var(--primary)] text-white" aria-label="Site footer">
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-8 lg:py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {/* Brand + social */}
          <div className="space-y-6 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl font-black text-white">
                L
              </div>
              <span className="text-lg font-bold tracking-tight">LUMINA Realty</span>
            </Link>
            <p className="text-sm text-white/75 max-w-[240px]">
              Find your next home across Canada. Listings, open houses, and market insights.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/70">
              {social.map((s) => (
                <a key={s.label} href={s.href} className="hover:text-white transition-colors" aria-label={s.label}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Listings */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Listings</p>
            <ul className="space-y-2.5 text-sm text-white/85">
              {listingsLinks.map(linkItem)}
            </ul>
          </div>

          {/* Company & tools */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Company & tools</p>
            <ul className="space-y-2.5 text-sm text-white/85">
              {companyLinks.map(linkItem)}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Legal</p>
            <ul className="space-y-2.5 text-sm text-white/85">
              {legalLinks.map(linkItem)}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/15 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-white/60">
          <p>© {currentYear} LUMINA Realty. All rights reserved.</p>
          <p className="text-white/50">Canada</p>
        </div>
      </div>
    </footer>
  );
}
