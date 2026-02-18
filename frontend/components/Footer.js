"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const currentYear = new Date().getFullYear();

const social = [
  { label: "Instagram", href: "#", icon: "instagram" },
  { label: "Facebook", href: "#", icon: "facebook" },
  { label: "LinkedIn", href: "#", icon: "linkedin" },
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
  { label: "Link agent code", href: "/link-agent" },
  { label: "Contact", href: "/profile" },
  { label: "Accessibility", href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Use", href: "#" },
  { label: "Sitemap", href: "/explore" },
];

function SocialIcon({ kind, className }) {
  const c = className ?? "h-5 w-5";
  if (kind === "instagram") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.885 2h.08zm0-2C9.717 0 9.327.007 8.985.04c-1.366.083-2.37.36-3.168.766C4.67 1.234 3.834 2.07 3.269 3.1c-.406.798-.683 1.802-.766 3.168C2.007 7.327 2 7.717 2 12s.007 4.673.04 5.015c.083 1.367.36 2.37.766 3.168.601 1.04 1.438 1.876 2.508 2.507.798.407 1.802.684 3.168.767.342.032.732.039 5.015.039s4.673-.007 5.016-.04c1.366-.083 2.37-.36 3.168-.766 1.04-.601 1.876-1.438 2.508-2.508.406-.798.683-1.802.766-3.168.033-.342.04-.732.04-5.015s-.007-4.673-.04-5.016c-.083-1.366-.36-2.37-.766-3.168a5.975 5.975 0 00-2.508-2.508c-.798-.406-1.802-.683-3.168-.766C15.673.007 15.283 0 12 0h-.08z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" clipRule="evenodd" />
      </svg>
    );
  }
  if (kind === "facebook") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
      </svg>
    );
  }
  if (kind === "linkedin") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  return null;
}

export default function Footer() {
  const { user, openAuthModal, isProtectedPath } = useAuth();

  const linkItem = (item) => {
    const protectedAndGuest = isProtectedPath(item.href) && !user;
    const linkClass =
      "text-muted hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded";
    if (protectedAndGuest) {
      return (
        <li key={item.label}>
          <button type="button" onClick={() => openAuthModal(item.href)} className={`text-left ${linkClass}`}>
            {item.label}
          </button>
        </li>
      );
    }
    return (
      <li key={item.label}>
        <Link href={item.href} className={linkClass}>
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <footer
      className="shrink-0 border-t border-border bg-surface text-foreground"
      aria-label="Site footer"
      style={{ boxShadow: "0 -1px 0 0 var(--border)" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:px-8 md:py-14 lg:py-16">
        <div className="grid gap-10 sm:gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-x-12 xl:gap-x-16">
          {/* Brand */}
          <div className="lg:col-span-1 space-y-5">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-black text-white"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                K
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">Kozi</span>
            </Link>
            <p className="text-sm text-muted max-w-[260px] leading-relaxed">
              Find your next home across Canada. Listings, open houses, and market insights.
            </p>
            <div className="flex items-center gap-3">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-elevated text-muted transition-all duration-200 hover:border-primary/40 hover:text-primary hover:shadow-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
                  aria-label={s.label}
                >
                  <SocialIcon kind={s.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Listings */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Listings</p>
            <ul className="space-y-3 text-sm">
              {listingsLinks.map(linkItem)}
            </ul>
          </div>

          {/* Company & tools */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Company & tools</p>
            <ul className="space-y-3 text-sm">
              {companyLinks.map(linkItem)}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Legal</p>
            <ul className="space-y-3 text-sm">
              {legalLinks.map(linkItem)}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted">
          <p>© {currentYear} Kozi. All rights reserved.</p>
          <p>Canada</p>
        </div>
      </div>
    </footer>
  );
}
