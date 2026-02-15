"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useSaved } from "@/context/SavedContext";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_AVATAR = "https://picsum.photos/id/64/100/100";

const menuItems = [
  { label: "Home", href: "/", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Explore", href: "/explore", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "Saved", href: "/saved", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];

const toolItems = [
  { label: "Open Houses", href: "/open-houses", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
  { label: "Market", href: "/market", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { label: "VIP Deals", href: "/vip", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Snap", href: "/snap", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { label: "Valuation", href: "/valuation", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, openAuthModal, isProtectedPath } = useAuth();
  const { savedIds } = useSaved();

  const avatarUrl = user?.user_metadata?.avatar_url || DEFAULT_AVATAR;

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-full w-[100px] flex-col items-center border-r border-border bg-surface-elevated py-8 transition-premium"
      aria-label="Navigation"
    >
      <Link href="/" className="group mb-12 cursor-pointer block">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-black text-white transition-premium group-hover:scale-105 group-hover:[box-shadow:var(--shadow-elevated)]" style={{ boxShadow: "var(--shadow-card)" }}>
          L
        </div>
      </Link>

      <nav className="flex w-full flex-1 flex-col space-y-5 px-2">
        <div className="flex flex-col space-y-0.5">
          {menuItems.map((item) => {
            const isSaved = item.href === "/saved";
            const active = isSaved ? pathname === "/saved" : isActive(item.href);
            const protectedAndGuest = isProtectedPath(item.href) && !user;
            const className = `relative flex w-full flex-col items-center justify-center rounded-lg py-2.5 transition-premium ${
              active ? "bg-primary text-white" : "text-muted hover:bg-surface hover:text-foreground"
            }`;
            const title = item.label + (isSaved && savedIds.length ? ` (${savedIds.length})` : "");
            const content = (
              <>
                <span className="relative inline-block">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-0.5 h-6 w-6"
                    fill={isSaved && active ? "currentColor" : "none"}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                  </svg>
                  {isSaved && savedIds.length > 0 && (
                    <span
                      className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-error px-1 text-[9px] font-black text-white"
                      aria-hidden
                    >
                      {savedIds.length > 99 ? "99+" : savedIds.length}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              </>
            );
            if (protectedAndGuest) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => openAuthModal(item.href)}
                  className={className}
                  title={title}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={className} title={title}>
                {content}
              </Link>
            );
          })}
        </div>

        <div className="px-3">
          <div className="h-px w-full bg-border" />
        </div>

        <div className="flex flex-col space-y-0.5">
          {toolItems.map((item) => {
            const protectedAndGuest = isProtectedPath(item.href) && !user;
            const className = `flex w-full flex-col items-center justify-center rounded-lg py-2.5 transition-premium ${
              isActive(item.href) ? "bg-primary text-white" : "text-muted hover:bg-surface hover:text-foreground"
            }`;
            const content = (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mb-0.5 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                <span className="px-1 text-center text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              </>
            );
            if (protectedAndGuest) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => openAuthModal(item.href)}
                  className={className}
                  title={item.label}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={className} title={item.label}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto flex w-full flex-col items-center space-y-3 px-2">
        <Link
          href="/pricing"
          className={`flex w-full flex-col items-center py-2 transition-all ${
            isActive("/pricing") ? "text-primary" : "text-muted hover:text-foreground"
          }`}
          title="Pricing"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mb-0.5 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Pricing</span>
        </Link>

        {!user ? (
          <button
            type="button"
            onClick={() => openAuthModal("/profile")}
            className={`block h-12 w-12 overflow-hidden rounded-xl border-2 transition-premium hover:border-primary active:scale-95 ${
              isActive("/profile") ? "border-primary" : "border-border"
            }`}
            style={{ boxShadow: "var(--shadow-card)" }}
            title="Sign in or sign up"
            aria-label="Sign in or sign up"
          >
            <img
              src={avatarUrl}
              alt="Profile"
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <Link
            href="/profile"
            className={`block h-12 w-12 overflow-hidden rounded-xl border-2 transition-premium hover:border-primary active:scale-95 ${
              isActive("/profile") ? "border-primary" : "border-border"
            }`}
            style={{ boxShadow: "var(--shadow-card)" }}
            title="Profile"
            aria-label="Profile"
          >
            <img
              src={avatarUrl}
              alt="Your profile"
              className="h-full w-full object-cover"
            />
          </Link>
        )}
      </div>
    </aside>
  );
}
