"use client";

/**
 * Parse natural-language search query into structured filters and a conversational response.
 * Can be extended to call Gemini API (e.g. NEXT_PUBLIC_GEMINI_API_KEY) for richer parsing.
 * @param {string} query - Raw search input
 * @returns {Promise<{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, type?: string, conversationalResponse?: string }>}
 */
export async function parseSearchQuery(query) {
  if (!query || typeof query !== "string") {
    return { conversationalResponse: null };
  }

  const q = query.trim();
  const lower = q.toLowerCase();
  const filters = {};
  let conversationalResponse = `Showing properties matching "${q}".`;

  // Location: treat as location if it looks like a place (no numbers, or ends with city/province keywords)
  const locationMatch = q.match(/^(?:in|near|at)\s+(.+)$/i) || (lower !== "" && !/^\d+[\d\s,.-]*$/.test(q) ? [null, q] : null);
  if (locationMatch && locationMatch[1]) {
    filters.location = locationMatch[1].trim();
  } else if (q && !/^\d+[\d\s,.-]*$/.test(q) && !lower.includes("bed") && !lower.includes("bath") && !lower.includes("under") && !lower.includes("over")) {
    filters.location = q;
  }

  // Price: "under 500k", "over 1M", "500k-1M", "between 400 and 800"
  const underMatch = lower.match(/under\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
  const overMatch = lower.match(/over\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
  const rangeMatch = lower.match(/\$?(\d+(?:\.\d+)?)\s*(k|m)?\s*[-–]\s*\$?(\d+(?:\.\d+)?)\s*(k|m)?/);
  const toNum = (n, suffix) => {
    let v = parseFloat(n);
    if (suffix === "k") v *= 1000;
    if (suffix === "m" || suffix === "million") v *= 1000000;
    return v;
  };
  if (underMatch) {
    filters.maxPrice = toNum(underMatch[1], underMatch[2]);
    conversationalResponse = `Properties under $${filters.maxPrice >= 1000 ? (filters.maxPrice / 1000).toFixed(0) + "k" : filters.maxPrice}.`;
  }
  if (overMatch) {
    filters.minPrice = toNum(overMatch[1], overMatch[2]);
    if (!underMatch) conversationalResponse = `Properties over $${filters.minPrice >= 1000000 ? (filters.minPrice / 1000000).toFixed(1) + "M" : (filters.minPrice / 1000).toFixed(0) + "k"}.`;
  }
  if (rangeMatch) {
    filters.minPrice = toNum(rangeMatch[1], rangeMatch[2]);
    filters.maxPrice = toNum(rangeMatch[3], rangeMatch[4]);
    conversationalResponse = `Properties between $${(filters.minPrice / 1000).toFixed(0)}k and $${(filters.maxPrice / 1000).toFixed(0)}k.`;
  }

  // Beds: "3 bed", "4+ bedrooms"
  const bedsMatch = lower.match(/(\d+)\s*\+\s*(?:bed|bedroom)/) || lower.match(/(\d+)\s*(?:bed|bedroom)/);
  if (bedsMatch) {
    filters.beds = parseInt(bedsMatch[1], 10);
  }

  // Type: condo, house, commercial, etc.
  const typeWords = ["condo", "house", "townhouse", "commercial", "land", "multi-family"];
  for (const t of typeWords) {
    if (lower.includes(t)) {
      filters.type = t;
      break;
    }
  }

  if (filters.location) {
    conversationalResponse = `Here are properties in ${filters.location}.`;
    if (Object.keys(filters).length > 1) conversationalResponse += " Refined by your criteria.";
  }

  return {
    ...filters,
    conversationalResponse: conversationalResponse || `Showing results for "${q}".`,
  };
}

/**
 * Get AI-driven valuation insight for an address. Can be extended to call Gemini API.
 * @param {string} address - Property address
 * @returns {Promise<string>} Advisor insight text
 */
export async function getValuationInsights(address) {
  if (!address || typeof address !== "string") {
    return "Enter an address to receive a tailored market insight for your property.";
  }
  const trimmed = address.trim();
  // Stub: return a contextual message. Replace with Gemini/API call when ready.
  const cityMatch = trimmed.match(/,?\s*([A-Za-z\s]+),?\s*(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT)/i);
  const city = cityMatch ? cityMatch[1].trim() : "your area";
  return `Based on current MLS® activity and comparable sales in ${city}, this address sits in a segment with strong liquidity. Consider a professional appraisal to lock in listing strategy and maximize equity capture.`;
}
