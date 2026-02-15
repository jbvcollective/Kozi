"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, hasSupabase } from "@/lib/supabase";
import AuthModal from "@/components/AuthModal";

const PROTECTED_PATHS = [
  "/explore",
  "/saved",
  "/open-houses",
  "/market",
  "/vip",
  "/compare",
  "/profile",
  "/snap",
  "/valuation",
];

function isProtectedPath(href) {
  if (!href || typeof href !== "string") return false;
  const path = href.split("?")[0];
  return PROTECTED_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [intendedPath, setIntendedPath] = useState(null);

  useEffect(() => {
    if (!hasSupabase()) return;
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription?.unsubscribe();
  }, []);

  const openAuthModal = useCallback((path) => {
    setIntendedPath(path ?? "/");
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
    setIntendedPath(null);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    if (intendedPath) router.push(intendedPath);
    setShowAuthModal(false);
    setIntendedPath(null);
  }, [intendedPath, router]);

  const value = {
    user,
    showAuthModal,
    openAuthModal,
    closeAuthModal,
    isProtectedPath,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showAuthModal && (
        <AuthModal onClose={closeAuthModal} onSuccess={handleAuthSuccess} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx || { user: null, openAuthModal: () => {}, closeAuthModal: () => {}, isProtectedPath: () => false };
}
