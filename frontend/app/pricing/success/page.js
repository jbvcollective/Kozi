"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const REDIRECT_SECONDS = 5;

export default function PricingSuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-muted">Loading...</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [status, setStatus] = useState("waiting");
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!sessionId || status !== "waiting") return;

    (async () => {
      setStatus("verifying");
      try {
        const res = await fetch("/api/verify-agent-pro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (data.verified) {
          setStatus("verified");
        } else {
          setErrorMsg(data.message || data.error || "Could not verify payment.");
          setStatus("error");
        }
      } catch {
        setErrorMsg("Network error while verifying payment.");
        setStatus("error");
      }
    })();
  }, [sessionId, status]);

  useEffect(() => {
    if (status !== "verified" && status !== "error") return;
    if (countdown <= 0) {
      router.push("/");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router, status]);

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-[600px] animate-fade-in px-8 pb-32 pt-24 text-center md:px-12">
        <h1 className="text-3xl font-black tracking-tight text-foreground">No session found</h1>
        <p className="mt-4 text-muted">
          It looks like you arrived here without completing checkout.
        </p>
        <Link href="/pricing" className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90">
          Back to pricing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[600px] animate-fade-in px-8 pb-32 pt-24 text-center md:px-12">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
        Welcome to Agent Pro
      </h1>
      <p className="mt-4 text-muted">
        Your payment is complete. Your name and contact info will now appear as the listing agent across all listings.
      </p>
      {status === "verifying" && (
        <p className="mt-4 text-sm text-muted">Verifying your subscription...</p>
      )}
      {status === "verified" && (
        <p className="mt-4 text-sm font-semibold text-green-600">Subscription verified and activated!</p>
      )}
      {status === "error" && (
        <p className="mt-4 text-sm text-red-500">{errorMsg}</p>
      )}
      <p className="mt-6 text-sm text-muted">
        Redirecting in <strong className="text-foreground">{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/dashboard/customize"
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          Customize your branding
        </Link>
        <Link
          href="/explore"
          className="rounded-xl border-2 border-border bg-surface-elevated px-6 py-3 text-sm font-bold text-foreground hover:border-primary"
        >
          Explore listings
        </Link>
      </div>
    </div>
  );
}
