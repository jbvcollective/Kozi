"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchVipDeals } from "@/lib/api";
import VIPDeals from "@/components/VIPDeals";
import Loading from "@/components/Loading";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { useChosenAgent } from "@/context/ChosenAgentContext";
import { useAgentPro } from "@/hooks/useAgentPro";

function VipPageContent() {
  const { user } = useAuth();
  const { chosenAgent } = useChosenAgent();
  const { hasAgentPro, isAgent } = useAgentPro();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDeals = useCallback(async () => {
    const list = await fetchVipDeals();
    setDeals(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDeals()
      .then(() => { if (!cancelled) setLoading(false); })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadDeals]);

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading VIP deals..."
        className="min-h-[40vh] px-8 pt-24 md:px-12"
      />
    );
  }

  if (isAgent && !hasAgentPro) {
    return (
      <div className="mx-auto max-w-[1600px] animate-fade-in px-4 sm:px-6 md:px-8 lg:px-12 pb-24 sm:pb-32 pt-20 md:pt-12 lg:pt-24 min-w-0">
        <header className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">VIP Deals</h1>
          <p className="mt-2 text-muted">Share exclusive discounts and perks with your clients.</p>
        </header>
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">Become an Agent Pro</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            With Agent Pro you can create exclusive VIP deals — discounts, coupons, and perks — and share them with every client who chooses you as their agent.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            Subscribe to Agent Pro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <VIPDeals
      deals={deals}
      isAgent={isAgent && hasAgentPro}
      onRefresh={loadDeals}
      chosenAgent={chosenAgent}
    />
  );
}

export default function VipPage() {
  return (
    <RequireAuth>
      <VipPageContent />
    </RequireAuth>
  );
}
