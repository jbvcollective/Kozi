"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import Settings from "@/components/Settings";

const AVATAR_BUCKET = "avatars";
const DEFAULT_AVATAR = "https://picsum.photos/id/64/100/100";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(str) {
  return typeof str === "string" && EMAIL_REGEX.test(str.trim());
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const [userType, setUserType] = useState(null); // null | "user" | "agent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signUpError, setSignUpError] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!hasSupabase()) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || null;

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSignUpError("Please choose an image file.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (userId) => {
    if (!photoFile || !hasSupabase()) return null;
    const ext = photoFile.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, photoFile, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) return null;
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);
    return urlData?.publicUrl ?? null;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setSignUpError(null);
    const trimmedEmail = email?.trim();
    if (!trimmedEmail || !password?.trim()) {
      setSignUpError("Email and password are required.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setSignUpError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (password.length < 6) {
      setSignUpError("Password must be at least 6 characters.");
      return;
    }
    if (userType === "user") {
      if (!name?.trim()) {
        setSignUpError("Name is required.");
        return;
      }
      if (!phone?.trim()) {
        setSignUpError("Phone is required.");
        return;
      }
    }
    if (userType === "agent") {
      if (!name?.trim() || !phone?.trim() || !brokerage?.trim()) {
        setSignUpError("Name, phone, and brokerage chosen name are required.");
        return;
      }
    }
    if (!hasSupabase()) {
      setSignUpError("Sign up is not configured yet.");
      return;
    }

    setAuthLoading(true);
    try {
      const metadata = {
        full_name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        user_type: userType || "user",
        ...(userType === "agent" && { brokerage: brokerage.trim() }),
      };
      const { data, error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });
      if (err) {
        setSignUpError(err.message ?? "Sign up failed.");
        return;
      }
      const newUser = data.user;
      if (newUser && photoFile) {
        const url = await uploadAvatar(newUser.id);
        if (url) {
          await supabase.auth.updateUser({ data: { avatar_url: url } });
        }
      }
      if (data.session) {
        setUser(data.session.user);
        setSignUpSuccess(true);
      } else {
        setSignUpSuccess(true);
      }
    } catch (err) {
      setSignUpError(err?.message ?? "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleChangePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user || !hasSupabase()) return;
    if (!file.type.startsWith("image/")) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadAvatar(user.id);
      if (url) {
        await supabase.auth.updateUser({ data: { avatar_url: url } });
        setUser((prev) => prev ? { ...prev, user_metadata: { ...prev.user_metadata, avatar_url: url } } : null);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface" />
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  if (user && !signUpSuccess) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Your profile</span>
        </div>
        <h1 className="mb-10 text-4xl font-black tracking-tight text-foreground">Profile</h1>

        <div className="flex flex-col items-center gap-8">
          <label className="relative block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleChangePhoto}
              disabled={uploadingPhoto}
            />
            <div className="h-32 w-32 overflow-hidden rounded-2xl border-2 border-border shadow-lg transition-all hover:border-primary">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <span className="mt-3 block text-center text-sm font-semibold text-muted hover:text-foreground">
              {uploadingPhoto ? "Uploading…" : "Change photo"}
            </span>
          </label>

          <div className="w-full space-y-4 rounded-2xl border border-border bg-surface p-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Name</span>
              <p className="mt-1 text-lg font-bold text-foreground">{user.user_metadata?.full_name || "—"}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Email</span>
              <p className="mt-1 text-lg font-bold text-foreground">{user.email}</p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Account type</span>
              <p className="mt-1 text-lg font-bold text-foreground">
                {user.user_metadata?.user_type === "agent" ? "Broker / Agent" : "User"}
              </p>
            </div>
            {user.user_metadata?.brokerage && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Brokerage chosen</span>
                <p className="mt-1 text-lg font-bold text-foreground">{user.user_metadata.brokerage}</p>
              </div>
            )}
            {user.user_metadata?.phone && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Phone</span>
                <p className="mt-1 text-lg font-bold text-foreground">{user.user_metadata.phone}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.refresh())}
            className="rounded-xl border border-border px-6 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-foreground"
          >
            Sign out
          </button>

          <Settings embedded />
        </div>
      </div>
    );
  }

  if (user && signUpSuccess) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="mb-6 flex justify-center">
          <div className="h-28 w-28 overflow-hidden rounded-2xl border-2 border-border shadow-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt="You" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <h1 className="mb-2 text-center text-3xl font-black text-foreground">You’re in</h1>
        <p className="mb-8 text-center text-muted">This is now your profile. Your picture appears in the sidebar.</p>
        <div className="flex justify-center gap-3">
          <Link href="/explore" className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90">Explore</Link>
          <button
            type="button"
            onClick={() => setSignUpSuccess(false)}
            className="rounded-xl border-2 border-border px-6 py-3 text-sm font-bold text-foreground hover:border-primary"
          >
            View profile
          </button>
        </div>
      </div>
    );
  }

  if (userType === null) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Create account</span>
        </div>
        <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">Sign up</h1>
        <p className="mb-10 text-muted">Are you signing up as a user or as a broker/agent?</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setUserType("user")}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-surface p-8 text-left transition-all hover:border-primary hover:bg-surface-elevated"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xl font-black text-foreground">User</span>
            <span className="text-sm text-muted">Buyer or renter — browse and save listings</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("agent")}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-surface p-8 text-left transition-all hover:border-primary hover:bg-surface-elevated"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-black text-foreground">Broker / Agent</span>
            <span className="text-sm text-muted">List properties and add your brokerage chosen</span>
          </button>
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => setUserType(null)} className="text-muted hover:text-foreground">
          ← Back
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">
          {userType === "user" ? "User sign up" : "Broker / Agent sign up"}
        </span>
      </div>
      <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">Sign up</h1>
      <p className="mb-10 text-muted">
        {userType === "user"
          ? "Create your account with name, email, phone and password."
          : "Create your broker/agent account with name, email, phone, brokerage chosen name and password."}
      </p>

      <form onSubmit={handleSignUp} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-bold text-foreground">Name <span className="text-red-500">*</span></label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Jane Smith"
              disabled={authLoading}
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-bold text-foreground">Email <span className="text-red-500">*</span></label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="you@example.com"
              disabled={authLoading}
            />
            <p className="mt-1.5 text-xs text-muted">Use a valid email format (e.g. name@example.com)</p>
          </div>
          <div>
            <label htmlFor="profile-phone" className="mb-2 block text-sm font-bold text-foreground">Phone <span className="text-red-500">*</span></label>
            <input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="(555) 123-4567"
              disabled={authLoading}
            />
          </div>
          {userType === "agent" && (
            <div>
              <label htmlFor="profile-brokerage" className="mb-2 block text-sm font-bold text-foreground">Brokerage chosen name <span className="text-red-500">*</span></label>
              <input
                id="profile-brokerage"
                type="text"
                autoComplete="organization"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. REAL BROKER ONTARIO LTD."
                disabled={authLoading}
              />
            </div>
          )}
          <div>
            <label htmlFor="profile-password" className="mb-2 block text-sm font-bold text-foreground">Password <span className="text-red-500">*</span></label>
            <input
              id="profile-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="At least 6 characters"
              disabled={authLoading}
            />
          </div>
        </div>

        {signUpError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{signUpError}</p>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-xl bg-primary px-6 py-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {authLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
