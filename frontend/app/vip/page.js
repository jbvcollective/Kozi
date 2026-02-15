"use client";

import { useEffect, useState } from "react";
import { fetchListings } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import VIPDeals from "@/components/VIPDeals";
import Loading from "@/components/Loading";
import RequireAuth from "@/components/RequireAuth";

export default function VipPage() {
  return (
    <RequireAuth>
      <VipPageContent />
    </RequireAuth>
  );
}

function VipPageContent() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((rows) => {
        if (cancelled) return;
        setProperties((rows || []).map(mapListingToProperty));
      })
      .catch(() => {
        if (!cancelled) setProperties([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading VIP deals..."
        className="min-h-[40vh] px-8 pt-24 md:px-12"
      />
    );
  }

  return <VIPDeals properties={properties} />;
}
