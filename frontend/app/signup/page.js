"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-8">
      <p className="text-gray-500">Redirecting to profile…</p>
    </div>
  );
}
