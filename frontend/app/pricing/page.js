"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase, hasSupabase } from "@/lib/supabase";

const PAYMENT_LINK = "https://buy.stripe.com/eVqbJ33HueTS8d7a492Nq01";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60;

export default function PricingPage() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState(null);
  const [polling, setPolling] = useState(false);
  const [verified, setVerified] = useState(false);
  const pollRef = useRef(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!hasSupabase()) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hasSupabase() || !user?.id || user?.user_metadata?.user_type !== "agent") {
      setAgentData(null);
      return;
    }
    supabase.from("agents").select("data, is_paid").eq("user_id", user.id).maybeSingle().then(({ data }) => setAgentData(data ?? null));
  }, [user?.id, user?.user_metadata?.user_type]);

  const isAgentOrBroker = user?.user_metadata?.user_type === "agent";
  const alreadyPro = !!(agentData?.is_paid || agentData?.data?.agent_pro_subscribed_at) || verified;

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    attemptRef.current = 0;
    setPolling(false);
  }, []);

  const pollForPayment = useCallback(() => {
    if (!user?.id || !user?.email) return;
    setPolling(true);
    attemptRef.current = 0;

    pollRef.current = setInterval(async () => {
      attemptRef.current += 1;
      if (attemptRef.current > POLL_MAX_ATTEMPTS) {
        stopPolling();
        return;
      }
      try {
        const res = await fetch("/api/verify-agent-pro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, user_id: user.id }),
        });
        const data = await res.json();
        if (data.verified) {
          stopPolling();
          setVerified(true);
          setSubscribing(false);
          setAgentData((prev) => ({ ...prev, is_paid: true }));
        }
      } catch (_) {}
    }, POLL_INTERVAL_MS);
  }, [user?.id, user?.email, stopPolling]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleSubscribe = () => {
    if (!user?.id || !isAgentOrBroker || subscribing) return;
    setSubscribeError(null);
    setSubscribing(true);
    const params = new URLSearchParams();
    if (user.email) params.set("prefilled_email", user.email);
    params.set("client_reference_id", user.id);
    window.open(`${PAYMENT_LINK}?${params.toString()}`, "_blank");
    pollForPayment();
  };

  return (
    <div className="mx-auto max-w-[1600px] animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Plans</span>
      </div>
      <h1 className="mb-4 text-5xl font-black tracking-tight text-foreground md:text-6xl">
        Two sides of Kozi
      </h1>
      <p className="mb-16 max-w-2xl text-lg text-muted">
        Browse as a user, or join as an agent to put your name on listings and customize your presence.
      </p>

      {/* Agent plans heading */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">For agents &amp; brokers</span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">Grow your business</h2>
        <p className="mt-2 text-muted">Choose the plan that fits your goals.</p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Agent Pro */}
        <section className="rounded-2xl border-2 border-primary bg-primary p-10 text-white transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black">Agent Pro</h2>
              <p className="text-sm text-white/60">Get listed &amp; stand out</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="text-white/60">Monthly subscription</p>
          </div>
          <ul className="space-y-4 text-sm text-white/90">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
              <strong>Your name as listing agent</strong> on your properties
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
                Agent Pro is for agents only. Sign up as an Agent to get started.
              </p>
            )}
            {subscribeError && (
              <p className="rounded-xl bg-white/15 px-4 py-3 text-xs text-white/80" role="alert">
                {subscribeError}
              </p>
            )}
            {alreadyPro && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Agent Pro is active
              </div>
            )}
            {isAgentOrBroker && !alreadyPro && (
              <>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing || polling}
                  className="inline-block rounded-xl bg-white px-6 py-3 text-center text-sm font-bold text-primary transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {polling ? "Waiting for payment..." : subscribing ? "Opening checkout..." : "Subscribe monthly"}
                </button>
                {polling && (
                  <p className="text-center text-xs text-white/70 animate-pulse">
                    Complete payment in the new tab. This page will update automatically.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Agent Plus — coming soon */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-border bg-surface p-10 transition-premium">
          <div className="absolute right-6 top-6 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">Coming soon</div>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Agent Plus</h2>
              <p className="text-sm text-muted">Everything in Pro &amp; more</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="text-muted">Everything in Agent Pro, plus:</p>
          </div>
          <ul className="space-y-4 text-sm text-foreground">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <strong>Custom branded website</strong> — your colors, logo, domain
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <strong>Analytics dashboard</strong> — views, leads, performance
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <strong>Lead capture &amp; CRM</strong> — manage client inquiries
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <strong>Advanced customization</strong> — themes, layouts, featured listings
            </li>
          </ul>
          <div className="mt-8">
            <div className="inline-block rounded-xl bg-surface-elevated px-6 py-3 text-center text-sm font-bold text-muted opacity-70">
              Coming soon
            </div>
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
