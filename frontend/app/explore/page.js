"use client";

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchListings, fetchListingsSearch, fetchListingsInBounds } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { parseSearchQuery, suggestSimilarSearch } from "@/lib/geminiService";
import { useSaved } from "@/context/SavedContext";
import PropertyCard from "@/components/PropertyCard";
import FilterSidebar from "@/components/FilterSidebar";
import { CATEGORIES } from "@/constants/categories";
import PropertyMap from "@/components/PropertyMap";
import Loading from "@/components/Loading";
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

/** Gemini returns type: house, condo, townhouse, etc. Map to listing type substrings (Detached, Condo Apartment, etc.). */
function listingTypeMatchesFilter(listingTypeStr, geminiType) {
  if (!geminiType || !listingTypeStr) return !geminiType;
  const t = String(listingTypeStr).toLowerCase();
  const g = String(geminiType).toLowerCase();
  if (g === "house") return t.includes("detached") || t.includes("semi-detached") || t.includes("house") || t.includes("single family") || t.includes("residential");
  if (g === "condo") return t.includes("condo");
  if (g === "townhouse") return t.includes("townhouse");
  if (g === "commercial") return t.includes("commercial");
  if (g === "land") return t.includes("land");
  if (g === "multi-family") return t.includes("duplex") || t.includes("triplex") || t.includes("multiplex") || t.includes("multi-family");
  return t.includes(g);
}

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

/** True if sidebar has any filter set (used to decide whether to fetch from Supabase search API). */
function hasSidebarFilters(f) {
  if (!f) return false;
  return (
    (f.type != null && f.type !== "") ||
    f.forRent ||
    f.forSale ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.beds != null ||
    f.baths != null ||
    (f.amenities?.length > 0) ||
    (f.minSqft != null || f.maxSqft != null) ||
    (f.statusLabel != null && f.statusLabel !== "")
  );
}

/** Map sidebar filter state to API shape for POST /api/listings/search (Supabase). */
function sidebarFiltersToApiFilters(f) {
  if (!f) return {};
  return {
    location: undefined,
    minPrice: f.minPrice ?? undefined,
    maxPrice: f.maxPrice ?? undefined,
    beds: f.beds ?? undefined,
    baths: f.baths ?? undefined,
    type: (f.type && String(f.type).trim()) || undefined,
    amenities: Array.isArray(f.amenities) && f.amenities.length > 0 ? f.amenities : undefined,
    forSaleOnly: f.forSale ? true : f.forRent ? false : undefined,
  };
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

function ExplorePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get("q") || "";
  const seeAllParam = searchParams.get("seeAll") || "";
  const { savedIds, toggleSave } = useSaved();

  /** Listings per page for "All Listings" view (sub-pages); pagination at bottom. */
  const LISTINGS_PAGE_SIZE = 52;

  const [properties, setProperties] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Full set for category views (New Arrivals, Best Value, etc.); loaded when user selects a category. */
  const [categoryProperties, setCategoryProperties] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  /** Larger set used only for section previews (Best Value, New Arrivals, etc.) so those sections have enough listings. */
  const [sectionProperties, setSectionProperties] = useState([]);
  const [sectionPropertiesLoading, setSectionPropertiesLoading] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [searchMode, setSearchMode] = useState("grid");
  const [filters, setFilters] = useState({});
  const [inventoryMode, setInventoryMode] = useState(seeAllParam);
  const listingsGridRef = useRef(null);
  const [activeQuery, setActiveQuery] = useState(queryParam || null);
  const [aiResponseText, setAiResponseText] = useState(null);
  const [aiFilters, setAiFilters] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [voiceSearchRows, setVoiceSearchRows] = useState([]);
  const [loadingVoiceSearch, setLoadingVoiceSearch] = useState(false);
  /** When sidebar filters are active, results from Supabase via /api/listings/search (server-side filter). */
  const [filterSearchResults, setFilterSearchResults] = useState([]);
  const [loadingFilterSearch, setLoadingFilterSearch] = useState(false);
  /** Map viewport listings (All Listings only): loaded by bounds, not full list. */
  const [mapProperties, setMapProperties] = useState([]);
  const [mapPropertiesLoading, setMapPropertiesLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  /** When user returns to the tab, refetch current page so updated listings (from sync) appear. Throttled to once per 60s. */
  const lastRefetchRef = useRef(0);
  useEffect(() => {
    if (!mounted || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefetchRef.current < 60000) return;
      lastRefetchRef.current = now;
      const offset = (currentPage - 1) * LISTINGS_PAGE_SIZE;
      fetchListings({ limit: LISTINGS_PAGE_SIZE, offset, includeCount: true })
        .then((res) => {
          const rows = Array.isArray(res) ? res : (res?.data ?? []);
          const total = Array.isArray(res) ? null : (res?.total ?? null);
          const fresh = (rows || []).map(mapListingToProperty);
          setProperties(fresh);
          if (total != null) setTotalCount(total);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mounted, currentPage]);

  /** Fetch one page of listings (All Listings view). */
  const fetchPage = useCallback((page) => {
    const offset = (page - 1) * LISTINGS_PAGE_SIZE;
    return fetchListings({ limit: LISTINGS_PAGE_SIZE, offset, includeCount: true })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        const total = Array.isArray(res) ? null : (res?.total ?? null);
        return { rows, total };
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(1)
      .then(({ rows, total }) => {
        if (cancelled) return;
        const mapped = (rows || []).map(mapListingToProperty);
        setProperties(mapped);
        setTotalCount(total ?? mapped.length);
        setCurrentPage(1);
        setHasMoreListings(total == null || LISTINGS_PAGE_SIZE < total);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /** When sidebar filters are active, fetch filtered listings from Supabase via /api/listings/search so filters apply to full dataset. */
  useEffect(() => {
    if (!hasSidebarFilters(filters)) {
      setFilterSearchResults([]);
      return;
    }
    setCurrentPage(1);
    let cancelled = false;
    setLoadingFilterSearch(true);
    const apiFilters = sidebarFiltersToApiFilters(filters);
    fetchListingsSearch(apiFilters)
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows || []).map(mapListingToProperty);
        setFilterSearchResults(mapped);
      })
      .catch(() => {
        if (!cancelled) setFilterSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFilterSearch(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  /** Teleport scroll to top of main content (instant, no animation). */
  const scrollToTopOfPage = useCallback(() => {
    const scrollEl =
      listingsGridRef.current?.closest("[data-sidebar-content]") ||
      document.querySelector("[data-sidebar-content]");
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  /** Scroll to top after every page change, once the new content has rendered. */
  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      // Double-RAF: first frame lets React flush, second fires after paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToTopOfPage());
      });
    }
  }, [currentPage, scrollToTopOfPage]);

  /** Change page. */
  const goToPage = useCallback((page) => {
    if (page < 1) return;
    const isAllListings = inventoryMode === "All Listings";
    if (isAllListings) {
      setLoading(true);
      setCurrentPage(page);
      fetchPage(page)
        .then(({ rows, total }) => {
          const mapped = (rows || []).map(mapListingToProperty);
          setProperties(mapped);
          if (total != null) setTotalCount(total);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setCurrentPage(page);
    }
  }, [fetchPage, inventoryMode]);

  /** On main Explore (sections): append next page. On "All Listings" view: use pagination (goToPage). */
  const loadMoreListings = useCallback(() => {
    if (inventoryMode === "All Listings" || inventoryMode) {
      if (totalCount != null && (currentPage * LISTINGS_PAGE_SIZE) >= totalCount) return;
      goToPage(currentPage + 1);
      return;
    }
    if (loadingMore || !hasMoreListings) return;
    setLoadingMore(true);
    fetchListings({ limit: LISTINGS_PAGE_SIZE, offset: properties.length })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        const mapped = (rows || []).map(mapListingToProperty);
        setProperties((prev) => [...prev, ...mapped]);
        setHasMoreListings((rows || []).length >= LISTINGS_PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [inventoryMode, currentPage, totalCount, goToPage, loadingMore, hasMoreListings, properties.length]);

  /** Refetch current page (e.g. after sync). */
  const [refreshing, setRefreshing] = useState(false);
  const refreshListings = useCallback(() => {
    if (refreshing || loading) return;
    setRefreshing(true);
    fetchPage(currentPage)
      .then(({ rows, total }) => {
        const mapped = (rows || []).map(mapListingToProperty);
        setProperties(mapped);
        if (total != null) setTotalCount(total);
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refreshing, loading, currentPage, fetchPage]);

  useEffect(() => {
    setActiveQuery(queryParam || null);
    setInventoryMode(seeAllParam || null);
    setCurrentPage(1);
    if (!queryParam?.trim()) setVoiceSearchRows([]);
  }, [queryParam, seeAllParam]);

  useEffect(() => {
    if (!queryParam?.trim()) {
      setAiResponseText(null);
      setAiFilters({});
      setSuggestionApplied(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setAiResponseText(null);
    setSuggestionApplied(false);
    parseSearchQuery(queryParam)
      .then((result) => {
        if (cancelled) return;
        setAiResponseText(result.conversationalResponse || null);
        const nextFilters = {
          location: result.location,
          minPrice: result.minPrice,
          maxPrice: result.maxPrice,
          beds: result.beds,
          baths: result.baths,
          type: result.type,
          forSaleOnly: result.forSaleOnly,
          amenities: Array.isArray(result.amenities) ? result.amenities : [],
        };
        setAiFilters(nextFilters);
        const hasFilters = nextFilters.location || nextFilters.minPrice != null || nextFilters.maxPrice != null || nextFilters.beds != null || nextFilters.baths != null || nextFilters.type || (nextFilters.amenities?.length > 0) || nextFilters.forSaleOnly === true || nextFilters.forSaleOnly === false;
        if (hasFilters) {
          setLoadingVoiceSearch(true);
          setVoiceSearchRows([]);
          fetchListingsSearch(nextFilters)
            .then((rows) => { if (!cancelled) setVoiceSearchRows(rows || []); })
            .catch(() => { if (!cancelled) setVoiceSearchRows([]); })
            .finally(() => { if (!cancelled) setLoadingVoiceSearch(false); });
        } else {
          setVoiceSearchRows([]);
        }
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

  const searchResultProperties = useMemo(
    () => (voiceSearchRows || []).map(mapListingToProperty),
    [voiceSearchRows]
  );

  /** Base list for category sections: full set when viewing a category, else preloaded section set, else first page. */
  const baseListForCategories = categoryProperties.length > 0 ? categoryProperties : (sectionProperties.length > 0 ? sectionProperties : properties);
  const categorized = useMemo(() => {
    return {
      // New Arrivals: DOM 7 days or under, newest first
      newListings: baseListForCategories
        .filter((p) => (p.daysOnMarket ?? 999) <= 7)
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      // Best Value: only listings with a price change (original price differs from current), sorted by biggest reduction
      bestValue: baseListForCategories
        .filter((p) => p.originalPrice && p.originalPrice !== p.price)
        .sort((a, b) => {
          const aReduction = (a.originalPrice && a.originalPrice > a.price) ? (a.originalPrice - a.price) : 0;
          const bReduction = (b.originalPrice && b.originalPrice > b.price) ? (b.originalPrice - b.price) : 0;
          if (bReduction !== aReduction) return bReduction - aReduction;
          return (a.price ?? 0) - (b.price ?? 0);
        }),
      // Luxury Estates: $1,000,000 and over
      luxury: baseListForCategories
        .filter((p) => (p.price || 0) >= 1000000)
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
      // Rentals: residential (not commercial) with monthly payment
      rentals: baseListForCategories
        .filter((p) => {
          const type = String(p.type || "").toLowerCase();
          if (type.includes("commercial")) return false;
          const tt = String((p.listing?.transactionType || p.transactionType) ?? "").toLowerCase();
          const hasLeasePrice = p.priceIsMonthly || p.listing?.leaseAmount != null || p.listing?.year1LeasePrice != null;
          return hasLeasePrice || tt.includes("lease") || tt.includes("rent") || type.includes("rental") || type.includes("lease");
        })
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      // Commercial Spaces: all commercial listings
      commercial: baseListForCategories
        .filter((p) => String(p.type || "").toLowerCase().includes("commercial"))
        .sort((a, b) => (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999)),
      commercialReductions: baseListForCategories
        .filter((p) => String(p.type || "").toLowerCase().includes("commercial"))
        .sort((a, b) => {
          const aReduction = (a.originalPrice && a.originalPrice > a.price) ? (a.originalPrice - a.price) : 0;
          const bReduction = (b.originalPrice && b.originalPrice > b.price) ? (b.originalPrice - b.price) : 0;
          if (bReduction !== aReduction) return bReduction - aReduction;
          return (a.daysOnMarket ?? 999) - (b.daysOnMarket ?? 999);
        }),
      preconstruction: baseListForCategories.filter((p) => {
        const type = String(p.type || "").toLowerCase();
        const status = String(p.status || p.listing?.standardStatus || "").toLowerCase();
        return type.includes("preconstruction") || type.includes("pre-construction") || status.includes("preconstruction");
      }),
    };
  }, [baseListForCategories]);

  /** When user selects a category (New Arrivals, etc.), load ALL listings once so categories have full data. */
  useEffect(() => {
    const isCategory = inventoryMode && inventoryMode !== "All Listings";
    if (!isCategory || categoryProperties.length > 0 || categoryLoading) return;
    let cancelled = false;
    setCategoryLoading(true);
    fetchListings({ limit: 50000, offset: 0, includeCount: true })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        if (!cancelled) setCategoryProperties((rows || []).map(mapListingToProperty));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCategoryLoading(false); });
    return () => { cancelled = true; };
  }, [inventoryMode, categoryProperties.length, categoryLoading]);

  /** Preload ALL listings for section previews & categories so counts are accurate from the start. */
  useEffect(() => {
    if (categoryProperties.length > 0 || sectionProperties.length > 0 || sectionPropertiesLoading) return;
    let cancelled = false;
    setSectionPropertiesLoading(true);
    fetchListings({ limit: 50000, offset: 0, includeCount: true })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        if (!cancelled) {
          const mapped = (rows || []).map(mapListingToProperty);
          setSectionProperties(mapped);
          setCategoryProperties(mapped);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSectionPropertiesLoading(false); });
    return () => { cancelled = true; };
  }, [categoryProperties.length, sectionProperties.length, sectionPropertiesLoading]);

  const filteredProperties = useMemo(() => {
    const hasAiFilters = aiFilters.location || aiFilters.minPrice != null || aiFilters.maxPrice != null || aiFilters.beds != null || aiFilters.baths != null || aiFilters.type || (aiFilters.amenities?.length > 0);
    const useVoiceSearchResults = activeQuery && hasAiFilters && voiceSearchRows.length > 0;

    let list;
    if (useVoiceSearchResults) {
      list = searchResultProperties;
    } else if (hasSidebarFilters(filters)) {
      list = filterSearchResults;
    } else if (inventoryMode) {
      if (inventoryMode === "All Listings") list = properties;
      else if (inventoryMode === "New Arrivals") list = categorized.newListings;
      else if (inventoryMode === "Best Value") list = categorized.bestValue;
      else if (inventoryMode === "Luxury Estates") list = categorized.luxury;
      else if (inventoryMode === "Rentals") list = categorized.rentals;
      else if (inventoryMode === "Commercial Spaces") list = categorized.commercialReductions;
      else if (inventoryMode === "Preconstruction") list = categorized.preconstruction;
      else list = properties;
    } else {
      list = properties;
    }
    if (activeQuery && !useVoiceSearchResults) {
      if (hasAiFilters) {
        list = list.filter((p) => {
          if (aiFilters.location) {
            const loc = aiFilters.location.toLowerCase();
            const inLocation = String(p.location || "").toLowerCase().includes(loc);
            const inCity = p.city && String(p.city).toLowerCase().includes(loc);
            if (!inLocation && !inCity) return false;
          }
          if (aiFilters.minPrice != null && (p.price ?? 0) < aiFilters.minPrice) return false;
          if (aiFilters.maxPrice != null && (p.price ?? 0) > aiFilters.maxPrice) return false;
          if (aiFilters.beds != null) {
            const listingBeds = p.beds != null && p.beds !== "" ? Number(p.beds) : null;
            if (listingBeds != null && !Number.isNaN(listingBeds) && listingBeds < aiFilters.beds) return false;
          }
          if (aiFilters.baths != null) {
            const listingBaths = p.baths != null && p.baths !== "" ? Number(p.baths) : null;
            if (listingBaths != null && !Number.isNaN(listingBaths) && listingBaths < aiFilters.baths) return false;
          }
          if (aiFilters.type && !listingTypeMatchesFilter(p.type, aiFilters.type)) return false;
          if (aiFilters.amenities?.length) {
            const propList = Array.isArray(p.amenities) ? p.amenities : [];
            const hasParking = (p.parking ?? 0) > 0;
            if (!aiFilters.amenities.every((a) => {
              const key = String(a).toLowerCase();
              if (key === "parking") return hasParking || propList.some((x) => String(x).toLowerCase().includes("park") || String(x).toLowerCase().includes("garage"));
              return propList.some((x) => String(x).toLowerCase().includes(key));
            })) return false;
          }
          if (aiFilters.forSaleOnly === true && p.priceIsMonthly) return false;
          if (aiFilters.forSaleOnly === false && !p.priceIsMonthly) return false;
          return true;
        });
      } else {
        list = filterByQuery(list, activeQuery);
      }
    }
    return filterByFilters(list, filters);
  }, [properties, searchResultProperties, voiceSearchRows.length, inventoryMode, activeQuery, filters, aiFilters, categorized, filterSearchResults]);

  const hasAiFilters = Boolean(
    aiFilters.location || aiFilters.minPrice != null || aiFilters.maxPrice != null ||
    aiFilters.beds != null || aiFilters.baths != null || aiFilters.type || (aiFilters.amenities?.length > 0)
  );

  /** For "All Listings" with no sidebar filters: one page from server. With sidebar filters or categories: slice by current page. */
  const displayProperties = useMemo(() => {
    const start = (currentPage - 1) * LISTINGS_PAGE_SIZE;
    if (hasSidebarFilters(filters)) return filteredProperties.slice(start, start + LISTINGS_PAGE_SIZE);
    if (!inventoryMode || inventoryMode === "All Listings") return filteredProperties;
    return filteredProperties.slice(start, start + LISTINGS_PAGE_SIZE);
  }, [inventoryMode, currentPage, filteredProperties, filters]);

  /** Total count for pagination: when sidebar filters are active we use filtered list length; else API total for All Listings or category length. */
  const totalForPagination = hasSidebarFilters(filters)
    ? filteredProperties.length
    : inventoryMode === "All Listings"
      ? (totalCount ?? 0)
      : filteredProperties.length;
  const totalPagesForPagination = Math.max(1, Math.ceil(totalForPagination / LISTINGS_PAGE_SIZE));
  const isCategoryPagination = inventoryMode && inventoryMode !== "All Listings";

  useEffect(() => {
    if (!activeQuery || !hasAiFilters || filteredProperties.length > 0 || suggestionApplied || isSearching || loadingVoiceSearch) return;
    let cancelled = false;
    setLoadingSimilar(true);
    suggestSimilarSearch(aiFilters, activeQuery)
      .then((s) => {
        if (cancelled || !s) return;
        setAiFilters({
          location: s.location,
          minPrice: s.minPrice,
          maxPrice: s.maxPrice,
          beds: s.beds,
          baths: s.baths,
          type: s.type,
        });
        setAiResponseText("No exact matches. " + (s.message || "Here are similar listings."));
        setSuggestionApplied(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingSimilar(false);
      });
    return () => { cancelled = true; };
  }, [activeQuery, hasAiFilters, filteredProperties.length, suggestionApplied, isSearching, loadingVoiceSearch, aiFilters]);

  const handleSeeAll = useCallback((title, categoryList) => {
    setInventoryMode(title);
    setActiveQuery(null);
    setSearchMode("grid");
    setFilters({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /** Build the URL we want to return to when user clicks "Back to results" on the listing page. */
  const returnToUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (seeAllParam) params.set("seeAll", seeAllParam);
    if (queryParam?.trim()) params.set("q", queryParam.trim());
    const search = params.toString();
    return search ? `/explore?${search}` : "/explore";
  }, [seeAllParam, queryParam]);

  const listingUrl = useCallback(
    (id) => {
      const base = `/listings/${id}`;
      const params = new URLSearchParams();
      params.set("from", returnToUrl);
      return `${base}?${params.toString()}`;
    },
    [returnToUrl]
  );

  const selectProperty = useCallback(
    (property) => {
      if (property?.id) window.location.href = listingUrl(property.id);
    },
    [listingUrl]
  );

  /** Load listings for the visible map bounds (View All → map). Only used when inventoryMode === "All Listings". */
  const handleBoundsChange = useCallback((bounds) => {
    if (inventoryMode !== "All Listings") return;
    setMapPropertiesLoading(true);
    fetchListingsInBounds({ ...bounds, limit: 500 })
      .then((rows) => {
        const mapped = (rows || []).map(mapListingToProperty);
        setMapProperties(mapped);
      })
      .catch(() => setMapProperties([]))
      .finally(() => setMapPropertiesLoading(false));
  }, [inventoryMode]);

  /** For All Listings map: apply sidebar filters client-side to viewport-loaded pins. */
  const mapPropertiesForMap = useMemo(() => {
    if (inventoryMode !== "All Listings") return [];
    return hasSidebarFilters(filters) ? filterByFilters(mapProperties, filters) : mapProperties;
  }, [inventoryMode, mapProperties, filters]);

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
      <section className="space-y-4 md:space-y-6" aria-labelledby={title.replace(/\s+/g, "-").toLowerCase() + "-heading"}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-3 md:pb-4">
          <div>
            <h2 id={title.replace(/\s+/g, "-").toLowerCase() + "-heading"} className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 md:mt-1 text-sm sm:text-base md:text-lg font-medium text-muted">{subtitle}</p>
          </div>
          {hasListings && (
            <a
              href={seeAllUrl}
              className="text-xs font-black uppercase tracking-widest border-b-2 border-primary pb-0.5 text-primary transition-premium hover:border-muted hover:text-muted self-start"
            >
              See All
            </a>
          )}
        </div>
        {hasListings ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 min-w-0 w-full">
            {list.slice(0, 4).map((p) => (
              <div key={p.id} className="min-w-0">
                <PropertyCard
                  property={p}
                  isSaved={savedIds.includes(p.id)}
                  onToggleSave={toggleSave}
                  href={listingUrl(p.id)}
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
            ? "Listings request timed out. Refresh the page to try again. You can increase Statement timeout in Supabase: Project Settings → Database."
            : <>Ensure <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set in <code className="rounded bg-gray-100 px-1">frontend/.env.local</code>, or start the backend and set <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_API_URL</code>.</>}
        </p>
      </div>
    );
  }

  const isSearchView = inventoryMode || activeQuery;

  /** Banner text: use AI response, or build from filters so price/amenities are shown when applied */
  const searchBannerText = (() => {
    const hasPrice = aiFilters.maxPrice != null || aiFilters.minPrice != null;
    const hasAmenities = aiFilters.amenities?.length > 0;
    const responseHasPrice = aiResponseText && /\$|\d+\s*[kKmM]|under|over|between/.test(aiResponseText);
    const responseHasAmenities = aiResponseText && /\b(gym|pool|parking|garage|waterfront|concierge|smart home|guest house)\b/i.test(aiResponseText);
    if (aiResponseText && (!hasPrice || responseHasPrice) && (!hasAmenities || responseHasAmenities)) return aiResponseText;
    if (!hasPrice && !hasAmenities) return aiResponseText;
    const parts = [];
    if (aiFilters.type) parts.push(aiFilters.type === "house" ? "Homes" : aiFilters.type === "condo" ? "Condos" : `${aiFilters.type}s`);
    if (aiFilters.location) parts.push(`in ${aiFilters.location}`);
    if (aiFilters.maxPrice != null && aiFilters.minPrice == null) parts.push(`under $${aiFilters.maxPrice >= 1000000 ? (aiFilters.maxPrice / 1000000).toFixed(1) + "M" : (aiFilters.maxPrice / 1000).toFixed(0) + "K"}`);
    else if (aiFilters.minPrice != null && aiFilters.maxPrice == null) parts.push(`over $${aiFilters.minPrice >= 1000000 ? (aiFilters.minPrice / 1000000).toFixed(1) + "M" : (aiFilters.minPrice / 1000).toFixed(0) + "K"}`);
    else if (aiFilters.minPrice != null && aiFilters.maxPrice != null) parts.push(`$${(aiFilters.minPrice / 1000).toFixed(0)}K – $${(aiFilters.maxPrice / 1000).toFixed(0)}K`);
    if (aiFilters.amenities?.length) parts.push(`with ${aiFilters.amenities.map((a) => a.toLowerCase()).join(", ")}`);
    if (aiFilters.beds != null) parts.push(`${aiFilters.beds}+ bed`);
    if (aiFilters.baths != null) parts.push(`${aiFilters.baths}+ bath`);
    if (parts.length) return parts.join(" ") + ".";
    return aiResponseText;
  })();

  const viewAllFloatingButton = mounted && !inventoryMode ? (
    <a
      href="/explore?seeAll=All%20Listings"
      className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-[9999] flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-primary px-4 py-3 sm:px-6 sm:py-4 font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-primary/40"
      style={{ boxShadow: "0 10px 40px -10px rgba(26, 60, 60, 0.4)" }}
      aria-label="View all listings"
    >
      <span className="text-xs sm:text-sm uppercase tracking-widest md:text-base">View all</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </a>
  ) : null;

  if (isSearchView) {
    return (
      <RequireAuth>
      <div className="flex w-full flex-col animate-fade-in pt-16 md:pt-12 lg:pt-20 xl:pt-24">
        {mounted && typeof document !== "undefined" && createPortal(viewAllFloatingButton, document.body)}
        <div className="flex-shrink-0 px-4 sm:px-5 md:px-6 lg:px-8 xl:px-12 pb-4">
          {(searchBannerText || aiResponseText) && (
            <div className="mb-10 p-10 bg-primary text-white rounded-3xl relative overflow-hidden group transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-premium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-40 w-40" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                </svg>
              </div>
              <div className="relative z-10 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/60">Your search</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter max-w-4xl leading-tight">
                  {searchBannerText || aiResponseText}
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

          <div className="flex flex-col gap-4 sm:gap-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tighter text-foreground break-words">
              <span className="block sm:inline">{inventoryMode || "All Listings"}</span>{" "}
              <span className="text-muted text-base sm:text-lg md:text-xl mt-0.5 sm:mt-0 sm:ml-1 md:ml-2 block sm:inline">
                {inventoryMode && totalForPagination > LISTINGS_PAGE_SIZE
                  ? `Showing ${(currentPage - 1) * LISTINGS_PAGE_SIZE + 1}–${Math.min(currentPage * LISTINGS_PAGE_SIZE, totalForPagination)} of ${totalForPagination}`
                  : `${filteredProperties.length} matches`}
              </span>
            </h1>
            {inventoryMode === "New Arrivals" && (
              <p className="text-muted text-sm font-medium -mt-2">Listed 7 days or less — newest first</p>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center gap-2 sm:gap-3 min-h-[44px] px-4 sm:px-6 py-3 border rounded-xl font-bold transition-premium ${showFilters ? "bg-primary text-white border-primary" : "bg-surface-elevated text-foreground border-border hover:border-primary"}`}
                style={!showFilters ? { boxShadow: "var(--shadow-card)" } : {}}
              >
                <span>Filters</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 0h2m-6 0H4m12 0h4" />
                </svg>
              </button>
              <div className="flex items-center bg-surface rounded-xl p-1 border border-border min-h-[44px]">
                <button
                  type="button"
                  onClick={() => setSearchMode("grid")}
                  className={`min-h-[36px] px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-premium ${searchMode === "grid" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("map")}
                  className={`min-h-[36px] px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-premium ${searchMode === "map" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                >
                  Map Only
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 md:px-6 lg:px-8 xl:px-12 pb-20 md:pb-24 lg:pb-32 min-w-0">
          {searchMode === "grid" ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 xl:gap-12 min-w-0">
              {showFilters && (
                <div className="w-full flex-shrink-0 lg:w-64 xl:w-72 min-w-0">
                  <div className="pb-6 lg:pr-2 overflow-x-hidden">
                    <FilterSidebar isVisible onFilterChange={setFilters} />
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-6 sm:space-y-8 md:space-y-12">
                <div id="explore-listings-grid" ref={listingsGridRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-6 xl:gap-x-6 xl:gap-y-8 transition-all duration-500 min-w-0 w-full">
                  {loadingFilterSearch ? (
                    <div className="col-span-full py-16 sm:py-24 text-center">
                      <p className="text-lg font-bold text-muted">Filtering listings from database…</p>
                    </div>
                  ) : displayProperties.length > 0 ? (
                    displayProperties.map((p) => (
                      <PropertyCard
                        key={p.id}
                        property={p}
                        isSaved={savedIds.includes(p.id)}
                        onToggleSave={toggleSave}
                        href={listingUrl(p.id)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-16 sm:py-24 md:py-40 text-center space-y-4 md:space-y-6">
                      <p className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-muted italic px-4">
                        {hasSidebarFilters(filters) && !loadingFilterSearch
                          ? "No listings match your filters. Try a different property type, price range, or beds/baths."
                          : inventoryMode && inventoryMode !== "All Listings"
                              ? "No listings in this category yet. We'll update soon."
                              : activeQuery
                                ? loadingSimilar
                                  ? "No exact matches. Finding similar listings…"
                                  : properties.length === 0
                                    ? "Sign in to load listings, then try your search again."
                                    : suggestionApplied
                                      ? "No similar listings found. Try a different city, type (condo, house), or price."
                                      : "No listings match your search. Try a city (e.g. Toronto, Vancouver), type (condo, house), or price (under $800K). Sign in to load listings."
                                : "No matches in the current database."}
                      </p>
                      <a href={inventoryMode && inventoryMode !== "All Listings" ? "/explore" : "/"} className="btn-primary inline-block px-10 py-4 rounded-xl">
                        {inventoryMode && inventoryMode !== "All Listings" ? "Back to Explore" : "Try search or voice"}
                      </a>
                    </div>
                  )}

                {filteredProperties.length > 0 && (inventoryMode || hasSidebarFilters(filters)) && totalForPagination > LISTINGS_PAGE_SIZE && (
                  <div className="col-span-full flex flex-col items-center gap-4 pt-8 pb-4">
                    <p className="text-sm font-semibold text-muted">
                      Page {currentPage} of {totalPagesForPagination}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(1)}
                      disabled={currentPage <= 1 || (inventoryMode === "All Listings" && loading)}
                      className="min-w-[44px] min-h-[44px] rounded-xl font-bold border border-border bg-surface-elevated text-foreground hover:border-primary disabled:opacity-50 disabled:pointer-events-none transition-premium"
                      aria-label="First page"
                    >
                      &lt;&lt;
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1 || (inventoryMode === "All Listings" && loading)}
                      className="min-w-[44px] min-h-[44px] rounded-xl font-bold border border-border bg-surface-elevated text-foreground hover:border-primary disabled:opacity-50 disabled:pointer-events-none transition-premium"
                    >
                      Prev
                    </button>
                    {(() => {
                      const totalPages = totalPagesForPagination;
                      const maxVisible = 7;
                      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                      const pages = [];
                      if (start > 1) {
                        pages.push(1);
                        if (start > 2) pages.push("…");
                      }
                      for (let p = start; p <= end; p++) pages.push(p);
                      if (end < totalPages) {
                        if (end < totalPages - 1) pages.push("…");
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) =>
                        p === "…" ? (
                          <span key={`ellip-${i}`} className="px-2 text-muted">…</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => goToPage(p)}
                            disabled={inventoryMode === "All Listings" && loading}
                            className={`min-w-[44px] min-h-[44px] rounded-xl font-bold border transition-premium ${
                              p === currentPage
                                ? "bg-primary border-primary text-white"
                                : "border-border bg-surface-elevated text-foreground hover:border-primary disabled:opacity-50 disabled:pointer-events-none"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPagesForPagination || (inventoryMode === "All Listings" && loading)}
                      className="min-w-[44px] min-h-[44px] rounded-xl font-bold border border-border bg-surface-elevated text-foreground hover:border-primary disabled:opacity-50 disabled:pointer-events-none transition-premium"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(totalPagesForPagination)}
                      disabled={currentPage >= totalPagesForPagination || (inventoryMode === "All Listings" && loading)}
                      className="min-w-[44px] min-h-[44px] rounded-xl font-bold border border-border bg-surface-elevated text-foreground hover:border-primary disabled:opacity-50 disabled:pointer-events-none transition-premium"
                      aria-label="Last page"
                    >
                      &gt;&gt;
                    </button>
                    </div>
                  </div>
                )}
                </div>

                {(filteredProperties.length > 0 || inventoryMode === "All Listings") && (
                  <div className="space-y-4 md:space-y-8 animate-fade-in pt-12 md:pt-20 border-t border-gray-100">
                    <div>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">Geospatial Discovery.</h2>
                      <p className="mt-1 text-sm sm:text-base md:text-lg font-medium text-muted">
                        {inventoryMode === "All Listings" ? "Pan or zoom to load listings in the visible area. Pins show price." : "Every architectural sanctuary in your results, mapped."}
                      </p>
                    </div>
                    <div className="relative h-[320px] sm:h-[420px] md:h-[550px] lg:h-[700px] w-full rounded-xl md:rounded-3xl overflow-hidden border border-border transition-premium" style={{ boxShadow: "var(--shadow-elevated)" }}>
                      {mapPropertiesLoading && inventoryMode === "All Listings" && (
                        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/10 rounded-xl md:rounded-3xl">
                          <span className="rounded-xl bg-white/95 px-4 py-2 text-sm font-bold text-foreground shadow-lg">Loading listings for this area…</span>
                        </div>
                      )}
                      <PropertyMap
                        properties={inventoryMode === "All Listings" ? mapPropertiesForMap : filteredProperties}
                        onSelectProperty={selectProperty}
                        onBoundsChange={inventoryMode === "All Listings" ? handleBoundsChange : undefined}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="relative h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] md:h-[calc(100vh-250px)] w-full rounded-xl md:rounded-3xl overflow-hidden border border-border" style={{ boxShadow: "var(--shadow-elevated)" }}>
              {mapPropertiesLoading && inventoryMode === "All Listings" && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/10 rounded-xl md:rounded-3xl">
                  <span className="rounded-xl bg-white/95 px-4 py-2 text-sm font-bold text-foreground shadow-lg">Loading listings for this area…</span>
                </div>
              )}
              <PropertyMap
                properties={inventoryMode === "All Listings" ? mapPropertiesForMap : filteredProperties}
                onSelectProperty={selectProperty}
                onBoundsChange={inventoryMode === "All Listings" ? handleBoundsChange : undefined}
              />
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

      <div className="pt-24 sm:pt-8 md:pt-12 lg:pt-20 xl:pt-24 px-4 sm:px-5 md:px-6 lg:px-8 xl:px-12 pb-12 sm:pb-16 md:pb-24 lg:pb-32 max-w-[1600px] mx-auto w-full min-w-0 overflow-hidden">
        <div className="mb-6 sm:mb-8 md:mb-12 lg:mb-16 border-b border-border pb-4 sm:pb-6 md:pb-8 lg:pb-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter text-foreground leading-tight break-words scroll-mt-28 md:scroll-mt-0" id="explore-page-title">
                Explore
              </h1>
              <p className="text-muted mt-2 md:mt-3 lg:mt-4 font-medium text-base sm:text-base md:text-lg lg:text-xl max-w-2xl">
                Browse Canadian listings — homes, condos, and properties for sale or rent.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-12 md:space-y-16 lg:space-y-24">
          {renderSection("New Arrivals", categorized.newListings.slice(0, 4), "Listed 7 days or less — newest first")}
          {renderSection("Best Value", categorized.bestValue.slice(0, 4), "Price reductions first, then lowest prices")}
          {renderSection("Luxury Estates", categorized.luxury, "Exceptional properties over $1,000,000")}
          {renderSection("Rentals", categorized.rentals, "Homes, condos & apartments for rent — per month")}
          {renderSection("Preconstruction", categorized.preconstruction, "Preconstruction and new development")}
          {renderSection("Commercial Spaces", categorized.commercialReductions, "Commercial properties — price reductions first")}

        </div>
      </div>
    </div>
    </RequireAuth>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <Loading
          variant="screen"
          size="md"
          message="Loading listings..."
          className="min-h-[60vh] pt-20 md:pt-24"
        />
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
