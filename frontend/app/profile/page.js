"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import Settings from "@/components/Settings";
import { useAgentPro } from "@/hooks/useAgentPro";

const AVATAR_BUCKET = "avatars";
const AGENT_ASSETS_BUCKET = "agent-assets";
const DEFAULT_AVATAR = "https://picsum.photos/id/64/100/100";

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
  const [profileShowPassword, setProfileShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signUpError, setSignUpError] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [agentProfileImageUrl, setAgentProfileImageUrl] = useState(null);
  const [agentCode, setAgentCode] = useState(null);
  const [agentCodeLoading, setAgentCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const isAgent = user?.user_metadata?.user_type === "agent";
  const { hasAgentPro } = useAgentPro();

  useEffect(() => {
    if (!hasSupabase() || !user?.id || !isAgent) {
      if (!isAgent) {
        setAgentProfileImageUrl(null);
        setAgentCode(null);
      }
      setAgentCodeLoading(false);
      return;
    }
    setAgentCodeLoading(true);
    supabase
      .from("agents")
      .select("data, code")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAgentCodeLoading(false);
        setAgentProfileImageUrl(data?.data?.profile_image_url ?? null);
        setAgentCode(data?.code ?? null);
      })
      .catch(() => setAgentCodeLoading(false));
  }, [user?.id, isAgent]);

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

  const avatarUrl = user?.user_metadata?.avatar_url || agentProfileImageUrl || null;

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
    const contentType = photoFile.type || (ext.toLowerCase() === "png" ? "image/png" : "image/jpeg");
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, photoFile, {
      cacheControl: "3600",
      upsert: true,
      contentType,
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
      if (!firstName?.trim() || !lastName?.trim()) {
        setSignUpError("First name and last name are required.");
        return;
      }
      if (!phone?.trim()) {
        setSignUpError("Phone is required.");
        return;
      }
    }
    if (userType === "agent") {
      if (!firstName?.trim() || !lastName?.trim() || !phone?.trim() || !brokerage?.trim()) {
        setSignUpError("First name, last name, phone, and brokerage chosen name are required.");
        return;
      }
      if (!photoFile) {
        setSignUpError("Please add a photo of yourself (required for agents).");
        return;
      }
    }
    if (!hasSupabase()) {
      setSignUpError("Sign up is not configured yet.");
      return;
    }

    setAuthLoading(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || undefined;
      const metadata = {
        full_name: fullName,
        phone: phone.trim() || undefined,
        user_type: userType || "user",
        ...(userType === "agent" && { brokerage: brokerage.trim() }),
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
            setSignUpError(signInErr.message || "Sign up failed. Try again or contact support.");
            setAuthLoading(false);
            return;
          }
          authUser = signInData?.user ?? null;
          authSession = signInData?.session ?? null;
        } else {
          setSignUpError(msg || "Sign up failed.");
          setAuthLoading(false);
          return;
        }
      } else {
        authUser = data?.user ?? null;
        authSession = data?.session ?? null;
      }

      if (authUser && userType === "agent") {
        let profileImageUrl = null;
        if (photoFile && hasSupabase()) {
          const ext = photoFile.name.split(".").pop() || "jpg";
          const path = `${authUser.id}/profile-${Date.now()}.${ext}`;
          const contentType = photoFile.type || (ext.toLowerCase() === "png" ? "image/png" : "image/jpeg");
          const { error: uploadErr } = await supabase.storage
            .from(AGENT_ASSETS_BUCKET)
            .upload(path, photoFile, { cacheControl: "3600", upsert: true, contentType });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from(AGENT_ASSETS_BUCKET).getPublicUrl(path);
            profileImageUrl = urlData?.publicUrl ?? null;
          }
        }
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
          setSignUpError("Account created but agent profile could not be saved: " + agentsErr.message);
        }
        const { error: usersErr } = await supabase.from("users").upsert(
          {
            user_id: authUser.id,
            data: {
              name: fullName, email: trimmedEmail, phone: phone?.trim(),
              user_type: "agent", brokerage: brokerage?.trim(), profile_image_url: profileImageUrl,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (usersErr) console.warn("users upsert:", usersErr.message);
      } else if (authUser && photoFile) {
        const url = await uploadAvatar(authUser.id);
        if (url) {
          await supabase.auth.updateUser({ data: { avatar_url: url } });
        }
      }
      if (authSession) {
        setUser(authSession.user);
        setSignUpSuccess(true);
      } else if (authUser) {
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
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file (e.g. PNG or JPG).");
      return;
    }
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      if (isAgent) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/profile-${Date.now()}.${ext}`;
        const contentType = file.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
        const { error: uploadErr } = await supabase.storage
          .from(AGENT_ASSETS_BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: true, contentType });
        if (uploadErr) {
          setPhotoError(uploadErr.message || "Upload failed. In Supabase Storage, create a public bucket named \"agent-assets\".");
          setUploadingPhoto(false);
          return;
        }
        const { data: urlData } = supabase.storage.from(AGENT_ASSETS_BUCKET).getPublicUrl(path);
        const url = urlData?.publicUrl ?? null;
        if (!url) {
          setPhotoError("Could not get image URL.");
          setUploadingPhoto(false);
          return;
        }
        const { data: agentRow } = await supabase
          .from("agents")
          .select("id, data")
          .eq("user_id", user.id)
          .maybeSingle();
        const existingData = agentRow?.data || {};
        const nextData = {
          ...existingData,
          profile_image_url: url,
          media: [url, existingData.logo_url].filter(Boolean),
        };
        const { error: updateErr } = await supabase
          .from("agents")
          .update({ data: nextData, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (updateErr) {
          setPhotoError(updateErr.message || "Saved to storage but could not update profile. Try again.");
          setUploadingPhoto(false);
          return;
        }
        await supabase.auth.updateUser({ data: { avatar_url: url } });
        setAgentProfileImageUrl(url);
        setUser((prev) => prev ? { ...prev, user_metadata: { ...prev.user_metadata, avatar_url: url } } : null);
      } else {
        const url = await uploadAvatar(user.id);
        if (url) {
          await supabase.auth.updateUser({ data: { avatar_url: url } });
          setUser((prev) => prev ? { ...prev, user_metadata: { ...prev.user_metadata, avatar_url: url } } : null);
        } else {
          setPhotoError("Upload failed. In Supabase Storage, create a public bucket named \"avatars\".");
        }
      }
    } catch (err) {
      setPhotoError(err?.message || "Something went wrong. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
    e.target.value = "";
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
      <div className="mx-auto max-w-5xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Your profile</span>
        </div>
        <h1 className="mb-10 text-4xl font-black tracking-tight text-foreground">Profile</h1>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-8">
          {isAgent && (
            <label className="relative block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleChangePhoto}
                disabled={uploadingPhoto}
              />
              <div className="h-32 w-32 overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-md ring-2 ring-white transition-all hover:border-primary hover:shadow-lg">
                {avatarUrl ? (
                  <img key={avatarUrl} src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="mt-3 block text-center text-sm font-semibold text-muted hover:text-foreground">
                {uploadingPhoto ? "Saving…" : "Change photo"}
              </span>
              {photoError && (
                <p className="mt-2 text-center text-sm text-red-600" role="alert">{photoError}</p>
              )}
            </label>
          )}

          <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="divide-y divide-border">
              <div className="px-6 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Name</span>
                <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">{user.user_metadata?.full_name || "—"}</p>
              </div>
              <div className="px-6 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Email</span>
                <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground break-all">{user.email}</p>
              </div>
              <div className="px-6 py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Account type</span>
                <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">
                  {user.user_metadata?.user_type === "agent" ? "Broker / Agent" : "User"}
                </p>
              </div>
              {user.user_metadata?.brokerage && (
                <div className="px-6 py-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Brokerage chosen</span>
                  <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">{user.user_metadata.brokerage}</p>
                </div>
              )}
              {user.user_metadata?.phone && (
                <div className="px-6 py-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Phone</span>
                  <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">{user.user_metadata.phone}</p>
                </div>
              )}
            </div>
          </div>

          {user.user_metadata?.user_type === "agent" && (
            <>
              {hasAgentPro ? (
                <>
                  <div className="mt-8 w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/8 to-primary/5 shadow-sm">
                    <div className="p-6">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted">Your agent code (share with clients)</h3>
                      <div className="mt-3 rounded-xl bg-white/60 px-4 py-3 font-mono text-xl font-black tracking-wide text-primary">
                        {agentCodeLoading ? (
                          <span className="text-muted">Loading…</span>
                        ) : agentCode ? (
                          agentCode
                        ) : (
                          <span className="text-muted font-normal">No code found.</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted">Share this code with your clients.</p>
                      {agentCode && !agentCodeLoading && (
                        <button
                          type="button"
                          onClick={() => {
                            const text = agentCode;
                            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                              navigator.clipboard.writeText(text).then(() => {
                                setCodeCopied(true);
                                setTimeout(() => setCodeCopied(false), 2000);
                              }).catch(() => {
                                const ta = document.createElement("textarea");
                                ta.value = text;
                                ta.style.position = "fixed";
                                ta.style.opacity = "0";
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                                setCodeCopied(true);
                                setTimeout(() => setCodeCopied(false), 2000);
                              });
                            } else {
                              const ta = document.createElement("textarea");
                              ta.value = text;
                              ta.style.position = "fixed";
                              ta.style.opacity = "0";
                              document.body.appendChild(ta);
                              ta.select();
                              document.execCommand("copy");
                              document.body.removeChild(ta);
                              setCodeCopied(true);
                              setTimeout(() => setCodeCopied(false), 2000);
                            }
                          }}
                          className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-hover"
                        >
                          {codeCopied ? "Copied!" : "Copy code"}
                        </button>
                      )}
                    </div>
                  </div>
                  <Link href="/dashboard/customize" className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-surface">
                    Customize your branding (colors, logo)
                    <span className="text-primary">→</span>
                  </Link>
                </>
              ) : (
                <div className="mt-8 w-full overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-sm">
                  <div className="p-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Your agent code is ready</h3>
                    <p className="mt-2 text-sm text-muted">Subscribe to Agent Pro to unlock your agent code, share it with clients, and get your name on every listing.</p>
                    <Link href="/pricing" className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-opacity">
                      Subscribe to Agent Pro
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.refresh())}
            className="mt-8 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-foreground"
          >
            Sign out
          </button>
          </div>

          <div className="lg:sticky lg:top-24">
            <Settings embedded />
          </div>
        </div>
      </div>
    );
  }

  if (user && signUpSuccess) {
    const isAgentSignup = user.user_metadata?.user_type === "agent";
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        {isAgentSignup && (
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
        )}
        <h1 className="mb-2 text-center text-3xl font-black text-foreground">You’re in</h1>
        <p className="mb-8 text-center text-muted">
          {isAgentSignup ? "This is now your profile. Your picture appears in the sidebar." : "This is now your profile."}
        </p>
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
          ? "Create your account with first name, last name, email, phone and password."
          : "Create your broker/agent account with first name, last name, email, phone, brokerage chosen name, and a photo of yourself."}
      </p>

      <form onSubmit={handleSignUp} className="space-y-6">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-first-name" className="mb-2 block text-sm font-bold text-foreground">First name <span className="text-red-500">*</span></label>
              <input
                id="profile-first-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Jane"
                disabled={authLoading}
              />
            </div>
            <div>
              <label htmlFor="profile-last-name" className="mb-2 block text-sm font-bold text-foreground">Last name <span className="text-red-500">*</span></label>
              <input
                id="profile-last-name"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Smith"
                disabled={authLoading}
              />
            </div>
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
            <div className="relative">
              <input
                id="profile-password"
                type={profileShowPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 pr-12 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="At least 6 characters"
                disabled={authLoading}
              />
              <button
                type="button"
                onClick={() => setProfileShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
                aria-label={profileShowPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {profileShowPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>
          {userType === "agent" && (
            <div>
              <label htmlFor="profile-agent-photo" className="mb-2 block text-sm font-bold text-foreground">Your photo <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-4">
                {photoPreview && (
                  <img src={photoPreview} alt="You" className="h-16 w-16 rounded-full object-cover border border-border" />
                )}
                <input
                  id="profile-agent-photo"
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:opacity-90"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setPhotoFile(f || null);
                    setPhotoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  disabled={authLoading}
                />
              </div>
              <p className="mt-1 text-xs text-muted">Required — add a picture of yourself. You can change it later in Dashboard → Customize.</p>
            </div>
          )}
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
