"use client";

import { useState, useEffect } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * For the current user: true only if they are an agent AND have paid for Agent Pro
 * (agents.data.agent_pro_subscribed_at is set). Also returns the agent's profile so they
 * can be shown as listing agent on all listings when they're signed in.
 */
export function useAgentPro() {
  const { user } = useAuth();
  const [hasAgentPro, setHasAgentPro] = useState(false);
  const [selfAgentProfile, setSelfAgentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAgent = user?.user_metadata?.user_type === "agent";

  useEffect(() => {
    if (!hasSupabase() || !user?.id || !isAgent) {
      setHasAgentPro(false);
      setSelfAgentProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("agents")
      .select("data, is_paid")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const ad = data?.data;
        const paid = !!(data?.is_paid || ad?.agent_pro_subscribed_at);
        setHasAgentPro(paid);
        if (paid && ad) {
          setSelfAgentProfile({
            name: (ad.display_name || "").trim() || user.user_metadata?.full_name || user.email || "Agent",
            brokerage: ad.brokerage ?? user.user_metadata?.brokerage ?? null,
            phone: ad.phone ?? user.user_metadata?.phone ?? null,
            email: ad.email ?? user?.email ?? null,
            profile_image_url: ad.profile_image_url ?? null,
          });
        } else {
          setSelfAgentProfile(null);
        }
      })
      .finally(() => setLoading(false));
  }, [user?.id, isAgent, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.brokerage, user?.user_metadata?.phone]);

  return { hasAgentPro, isAgent, loading, selfAgentProfile };
}
