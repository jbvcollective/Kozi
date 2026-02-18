"use client";

import { useEffect, useState } from "react";
import { fetchListings, fetchAnalytics } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import MarketAnalysis from "@/components/MarketAnalysis";
import RequireAuth from "@/components/RequireAuth";

export default function MarketPage() {
  return (
    <RequireAuth>
      <MarketPageContent />
    </RequireAuth>
  );
}

function MarketPageContent() {
  const [properties, setProperties] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchListings().then((rows) => (rows ?? []).map(mapListingToProperty)),
      fetchAnalytics().catch(() => null),
    ])
      .then(([listings, analyticsData]) => {
        if (cancelled) return;
        setProperties(listings);
        setAnalytics(analyticsData ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load listings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="px-4 pt-24 md:px-6 md:pt-24 lg:px-8 xl:px-12">
        <div className="shimmer-bg mb-6 h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="shimmer-bg h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <MarketAnalysis properties={properties} analytics={analytics} />

      {error && (
        <div className="mx-auto max-w-[1600px] px-8 pb-8 md:px-12">
          <p className="text-red-600">Error: {error}</p>
        </div>
      )}
    </div>
  );
}

