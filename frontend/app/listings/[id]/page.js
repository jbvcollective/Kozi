"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchListingById, getCachedListingById } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { useSaved } from "@/context/SavedContext";
import PropertyDetails from "@/components/PropertyDetails";
import Loading from "@/components/Loading";
import RequireAuth from "@/components/RequireAuth";

export default function ListingDetailPage() {
  return (
    <RequireAuth>
      <ListingDetailContent />
    </RequireAuth>
  );
}

function ListingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { savedIds, toggleSave } = useSaved();
  const cached = id ? getCachedListingById(id) : null;
  const [property, setProperty] = useState(() => (cached ? mapListingToProperty(cached) : null));
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    if (getCachedListingById(id)) return; // already showing from prefetch cache
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListingById(id)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setProperty(mapListingToProperty(row));
        } else {
          setError("Listing not found");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading listing..."
        className="min-h-screen px-8 pt-24 md:px-12"
      />
    );
  }

  if (error || !property) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 pt-24 md:px-12">
        <p className="text-lg font-bold text-red-600">{error || "Not found"}</p>
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

  return (
    <PropertyDetails
      property={property}
      isSaved={savedIds.includes(property.id)}
      onToggleSave={toggleSave}
      onBack={() => router.push("/explore")}
    />
  );
}

