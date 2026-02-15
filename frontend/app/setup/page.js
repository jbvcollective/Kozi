"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Settings moved to Profile. Redirect /setup to /profile. */
export default function SetupRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return null;
}
