"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (!hasSupabase()) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      hadUserRef.current = !!u;
      fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'AuthContext.js:getSession:then',message:'AuthContext getSession ok',data:{hasSession:!!session},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    }).catch((e) => {
      fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'AuthContext.js:getSession:catch',message:'AuthContext getSession failed',data:{errName:e?.name,errMessage:e?.message},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      const wasSignedOut = event === "SIGNED_OUT" || event === "USER_DELETED";
      const nowNoUser = !u;
      if (hadUserRef.current && (wasSignedOut || nowNoUser)) {
        setShowAuthModal(true);
      }
      hadUserRef.current = !!u;
      setUser(u);
    });
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
