"use client";

import { useState } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(str) {
  return typeof str === "string" && EMAIL_REGEX.test(str.trim());
}

// Responsive tiers (Tailwind breakpoints):
// - Phone:  default, < 768px  (modal: max-w-md 448px, compact padding)
// - Tablet: md,      768px+   (modal: max-w-lg 512px, md padding)
// - Laptop: lg,      1024px+  (modal: max-w-xl 576px, larger padding)
const inputClass =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 md:px-4 md:py-3 text-sm md:text-base text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const AGENT_ASSETS_BUCKET = "agent-assets";

function generateClientAgentCode(name) {
  const parts = (name || "AX").trim().split(/\s+/);
  const fn = parts[0] || "AX";
  const ln = parts.length > 1 ? parts[parts.length - 1] : fn;
  const fnP = (fn[0] + fn[fn.length - 1]).toUpperCase();
  const lnP = (ln[0] + ln[ln.length - 1]).toUpperCase();
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 90) + 10);
  return fnP + lnP + mm + yy + rand;
}

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [userType, setUserType] = useState(null); // null | "user" | "agent" (for signup)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

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
      if (!firstName?.trim() || !lastName?.trim()) {
        setError("First name and last name are required.");
        return;
      }
      if (!phone?.trim()) {
        setError("Phone is required.");
        return;
      }
    }
    if (userType === "agent") {
      if (!firstName?.trim() || !lastName?.trim() || !phone?.trim() || !brokerage?.trim()) {
        setError("First name, last name, phone, and brokerage chosen name are required.");
        return;
      }
      if (!photoFile) {
        setError("Please add a photo of yourself (required for agents).");
        return;
      }
    }
    if (!hasSupabase()) {
      setError("Sign up is not configured. Contact support.");
      return;
    }
    setLoading(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || undefined;
      const metadata = {
        full_name: fullName,
        phone: phone.trim() || undefined,
        user_type: userType || "user",
        ...(userType === "agent" && {
          brokerage: brokerage.trim(),
        }),
      };
      let authUser = null;
      let authSession = null;

      const { data, error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });

      if (err) {
        const msg = err.message ?? "";
        const isDbOrDup = /database|trigger|saving new user|already registered|already been registered/i.test(msg);
        if (isDbOrDup) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
          if (signInErr) {
            setError(signInErr.message || "Sign up failed. Try again or contact support.");
            return;
          }
          authUser = signInData?.user ?? null;
          authSession = signInData?.session ?? null;
        } else {
          setError(msg || "Sign up failed.");
          return;
        }
      } else {
        authUser = data?.user ?? null;
        authSession = data?.session ?? null;
      }

      if (authUser && hasSupabase()) {
        let profileImageUrl = null;
        if (userType === "agent" && photoFile) {
          const ext = photoFile.name.split(".").pop() || "jpg";
          const path = `${authUser.id}/profile-${Date.now()}.${ext}`;
          const contentType = photoFile.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
          const { error: uploadErr } = await supabase.storage
            .from(AGENT_ASSETS_BUCKET)
            .upload(path, photoFile, { cacheControl: "3600", upsert: true, contentType });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from(AGENT_ASSETS_BUCKET).getPublicUrl(path);
            profileImageUrl = urlData?.publicUrl ?? null;
          }
        }
        const signUpData = {
          name: fullName,
          email: trimmedEmail,
          phone: phone?.trim() || undefined,
          user_type: userType || "user",
          ...(userType === "agent" && {
            brokerage: brokerage?.trim() || undefined,
            profile_image_url: profileImageUrl,
          }),
        };
        const { error: usersErr } = await supabase.from("users").upsert(
          { user_id: authUser.id, data: signUpData, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (usersErr) {
          console.warn("users upsert:", usersErr.message);
          setError("Account created but profile could not be saved: " + usersErr.message);
        }
        if (userType === "agent") {
          const agentData = {
            display_name: fullName || trimmedEmail,
            brokerage: brokerage?.trim() || null,
            email: trimmedEmail,
            phone: phone?.trim() || null,
            profile_image_url: profileImageUrl || null,
            ...(profileImageUrl && { media: [profileImageUrl] }),
          };
          const { data: existingAgent } = await supabase
            .from("agents").select("code").eq("user_id", authUser.id).maybeSingle();
          const needsCode = !existingAgent?.code;
          const generatedCode = needsCode ? generateClientAgentCode(fullName || trimmedEmail) : undefined;
          const { error: agentsErr } = await supabase.from("agents").upsert(
            {
              user_id: authUser.id,
              data: agentData,
              updated_at: new Date().toISOString(),
              ...(needsCode && generatedCode ? { code: generatedCode } : {}),
            },
            { onConflict: "user_id" }
          );
          if (agentsErr) {
            console.warn("agents upsert:", agentsErr.message);
            setError("Account created but agent profile could not be saved: " + agentsErr.message);
          }
        }
      }
      if (authSession) {
        onSuccess?.();
      } else if (authUser) {
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
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in overscroll-contain p-4 md:p-6 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Phone: default | Tablet: md (768px+) | Laptop: lg (1024px+) */}
      <div className="flex min-h-full items-center justify-center py-4 md:py-6 lg:py-8">
        <div
          className="relative w-full max-w-md md:max-w-lg lg:max-w-xl rounded-3xl border border-border bg-surface-elevated px-5 pt-5 pb-6 md:p-8 shadow-2xl"
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

        <h2 id="auth-modal-title" className="text-xl md:text-2xl font-black tracking-tight text-foreground mb-1">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <p className="text-xs md:text-sm text-muted mb-3 md:mb-6">
          {mode === "signin"
            ? "Sign in to view listings and save your favourites."
            : mode === "signup" && userType === null
              ? "Are you signing up as a user or as a broker/agent?"
              : userType === "user"
                ? "Create your account with your name, email, phone and password."
                : "Create your broker/agent account with your details and a photo."}
        </p>

        {mode === "signup" && userType === null ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => { setUserType("user"); setError(null); setPhotoFile(null); setPhotoPreview(null); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-surface p-4 md:p-6 text-left transition-all hover:border-primary hover:bg-surface-elevated"
              >
                <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-base md:text-lg font-black text-foreground">User</span>
                <span className="text-xs text-muted">Buyer or renter</span>
              </button>
              <button
                type="button"
                onClick={() => { setUserType("agent"); setError(null); setPhotoFile(null); setPhotoPreview(null); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-surface p-4 md:p-6 text-left transition-all hover:border-primary hover:bg-surface-elevated"
              >
                <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-base md:text-lg font-black text-foreground">Broker / Agent</span>
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
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            {mode === "signup" && userType !== null && (
              <button
                type="button"
                onClick={() => { setUserType(null); setError(null); setFirstName(""); setLastName(""); setPhotoFile(null); setPhotoPreview(null); }}
                className="text-sm text-muted hover:text-foreground"
              >
                ← Back
              </button>
            )}
            {mode === "signup" && userType !== null && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="auth-first-name" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="auth-first-name"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                      placeholder="Jane"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-last-name" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="auth-last-name"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                      placeholder="Smith"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="auth-email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
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
                  <p className="mt-0.5 text-[11px] text-muted">Valid email format (e.g. name@example.com)</p>
                </div>
                <div>
                  <label htmlFor="auth-phone" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
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
                      <label htmlFor="auth-brokerage" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
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
                  <label htmlFor="auth-email" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
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
                  <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass + " pr-12"}
                      placeholder="Your password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
            {mode === "signup" && userType !== null && (
              <div>
                <label htmlFor="auth-password" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass + " pr-12"}
                    placeholder="At least 6 characters"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && userType === "agent" && (
              <div>
                <label htmlFor="auth-agent-photo" className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                  Your photo <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  {photoPreview && (
                    <img src={photoPreview} alt="You" className="h-12 w-12 rounded-full object-cover border border-border flex-shrink-0" />
                  )}
                  <input
                    id="auth-agent-photo"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:opacity-90"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setPhotoFile(f || null);
                      setPhotoPreview(f ? URL.createObjectURL(f) : null);
                    }}
                    disabled={loading}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-muted">Required — you can change it later in Dashboard → Customize.</p>
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
              className="w-full rounded-xl bg-primary px-6 py-3 md:py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>
        )}

        <p className="mt-4 md:mt-6 text-center text-sm text-muted">
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
    </div>
  );
}
