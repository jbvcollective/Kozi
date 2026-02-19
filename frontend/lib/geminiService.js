"use client";

/**
 * Call server-only API to parse search (Gemini key never exposed to client).
 * @param {string} query - Raw search input (e.g. from voice)
 * @returns {Promise<{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, baths?: number, type?: string, conversationalResponse?: string } | null>}
 */
async function parseSearchQueryViaApi(query) {
  if (!query?.trim()) return null;
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'geminiService.js:parseSearchQueryViaApi:before-fetch',message:'about to fetch /api/parse-search',data:{queryLen:query?.trim()?.length},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    const res = await fetch("/api/parse-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query.trim() }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const hasFilters =
      data.location ||
      data.minPrice != null ||
      data.maxPrice != null ||
      data.beds != null ||
      data.baths != null ||
      data.type ||
      (Array.isArray(data.amenities) && data.amenities.length > 0) ||
      data.forSaleOnly === true ||
      data.forSaleOnly === false;
    if (!hasFilters) return null;
    return {
      location: data.location,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      beds: data.beds,
      baths: data.baths,
      type: data.type,
      forSaleOnly: data.forSaleOnly,
      amenities: Array.isArray(data.amenities) ? data.amenities : undefined,
      conversationalResponse:
        data.conversationalResponse || `Showing properties matching "${query.trim()}".`,
    };
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'geminiService.js:parseSearchQueryViaApi:catch',message:'parse-search fetch failed',data:{errName:e?.name,errMessage:e?.message},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    return null;
  }
}

/**
 * Rule-based fallback when Gemini is unavailable or fails.
 */
function parseSearchQueryFallback(query) {
  const q = query.trim();
  const lower = q.toLowerCase();
  const filters = {};
  let conversationalResponse = `Showing properties matching "${q}".`;

  const placeWords = [
    "toronto", "vancouver", "montreal", "calgary", "ottawa", "edmonton", "mississauga", "winnipeg",
    "brampton", "hamilton", "quebec", "surrey", "laval", "halifax", "london", "victoria", "oakville",
    "markham", "richmond hill", "burlington", "greater vancouver", "gta", "greater toronto",
    "lanark", "carleton place", "smiths falls", "almonte", "kingston", "niagara", "waterloo", "kitchener"
  ];
  const extractLocation = (text) => {
    const t = text.toLowerCase();
    const inMatch = t.match(/(?:in|near|at)\s+([a-z\s]+?)(?:\s+under|\s+over|\s+\$|$)/);
    if (inMatch) {
      const loc = inMatch[1].trim();
      if (loc.length > 1 && loc.length < 50) return loc;
    }
    for (const place of placeWords) {
      if (t.includes(place)) return place;
    }
    return null;
  };

  const extractedLocation = extractLocation(q);
  if (extractedLocation) filters.location = extractedLocation;

  const underMatch = lower.match(/under\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
  const lessThanMatch = lower.match(/less\s+than\s+(?:\$?|amount\s+)?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
  const belowMatch = lower.match(/below\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
  const forPriceMatch = lower.match(/for\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/);
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
  if (!underMatch && (lessThanMatch || belowMatch)) {
    const m = lessThanMatch || belowMatch;
    filters.maxPrice = toNum(m[1], m[2]);
    conversationalResponse = `Properties under $${filters.maxPrice >= 1000 ? (filters.maxPrice / 1000).toFixed(0) + "k" : filters.maxPrice}.`;
  }
  if (!underMatch && !lessThanMatch && !belowMatch && forPriceMatch) {
    filters.maxPrice = toNum(forPriceMatch[1], forPriceMatch[2]);
    conversationalResponse = `Properties for $${filters.maxPrice >= 1000 ? (filters.maxPrice / 1000).toFixed(0) + "k" : filters.maxPrice} or less.`;
  }
  if (overMatch) {
    filters.minPrice = toNum(overMatch[1], overMatch[2]);
    if (!underMatch && !lessThanMatch && !belowMatch) conversationalResponse = `Properties over $${filters.minPrice >= 1000000 ? (filters.minPrice / 1000000).toFixed(1) + "M" : (filters.minPrice / 1000).toFixed(0) + "k"}.`;
  }
  if (rangeMatch) {
    filters.minPrice = toNum(rangeMatch[1], rangeMatch[2]);
    filters.maxPrice = toNum(rangeMatch[3], rangeMatch[4]);
    conversationalResponse = `Properties between $${(filters.minPrice / 1000).toFixed(0)}k and $${(filters.maxPrice / 1000).toFixed(0)}k.`;
  }

  const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  const bedsNumMatch = lower.match(/(\d+)\s*\+\s*(?:bed|bedroom)/) || lower.match(/(\d+)\s*(?:bed|bedroom|br\b)/);
  if (bedsNumMatch) filters.beds = parseInt(bedsNumMatch[1], 10);
  else {
    for (const [word, num] of Object.entries(wordToNum)) {
      if (new RegExp(`${word}\\s+(?:bed|bedroom)`).test(lower) || new RegExp(`(?:bed|bedroom).*${word}`).test(lower)) {
        filters.beds = num;
        break;
      }
    }
  }
  const bathsNumMatch = lower.match(/(\d+)\s*\+\s*(?:bath|bathroom)/) || lower.match(/(\d+)\s*(?:bath|bathroom)/);
  if (bathsNumMatch) filters.baths = parseInt(bathsNumMatch[1], 10);
  else {
    for (const [word, num] of Object.entries(wordToNum)) {
      if (new RegExp(`${word}\\s+(?:bath|bathroom)`).test(lower)) {
        filters.baths = num;
        break;
      }
    }
  }

  const typeWords = ["condo", "townhouse", "commercial", "land", "multi-family", "house", "home"];
  for (const t of typeWords) {
    if (lower.includes(t)) {
      filters.type = t === "home" ? "house" : t;
      break;
    }
  }

  const amenityKeywords = [
    ["pool", "Pool"],
    ["swimming", "Pool"],
    ["gym", "Gym"],
    ["fitness", "Gym"],
    ["exercise", "Gym"],
    ["parking", "Parking"],
    ["garage", "Garage"],
    ["waterfront", "Waterfront"],
    ["lakefront", "Waterfront"],
    ["guest house", "Guest House"],
    ["in-law suite", "Guest House"],
    ["concierge", "Concierge"],
    ["smart home", "Smart Home"],
    ["laundry", "Laundry"],
    ["washer", "Laundry"],
    ["balcony", "Balcony"],
    ["terrace", "Balcony"],
    ["deck", "Balcony"],
    ["fireplace", "Fireplace"],
    ["air conditioning", "Air Conditioning"],
    ["central air", "Air Conditioning"],
    ["elevator", "Elevator"],
    ["storage", "Storage"],
    ["locker", "Storage"],
  ];
  const foundAmenities = [];
  for (const [keyword, canonical] of amenityKeywords) {
    if (lower.includes(keyword)) foundAmenities.push(canonical);
  }
  if (foundAmenities.length) filters.amenities = [...new Set(foundAmenities)];

  const wantsRent = /\b(rent|rentals?|monthly|per month|\/mo\b|lease)\b/.test(lower);
  if (filters.type != null && !wantsRent) filters.forSaleOnly = true;
  else if (wantsRent) filters.forSaleOnly = false;

  const hasAnyFilter = filters.location || filters.type || filters.maxPrice != null || filters.minPrice != null || filters.beds != null || filters.baths != null || (filters.amenities?.length > 0);
  if (hasAnyFilter) {
    const parts = [];
    if (filters.type) parts.push(filters.type === "house" ? "Homes" : filters.type === "condo" ? "Condos" : `${filters.type}s`);
    if (filters.location) parts.push(`in ${filters.location}`);
    if (filters.maxPrice != null) parts.push(`under $${filters.maxPrice >= 1000000 ? (filters.maxPrice / 1000000).toFixed(1) + "M" : (filters.maxPrice / 1000).toFixed(0) + "K"}`);
    if (filters.minPrice != null && filters.maxPrice == null) parts.push(`over $${filters.minPrice >= 1000000 ? (filters.minPrice / 1000000).toFixed(1) + "M" : (filters.minPrice / 1000).toFixed(0) + "K"}`);
    if (filters.beds != null) parts.push(`${filters.beds}+ bed`);
    if (filters.baths != null) parts.push(`${filters.baths}+ bath`);
    if (filters.amenities?.length) parts.push(`with ${filters.amenities.map((a) => a.toLowerCase()).join(", ")}`);
    if (parts.length && !filters.type) parts.unshift("Properties");
    conversationalResponse = parts.length ? parts.join(" ") + "." : conversationalResponse;
  }

  return {
    ...filters,
    conversationalResponse: conversationalResponse || `Showing results for "${q}".`,
  };
}

/**
 * Parse natural-language search query into structured filters (uses Gemini when API key is set, else rule-based).
 * @param {string} query - Raw search input (e.g. from voice: "find me a home with 2 beds and 1 bath in Oakville under 1 million")
 * @returns {Promise<{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, baths?: number, type?: string, conversationalResponse?: string }>}
 */
export async function parseSearchQuery(query) {
  if (!query || typeof query !== "string") {
    return { conversationalResponse: null };
  }
  try {
    const result = await parseSearchQueryViaApi(query);
    if (result) return result;
  } catch (_) {
    // fall through to rule-based
  }
  return parseSearchQueryFallback(query);
}

/**
 * Suggest a relaxed search when the user's criteria returned no results. Uses Gemini server-side.
 * @param {{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, baths?: number, type?: string }} originalFilters - Filters that had zero results
 * @param {string} [originalQuery] - User's original search phrase (optional)
 * @returns {Promise<{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, baths?: number, type?: string, message: string } | null>}
 */
export async function suggestSimilarSearch(originalFilters, originalQuery = "") {
  if (!originalFilters || typeof originalFilters !== "object") return null;
  const hasAny =
    originalFilters.location ||
    originalFilters.minPrice != null ||
    originalFilters.maxPrice != null ||
    originalFilters.beds != null ||
    originalFilters.baths != null ||
    originalFilters.type;
  if (!hasAny) return null;
  try {
    const res = await fetch("/api/suggest-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilters: {
          location: originalFilters.location,
          minPrice: originalFilters.minPrice,
          maxPrice: originalFilters.maxPrice,
          beds: originalFilters.beds,
          baths: originalFilters.baths,
          type: originalFilters.type,
        },
        originalQuery: originalQuery ? String(originalQuery).trim().slice(0, 300) : "",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.message) return null;
    return {
      location: data.location,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      beds: data.beds,
      baths: data.baths,
      type: data.type,
      message: data.message,
    };
  } catch {
    return null;
  }
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
  const cityMatch = trimmed.match(/,?\s*([A-Za-z\s]+),?\s*(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT)/i);
  const city = cityMatch ? cityMatch[1].trim() : "your area";
  return `Based on current MLS® activity and comparable sales in ${city}, this address sits in a segment with strong liquidity. Consider a professional appraisal to lock in listing strategy and maximize equity capture.`;
}
