"use client";

import { useState, useEffect } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function ChooseAgentModal({ onClose, onSave, initialAgent }) {
  const [agentCode, setAgentCode] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [paidAgents, setPaidAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialAgent?.agentCode) setAgentCode(initialAgent.agentCode ?? "");
  }, [initialAgent?.agentCode]);

  // Load agents who are signed up and paid (Agent Pro) for the "choose from list" option
  useEffect(() => {
    if (!hasSupabase()) {
      setAgentsLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("agents")
      .select("id, user_id, code, data, is_paid")
      .then(({ data, error: e }) => {
        if (cancelled || e) {
          if (!cancelled) setAgentsLoading(false);
          return;
        }
        const paid = (data || []).filter((a) => !!(a.is_paid || (a.data || {}).agent_pro_subscribed_at));
        setPaidAgents(paid);
        setAgentsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelectFromList = (agent) => {
    setSelectedAgent(agent);
    setAgentCode("");
    setError(null);
  };

  const handleCodeChange = (value) => {
    setAgentCode(value);
    setSelectedAgent(null);
    setError(null);
  };

  const saveAgent = async (agentPayload) => {
    const result = await onSave(agentPayload);
    if (result?.error) {
      const msg = result.error?.message ?? (typeof result.error === "string" ? result.error : "Failed to save. Try again.");
      setError(msg);
      return false;
    }
    onClose();
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!hasSupabase()) {
      setError("Service not configured. Try again later.");
      return;
    }

    // Option 1: User selected an agent from the list (paid agents)
    if (selectedAgent) {
      const d = selectedAgent.data || {};
      setLoading(true);
      const ok = await saveAgent({
        agentId: selectedAgent.user_id ?? null,
        agentCode: selectedAgent.code ?? null,
        agentName: (d.display_name || "").trim() || "Agent",
        brokerage: d.brokerage ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
      });
      setLoading(false);
      return;
    }

    // Option 2: User entered an agent code — validate against agents table (case-insensitive)
    const rawCode = agentCode?.trim();
    if (!rawCode) {
      setError("Enter your agent code or choose an agent below.");
      return;
    }
    const codeUpper = rawCode.toUpperCase();
    let row = null;
    let fetchError = null;
    const { data: byUpper, error: e1 } = await supabase
      .from("agents")
      .select("id, user_id, code, data")
      .eq("code", codeUpper)
      .maybeSingle();
    if (e1) fetchError = e1;
    else if (byUpper) row = byUpper;
    if (!row && !fetchError) {
      const { data: byExact, error: e2 } = await supabase
        .from("agents")
        .select("id, user_id, code, data")
        .eq("code", rawCode)
        .maybeSingle();
      if (e2) fetchError = e2;
      else if (byExact) row = byExact;
    }
    if (fetchError || !row) {
      const msg = fetchError?.message
        ? `Couldn't look up agent: ${fetchError.message}`
        : "No agent found with this code. Check for typos or ask your agent for the exact code.";
      setError(msg);
      return;
    }
    setLoading(true);
    const d = row.data || {};
    const ok = await saveAgent({
      agentId: row.user_id ?? null,
      agentCode: row.code ?? codeUpper ?? rawCode,
      agentName: (d.display_name || "").trim() || "Agent",
      brokerage: d.brokerage ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
    });
    setLoading(false);
  };

  const canSave = !!agentCode?.trim() || !!selectedAgent;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="choose-agent-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-surface-elevated p-8 shadow-2xl"
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

        <h2 id="choose-agent-modal-title" className="text-2xl font-black tracking-tight text-foreground mb-1">
          Choose your agent
        </h2>
        <p className="text-sm text-muted mb-6">
          Your chosen agent will be shown on all listings. You can change this anytime.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Have an agent code */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Have an agent code?</p>
            <input
              id="agent-code"
              type="text"
              value={agentCode}
              onChange={(e) => handleCodeChange(e.target.value.toUpperCase())}
              className={inputClass}
              placeholder="8 digit key"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Don't have a code: list of paid agents */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Don&apos;t have a code? Choose an agent</p>
            {agentsLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
                <span className="text-sm">Loading agents…</span>
              </div>
            ) : paidAgents.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                No agents available to choose from yet. Enter your agent&apos;s code above if you have one.
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-2">
                {paidAgents.map((agent) => {
                  const d = agent.data || {};
                  const name = (d.display_name || "").trim() || "Agent";
                  const brokerage = (d.brokerage || "").trim() || null;
                  const photoUrl = d.profile_image_url || null;
                  const isSelected = selectedAgent?.user_id === agent.user_id;
                  return (
                    <li key={agent.user_id}>
                      <button
                        type="button"
                        onClick={() => handleSelectFromList(agent)}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                          isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-surface-elevated"
                        }`}
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-elevated">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lg font-bold text-muted">
                              {name.charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-foreground">{name}</span>
                          {brokerage && (
                            <span className="mt-0.5 block text-xs text-muted">{brokerage}</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-border py-3 text-lg font-bold text-foreground hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSave}
              className="btn-primary flex-1 rounded-xl py-3 text-lg font-bold disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
