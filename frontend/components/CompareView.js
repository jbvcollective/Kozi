"use client";

import { useState } from "react";
import Link from "next/link";

const specs = [
  { label: "Price", key: "price", format: (v) => (v != null ? `$${Number(v).toLocaleString()}` : "—") },
  { label: "Beds", key: "beds" },
  { label: "Baths", key: "baths" },
  { label: "Sq Ft", key: "sqft", format: (v) => (v != null ? `${Number(v).toLocaleString()} sqft` : "—") },
  {
    label: "Price / SqFt",
    key: "priceSqFt",
    calculate: (p) => {
      const price = p?.price;
      const sqft = p?.sqft;
      if (price != null && sqft != null && sqft > 0) return `$${Math.round(price / sqft).toLocaleString()}`;
      return "—";
    },
  },
  { label: "Type", key: "type" },
  { label: "Days on Market", key: "daysOnMarket", format: (v) => (v != null ? `${v} days` : "—") },
];

function checkIfDifferent(values) {
  return new Set(values.map((v) => String(v ?? ""))).size > 1;
}

export default function CompareView({ properties = [], onBack }) {
  const [highlightDifferences, setHighlightDifferences] = useState(false);
  const [hideSimilarities, setHideSimilarities] = useState(false);

  const allAmenities = Array.from(
    new Set((properties || []).flatMap((p) => (Array.isArray(p.amenities) ? p.amenities : [])))
  ).sort();

  if (!properties?.length) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-8 md:px-12">
        <p className="text-lg font-bold text-gray-500">Add listings to compare from Explore or Saved.</p>
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-2xl bg-black px-8 py-3 font-bold text-white">
            Back
          </button>
        )}
        {!onBack && (
          <Link href="/explore" className="rounded-2xl bg-black px-8 py-3 font-bold text-white">
            Explore
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="pt-24 pb-32 px-8 md:px-12 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
        <div className="space-y-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center space-x-3 text-sm font-bold text-gray-400 hover:text-black transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Return to Vault</span>
            </button>
          ) : (
            <Link
              href="/explore"
              className="flex items-center space-x-3 text-sm font-bold text-gray-400 hover:text-black transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Return to Explore</span>
            </Link>
          )}
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-none">Side-by-Side Analysis.</h1>
          <p className="text-gray-400 font-medium text-lg max-w-xl">
            Comparing {properties.length} architectural selections. Hover over attributes to see deep-dive market insights.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <div
              role="switch"
              tabIndex={0}
              aria-checked={highlightDifferences}
              onClick={() => setHighlightDifferences(!highlightDifferences)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setHighlightDifferences(!highlightDifferences))}
              className={`w-12 h-6 rounded-full relative transition-all duration-300 ${highlightDifferences ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${highlightDifferences ? "translate-x-6" : ""}`} />
            </div>
            <span className="text-sm font-bold text-gray-700">Highlight Differences</span>
          </label>

          <div className="hidden sm:block w-[1px] h-6 bg-gray-200" />

          <label className="flex items-center space-x-3 cursor-pointer group">
            <div
              role="switch"
              tabIndex={0}
              aria-checked={hideSimilarities}
              onClick={() => setHideSimilarities(!hideSimilarities)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setHideSimilarities(!hideSimilarities))}
              className={`w-12 h-6 rounded-full relative transition-all duration-300 ${hideSimilarities ? "bg-black" : "bg-gray-300"}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${hideSimilarities ? "translate-x-6" : ""}`} />
            </div>
            <span className="text-sm font-bold text-gray-700">Hide Similarities</span>
          </label>
        </div>
      </div>

      {/* Comparison Table Container */}
      <div className="relative border border-gray-100 rounded-[3rem] bg-white shadow-2xl overflow-hidden">
        <div className="overflow-x-auto no-scrollbar scroll-smooth">
          <table className="w-full text-left border-collapse border-spacing-0 min-w-[1000px]">
            <thead>
              <tr className="bg-white">
                <th className="sticky left-0 top-0 z-50 bg-white p-10 w-1/4 border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                  <div className="flex flex-col space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Property Ledger</span>
                    <span className="text-2xl font-black">{properties.length} Listings</span>
                  </div>
                </th>
                {properties.map((p) => (
                  <th key={p.id} className="sticky top-0 z-40 bg-white p-10 w-1/4 align-top border-b border-gray-50">
                    <div className="group relative">
                      <div className="aspect-[4/5] rounded-[2rem] overflow-hidden mb-6 shadow-xl transition-transform duration-500 group-hover:scale-[1.02]">
                        <img src={p.image || p.images?.[0]} className="w-full h-full object-cover" alt={p.title} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black tracking-tight leading-tight line-clamp-1">{p.title}</h3>
                        <p className="text-gray-400 font-medium text-[11px] uppercase tracking-[0.15em]">{p.location}</p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {specs.map((spec) => {
                const values = properties.map((p) => (spec.calculate ? spec.calculate(p) : p[spec.key]));
                const isDifferent = checkIfDifferent(values);

                if (hideSimilarities && !isDifferent) return null;

                return (
                  <tr
                    key={spec.label}
                    className={`group transition-colors duration-300 ${
                      highlightDifferences && isDifferent ? "bg-purple-50/40" : "hover:bg-gray-50/50"
                    }`}
                  >
                    <td className="sticky left-0 z-30 bg-white group-hover:bg-gray-50 p-10 border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex items-center space-x-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{spec.label}</span>
                        {highlightDifferences && isDifferent && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-[9px] font-black uppercase tracking-wider">Varies</span>
                        )}
                      </div>
                    </td>
                    {properties.map((p) => {
                      const val = spec.calculate ? spec.calculate(p) : p[spec.key];
                      const formatted = spec.format ? spec.format(val) : (val ?? "—");
                      return (
                        <td
                          key={p.id}
                          className={`p-10 text-2xl font-black tracking-tighter ${
                            highlightDifferences && isDifferent ? "text-purple-900" : "text-gray-900"
                          }`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Section Header: Amenities */}
              <tr className="bg-gray-50/80">
                <td className="sticky left-0 z-30 bg-gray-100 p-10 border-r border-gray-200">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-900">Lifestyle & Features</span>
                </td>
                {properties.map((p) => <td key={p.id} className="p-10 border-b border-gray-100" />)}
              </tr>

              {/* Amenities Grid */}
              {allAmenities.map((amenity) => {
                const hasStatus = properties.map((p) => Array.isArray(p.amenities) && p.amenities.includes(amenity));
                const isDifferent = checkIfDifferent(hasStatus);

                if (hideSimilarities && !isDifferent) return null;

                return (
                  <tr
                    key={amenity}
                    className={`group transition-colors duration-300 ${
                      highlightDifferences && isDifferent ? "bg-purple-50/30" : "hover:bg-gray-50/30"
                    }`}
                  >
                    <td className="sticky left-0 z-30 bg-white group-hover:bg-gray-50 p-10 border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-bold text-gray-500 group-hover:text-black">{amenity}</span>
                        {highlightDifferences && isDifferent && (
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        )}
                      </div>
                    </td>
                    {properties.map((p) => (
                      <td key={p.id} className="p-10">
                        {Array.isArray(p.amenities) && p.amenities.includes(amenity) ? (
                          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white shadow-lg animate-scale-in">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-20 flex flex-col items-center text-center">
        <div className="w-20 h-[1px] bg-gray-200 mb-10" />
        <div className="max-w-2xl space-y-6">
          <h4 className="text-xl font-black">Need an expert second opinion?</h4>
          <p className="text-gray-400 font-medium leading-relaxed">
            Our specialized advisors provide architectural audits and market appreciation forecasts for every listing in your vault. Secure your investment with Lumina Advisory.
          </p>
          <button type="button" className="px-10 py-5 bg-black text-white rounded-[1.5rem] font-black hover:scale-105 active:scale-95 transition-all shadow-2xl">
            Speak with a Specialist
          </button>
        </div>
      </div>
    </div>
  );
}
