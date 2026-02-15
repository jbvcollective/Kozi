"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PricingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="mx-auto max-w-[600px] animate-fade-in px-8 pb-32 pt-24 md:px-12 text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
        You&apos;re subscribed to Agent Pro
      </h1>
      <p className="mt-4 text-muted">
        Thank you for subscribing. Your subscription is active and you can now use Agent Pro features.
      </p>
      {sessionId && (
        <p className="mt-2 text-xs text-muted">
          Session: {sessionId.slice(0, 24)}…
        </p>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/pricing"
          className="rounded-xl border-2 border-border bg-surface-elevated px-6 py-3 text-sm font-bold text-foreground hover:border-primary"
        >
          Back to pricing
        </Link>
        <Link
          href="/explore"
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          Explore listings
        </Link>
      </div>
    </div>
  );
}

export default function PricingSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[600px] px-8 pb-32 pt-24 md:px-12 text-center animate-pulse text-muted">Loading…</div>}>
      <PricingSuccessContent />
    </Suspense>
  );
}
