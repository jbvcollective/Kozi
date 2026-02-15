"use client";

import { useState } from "react";
import Link from "next/link";
import PropertyCard from "@/components/PropertyCard";

const MAX_COMPARE = 5;

export default function SavedView({ properties = [], onSelectProperty, onToggleSave }) {
  const count = properties.length;
  const [selectedForCompare, setSelectedForCompare] = useState(() => new Set());

  const toggleForCompare = (id) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COMPARE) next.add(id);
      return next;
    });
  };

  const selectedCount = selectedForCompare.size;
  const compareSelectedUrl = selectedCount >= 2 ? `/compare?ids=${[...selectedForCompare].join(",")}` : null;
  const compareAllUrl = count >= 2 ? `/compare?ids=${properties.slice(0, MAX_COMPARE).map((p) => p.id).join(",")}` : "/compare";

  if (count === 0) {
    return (
      <div className="px-8 pb-32 pt-24 md:px-12">
        <h1 className="mb-8 flex items-center gap-3 text-4xl font-black tracking-tight text-foreground">
          Saved listings
          <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl bg-primary/10 px-3 py-1.5 text-xl font-black text-primary">
            {count}
          </span>
        </h1>
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 py-20 text-center">
          <p className="text-muted font-medium">No saved listings yet.</p>
          <p className="mt-2 text-sm text-muted">Save listings from Explore to see them here.</p>
          <Link href="/explore" className="mt-6 inline-block rounded-xl bg-primary px-8 py-3 font-bold text-white">
            Explore listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 pb-32 pt-24 md:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-4xl font-black tracking-tight text-foreground">
          Saved listings
          <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-xl bg-primary/10 px-3 py-1.5 text-xl font-black text-primary">
            {count}
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {compareSelectedUrl && (
            <Link
              href={compareSelectedUrl}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 font-bold text-white transition-premium hover:opacity-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare selected ({selectedCount})
            </Link>
          )}
          <Link
            href={compareAllUrl}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-surface-elevated px-5 py-2.5 font-bold text-foreground transition-premium hover:border-primary hover:bg-primary/5"
          >
            Compare all (up to {Math.min(count, MAX_COMPARE)})
          </Link>
        </div>
      </div>

      {count >= 2 && (
        <p className="mb-4 text-sm font-medium text-muted">
          Select 2–5 listings to compare, or use “Compare all” for the first {Math.min(count, MAX_COMPARE)}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {properties.map((p) => {
          const isSelected = selectedForCompare.has(p.id);
          const canSelect = selectedCount < MAX_COMPARE || isSelected;
          return (
            <div key={p.id} className="min-w-0">
              <PropertyCard
                property={p}
                isSaved
                onToggleSave={onToggleSave}
                href={`/listings/${p.id}`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {count >= 2 && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleForCompare(p.id)}
                      disabled={!canSelect}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">Add to compare</span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForCompare((prev) => {
                      const next = new Set(prev);
                      next.delete(p.id);
                      return next;
                    });
                    onToggleSave(p.id);
                  }}
                  className="text-xs font-bold uppercase tracking-wider text-error hover:underline"
                  aria-label={`Remove ${p.title || "listing"} from saved`}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
