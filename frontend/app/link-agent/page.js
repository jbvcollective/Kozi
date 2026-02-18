"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useChosenAgent } from "@/context/ChosenAgentContext";
import { useLinkedAgent } from "@/context/LinkedAgentContext";

export default function LinkAgentPage() {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const { reload: reloadChosenAgent, showAgentConnectedPopupIfNotDismissed } = useChosenAgent();
  const { reload: reloadLinkedAgent } = useLinkedAgent();
  const [agentCode, setAgentCode] = useState("");
  const [error, setError] = useState("");
  const [linking, setLinking] = useState(false);

  async function linkAgent() {
    setError("");
    if (!user) {
      openAuthModal?.();
      return;
    }
    const code = agentCode.trim().toUpperCase();
    if (!code) {
      setError("Enter your agent code.");
      return;
    }
    if (!hasSupabase()) {
      setError("Service not configured.");
      return;
    }
    setLinking(true);
    try {
      const { data: agentRow, error: fetchError } = await supabase
        .from("agents")
        .select("user_id, code, data")
        .eq("code", code)
        .maybeSingle();

      if (fetchError || !agentRow) {
        setError("Invalid or unknown agent code.");
        setLinking(false);
        return;
      }

      const ad = agentRow.data || {};
      const chosenAgentData = {
        user_name: user.user_metadata?.full_name ?? user.email ?? null,
        agent_id: agentRow.user_id ?? null,
        agent_code: agentRow.code ?? code,
        agent_name: (ad.display_name || "").trim() || "Your agent",
        brokerage: ad.brokerage ?? null,
        agent_phone: ad.phone ?? null,
        agent_email: ad.email ?? null,
        theme: "teal",
      };
      await supabase.from("user_chosen_agent").upsert(
        { user_id: user.id, data: chosenAgentData, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      await Promise.all([reloadChosenAgent(), reloadLinkedAgent()]);
      showAgentConnectedPopupIfNotDismissed?.();
      router.push("/explore");
    } catch (e) {
      setError(e?.message || "Could not link.");
      setLinking(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 py-16">
      <div className="card w-full max-w-md rounded-2xl border-border bg-surface-elevated p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-black tracking-tight text-foreground">Enter your agent code</h1>
        <p className="mb-6 text-muted">
          Your real estate agent should have given you an 8 digit key. Enter it to see their branding and contact info.
        </p>
        <input
          type="text"
          value={agentCode}
          onChange={(e) => setAgentCode(e.target.value.toUpperCase())}
          placeholder="8 digit key"
          className="mb-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-lg font-mono text-foreground"
        />
        {error && <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>}
        <button
          type="button"
          onClick={linkAgent}
          disabled={linking}
          className="btn-primary w-full rounded-xl py-3 font-bold disabled:opacity-60"
        >
          {linking ? "Linking…" : "Connect to agent"}
        </button>
        {!user && (
          <p className="mt-4 text-center text-sm text-muted">
            <button type="button" onClick={openAuthModal} className="font-semibold text-primary underline-offset-2 hover:underline">
              Sign in
            </button>
            {" "}to link your agent code.
          </p>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/explore" className="font-semibold text-primary underline-offset-2 hover:underline">Browse without a code</Link>
        </p>
      </div>
    </div>
  );
}
