"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lumina_sidebar_open";

const SidebarContext = createContext(null);

function getInitialSidebarOpen() {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw !== "false";
  } catch (_) {
    return true;
  }
}

export function SidebarProvider({ children }) {
  const [sidebarOpen, setSidebarOpenState] = useState(getInitialSidebarOpen);

  const setSidebarOpen = useCallback((value) => {
    setSidebarOpenState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch (_) {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  return ctx || { sidebarOpen: true, setSidebarOpen: () => {}, toggleSidebar: () => {} };
}
