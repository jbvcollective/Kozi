"use client";

import { useEffect, useState } from "react";
import { fetchListings } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { useSaved } from "@/context/SavedContext";
import SavedView from "@/components/SavedView";
import RequireAuth from "@/components/RequireAuth";

export default function SavedPage() {
  return (
    <RequireAuth>
      <SavedPageContent />
    </RequireAuth>
  );
}

function SavedPageContent() {
  const { savedIds, toggleSave } = useSaved();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchListings()
      .then((rows) => {
        if (cancelled) return;
        const all = (rows || []).map(mapListingToProperty);
        setProperties(all.filter((p) => savedIds.includes(p.id)));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [savedIds]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-8 pt-24 md:px-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-100 border-t-black" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 pb-32 pt-24 md:px-12">
        <p className="font-semibold text-red-600">Error: {error}</p>
      </div>
    );
  }

  return <SavedView properties={properties} onToggleSave={toggleSave} />;
}

