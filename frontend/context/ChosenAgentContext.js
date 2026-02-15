"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ChooseAgentModal from "@/components/ChooseAgentModal";

const ChosenAgentContext = createContext(null);

export function ChosenAgentProvider({ children }) {
  const { user } = useAuth();
  const [chosenAgent, setChosenAgentState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChooseModal, setShowChooseModal] = useState(false);
  const skipNextLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasSupabase() || !user?.id) {
      setChosenAgentState(null);
      setLoading(false);
      return;
    }
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      setLoading(false);
      return;
    }
    setLoading(true);
    // Load from user_chosen_agent table (one row per user when they save)
    const { data: row } = await supabase
      .from("user_chosen_agent")
      .select("agent_code, agent_name, brokerage, agent_phone, agent_email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (row?.agent_name != null && row.agent_name !== "") {
      setChosenAgentState({
        agentCode: row.agent_code ?? null,
        agentName: String(row.agent_name),
        brokerage: row.brokerage ?? null,
        phone: row.agent_phone ?? null,
        email: row.agent_email ?? null,
      });
    } else {
      const meta = user.user_metadata || {};
      const name = meta.chosen_agent_name;
      if (name != null && name !== "") {
        setChosenAgentState({
          agentCode: meta.chosen_agent_code ?? null,
          agentName: String(name),
          brokerage: meta.chosen_agent_brokerage ?? null,
          phone: meta.chosen_agent_phone ?? null,
          email: meta.chosen_agent_email ?? null,
        });
      } else {
        setChosenAgentState(null);
      }
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveChosenAgent = useCallback(
    async (agent) => {
      if (!hasSupabase()) return { error: new Error("App not connected to database.") };
      if (!user?.id) return { error: new Error("Please sign in to save your agent.") };
      const nextState = {
        agentCode: agent.agentCode ?? null,
        agentName: agent.agentName ?? "",
        brokerage: agent.brokerage ?? null,
        phone: agent.phone ?? null,
        email: agent.email ?? null,
      };
      const updatedAt = new Date().toISOString();
      const userName = user.user_metadata?.full_name ?? user.email ?? null;
      const { error } = await supabase.from("user_chosen_agent").upsert(
        {
          user_id: user.id,
          user_name: userName,
          agent_code: nextState.agentCode,
          agent_name: nextState.agentName || "",
          brokerage: nextState.brokerage,
          agent_phone: nextState.phone,
          agent_email: nextState.email,
          updated_at: updatedAt,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        const err = error instanceof Error ? error : new Error(error.message || String(error));
        return { error: err };
      }
      setChosenAgentState(nextState);
      skipNextLoadRef.current = true;
      setShowChooseModal(false);
      return { error: null };
    },
    [user?.id, user?.user_metadata?.full_name, user?.email]
  );

  const openChooseAgentModal = useCallback(() => setShowChooseModal(true), []);
  const closeChooseAgentModal = useCallback(() => setShowChooseModal(false), []);

  const value = {
    chosenAgent,
    loading,
    showChooseModal,
    openChooseAgentModal,
    closeChooseAgentModal,
    saveChosenAgent,
    reload: load,
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
    </ChosenAgentContext.Provider>
  );
}

export function useChosenAgent() {
  const ctx = useContext(ChosenAgentContext);
  return (
    ctx || {
      chosenAgent: null,
      loading: false,
      showChooseModal: false,
      openChooseAgentModal: () => {},
      closeChooseAgentModal: () => {},
      saveChosenAgent: async () => ({ error: new Error("No provider") }),
      reload: () => {},
    }
  );
}
