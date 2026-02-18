"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useSaved } from "@/context/SavedContext";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { useLinkedAgent } from "@/context/LinkedAgentContext";
import { useAgentPro } from "@/hooks/useAgentPro";

const USER_SETTINGS_EMOJI = "⚙️";

function NavIcon({ d }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

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
  { label: "Feedback", href: "/feedback", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, openAuthModal, isProtectedPath } = useAuth();
  const { savedIds } = useSaved();
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { linkedAgent } = useLinkedAgent();
  const { hasAgentPro, isAgent } = useAgentPro();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const isAgentUser = user?.user_metadata?.user_type === "agent";
  const avatarUrl = isAgentUser ? (user?.user_metadata?.avatar_url ?? null) : null;

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const linkClass = (active) =>
    `flex items-center gap-4 rounded-xl px-4 py-3.5 text-left transition-premium ${
      active ? "bg-primary text-white" : "text-foreground hover:bg-surface"
    }`;

  const allNavItems = [
    ...menuItems.map((m) => ({ ...m, isMenu: true })),
    ...toolItems.map((t) => ({ ...t, isMenu: false })),
  ];

  /** Page title for mobile header (pathname -> display label) */
  const getMobilePageTitle = () => {
    if (!pathname) return "Kozi";
    if (pathname === "/") return "Home";
    const all = [...menuItems, ...toolItems];
    const match = all.find((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
    if (match) return match.label;
    if (pathname.startsWith("/listings/")) return "Listing";
    if (pathname.startsWith("/login")) return "Sign in";
    if (pathname.startsWith("/profile")) return "Profile";
    if (pathname.startsWith("/pricing")) return "Pricing";
    if (pathname.startsWith("/feedback")) return "Feedback";
    return "Kozi";
  };

  const mobilePageTitle = getMobilePageTitle();

  return (
    <>
      {/* Mobile: top bar with logo + page title + hamburger */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 min-h-[56px] items-center justify-between gap-2 border-b border-border bg-surface-elevated px-3 safe-top md:hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-lg font-black text-white" onClick={() => setMobileMenuOpen(false)}>
          {linkedAgent?.logo_url ? <img src={linkedAgent.logo_url} alt="" className="h-full w-full object-contain p-1" /> : "K"}
        </Link>
        <h1 className="flex-1 min-w-0 text-center text-base font-bold tracking-tight text-foreground truncate">
          {mobilePageTitle}
        </h1>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-surface"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile: drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          aria-hidden="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] flex flex-col border-r border-border bg-surface-elevated py-6 px-4 animate-fade-in overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-black uppercase tracking-widest text-muted">Menu</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface" aria-label="Close menu">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {allNavItems.map((item) => {
                const isSaved = item.href === "/saved";
                const active = isSaved ? pathname === "/saved" : isActive(item.href);
                const protectedAndGuest = isProtectedPath(item.href) && !user;
                const title = item.label + (isSaved && savedIds.length ? ` (${savedIds.length})` : "");
                const content = (
                  <span className="flex items-center gap-4">
                    <NavIcon d={item.icon} />
                    <span className="font-bold">{item.label}</span>
                    {isSaved && savedIds.length > 0 && (
                      <span className="ml-auto rounded-full bg-error px-2 py-0.5 text-[10px] font-black text-white">{savedIds.length > 99 ? "99+" : savedIds.length}</span>
                    )}
                  </span>
                );
                if (protectedAndGuest) {
                  return (
                    <button key={item.href} type="button" onClick={() => openAuthModal(item.href)} className={linkClass(false)} title={title}>
                      {content}
                    </button>
                  );
                }
                return (
                  <Link key={item.href} href={item.href} className={linkClass(active)} title={title} onClick={() => setMobileMenuOpen(false)}>
                    {content}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 border-t border-border pt-4 flex flex-col gap-2">
              {isAgent && (
                <Link href="/pricing" className={linkClass(isActive("/pricing"))} onClick={() => setMobileMenuOpen(false)}>
                  <span className="flex items-center gap-4">
                    <NavIcon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    <span className="font-bold">Pricing</span>
                  </span>
                </Link>
              )}
              {isAgent && hasAgentPro && (
                <Link href="/dashboard/customize" className={linkClass(pathname?.startsWith("/dashboard"))} onClick={() => setMobileMenuOpen(false)}>
                  <span className="flex items-center gap-4">
                    <NavIcon d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    <span className="font-bold">Customize</span>
                  </span>
                </Link>
              )}
              {!user ? (
                <button type="button" onClick={() => openAuthModal("/profile")} className={linkClass(false)}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xl" aria-hidden>{USER_SETTINGS_EMOJI}</span>
                  <span className="font-bold">Sign in</span>
                </button>
              ) : (
                <Link href="/profile" className={linkClass(isActive("/profile"))} onClick={() => setMobileMenuOpen(false)}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xl" aria-hidden>{USER_SETTINGS_EMOJI}</span>
                  )}
                  <span className="font-bold">Profile</span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop: closed = glass square around hamburger; open = full rail */}
    <aside
      className={`sidebar-rail hidden md:flex fixed left-0 top-0 z-50 flex-col items-center justify-center overflow-hidden border-r border-border ${
        sidebarOpen
          ? "h-full w-[72px] lg:w-[88px] xl:w-[100px] py-6 lg:py-8 bg-surface-elevated"
          : "h-12 w-12 p-1 rounded-br-2xl border-b border-white/20 bg-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:bg-surface-elevated/80 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      }`}
      style={sidebarOpen ? { boxShadow: "var(--shadow-card)" } : undefined}
      aria-label={sidebarOpen ? "Navigation" : "Open sidebar"}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className={`flex h-10 w-10 shrink-0 flex-shrink-0 items-center justify-center rounded-xl text-muted transition-premium ${
          sidebarOpen
            ? "hover:bg-surface hover:text-foreground"
            : "border border-white/50 bg-white/40 shadow-md backdrop-blur-md hover:border-white/70 hover:bg-white/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20"
        }`}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={sidebarOpen ? "Close menu" : "Open menu"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {sidebarOpen && (
        <div key="sidebar-open-content" className="sidebar-content-in flex flex-1 flex-col items-center w-full min-w-0 pt-4 lg:pt-6">
          <Link href="/" className="group cursor-pointer block mb-6 lg:mb-8">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center overflow-hidden rounded-xl bg-primary text-lg lg:text-xl font-black text-white transition-premium group-hover:scale-105 group-hover:[box-shadow:var(--shadow-elevated)]" style={{ boxShadow: "var(--shadow-card)" }}>
              {linkedAgent?.logo_url ? <img src={linkedAgent.logo_url} alt="" className="h-full w-full object-contain p-1" /> : "K"}
            </div>
          </Link>

          <nav className="flex w-full flex-1 flex-col space-y-3 lg:space-y-5 px-1.5 lg:px-2">
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
        {isAgent && (
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
        )}

        {isAgent && hasAgentPro && (
          <Link
            href="/dashboard/customize"
            className={`flex w-full flex-col items-center py-2 transition-all ${
              pathname?.startsWith("/dashboard") ? "text-primary" : "text-muted hover:text-foreground"
            }`}
            title="Customize your branding"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-0.5 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Customize</span>
          </Link>
        )}

        {!user ? (
          <button
            type="button"
            onClick={() => openAuthModal("/profile")}
            className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 transition-premium hover:border-primary active:scale-95 ${
              isActive("/profile") ? "border-primary text-white" : "border-border bg-surface text-muted"
            }`}
            style={{ boxShadow: "var(--shadow-card)" }}
            title="Sign in or sign up"
            aria-label="Sign in or sign up"
          >
            <span className="text-2xl" aria-hidden>{USER_SETTINGS_EMOJI}</span>
          </button>
        ) : (
          <Link
            href="/profile"
            className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 transition-premium hover:border-primary active:scale-95 ${
              isActive("/profile") ? "border-primary" : "border-border"
            }`}
            style={{ boxShadow: "var(--shadow-card)" }}
            title="Profile"
            aria-label="Profile"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl" aria-hidden>{USER_SETTINGS_EMOJI}</span>
            )}
          </Link>
        )}
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
