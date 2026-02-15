"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lumina_saved_ids";

const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const [savedIds, setSavedIds] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedIds(parsed);
      }
    } catch (_) {}
  }, []);

  const persist = useCallback((ids) => {
    setSavedIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (_) {}
  }, []);

  const toggleSave = useCallback((id) => {
    persist((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, [persist]);

  return (
    <SavedContext.Provider value={{ savedIds, toggleSave }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) return { savedIds: [], toggleSave: () => {} };
  return ctx;
}
