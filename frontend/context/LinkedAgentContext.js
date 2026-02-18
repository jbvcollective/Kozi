"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const LinkedAgentContext = createContext(null);

export function LinkedAgentProvider({ children }) {
  const { user } = useAuth();
  const [linkedAgent, setLinkedAgent] = useState(null);
  const [loading, setLoading] = useState(true);

    // Single source: user_chosen_agent table, one JSONB column (data)
    const load = useCallback(async () => {
      if (!hasSupabase() || !user?.id) {
        setLinkedAgent(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: row } = await supabase
          .from("user_chosen_agent")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        const d = row?.data || {};
        const agentUserId = d.agent_id ?? null;
      if (!agentUserId) {
        setLinkedAgent(null);
        setLoading(false);
        return;
      }

      const { data: agent } = await supabase
        .from("agents")
        .select("id, user_id, code, data, is_paid")
        .eq("user_id", agentUserId)
        .maybeSingle();

      if (!agent) {
        setLinkedAgent(null);
        setLoading(false);
        return;
      }

      const { data: custom } = await supabase
        .from("agent_customizations")
        .select("primary_color, secondary_color, accent_color, tagline, bio")
        .eq("agent_id", agent.id)
        .maybeSingle();

      const ad = agent.data || {};
      const hasAgentPro = !!(agent.is_paid || ad.agent_pro_subscribed_at);
      setLinkedAgent({
        ...agent,
        name: ad.display_name,
        brokerage: ad.brokerage,
        email: ad.email,
        phone: ad.phone,
        profile_image_url: ad.profile_image_url,
        logo_url: ad.logo_url ?? null,
        primary_color: custom?.primary_color || "#3b82f6",
        secondary_color: custom?.secondary_color || "#1e40af",
        accent_color: custom?.accent_color || "#10b981",
        tagline: custom?.tagline || null,
        bio: custom?.bio || null,
        hasAgentPro,
      });
    } catch {
      setLinkedAgent(null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Apply linked agent theme to document
  useEffect(() => {
    if (!linkedAgent) return;
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (!root) return;
    root.style.setProperty("--primary", linkedAgent.primary_color);
    root.style.setProperty("--primary-hover", linkedAgent.secondary_color || linkedAgent.primary_color);
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-hover");
    };
  }, [linkedAgent?.primary_color, linkedAgent?.secondary_color]);

  const value = {
    linkedAgent,
    loading,
    reload: load,
  };

  return (
    <LinkedAgentContext.Provider value={value}>
      {children}
    </LinkedAgentContext.Provider>
  );
}

export function useLinkedAgent() {
  const ctx = useContext(LinkedAgentContext);
  return ctx || { linkedAgent: null, loading: false, reload: () => {} };
}
