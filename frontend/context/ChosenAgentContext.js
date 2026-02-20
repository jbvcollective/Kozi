"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ChooseAgentModal from "@/components/ChooseAgentModal";
import ClaimAsAgentModal from "@/components/ClaimAsAgentModal";
import { getTheme, DEFAULT_THEME_ID } from "@/lib/themes";

const ChosenAgentContext = createContext(null);

const AGENT_CODE_PROMPT_KEY = "vestahome_agent_code_prompt_dismissed";
const AGENT_CONNECTED_DISMISSED_KEY = "vestahome_agent_connected_dismissed";

export function ChosenAgentProvider({ children }) {
  const { user } = useAuth();
  const [chosenAgent, setChosenAgentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChooseModal, setShowChooseModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const skipNextLoadRef = useRef(false);
  const [showAgentConnectedPopup, setShowAgentConnectedPopup] = useState(false);
  const [showAgentCodePrompt, setShowAgentCodePrompt] = useState(false);
  const [agentCodeInput, setAgentCodeInput] = useState("");
  const [agentCodeError, setAgentCodeError] = useState(null);
  const [agentCodeLoading, setAgentCodeLoading] = useState(false);
  const [agentList, setAgentList] = useState([]);
  const [agentListLoading, setAgentListLoading] = useState(false);
  const agentCodePromptShownRef = useRef(false);

  const hasDismissedAgentPopup = useCallback(() => {
    if (typeof window === "undefined" || !user?.id) return true;
    try {
      return localStorage.getItem(`${AGENT_CONNECTED_DISMISSED_KEY}_${user.id}`) === "1";
    } catch {
      return false;
    }
  }, [user?.id]);

  const dismissAgentConnectedPopup = useCallback(() => {
    if (user?.id && typeof window !== "undefined") {
      try {
        localStorage.setItem(`${AGENT_CONNECTED_DISMISSED_KEY}_${user.id}`, "1");
      } catch (_) {}
    }
    setShowAgentConnectedPopup(false);
  }, [user?.id]);

  const showAgentConnectedPopupIfNotDismissed = useCallback(() => {
    if (!hasDismissedAgentPopup()) setShowAgentConnectedPopup(true);
  }, [hasDismissedAgentPopup]);

  const load = useCallback(async () => {
    if (!hasSupabase() || !user?.id) {
      setChosenAgentState(null);
      setThemeId(DEFAULT_THEME_ID);
      setLoading(false);
      return;
    }
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      setLoading(false);
      return;
    }
    setLoading(true);
    // Load from user_chosen_agent table, one JSONB column: data
    const { data: row } = await supabase
      .from("user_chosen_agent")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    const d = row?.data || {};
    if (d.theme && typeof d.theme === "string") setThemeId(d.theme);
    else setThemeId(DEFAULT_THEME_ID);
    const agentNameVal = d.agent_name != null && d.agent_name !== "" ? String(d.agent_name) : "";
    if (agentNameVal) {
      let hasAgentPro = false;
      let agentName = agentNameVal;
      let brokerage = d.brokerage ?? null;
      let phone = d.agent_phone ?? null;
      let email = d.agent_email ?? null;
      const agentId = d.agent_id ?? null;
      if (agentId) {
        const { data: agentRow } = await supabase.from("agents").select("code, data, is_paid").eq("user_id", agentId).maybeSingle();
        const ad = agentRow?.data;
        hasAgentPro = !!(agentRow?.is_paid || ad?.agent_pro_subscribed_at);
        if (agentRow && ad) {
          agentName = (ad.display_name || "").trim() || agentName;
          brokerage = ad.brokerage ?? brokerage;
          phone = ad.phone ?? phone;
          email = ad.email ?? email;
        }
      }
      setChosenAgentState({
        agentId: agentId,
        agentCode: d.agent_code ?? null,
        agentName,
        brokerage,
        phone,
        email,
        hasAgentPro,
      });
    } else {
      const meta = user.user_metadata || {};
      const pendingCode = meta.chosen_agent_code;
      const name = meta.chosen_agent_name;
      if (pendingCode && typeof pendingCode === "string") {
        const { data: agentRow } = await supabase
          .from("agents")
          .select("user_id, code, data, is_paid")
          .eq("code", pendingCode.toUpperCase())
          .maybeSingle();
        if (agentRow) {
          const ad = agentRow.data || {};
          const chosenAgentData = {
            user_name: meta.full_name || user.email || null,
            agent_id: agentRow.user_id ?? null,
            agent_code: agentRow.code ?? pendingCode.toUpperCase(),
            agent_name: (ad.display_name || "").trim() || "Your agent",
            brokerage: ad.brokerage ?? null,
            agent_phone: ad.phone ?? null,
            agent_email: ad.email ?? null,
            agent_photo: ad.profile_image_url ?? null,
            hasAgentPro: !!(agentRow.is_paid || ad.agent_pro_subscribed_at),
            theme: "teal",
          };
          await supabase.from("user_chosen_agent").upsert(
            { user_id: user.id, data: chosenAgentData, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
          const hasAgentPro = !!(agentRow.is_paid || ad.agent_pro_subscribed_at);
          setChosenAgentState({
            agentId: agentRow.user_id ?? null,
            agentCode: agentRow.code ?? pendingCode.toUpperCase(),
            agentName: (ad.display_name || "").trim() || "Your agent",
            brokerage: ad.brokerage ?? null,
            phone: ad.phone ?? null,
            email: ad.email ?? null,
            hasAgentPro,
          });
        } else {
          setChosenAgentState(null);
        }
      } else if (name != null && name !== "") {
        setChosenAgentState({
          agentCode: meta.chosen_agent_code ?? null,
          agentName: String(name),
          brokerage: meta.chosen_agent_brokerage ?? null,
          phone: meta.chosen_agent_phone ?? null,
          email: meta.chosen_agent_email ?? null,
          hasAgentPro: false,
        });
      } else {
        setChosenAgentState(null);
      }
    }
    setLoading(false);
  }, [user?.id]);

  // Apply agent theme to document (primary colors)
  useEffect(() => {
    const theme = getTheme(themeId);
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) return;
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--primary-hover", theme.primaryHover);
    return () => {
      const def = getTheme(DEFAULT_THEME_ID);
      root.style.setProperty("--primary", def.primary);
      root.style.setProperty("--primary-hover", def.primaryHover);
    };
  }, [themeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Only show "Do you have an agent code?" to users who have not yet selected an agent.
  useEffect(() => {
    if (loading || agentCodePromptShownRef.current) return;
    if (!user?.id) return;
    const meta = user.user_metadata || {};
    if (meta.user_type === "agent") return;
    if (chosenAgent) return;
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(`${AGENT_CODE_PROMPT_KEY}_${user.id}`) === "1") return;
    } catch {}
    agentCodePromptShownRef.current = true;
    setShowAgentCodePrompt(true);
  }, [loading, user?.id, user?.user_metadata, chosenAgent]);

  const dismissAgentCodePrompt = useCallback(() => {
    setShowAgentCodePrompt(false);
    setAgentCodeInput("");
    setAgentCodeError(null);
    if (user?.id && typeof window !== "undefined") {
      try { localStorage.setItem(`${AGENT_CODE_PROMPT_KEY}_${user.id}`, "1"); } catch {}
    }
  }, [user?.id]);

  const submitAgentCode = useCallback(async () => {
    const code = agentCodeInput.trim().toUpperCase();
    if (!code) { setAgentCodeError("Please enter an agent code."); return; }
    if (!user?.id || !hasSupabase()) return;
    setAgentCodeLoading(true);
    setAgentCodeError(null);
    try {
      const { data: agentRow, error: lookupErr } = await supabase
        .from("agents").select("user_id, code, data, is_paid").eq("code", code).maybeSingle();
      if (lookupErr) { setAgentCodeError("Something went wrong. Please try again."); return; }
      if (!agentRow) { setAgentCodeError("No agent found with that code. Please check and try again."); return; }
      const ad = agentRow.data || {};
      const chosenAgentData = {
        user_name: user.user_metadata?.full_name || user.email || null,
        agent_id: agentRow.user_id ?? null,
        agent_code: agentRow.code ?? code,
        agent_name: (ad.display_name || "").trim() || "Your agent",
        brokerage: ad.brokerage ?? null,
        agent_phone: ad.phone ?? null,
        agent_email: ad.email ?? null,
        agent_photo: ad.profile_image_url ?? null,
        hasAgentPro: !!(agentRow.is_paid || ad.agent_pro_subscribed_at),
        theme: "teal",
      };
      const { error: upsertErr } = await supabase.from("user_chosen_agent").upsert(
        { user_id: user.id, data: chosenAgentData, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (upsertErr) { setAgentCodeError("Could not save. Please try again."); return; }
      setChosenAgentState({
        agentId: agentRow.user_id ?? null,
        agentCode: agentRow.code ?? code,
        agentName: (ad.display_name || "").trim() || "Your agent",
        brokerage: ad.brokerage ?? null,
        phone: ad.phone ?? null,
        email: ad.email ?? null,
        hasAgentPro: !!(agentRow.is_paid || ad.agent_pro_subscribed_at),
      });
      skipNextLoadRef.current = true;
      dismissAgentCodePrompt();
      if (!hasDismissedAgentPopup()) setShowAgentConnectedPopup(true);
    } finally {
      setAgentCodeLoading(false);
    }
  }, [agentCodeInput, user?.id, user?.email, user?.user_metadata, dismissAgentCodePrompt, hasDismissedAgentPopup]);

  const saveChosenAgent = useCallback(
    async (agent) => {
      if (!hasSupabase()) return { error: new Error("App not connected to database.") };
      if (!user?.id) return { error: new Error("Please sign in to save your agent.") };
      const nextState = {
        agentId: agent.agentId ?? null,
        agentCode: agent.agentCode ?? null,
        agentName: agent.agentName ?? "",
        brokerage: agent.brokerage ?? null,
        phone: agent.phone ?? null,
        email: agent.email ?? null,
      };
      const userName = user.user_metadata?.full_name ?? user.email ?? null;
      const chosenAgentData = {
        user_name: userName,
        agent_id: nextState.agentId ?? null,
        agent_code: nextState.agentCode,
        agent_name: nextState.agentName || "",
        brokerage: nextState.brokerage,
        agent_phone: nextState.phone,
        agent_email: nextState.email,
        theme: themeId,
      };
      const { error } = await supabase.from("user_chosen_agent").upsert(
        { user_id: user.id, data: chosenAgentData, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) {
        const err = error instanceof Error ? error : new Error(error.message || String(error));
        return { error: err };
      }
      if (nextState.agentId) {
        const { data: agentRow } = await supabase.from("agents").select("code, data, is_paid").eq("user_id", nextState.agentId).maybeSingle();
        const ad = agentRow?.data;
        nextState.hasAgentPro = !!(agentRow?.is_paid || ad?.agent_pro_subscribed_at);
        if (agentRow && ad) {
          nextState.agentCode = agentRow.code ?? nextState.agentCode;
          nextState.agentName = (ad.display_name || "").trim() || nextState.agentName;
          nextState.brokerage = ad.brokerage ?? nextState.brokerage;
          nextState.phone = ad.phone ?? nextState.phone;
          nextState.email = ad.email ?? nextState.email;
        }
      } else {
        nextState.hasAgentPro = false;
      }
      setChosenAgentState(nextState);
      skipNextLoadRef.current = true;
      setShowChooseModal(false);
      setShowClaimModal(false);
      if (!hasDismissedAgentPopup()) setShowAgentConnectedPopup(true);
      return { error: null };
    },
    [user?.id, user?.user_metadata?.full_name, user?.email, themeId, hasDismissedAgentPopup]
  );

  const saveTheme = useCallback(
    async (newThemeId) => {
      if (!hasSupabase() || !user?.id) return { error: new Error("Please sign in to save theme.") };
      const { data: current } = await supabase.from("user_chosen_agent").select("data").eq("user_id", user.id).maybeSingle();
      const prev = current?.data || {};
      const merged = { ...prev, theme: newThemeId };
      const { error } = await supabase.from("user_chosen_agent").upsert(
        { user_id: user.id, data: merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) return { error: error instanceof Error ? error : new Error(error.message || String(error)) };
      setThemeId(newThemeId);
      return { error: null };
    },
    [user?.id]
  );

  const selectAgentFromList = useCallback(
    async (agentRow) => {
      if (!user?.id || !hasSupabase() || !agentRow) return;
      const d = agentRow.data || {};
      const payload = {
        agentId: agentRow.user_id ?? null,
        agentCode: agentRow.code ?? null,
        agentName: (d.display_name || "").trim() || "Agent",
        brokerage: d.brokerage ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
      };
      setAgentCodeLoading(true);
      setAgentCodeError(null);
      try {
        const result = await saveChosenAgent(payload);
        if (result?.error) {
          setAgentCodeError(result.error?.message ?? "Could not connect. Try again.");
          return;
        }
        skipNextLoadRef.current = true;
        dismissAgentCodePrompt();
        if (!hasDismissedAgentPopup()) setShowAgentConnectedPopup(true);
      } finally {
        setAgentCodeLoading(false);
      }
    },
    [user?.id, saveChosenAgent, dismissAgentCodePrompt, hasDismissedAgentPopup]
  );

  useEffect(() => {
    if (!showAgentCodePrompt || !hasSupabase()) return;
    let cancelled = false;
    setAgentListLoading(true);
    supabase
      .from("agents")
      .select("id, user_id, code, data, is_paid")
      .then(({ data, error: e }) => {
        if (cancelled) return;
        const list = (data || []).filter((a) => a.code);
        const paid = list.filter((a) => !!(a.is_paid || (a.data || {}).agent_pro_subscribed_at));
        setAgentList(paid.length > 0 ? paid : list);
        setAgentListLoading(false);
      });
    return () => { cancelled = true; };
  }, [showAgentCodePrompt]);

  const openChooseAgentModal = useCallback(() => setShowChooseModal(true), []);
  const closeChooseAgentModal = useCallback(() => setShowChooseModal(false), []);

  const openClaimAsAgentModal = useCallback(() => setShowClaimModal(true), []);
  const closeClaimAsAgentModal = useCallback(() => setShowClaimModal(false), []);

  const saveSelfAsChosenAgent = useCallback(async () => {
    if (!user?.id) return { error: new Error("Please sign in.") };
    const meta = user.user_metadata || {};
    let selfAgent = {
      agentId: user.id,
      agentCode: meta.agent_code ?? null,
      agentName: meta.full_name?.trim() || user.email || "My agent",
      brokerage: meta.brokerage ?? null,
      phone: meta.phone ?? null,
      email: user.email ?? meta.email ?? null,
    };
    if (hasSupabase()) {
      const { data: row } = await supabase
        .from("agents")
        .select("id, code, data")
        .eq("user_id", user.id)
        .maybeSingle();
      const d = row?.data;
      if (d && (d.display_name || row.code)) {
        selfAgent = {
          agentId: user.id,
          agentCode: row.code ?? selfAgent.agentCode,
          agentName: (d.display_name || "").trim() || selfAgent.agentName,
          brokerage: d.brokerage ?? selfAgent.brokerage,
          phone: d.phone ?? selfAgent.phone,
          email: d.email ?? selfAgent.email,
        };
      }
    }
    setClaimLoading(true);
    const result = await saveChosenAgent(selfAgent);
    setClaimLoading(false);
    if (!result.error) setShowClaimModal(false);
    return result;
  }, [user?.id, user?.email, user?.user_metadata, saveChosenAgent]);

  const value = {
    chosenAgent,
    themeId,
    saveTheme,
    loading,
    showChooseModal,
    openChooseAgentModal,
    closeChooseAgentModal,
    showClaimModal,
    openClaimAsAgentModal,
    closeClaimAsAgentModal,
    saveSelfAsChosenAgent,
    saveChosenAgent,
    reload: load,
    showAgentConnectedPopupIfNotDismissed,
  };

  return (
    <ChosenAgentContext.Provider value={value}>
      {children}
      {showChooseModal && (
        <ChooseAgentModal
          onClose={closeChooseAgentModal}
          onSave={saveChosenAgent}
          initialAgent={chosenAgent}
        />
      )}
      {showClaimModal && (
        <ClaimAsAgentModal
          onClose={closeClaimAsAgentModal}
          onConfirm={saveSelfAsChosenAgent}
          loading={claimLoading}
        />
      )}
      {showAgentCodePrompt && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-code-prompt-title"
        >
          <div
            className="card w-full max-w-sm rounded-2xl border-border bg-surface-elevated p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="agent-code-prompt-title" className="text-lg font-black text-foreground">
              Do you have an agent code?
            </h2>
            <p className="mt-2 text-sm text-muted">
              If your agent gave you a code, enter it below to connect with them. You can always do this later from your profile.
            </p>
            <input
              type="text"
              value={agentCodeInput}
              onChange={(e) => { setAgentCodeInput(e.target.value.toUpperCase()); setAgentCodeError(null); }}
              placeholder="Enter 8-digit agent code"
              className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 tracking-widest text-center font-mono text-lg"
              maxLength={10}
              disabled={agentCodeLoading}
              onKeyDown={(e) => { if (e.key === "Enter") submitAgentCode(); }}
            />
            {agentCodeError && (
              <p className="mt-2 text-sm text-red-600 font-medium">{agentCodeError}</p>
            )}
            <button
              type="button"
              onClick={submitAgentCode}
              disabled={agentCodeLoading || !agentCodeInput.trim()}
              className="btn-primary mt-4 w-full rounded-xl py-3 font-bold disabled:opacity-50"
            >
              {agentCodeLoading ? "Connecting…" : "Connect with agent"}
            </button>

            <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Or choose an agent
            </p>
            {agentListLoading ? (
              <div className="flex items-center gap-2 py-3 text-muted">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                <span className="text-sm">Loading agents…</span>
              </div>
            ) : agentList.length > 0 ? (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-border bg-surface p-2">
                {agentList.map((agent) => {
                  const d = agent.data || {};
                  const name = (d.display_name || "").trim() || "Agent";
                  const brokerage = (d.brokerage || "").trim() || null;
                  return (
                    <li key={agent.user_id ?? agent.id}>
                      <button
                        type="button"
                        onClick={() => selectAgentFromList(agent)}
                        disabled={agentCodeLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-surface disabled:opacity-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {name.charAt(0).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground">{name}</span>
                          {brokerage && (
                            <span className="mt-0.5 block text-xs text-muted">{brokerage}</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
                No agents available yet. Enter a code above if your agent gave you one.
              </p>
            )}

            <button
              type="button"
              onClick={dismissAgentCodePrompt}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              No, skip for now
            </button>
          </div>
        </div>
      )}
      {showAgentConnectedPopup && chosenAgent?.agentName && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-connected-title"
        >
          <div
            className="card w-full max-w-sm rounded-2xl border-border bg-surface-elevated p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="agent-connected-title" className="text-lg font-black text-foreground">
              You&apos;re connected to your agent
            </h2>
            <p className="mt-2 text-muted">
              <span className="font-semibold text-foreground">{chosenAgent.agentName}</span>
              {chosenAgent.brokerage && ` · ${chosenAgent.brokerage}`}
            </p>
            <p className="mt-2 text-sm text-muted">
              They&apos;ll appear on listings you view. You can change this anytime from your profile or the VIP page.
            </p>
            <button
              type="button"
              onClick={dismissAgentConnectedPopup}
              className="btn-primary mt-6 w-full rounded-xl py-3 font-bold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </ChosenAgentContext.Provider>
  );
}

export function useChosenAgent() {
  const ctx = useContext(ChosenAgentContext);
  return (
    ctx || {
      chosenAgent: null,
      themeId: "teal",
      saveTheme: async () => ({ error: new Error("No provider") }),
      loading: false,
      showChooseModal: false,
      openChooseAgentModal: () => {},
      closeChooseAgentModal: () => {},
      showClaimModal: false,
      openClaimAsAgentModal: () => {},
      closeClaimAsAgentModal: () => {},
      saveSelfAsChosenAgent: async () => ({ error: new Error("No provider") }),
      saveChosenAgent: async () => ({ error: new Error("No provider") }),
      reload: () => {},
      showAgentConnectedPopupIfNotDismissed: () => {},
    }
  );
}
