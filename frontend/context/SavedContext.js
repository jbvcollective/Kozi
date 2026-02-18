"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase, hasSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "lumina_saved_ids";
const TABLE = "saved_listings";

const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load saved: from Supabase when logged in, else from localStorage (guest)
  useEffect(() => {
    if (!hasSupabase()) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedIds(parsed);
        }
      } catch (_) {}
      setLoading(false);
      return;
    }

    if (!user?.id) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedIds(parsed);
        } else setSavedIds([]);
      } catch (_) {
        setSavedIds([]);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .from(TABLE)
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data: row, error }) => {
        if (cancelled) return;
        if (error) {
          setSavedIds([]);
          setLoading(false);
          return;
        }
        let ids = Array.isArray(row?.data?.listing_keys) ? row.data.listing_keys.filter(Boolean) : [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const guestArray = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : [];
          const toMerge = guestArray.filter((k) => k && !ids.includes(k));
          if (toMerge.length > 0) {
            const nextData = { listing_keys: [...new Set([...toMerge, ...ids])], updated_at: new Date().toISOString() };
            await supabase.from(TABLE).upsert({ user_id: user.id, data: nextData, updated_at: nextData.updated_at }, { onConflict: "user_id" });
            ids = nextData.listing_keys;
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch (_) {}
          }
        } catch (_) {}
        if (!cancelled) setSavedIds(ids);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggleSave = useCallback(
    async (listingKey) => {
      const key = typeof listingKey === "string" ? listingKey : String(listingKey ?? "");
      if (!key) return;

      if (!hasSupabase() || !user?.id) {
        // Guest: persist to localStorage only
        setSavedIds((prev) => {
          const next = prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key];
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch (_) {}
          return next;
        });
        return;
      }

      const isCurrentlySaved = savedIds.includes(key);
      const nextIds = isCurrentlySaved ? savedIds.filter((i) => i !== key) : [...savedIds, key];
      setSavedIds(nextIds);

      const nextData = { listing_keys: nextIds, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from(TABLE)
        .upsert({ user_id: user.id, data: nextData, updated_at: nextData.updated_at }, { onConflict: "user_id" });
      if (error) setSavedIds(savedIds);
    },
    [user?.id, savedIds]
  );

  return (
    <SavedContext.Provider value={{ savedIds, toggleSave, loading }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) return { savedIds: [], toggleSave: () => {}, loading: false };
  return ctx;
}
