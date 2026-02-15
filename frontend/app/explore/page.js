"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchListings } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { parseSearchQuery } from "@/lib/geminiService";
import { useSaved } from "@/context/SavedContext";
import PropertyCard from "@/components/PropertyCard";
import FilterSidebar from "@/components/FilterSidebar";
import { CATEGORIES } from "@/constants/categories";
import PropertyMap from "@/components/PropertyMap";
import ToolsOverview from "@/components/ToolsOverview";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";
import RequireAuth from "@/components/RequireAuth";

const CATEGORY_TO_SECTION = {
  new: "New Arrivals",
  value: "Best Value",
  luxury: "Luxury Estates",
  rentals: "Rentals",
  commercial: "Commercial Spaces",
  preconstruction: "Preconstruction",
  viewall: "All Listings",
};
const SECTION_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_TO_SECTION).map(([k, v]) => [v, k])
);

function filterByQuery(properties, query) {
  if (!query?.trim()) return properties;
  const q = query.trim().toLowerCase();
  return properties.filter(
    (p) =>
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.type && p.type.toLowerCase().includes(q))
  );
}

function filterByFilters(properties, filters) {
  if (!filters) return properties;
  const hasActiveFilter =
    filters.forRent ||
    filters.forSale ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.beds != null ||
    filters.baths != null ||
    (filters.type != null && filters.type !== "") ||
    (filters.amenities?.length > 0) ||
    (filters.statusLabel != null && filters.statusLabel !== "");
  if (!hasActiveFilter) return properties;
  return properties.filter((p) => {
    if (filters.forRent && !p.priceIsMonthly) return false;
    if (filters.forSale && p.priceIsMonthly) return false;
    if (filters.minPrice != null && (p.price ?? 0) < filters.minPrice) return false;
    if (filters.maxPrice != null && (p.price ?? 0) > filters.maxPrice) return false;
    if (filters.beds != null && (p.beds ?? 0) < filters.beds) return false;
    if (filters.baths != null && (p.baths ?? 0) < filters.baths) return false;
    if (filters.minSqft != null && (p.sqft ?? 0) < filters.minSqft) return false;
    if (filters.maxSqft != null && (p.sqft ?? 0) > filters.maxSqft) return false;
    if (filters.type && !String(p.type || "").toLowerCase().includes(String(filters.type).toLowerCase())) return false;
    if (filters.amenities?.length) {
      const list = Array.isArray(p.amenities) ? p.amenities : [];
      const hasParking = (p.parking ?? 0) > 0;
      if (!filters.amenities.every((a) => {
        const key = String(a).toLowerCase();
        if (key === "parking") return hasParking || list.some((x) => String(x).toLowerCase().includes("park") || String(x).toLowerCase().includes("garage"));
        return list.some((x) => String(x).toLowerCase().includes(key));
      })) return false;
    }
    if (filters.statusLabel) {
      const status = String(p.status || "").toLowerCase();
      const label = String(filters.statusLabel).toLowerCase();
      if (label === "new construction") {
        if (status !== "new" && !String(p.type || "").toLowerCase().includes("new construction")) return false;
      } else if (status !== label) return false;
    }
    return true;
  });
}

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get("q") || "";
  const seeAllParam = searchParams.get("seeAll") || "";
  const { savedIds, toggleSave } = useSaved();

  const PAGE_SIZE = 400;

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [searchMode, setSearchMode] = useState("grid");
  const [filters, setFilters] = useState({});
  const [inventoryMode, setInventoryMode] = useState(seeAllParam);
  const [activeQuery, setActiveQuery] = useState(queryParam || null);
  const [aiResponseText, setAiResponseText] = useState(null);
  const [aiFilters, setAiFilters] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListings({ limit: PAGE_SIZE, offset: 0 })
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows || []).map(mapListingToProperty);
        setProperties(mapped);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveQuery(queryParam || null);
    setInventoryMode(seeAllParam || null);
  }, [queryParam, seeAllParam]);

  useEffect(() => {
    if (!queryParam?.trim()) {
      setAiResponseText(null);
      setAiFilters({});
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setAiResponseText(null);
    parseSearchQuery(queryParam)
      .then((result) => {
        if (cancelled) return;
        setAiResponseText(result.conversationalResponse || null);
        setAiFilters({
          location: result.location,
          minPrice: result.minPrice,
          maxPrice: result.maxPrice,
          beds: result.beds,
          type: result.type,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAiResponseText(`Showing properties matching "${queryParam}".`);
          setAiFilters({});
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => { cancelled = true; };
  }, [queryParam]);

  const categorized = useMemo(() => {
    return {
      // New Arrivals: 5 most recent by days on market (lowest DOM = newest)
      newListings: [...properties].sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      // Best Value: biggest price reductions first, top 5
      bestValue: properties
        .filter((p) => p.originalPrice && p.originalPrice > p.price && !String(p.type || "").toLowerCase().includes("commercial"))
        .sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price)),
      luxury: properties
        .filter((p) => (p.price || 0) >= 1000000)
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      rentals: properties
        .filter((p) => {
          const type = String(p.type || "").toLowerCase();
          if (type.includes("commercial")) return false;
          const tt = String((p.listing?.transactionType || p.transactionType) ?? "").toLowerCase();
          const hasLeasePrice = p.priceIsMonthly || p.listing?.leaseAmount != null || p.listing?.year1LeasePrice != null;
          return hasLeasePrice || tt.includes("lease") || tt.includes("rent") || type.includes("rental") || type.includes("lease");
        })
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      commercial: properties
        .filter((p) => String(p.type || "").toLowerCase().includes("commercial"))
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      commercialReductions: properties
        .filter((p) => String(p.type || "").toLowerCase().includes("commercial") && p.originalPrice && p.originalPrice > p.price)
        .sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price)),
      preconstruction: properties.filter((p) => {
        const type = String(p.type || "").toLowerCase();
        const status = String(p.status || p.listing?.standardStatus || "").toLowerCase();
        return type.includes("preconstruction") || type.includes("pre-construction") || status.includes("preconstruction");
      }),
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    let list = properties;
    if (inventoryMode) {
      if (inventoryMode === "All Listings") list = properties;
      else if (inventoryMode === "New Arrivals") list = categorized.newListings;
      else if (inventoryMode === "Best Value") list = categorized.bestValue;
      else if (inventoryMode === "Luxury Estates") list = categorized.luxury;
      else if (inventoryMode === "Rentals") list = categorized.rentals;
      else if (inventoryMode === "Commercial Spaces") list = categorized.commercialReductions;
      else if (inventoryMode === "Preconstruction") list = categorized.preconstruction;
    }
    if (activeQuery) {
      const hasAiFilters = aiFilters.location || aiFilters.minPrice != null || aiFilters.maxPrice != null || aiFilters.beds != null || aiFilters.type;
      if (hasAiFilters) {
        list = list.filter((p) => {
          if (aiFilters.location && !String(p.location || "").toLowerCase().includes(aiFilters.location.toLowerCase())) return false;
          if (aiFilters.minPrice != null && (p.price ?? 0) < aiFilters.minPrice) return false;
          if (aiFilters.maxPrice != null && (p.price ?? 0) > aiFilters.maxPrice) return false;
          if (aiFilters.beds != null && (p.beds ?? 0) < aiFilters.beds) return false;
          if (aiFilters.type && String(p.type || "").toLowerCase() !== String(aiFilters.type).toLowerCase()) return false;
          return true;
        });
      } else {
        list = filterByQuery(list, activeQuery);
      }
    }
    return filterByFilters(list, filters);
  }, [properties, inventoryMode, activeQuery, filters, aiFilters, categorized]);

  const handleSeeAll = useCallback((title, categoryList) => {
    setInventoryMode(title);
    setActiveQuery(null);
    setSearchMode("grid");
    setFilters({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectProperty = useCallback((property) => {
    if (property?.id) window.location.href = `/listings/${property.id}`;
  }, []);

  const activeCategory = inventoryMode ? (SECTION_TO_CATEGORY[inventoryMode] || "all") : "all";

  const handleSelectCategory = useCallback((id) => {
    if (id === "all") {
      setInventoryMode(null);
      setActiveQuery(null);
      setFilters({});
      router.replace("/explore", { scroll: false });
    } else {
      const sectionTitle = CATEGORY_TO_SECTION[id] || null;
      setInventoryMode(sectionTitle);
      setActiveQuery(null);
      router.replace(`/explore?seeAll=${encodeURIComponent(sectionTitle)}`, { scroll: false });
    }
    setSearchMode("grid");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  const renderSection = (title, list, subtitle, emptyMessage = null) => {
    const seeAllUrl = `/explore?seeAll=${encodeURIComponent(title)}`;
    const hasListings = list?.length > 0;
    return (
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-lg font-medium text-muted">{subtitle}</p>
          </div>
          {hasListings && (
            <a
              href={seeAllUrl}
              className="text-xs font-black uppercase tracking-widest border-b-2 border-primary pb-0.5 text-primary transition-premium hover:border-muted hover:text-muted"
            >
              See All
            </a>
          )}
        </div>
        {hasListings ? (
          <div className="grid grid-cols-5 gap-4 sm:gap-6 min-w-0">
            {list.slice(0, 5).map((p) => (
              <div key={p.id} className="min-w-0">
                <PropertyCard
                  property={p}
                  isSaved={savedIds.includes(p.id)}
                  onToggleSave={toggleSave}
                  href={`/listings/${p.id}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 py-16 px-8 text-center">
            <p className="text-muted font-medium">
              {emptyMessage || "No listings in this category yet. We'll update soon."}
            </p>
          </div>
        )}
      </section>
    );
  };

  if (loading) {
    return (
      <Loading
        variant="screen"
        size="md"
        message="Loading listings..."
        className="min-h-[60vh] pt-24"
      />
    );
  }

  if (error) {
    const isTimeout = error.includes("statement timeout") || error.includes("canceling statement");
    return (
      <div className="p-12">
        <p className="mb-2 font-semibold text-error">Error: {error}</p>
        <p className="text-sm text-muted">
          {isTimeout
            ? "Supabase query timed out. The app now loads 400 listings at a time—refresh the page. To allow larger queries, increase Statement timeout in Supabase: Project Settings → Database."
            : <>Ensure <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set in <code className="rounded bg-gray-100 px-1">frontend/.env.local</code>, or start the backend and set <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_API_URL</code>.</>}
        </p>
      </div>
    );
  }

  const isSearchView = inventoryMode || activeQuery;

  const viewAllFloatingButton = mounted ? (
    <a
      href="/explore?seeAll=All%20Listings"
      className="fixed bottom-8 right-8 z-[9999] flex items-center gap-3 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-2xl transition-all hover:scale-105 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-primary/40"
      style={{ boxShadow: "0 10px 40px -10px rgba(26, 60, 60, 0.4)" }}
      aria-label="View all listings"
    >
      <span className="text-sm uppercase tracking-widest md:text-base">View all</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </a>
  ) : null;

  if (isSearchView) {
    return (
      <RequireAuth>
      <div className="flex w-full flex-col animate-fade-in pt-24">
        {mounted && typeof document !== "undefined" && createPortal(viewAllFloatingButton, document.body)}
        <div className="flex-shrink-0 px-8 md:px-12 pb-4">
          {aiResponseText && (
            <div className="mb-10 p-10 bg-primary text-white rounded-3xl relative overflow-hidden group transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-premium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-40 w-40" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                </svg>
              </div>
              <div className="relative z-10 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60">Lumina Unified AI</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter max-w-4xl leading-tight">
                  {aiResponseText}
                </h2>
              </div>
            </div>
          )}
          {activeQuery && isSearching && (
            <p className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Understanding your search...</p>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            <a
              href="/explore"
              onClick={(e) => {
                e.preventDefault();
                handleSelectCategory("all");
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-premium ${
                !inventoryMode && !activeQuery ? "bg-primary text-white" : "bg-surface-elevated text-foreground border border-border hover:border-primary"
              }`}
            >
              Explore
            </a>
            {CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
              const sectionTitle = CATEGORY_TO_SECTION[cat.id];
              const isActive = (inventoryMode || "All Listings") === (sectionTitle || "All Listings");
              return (
                <a
                  key={cat.id}
                  href={`/explore?seeAll=${encodeURIComponent(sectionTitle || "All Listings")}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectCategory(cat.id);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-premium ${
                    isActive ? "bg-primary text-white" : "bg-surface-elevated text-foreground border border-border hover:border-primary"
                  }`}
                >
                  {cat.label}
                </a>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h1 className="text-5xl font-black tracking-tighter text-foreground">
              {inventoryMode || "All Listings"}{" "}
              <span className="text-muted ml-2">{filteredProperties.length} matches</span>
            </h1>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-3 px-6 py-3 border rounded-xl font-bold transition-premium ${showFilters ? "bg-primary text-white border-primary" : "bg-surface-elevated text-foreground border-border hover:border-primary"}`}
                style={!showFilters ? { boxShadow: "var(--shadow-card)" } : {}}
              >
                <span>Filters</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 0h2m-6 0H4m12 0h4" />
                </svg>
              </button>
              <div className="flex items-center bg-surface rounded-xl p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setSearchMode("grid")}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-premium ${searchMode === "grid" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("map")}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-premium ${searchMode === "map" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                >
                  Map Only
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 md:px-12 pb-32">
          {searchMode === "grid" ? (
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
              {showFilters && (
                <div className="w-full flex-shrink-0 lg:w-72">
                  <div className="pb-8 pr-2 max-h-[70vh] overflow-y-auto lg:max-h-none">
                    <FilterSidebar isVisible onFilterChange={setFilters} />
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-12">
                <div className="grid grid-cols-1 gap-x-8 gap-y-12 transition-all duration-500 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProperties.length > 0 ? (
                    filteredProperties.map((p) => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        isSaved={savedIds.includes(p.id)}
                        onToggleSave={toggleSave}
                        href={`/listings/${p.id}`}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-40 text-center space-y-6">
                      <p className="text-4xl font-black tracking-tight text-muted italic">
                        {inventoryMode && inventoryMode !== "All Listings"
                          ? "No listings in this category yet. We'll update soon."
                          : "No matches in the current database."}
                      </p>
                      <a href={inventoryMode && inventoryMode !== "All Listings" ? "/explore" : "/"} className="btn-primary inline-block px-10 py-4 rounded-xl">
                        {inventoryMode && inventoryMode !== "All Listings" ? "Back to Explore" : "Try Global Search"}
                      </a>
                    </div>
                  )}
                </div>

                {filteredProperties.length > 0 && (
                  <div className="space-y-8 animate-fade-in pt-20 border-t border-gray-100">
                    <div>
                      <h2 className="text-4xl font-black tracking-tight text-foreground">Geospatial Discovery.</h2>
                      <p className="mt-1 text-lg font-medium text-muted">Every architectural sanctuary in your results, mapped.</p>
                    </div>
                    <div className="h-[700px] w-full rounded-3xl overflow-hidden border border-border transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
                      <PropertyMap properties={filteredProperties} onSelectProperty={selectProperty} />
                    </div>
                  </div>
                )}

                <div className="pt-20">
                  <Footer />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[calc(100vh-250px)] w-full rounded-3xl overflow-hidden border border-border" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <PropertyMap properties={filteredProperties} onSelectProperty={selectProperty} />
            </div>
          )}
        </div>
      </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
    <div className="relative w-full animate-fade-in flex flex-col min-h-screen">
      {mounted && typeof document !== "undefined" && createPortal(viewAllFloatingButton, document.body)}

      <div className="pt-24 px-8 md:px-12 pb-32 max-w-[1600px] mx-auto w-full">
        <div className="mb-16 border-b border-border pb-12">
          <h1 className="text-7xl font-black tracking-tighter text-foreground leading-none">Explore.</h1>
          <p className="text-muted mt-4 font-medium text-xl max-w-2xl">
            A curated selection of the world&apos;s most exceptional architectural sanctuaries.
          </p>
        </div>

        <div className="space-y-24">
          {renderSection("New Arrivals", categorized.newListings.slice(0, 5), "5 most recent listings (lowest days on market)")}
          {renderSection("Best Value", categorized.bestValue.slice(0, 5), "Top 5 price reductions — biggest savings on the left")}
          {renderSection("Luxury Estates", categorized.luxury, "Exceptional properties over $1,000,000")}
          {renderSection("Rentals", categorized.rentals, "Homes, condos & apartments for rent — per month")}
          {renderSection("Preconstruction", categorized.preconstruction, "Preconstruction and new development")}
          {renderSection("Commercial Spaces", categorized.commercialReductions, "Commercial listings with price reductions — biggest savings on the left")}

          <div className="pt-20 border-t border-border">
            <ToolsOverview />
          </div>
        </div>
      </div>
    </div>
    </RequireAuth>
  );
}
