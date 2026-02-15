"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";

export default function Home() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSearch = (query) => {
    if (!query?.trim()) return;
    setIsProcessing(true);
    // Simulate consulting "Lumina Intelligence" then navigate to Explore with query
    setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      router.push(`/explore?${params.toString()}`);
      setIsProcessing(false);
    }, 1500);
  };

  return <Onboarding onSearch={handleSearch} isProcessing={isProcessing} />;
}
