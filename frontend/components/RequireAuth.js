"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loading from "@/components/Loading";
import AuthModal from "@/components/AuthModal";

/**
 * Wraps content that requires a logged-in user. Shows a sign-in/sign-up popup when no session.
 * Use on Explore, listing detail, Saved, Market, Open Houses, Compare, VIP, etc.
 */
export default function RequireAuth({ children }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setHasSession(false);
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription?.unsubscribe();
  }, []);

  if (checking) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Checking sign-in…"
        className="min-h-screen px-8 pt-24"
      />
    );
  }

  if (!hasSession) {
    return (
      <AuthModal
        onClose={() => router.push("/")}
        onSuccess={() => {}}
      />
    );
  }

  return children;
}
