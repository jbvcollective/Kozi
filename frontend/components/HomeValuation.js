"use client";

import { useState } from "react";
import { fetchListingsSearch } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { getValuationInsights } from "@/lib/geminiService";

/** Extract city (and optionally province) from address string for comp search. */
function parseCityFromAddress(address) {
  if (!address || typeof address !== "string") return "";
  const trimmed = address.trim();
  const match = trimmed.match(/,?\s*([A-Za-z\s\-]+),?\s*(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|Ontario|British Columbia|Alberta|Quebec|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland|Prince Edward Island|Yukon|Northwest Territories)/i);
  return match ? match[1].trim() : trimmed.split(",")[0]?.trim() || trimmed;
}

function mapBenchmarkRow(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const merged = { ...vow, ...idx };
  const photos = idx.Photos ?? vow.Photos ?? [];
  const firstPhoto = Array.isArray(photos) ? photos[0] : photos?.[0];
  return {
    id: row.listing_key,
    title: merged.StreetName || merged.StreetNumber ? [merged.StreetNumber, merged.StreetName].filter(Boolean).join(" ") : "Comparable",
    price: Number(merged.ListPrice || merged.ClosePrice || 0),
    location: merged.City || "Canada",
    image: firstPhoto || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400",
  };
}

/** Median of sorted array. */
function median(sortedArr) {
  if (!sortedArr?.length) return null;
  const n = sortedArr.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sortedArr[mid] : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}

/** Percentile (0–1) of sorted array. */
function percentile(sortedArr, p) {
  if (!sortedArr?.length) return null;
  const i = (sortedArr.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (i - lo) * (sortedArr[hi] - sortedArr[lo]);
}

export default function HomeValuation() {
  const [address, setAddress] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);

  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!address) return;
    setCalculating(true);
    setResult(null);
    setTimeout(() => {
      setResult({ comingSoon: true });
      setCalculating(false);
    }, 1200);
  };

  return (
    <div className="pt-24 px-8 pb-32 max-w-[1600px] mx-auto animate-fade-in md:px-12">
      <div className="mb-20 text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-surface rounded-full border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Property Valuation</span>
        </div>
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-foreground">Equity.</h1>
        <p className="text-2xl text-muted font-medium max-w-2xl mx-auto leading-tight">
          Precise, market-based valuation for Canadian homes.{" "}
          <span className="text-foreground">Enter your address to begin.</span>
        </p>
      </div>

      <form onSubmit={handleCalculate} className="relative mb-24 max-w-4xl mx-auto">
        <div
          className={`relative flex items-center bg-surface-elevated border-2 transition-premium rounded-3xl px-10 py-8 ${
            calculating ? "border-primary ring-4 ring-primary/10" : "border-border focus-within:border-primary focus-within:[box-shadow:var(--shadow-focus)]"
          }`}
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <input
            type="text"
            placeholder="e.g. 150 King St W, Toronto, ON"
            className="flex-grow bg-transparent text-2xl md:text-3xl outline-none text-foreground font-bold placeholder-muted"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={calculating}
          />
          <button
            type="submit"
            disabled={calculating || !address}
            className="btn-primary p-6 rounded-xl flex items-center space-x-3 group"
          >
            {calculating ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-widest hidden md:block">Analyze</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
        <p className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.5em] text-muted">
          Global MLS® & Unified Database Sync Active
        </p>
      </form>

      {result?.comingSoon && (
        <div className="animate-fade-in text-center">
          <div className="card bg-surface-elevated rounded-3xl border-border p-12 max-w-2xl mx-auto">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-foreground">Coming soon</h2>
            <p className="mt-3 text-muted max-w-md mx-auto">
              Precise, market-based home valuations powered by MLS® data and AI insights are on the way. Stay tuned.
            </p>
          </div>
        </div>
      )}

      {!result && (
        <div className="grid grid-cols-1 gap-12 border-t border-gray-50 pt-20 md:grid-cols-3">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">Market Correlation</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              We combine property quality with neighborhood liquidity to surface equity value.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">Local Precision</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              Precision localized data for the GTA, Metro Vancouver, and Canadian luxury markets.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-black">MLS® Synergy</h3>
            <p className="text-gray-400 font-medium leading-relaxed">
              Seamlessly integrated with current active inventory and historical sold records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
