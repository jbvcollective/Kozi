"use client";

import { useState, useEffect } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function ChooseAgentModal({ onClose, onSave, initialAgent }) {
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [agentCode, setAgentCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [brokerage, setBrokerage] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialAgent) {
      setAgentCode(initialAgent.agentCode ?? "");
      setAgentName(initialAgent.agentName ?? "");
      setBrokerage(initialAgent.brokerage ?? "");
      setAgentPhone(initialAgent.phone ?? "");
      setAgentEmail(initialAgent.email ?? "");
    }
  }, [initialAgent]);

  useEffect(() => {
    if (!hasSupabase()) {
      setAgentsLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("auth_agents_with_type")
      .select("user_id, agent_code, display_name, brokerage, phone, email")
      .order("display_name")
      .then(({ data, error: e }) => {
        if (!cancelled && !e && data) setAgents(data);
        if (!cancelled) setAgentsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelectFromList = (agent) => {
    setSelectedAgent(agent);
    setShowManual(false);
    setError(null);
  };

  const handleUseManual = () => {
    setSelectedAgent(null);
    setShowManual(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (selectedAgent) {
      setLoading(true);
      const result = await onSave({
        agentCode: selectedAgent.agent_code ?? null,
        agentName: selectedAgent.display_name ?? "",
        brokerage: selectedAgent.brokerage ?? null,
        phone: selectedAgent.phone ?? null,
        email: selectedAgent.email ?? null,
      });
      setLoading(false);
      if (result?.error) {
        const msg = result.error?.message ?? (typeof result.error === "string" ? result.error : "Failed to save. Try again.");
        setError(msg);
        return;
      }
      onClose();
      return;
    }
    const name = agentName?.trim();
    if (!name) {
      setError("Agent name is required.");
      return;
    }
    setLoading(true);
    const result = await onSave({
      agentCode: agentCode?.trim() || null,
      agentName: name,
      brokerage: brokerage?.trim() || null,
      phone: agentPhone?.trim() || null,
      email: agentEmail?.trim() || null,
    });
    setLoading(false);
    if (result?.error) {
      const msg = result.error?.message ?? (typeof result.error === "string" ? result.error : "Failed to save. Try again.");
      setError(msg);
      return;
    }
    onClose();
  };

  const showingManualForm = showManual || (agents.length === 0 && !agentsLoading);
  const canSave = selectedAgent || (showingManualForm && agentName?.trim());

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {agentsLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
              <span className="text-sm">Loading agents…</span>
            </div>
          ) : agents.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Choose from registered agents</p>
              <ul className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-2">
                {agents.map((agent) => (
                  <li key={agent.user_id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFromList(agent)}
                          className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                            selectedAgent?.user_id === agent.user_id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                      <span className="font-bold text-foreground">{agent.display_name}</span>
                      {(agent.brokerage || agent.agent_code) && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {[agent.brokerage, agent.agent_code].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleUseManual}
                className="mt-2 text-sm text-muted hover:text-foreground underline"
              >
                Or enter agent details manually
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">No registered agents yet. Enter details manually below.</p>
          )}

          {showingManualForm && (
            <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Agent details</p>
              <div>
                <label htmlFor="agent-code" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Agent code (optional)
                </label>
                <input
                  id="agent-code"
                  type="text"
                  value={agentCode}
                  onChange={(e) => setAgentCode(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. from your agent"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="agent-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Agent name <span className="text-red-500">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className={inputClass}
                  placeholder="Agent full name"
                  disabled={loading}
                  required={showManual || agents.length === 0}
                />
              </div>
              <div>
                <label htmlFor="agent-brokerage" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Brokerage chosen (optional)
                </label>
                <input
                  id="agent-brokerage"
                  type="text"
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  className={inputClass}
                  placeholder="Brokerage chosen name"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="agent-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Phone (optional)
                </label>
                <input
                  id="agent-phone"
                  type="tel"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  className={inputClass}
                  placeholder="Agent phone"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="agent-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                  Email (optional)
                </label>
                <input
                  id="agent-email"
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  className={inputClass}
                  placeholder="Agent email"
                  disabled={loading}
                />
              </div>
              {agents.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setShowManual(false); setSelectedAgent(null); }}
                  className="text-sm text-muted hover:text-foreground underline"
                >
                  ← Back to agent list
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
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
