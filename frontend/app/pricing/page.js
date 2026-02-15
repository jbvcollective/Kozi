"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createCheckoutSession } from "@/lib/api";
import { supabase, hasSupabase } from "@/lib/supabase";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!hasSupabase()) return;
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription?.unsubscribe();
  }, []);

  const isAgentOrBroker = user?.user_metadata?.user_type === "agent";

  const handleAgentProCheckout = async () => {
    setError(null);
    if (!user) {
      setError("Sign in to subscribe to Agent Pro.");
      return;
    }
    if (!isAgentOrBroker) {
      setError("Agent Pro is for brokers and agents only. Sign up as a Broker/Agent to subscribe.");
      return;
    }
    setLoading(true);
    try {
      const { url } = await createCheckoutSession();
      if (url) window.location.href = url;
      else setError("Could not start checkout.");
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mx-auto max-w-[1600px] animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Plans</span>
      </div>
      <h1 className="mb-4 text-5xl font-black tracking-tight text-foreground md:text-6xl">
        Two sides of LUMINA
      </h1>
      <p className="mb-16 max-w-2xl text-lg text-muted">
        Browse as a user, or join as an agent to put your name on listings and customize your presence.
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* User side — free */}
        <section className="card rounded-2xl border-border bg-surface p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">For everyone</h2>
              <p className="text-sm text-muted">Buyers &amp; renters</p>
            </div>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black text-foreground">Free</span>
            <span className="ml-2 text-muted">forever</span>
          </div>
          <ul className="space-y-4 text-sm text-foreground">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              Browse Canadian listings
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              Save favorites &amp; compare
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              Open houses &amp; market insights
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              Home valuation &amp; tools
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="btn-primary inline-block rounded-xl px-6 py-3 text-sm"
            >
              Sign up
            </Link>
            <Link
              href="/explore"
              className="btn-secondary inline-block rounded-xl px-6 py-3 text-sm"
            >
              Start exploring
            </Link>
          </div>
        </section>

        {/* Agent side — paid */}
        <section className="rounded-2xl border-2 border-primary bg-primary p-10 text-white transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black">For agents</h2>
              <p className="text-sm text-white/60">Get listed &amp; stand out</p>
            </div>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black">Agent Pro</span>
            <p className="mt-2 text-white/60">Subscribe monthly via Stripe</p>
          </div>
          <ul className="space-y-4 text-sm text-white/90">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              <strong>Your name as listing agent</strong> on your properties
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              <strong>Customize the experience</strong> — branding, colors, logo
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Your profile &amp; contact front and center
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              Priority support &amp; onboarding
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-3">
            {user && !isAgentOrBroker && (
              <p className="rounded-xl bg-white/15 px-4 py-3 text-sm text-white" role="alert">
                Agent Pro is for brokers and agents only. Your account is set up as a user. To subscribe, sign up again as a Broker/Agent or contact us.
              </p>
            )}
            <button
              type="button"
              onClick={handleAgentProCheckout}
              disabled={loading || (!!user && !isAgentOrBroker)}
              className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Redirecting to checkout…" : !user ? "Sign in to subscribe" : user && !isAgentOrBroker ? "Broker/Agent account required" : "Subscribe with Stripe"}
            </button>
            {error && (
              <p className="text-sm text-white/90" role="alert">
                {error}
              </p>
            )}
            <a
              href="mailto:agents@lumina.example.com?subject=Agent%20Pro%20inquiry"
              className="text-sm text-white/70 underline hover:text-white"
            >
              Or get in touch for custom pricing
            </a>
          </div>
        </section>
      </div>

      <div className="mt-20 border-t border-border pt-12 text-center">
        <p className="text-sm text-muted">
          Have questions? <Link href="/profile" className="font-semibold text-primary underline-offset-2 hover:underline">Profile &amp; Settings</Link> or contact support.
        </p>
      </div>
    </div>
  );
}
