"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useAgentPro } from "@/hooks/useAgentPro";

const AGENT_ASSETS_BUCKET = "agent-assets";
const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#1e40af";
const DEFAULT_ACCENT = "#10b981";

// Same rule as SQL: first+last letter of first name + first+last letter of last name + MM + YY (8 chars). Ensures unique by appending number if needed.
function generateAgentCodeFromName(fullName) {
  const trimmed = (fullName || "").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const fn = parts[0] || "AX";
  const ln = parts.length > 1 ? parts[parts.length - 1] : fn;
  const first = (s) => (s.length ? s[0].toUpperCase() : "X");
  const last = (s) => (s.length > 1 ? s[s.length - 1].toUpperCase() : s[0]?.toUpperCase() || "X");
  const fnPart = first(fn) + last(fn);
  const lnPart = first(ln) + last(ln);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear() % 100).padStart(2, "0");
  return fnPart + lnPart + month + year;
}

async function ensureUniqueAgentCode(supabaseClient, fullName) {
  const base = generateAgentCodeFromName(fullName);
  for (let i = 0; i < 20; i++) {
    const code = i === 0 ? base : base + (i + 1);
    const { data } = await supabaseClient.from("agents").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return base + Date.now().toString().slice(-4);
}

export default function CustomizeDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [agentId, setAgentId] = useState(null);
  const [authData, setAuthData] = useState(null);
  const [customization, setCustomization] = useState({
    name: "",
    broker_name: "",
    email: "",
    phone: "",
    profile_image_url: "",
    logo_url: "",
    primary_color: DEFAULT_PRIMARY,
    secondary_color: DEFAULT_SECONDARY,
    accent_color: DEFAULT_ACCENT,
    tagline: "",
    bio: "",
  });

  const isAgent = user?.user_metadata?.user_type === "agent";
  const { hasAgentPro, loading: agentProLoading } = useAgentPro();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      router.replace("/profile");
      return;
    }
    if (user && user.user_metadata?.user_type !== "agent") {
      setLoading(false);
      router.replace("/profile");
      return;
    }
    if (!hasSupabase()) {
      setLoading(false);
      setError("Database not configured.");
      return;
    }
    if (!agentProLoading && !hasAgentPro) {
      setLoading(false);
      return;
    }
    if (hasAgentPro) loadCustomization();
  }, [user?.id, user?.user_metadata?.user_type, agentProLoading, hasAgentPro, router]);

  async function loadCustomization() {
    setLoading(true);
    setError(null);
    try {
      const { data: agentRow } = await supabase
        .from("agents")
        .select("id, user_id, data")
        .eq("user_id", user.id)
        .maybeSingle();

      const ad = agentRow?.data || {};
      setAuthData(ad);
      if (agentRow) {
        setAgentId(agentRow.id);

        const { data: customRow } = await supabase
          .from("agent_customizations")
          .select("primary_color, secondary_color, accent_color, tagline, bio")
          .eq("agent_id", agentRow.id)
          .maybeSingle();

        setCustomization({
          name: ad.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? user?.email ?? "",
          broker_name: ad.brokerage ?? user.user_metadata?.brokerage ?? user.user_metadata?.company_name ?? "",
          email: ad.email ?? user?.email ?? "",
          phone: ad.phone ?? user.user_metadata?.phone ?? "",
          profile_image_url: ad.profile_image_url ?? "",
          logo_url: ad.logo_url ?? "",
          primary_color: customRow?.primary_color || DEFAULT_PRIMARY,
          secondary_color: customRow?.secondary_color || DEFAULT_SECONDARY,
          accent_color: customRow?.accent_color || DEFAULT_ACCENT,
          tagline: customRow?.tagline || "",
          bio: customRow?.bio || "",
        });
      } else {
        const name = ad.display_name || user.user_metadata?.full_name || user.email || "Agent";
        const code = await ensureUniqueAgentCode(supabase, name);
        const brokerage = ad.brokerage ?? user.user_metadata?.brokerage ?? null;
        const { data: newAgent, error: insertErr } = await supabase
          .from("agents")
          .insert({
            user_id: user.id,
            code,
            data: {
              display_name: name,
              email: ad.email || user.email || null,
              phone: ad.phone || user.user_metadata?.phone || null,
              brokerage,
              profile_image_url: ad.profile_image_url || null,
              has_paid: true,
              subscription_status: "active",
            },
          })
          .select("id, code")
          .single();

        if (insertErr) {
          setError(insertErr.message || "Could not create agent record.");
          setLoading(false);
          return;
        }
        setAgentId(newAgent.id);
        setAgentCode(newAgent.code);
        setCustomization((c) => ({
          ...c,
          name,
          broker_name: brokerage || "",
          email: ad.email || user?.email || "",
          phone: ad.phone || user.user_metadata?.phone || "",
          profile_image_url: ad.profile_image_url || "",
        }));
      }
    } catch (e) {
      setError(e?.message || "Failed to load.");
    }
    setLoading(false);
  }

  async function uploadImage(file, type) {
    if (!hasSupabase() || !user?.id) return null;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${type}-${Date.now()}.${ext}`;

    const contentType = file.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
    const { error: uploadError } = await supabase.storage.from(AGENT_ASSETS_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message || "Upload failed. In Supabase Storage, create a public bucket named \"agent-assets\".");
      return null;
    }
    const { data } = supabase.storage.from(AGENT_ASSETS_BUCKET).getPublicUrl(path);
    const mediaUrl = data?.publicUrl ?? null;
    if (!mediaUrl) return null;

    const key = type === "profile" ? "profile_image_url" : "logo_url";
    setCustomization((c) => ({ ...c, [key]: mediaUrl }));

    // Persist the media URL to agents.data immediately so it can be fetched back
    if (agentId) {
      const nextData = {
        ...(authData || {}),
        display_name: customization.name || authData?.display_name || null,
        brokerage: customization.broker_name || authData?.brokerage || null,
        email: customization.email || authData?.email || null,
        phone: customization.phone || authData?.phone || null,
        profile_image_url: type === "profile" ? mediaUrl : (customization.profile_image_url || authData?.profile_image_url || null),
        logo_url: type === "logo" ? mediaUrl : (customization.logo_url || authData?.logo_url || null),
      };
      const mediaUrls = [nextData.profile_image_url, nextData.logo_url].filter(Boolean);
      if (mediaUrls.length) nextData.media = mediaUrls;
      setAuthData(nextData);
      const { error: updateErr } = await supabase
        .from("agents")
        .update({
          data: nextData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agentId);
      if (updateErr) {
        setError(updateErr.message || "Photo uploaded but could not save to profile. Try again.");
        return null;
      }
    }
    return mediaUrl;
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const agentPayload = {
        display_name: customization.name || null,
        brokerage: customization.broker_name || null,
        email: customization.email || null,
        phone: customization.phone || null,
        profile_image_url: customization.profile_image_url || null,
        logo_url: customization.logo_url || null,
      };
      const nextData = {
        ...(authData || {}),
        display_name: customization.name || null,
        brokerage: customization.broker_name || null,
        email: customization.email || null,
        phone: customization.phone || null,
        profile_image_url: customization.profile_image_url || null,
        logo_url: customization.logo_url || null,
      };
      const mediaUrls = [nextData.profile_image_url, nextData.logo_url].filter(Boolean);
      if (mediaUrls.length) nextData.media = mediaUrls;
      await supabase
        .from("agents")
        .update({
          data: nextData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agentId);
      setAuthData(nextData);

      const { data: existing } = await supabase
        .from("agent_customizations")
        .select("id")
        .eq("agent_id", agentId)
        .maybeSingle();
      const row = {
        agent_id: agentId,
        primary_color: customization.primary_color,
        secondary_color: customization.secondary_color,
        accent_color: customization.accent_color,
        tagline: customization.tagline || null,
        bio: customization.bio || null,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        await supabase.from("agent_customizations").update(row).eq("id", existing.id);
      } else {
        await supabase.from("agent_customizations").insert(row);
      }
    } catch (e) {
      setError(e?.message || "Save failed.");
    }
    setSaving(false);
  }

  if (!user || loading) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (user && user.user_metadata?.user_type !== "agent") {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12 text-center">
        <p className="text-lg font-bold text-foreground">This page is for brokers and agents only.</p>
        <p className="mt-2 text-muted">Redirecting you to your profile…</p>
        <Link href="/profile" className="btn-primary mt-6 inline-block rounded-xl px-6 py-3 text-sm font-bold">
          Go to profile
        </Link>
      </div>
    );
  }

  if (isAgent && !agentProLoading && !hasAgentPro) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12 text-center">
        <h1 className="text-2xl font-black text-foreground">Agent Pro required</h1>
        <p className="mt-4 text-muted">Customize your branding, colors, and logo after you subscribe to Agent Pro. Until then you have the same access as a regular user.</p>
        <Link href="/pricing" className="btn-primary mt-8 inline-block rounded-xl px-6 py-3 text-sm font-bold">
          Subscribe to Agent Pro
        </Link>
        <Link href="/profile" className="mt-4 block text-sm font-semibold text-primary underline-offset-2 hover:underline">
          ← Back to profile
        </Link>
      </div>
    );
  }

  if (isAgent && hasAgentPro) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in px-8 pb-32 pt-24 md:px-12 text-center">
        <div className="mb-6 flex justify-center">
          <Link href="/profile" className="text-sm text-muted hover:text-foreground">← Profile</Link>
        </div>
        <h1 className="text-3xl font-black text-foreground">Customize</h1>
        <p className="mt-6 text-2xl font-bold text-primary">Coming soon</p>
        <p className="mt-4 text-muted">Branding, colors, and how you appear to clients will be available here shortly.</p>
        <Link href="/profile" className="btn-primary mt-8 inline-block rounded-xl px-6 py-3 text-sm font-bold">
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-8 pb-32 pt-24 md:px-12">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/profile" className="text-muted hover:text-foreground">← Profile</Link>
      </div>
      <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">Customize your branding</h1>
      <p className="mb-2 text-muted">Set your name, logo, colors, and how you appear to clients.</p>
      <p className="mb-8 text-sm text-muted">Your agent code (to share with clients) is on your <Link href="/profile" className="font-semibold text-primary underline-offset-2 hover:underline">Profile</Link>.</p>

      <div className="card mb-8 rounded-2xl border-border bg-surface-elevated p-6">
        <h2 className="mb-6 text-lg font-black text-foreground">Branding</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">Profile image</label>
            {customization.profile_image_url ? (
              <img key={customization.profile_image_url} src={customization.profile_image_url} alt="" className="mb-2 h-32 w-32 rounded-full object-cover" />
            ) : (
              <div className="mb-2 flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-border bg-surface text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  uploadImage(f, "profile").then((url) => url && setCustomization((c) => ({ ...c, profile_image_url: url })));
                  e.target.value = "";
                }
              }}
              className="text-sm text-muted"
            />
            <p className="mt-1 text-xs text-muted">{uploading ? "Saving…" : "Change photo — saved to your profile"}</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">Company logo</label>
            {customization.logo_url && (
              <img src={customization.logo_url} alt="" className="mb-2 h-16 object-contain" />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  uploadImage(f, "logo").then((url) => url && setCustomization((c) => ({ ...c, logo_url: url })));
                  e.target.value = "";
                }
              }}
              className="text-sm text-muted"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-foreground">Your name</label>
          <input
            type="text"
            value={customization.name}
            onChange={(e) => setCustomization((c) => ({ ...c, name: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            placeholder="Your name"
          />
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-bold text-foreground">Broker name</label>
          <input
            type="text"
            value={customization.broker_name}
            onChange={(e) => setCustomization((c) => ({ ...c, broker_name: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            placeholder="Your broker's name"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">Email</label>
            <input
              type="email"
              value={customization.email}
              onChange={(e) => setCustomization((c) => ({ ...c, email: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-foreground">Phone</label>
            <input
              type="tel"
              value={customization.phone}
              onChange={(e) => setCustomization((c) => ({ ...c, phone: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-1 text-sm font-black text-foreground">Page colors</h3>
          <p className="mb-4 text-sm text-muted">When clients link to you, these colors control buttons, links, and highlights across the app.</p>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <label className="mb-2 block text-sm font-bold text-foreground">Primary (buttons, headers)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customization.primary_color}
                  onChange={(e) => setCustomization((c) => ({ ...c, primary_color: e.target.value }))}
                  className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Original: <span className="font-mono">{DEFAULT_PRIMARY}</span></p>
                  <p className="mt-0.5 font-mono text-sm text-foreground">{customization.primary_color}</p>
                  <button type="button" onClick={() => setCustomization((c) => ({ ...c, primary_color: DEFAULT_PRIMARY }))} className="mt-1 text-xs font-semibold text-primary hover:underline">Reset to original</button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <label className="mb-2 block text-sm font-bold text-foreground">Secondary (hover, dark areas)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customization.secondary_color}
                  onChange={(e) => setCustomization((c) => ({ ...c, secondary_color: e.target.value }))}
                  className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Original: <span className="font-mono">{DEFAULT_SECONDARY}</span></p>
                  <p className="mt-0.5 font-mono text-sm text-foreground">{customization.secondary_color}</p>
                  <button type="button" onClick={() => setCustomization((c) => ({ ...c, secondary_color: DEFAULT_SECONDARY }))} className="mt-1 text-xs font-semibold text-primary hover:underline">Reset to original</button>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <label className="mb-2 block text-sm font-bold text-foreground">Accent (badges, highlights)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customization.accent_color}
                  onChange={(e) => setCustomization((c) => ({ ...c, accent_color: e.target.value }))}
                  className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Original: <span className="font-mono">{DEFAULT_ACCENT}</span></p>
                  <p className="mt-0.5 font-mono text-sm text-foreground">{customization.accent_color}</p>
                  <button type="button" onClick={() => setCustomization((c) => ({ ...c, accent_color: DEFAULT_ACCENT }))} className="mt-1 text-xs font-semibold text-primary hover:underline">Reset to original</button>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCustomization((c) => ({ ...c, primary_color: DEFAULT_PRIMARY, secondary_color: DEFAULT_SECONDARY, accent_color: DEFAULT_ACCENT }))}
            className="mt-3 text-sm font-semibold text-muted hover:text-foreground"
          >
            Reset all colors to original
          </button>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-foreground">Tagline</label>
          <input
            type="text"
            value={customization.tagline}
            onChange={(e) => setCustomization((c) => ({ ...c, tagline: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            placeholder="Your trusted real estate partner"
          />
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-bold text-foreground">Bio</label>
          <textarea
            value={customization.bio}
            onChange={(e) => setCustomization((c) => ({ ...c, bio: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            rows={4}
            placeholder="A few lines about you..."
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary mt-6 rounded-xl px-6 py-3 font-bold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save customization"}
        </button>
      </div>

      <div className="card rounded-2xl border-border bg-surface-elevated p-8">
        <h2 className="mb-2 text-lg font-black text-foreground">How your page will look</h2>
        <p className="mb-6 text-sm text-muted">Preview for clients who link to you. Buttons, links, and your agent block use your colors.</p>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-background p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Buttons &amp; links</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                style={{ backgroundColor: customization.primary_color }}
              >
                Primary button
              </button>
              <a href="#" className="rounded-xl px-4 py-2 text-sm font-semibold underline-offset-2 hover:underline" style={{ color: customization.primary_color }} onClick={(e) => e.preventDefault()}>
                Link style
              </a>
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: customization.accent_color }}>
                Accent badge
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl border border-border p-6"
            style={{ backgroundColor: customization.primary_color + "12" }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Your agent block (on listings)</p>
            {customization.logo_url && <img src={customization.logo_url} alt="" className="mb-3 h-10 object-contain" />}
            <h3 className="text-xl font-black" style={{ color: customization.primary_color }}>
              {customization.broker_name || "Your broker"}
            </h3>
            <p className="mt-1 text-sm text-muted">{customization.tagline || "Your tagline"}</p>
            {(customization.profile_image_url || customization.name) && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3">
                {customization.profile_image_url && (
                  <img src={customization.profile_image_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                )}
                <div>
                  <p className="font-bold text-foreground">{customization.name || "Your name"}</p>
                  <p className="text-xs text-muted">Listing agent</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Mini nav (sidebar style)</p>
            <div className="flex gap-2">
              <span className="rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: customization.primary_color }}>Home</span>
              <span className="rounded-lg px-3 py-2 text-xs font-bold text-muted">Explore</span>
              <span className="rounded-lg px-3 py-2 text-xs font-bold text-muted">Saved</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
