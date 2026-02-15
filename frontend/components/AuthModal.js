"use client";

import { useState } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(str) {
  return typeof str === "string" && EMAIL_REGEX.test(str.trim());
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [userType, setUserType] = useState(null); // null | "user" | "agent" (for signup)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email?.trim() || !password?.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (!hasSupabase()) {
      setError("Sign in is not configured. Contact support.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message ?? "Sign in failed.");
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const trimmedEmail = email?.trim();
    if (!trimmedEmail || !password?.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (userType === "user") {
      if (!name?.trim()) {
        setError("Name is required.");
        return;
      }
      if (!phone?.trim()) {
        setError("Phone is required.");
        return;
      }
    }
    if (userType === "agent") {
      if (!name?.trim() || !phone?.trim() || !brokerage?.trim()) {
        setError("Name, phone, and brokerage chosen name are required.");
        return;
      }
    }
    if (!hasSupabase()) {
      setError("Sign up is not configured. Contact support.");
      return;
    }
    setLoading(true);
    try {
      const metadata = {
        full_name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        user_type: userType || "user",
        ...(userType === "agent" && {
          brokerage: brokerage.trim(),
          agent_code: agentCode?.trim() || undefined,
        }),
      };
      const { data, error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });
      if (err) {
        setError(err.message ?? "Sign up failed.");
        return;
      }
      if (data?.user && userType === "agent") {
        await supabase.from("auth_agents_with_type").upsert(
          {
            user_id: data.user.id,
            agent_code: agentCode?.trim() || null,
            display_name: name.trim() || trimmedEmail,
            brokerage: brokerage?.trim() || null,
            email: trimmedEmail,
            phone: phone?.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      if (data?.session) {
        onSuccess?.();
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setUserType(null);
      }
    } catch (err) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === "signin" ? handleSignIn : handleSignUp;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-surface-elevated p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="auth-modal-title" className="text-2xl font-black tracking-tight text-foreground mb-1">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <p className="text-sm text-muted mb-6">
          {mode === "signin"
            ? "Sign in to view listings and save your favourites."
            : mode === "signup" && userType === null
              ? "Are you signing up as a user or as a broker/agent?"
              : userType === "user"
                ? "Create your account with name, email, phone and password."
                : "Create your broker/agent account with name, email, phone, brokerage chosen name and password."}
        </p>

        {mode === "signup" && userType === null ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setUserType("user"); setError(null); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-surface p-6 text-left transition-all hover:border-primary hover:bg-surface-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-lg font-black text-foreground">User</span>
                <span className="text-xs text-muted">Buyer or renter</span>
              </button>
              <button
                type="button"
                onClick={() => { setUserType("agent"); setError(null); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-surface p-6 text-left transition-all hover:border-primary hover:bg-surface-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-lg font-black text-foreground">Broker / Agent</span>
                <span className="text-xs text-muted">List properties</span>
              </button>
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && userType !== null && (
              <button
                type="button"
                onClick={() => { setUserType(null); setError(null); }}
                className="text-sm text-muted hover:text-foreground"
              >
                ← Back
              </button>
            )}
            {mode === "signup" && userType !== null && (
              <>
                <div>
                  <label htmlFor="auth-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Your name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="auth-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-muted">Use a valid email format (e.g. name@example.com)</p>
                </div>
                <div>
                  <label htmlFor="auth-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="(555) 123-4567"
                    disabled={loading}
                  />
                </div>
                {userType === "agent" && (
                  <>
                    <div>
                      <label htmlFor="auth-agent-code" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                        Agent code (optional)
                      </label>
                      <input
                        id="auth-agent-code"
                        type="text"
                        value={agentCode}
                        onChange={(e) => setAgentCode(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. ABC123 — users can find you by this"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="auth-brokerage" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                        Brokerage chosen name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="auth-brokerage"
                        type="text"
                        autoComplete="organization"
                        value={brokerage}
                        onChange={(e) => setBrokerage(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. REAL BROKER ONTARIO LTD."
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {mode === "signin" && (
              <>
                <div>
                  <label htmlFor="auth-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="auth-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Your password"
                    disabled={loading}
                    required
                  />
                </div>
              </>
            )}
            {mode === "signup" && userType !== null && (
              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="At least 6 characters"
                  disabled={loading}
                />
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800" role="status">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setUserType(null); setError(null); setMessage(null); }}
                className="font-semibold text-primary hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setUserType(null); setError(null); setMessage(null); }}
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
