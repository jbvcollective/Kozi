"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchListings } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import CompareView from "@/components/CompareView";
import Loading from "@/components/Loading";
import RequireAuth from "@/components/RequireAuth";

export default function ComparePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Loading variant="screen" size="md" message="Loading comparison..." className="min-h-[60vh] px-8 pt-24 md:px-12" />}>
        <ComparePageContent />
      </Suspense>
    </RequireAuth>
  );
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(!!ids.length);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ids.length) {
      setProperties([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListings()
      .then((rows) => {
        if (cancelled) return;
        const all = (rows || []).map(mapListingToProperty);
        const selected = all.filter((p) => ids.includes(p.id));
        setProperties(selected);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [idsParam]);

  const handleBack = () => router.push("/explore");

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading comparison..."
        className="min-h-[60vh] px-8 pt-24 md:px-12"
      />
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-8 pt-24 md:px-12">
        <p className="font-semibold text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="rounded-2xl bg-black px-8 py-3 font-bold text-white"
        >
          Back to Explore
        </button>
      </div>
    );
  }

  return <CompareView properties={properties} onBack={handleBack} />;
}
