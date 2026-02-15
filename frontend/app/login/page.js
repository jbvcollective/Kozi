"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email?.trim() || !password?.trim()) {
      setError("Email and password are required.");
      return;
    }

    if (!hasSupabase()) {
      setError("Sign in is not configured yet. Contact support.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message ?? "Sign in failed.");
        return;
      }
      router.push("/explore");
      router.refresh();
    } catch (err) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Welcome back</span>
      </div>
      <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">Sign in</h1>
      <p className="mb-10 text-muted">Sign in to your LUMINA account to access saved listings and more.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-foreground">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-2 block text-sm font-bold text-foreground">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Your password"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Don’t have an account?{" "}
        <Link href="/profile" className="font-semibold text-primary underline-offset-2 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
