/**
 * Shared logic: does a property match the structured voice-search (Gemini) filters?
 * Used by the listings search API (Supabase check) and explore page.
 */

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

/**
 * @param {object} p - Property (from mapListingToProperty): location, city, price, priceIsMonthly, beds, baths, type, amenities, parking
 * @param {object} filters - Structured filters: location, minPrice, maxPrice, beds, baths, type, amenities, forSaleOnly
 * @returns {boolean}
 */
export function matchesVoiceSearchFilters(p, filters) {
  if (!filters) return true;
  const hasAny =
    filters.location ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.beds != null ||
    filters.baths != null ||
    filters.type ||
    (filters.amenities?.length > 0) ||
    filters.forSaleOnly === true ||
    filters.forSaleOnly === false;
  if (!hasAny) return true;

  if (filters.location) {
    const loc = filters.location.toLowerCase();
    const inLocation = String(p.location || "").toLowerCase().includes(loc);
    const inCity = p.city && String(p.city).toLowerCase().includes(loc);
    if (!inLocation && !inCity) return false;
  }
  if (filters.minPrice != null && (p.price ?? 0) < filters.minPrice) return false;
  if (filters.maxPrice != null && (p.price ?? 0) > filters.maxPrice) return false;
  if (filters.beds != null) {
    const listingBeds = p.beds != null && p.beds !== "" ? Number(p.beds) : null;
    if (listingBeds != null && !Number.isNaN(listingBeds) && listingBeds < filters.beds) return false;
  }
  if (filters.baths != null) {
    const listingBaths = p.baths != null && p.baths !== "" ? Number(p.baths) : null;
    if (listingBaths != null && !Number.isNaN(listingBaths) && listingBaths < filters.baths) return false;
  }
  if (filters.type && !listingTypeMatchesFilter(p.type, filters.type)) return false;
  if (filters.amenities?.length) {
    const list = Array.isArray(p.amenities) ? p.amenities : [];
    const hasParking = (p.parking ?? 0) > 0;
    const descLower = String(p.description || "").toLowerCase();
    const allText = [
      ...list.map((x) => String(x).toLowerCase()),
      descLower,
    ].join(" ");
    if (
      !filters.amenities.every((a) => {
        const key = String(a).toLowerCase();
        if (key === "parking" || key === "garage") return hasParking || allText.includes("park") || allText.includes("garage") || allText.includes("driveway");
        if (key === "pool") return allText.includes("pool") || allText.includes("swimming");
        if (key === "gym") return allText.includes("gym") || allText.includes("fitness") || allText.includes("exercise room") || allText.includes("work out");
        if (key === "concierge") return allText.includes("concierge");
        if (key === "waterfront") return allText.includes("waterfront") || allText.includes("lakefront") || allText.includes("water front") || allText.includes("lake view");
        if (key === "smart home") return allText.includes("smart home") || allText.includes("smart ") || allText.includes("home automation");
        if (key === "guest house") return allText.includes("guest house") || allText.includes("guest suite") || allText.includes("in-law");
        if (key === "laundry") return allText.includes("laundry") || allText.includes("washer") || allText.includes("dryer");
        if (key === "balcony") return allText.includes("balcony") || allText.includes("terrace") || allText.includes("deck");
        if (key === "fireplace") return allText.includes("fireplace");
        if (key === "air conditioning" || key === "ac") return allText.includes("air condition") || allText.includes("a/c") || allText.includes("central air");
        if (key === "elevator") return allText.includes("elevator");
        if (key === "storage") return allText.includes("storage") || allText.includes("locker");
        return allText.includes(key);
      })
    )
      return false;
  }
  if (filters.forSaleOnly === true && p.priceIsMonthly) return false;
  if (filters.forSaleOnly === false && !p.priceIsMonthly) return false;
  return true;
}
