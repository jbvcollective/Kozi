import { supabase, hasSupabase } from "./supabase";

// Backend API (optional). Set NEXT_PUBLIC_API_URL in .env.local if you use the Express server.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function getApiHeaders(session) {
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  if (typeof apiKey === "string" && apiKey) headers["X-Api-Key"] = apiKey;
  return headers;
}

async function parseJson(res, url) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const text = await res.text();
    throw new Error(
      "API returned HTML instead of JSON. Is the backend running? Set NEXT_PUBLIC_API_URL in .env.local to your Express server (e.g. http://localhost:3000) and run: npm run serve"
    );
  }
  return res.json();
}

/** Create Stripe Checkout Session for Agent Pro. Returns { url } to redirect to; tracks payment via session_id on success page and webhook. */
export async function createAgentProCheckoutSession({ email, name, phone } = {}) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Sign in to subscribe to Agent Pro.");
  const headers = { "Content-Type": "application/json", ...getApiHeaders(session) };
  const res = await fetch("/api/checkout_sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: session.user.id,
      email: email || session.user?.email || "",
      name: name || "",
      phone: phone || "",
    }),
  });
  const data = await parseJson(res, "/api/checkout_sessions");
  if (!res.ok) throw new Error(data?.error || "Checkout failed.");
  if (!data?.url) throw new Error("No checkout URL returned.");
  return { url: data.url };
}

/** Timeout per chunk when fetching from Supabase. 400 rows per request should stay under DB statement timeout. */
const FETCH_LISTINGS_TIMEOUT_MS = 35000;

/** VOW compliance: get current session; authenticated users may receive full (idx+vow) data. */
async function getSession() {
  if (!supabase?.auth) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:getSession:ok',message:'getSession ok',data:{hasSession:!!session},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    return session ?? null;
  } catch (e) {
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:getSession:catch',message:'getSession failed',data:{errName:e?.name,errMessage:e?.message},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    throw e;
  }
}

/** Chunk size for Supabase; many projects default to 1000 max rows per request. */
const SUPABASE_CHUNK_SIZE = 1000;

/**
 * Voice search: send structured filters (from Gemini) to the API; server checks Supabase and returns only same/similar listings.
 * @param {{ location?: string, minPrice?: number, maxPrice?: number, beds?: number, baths?: number, type?: string, amenities?: string[], forSaleOnly?: boolean }} filters
 * @returns {Promise<Array<{ listing_key: string, idx: object, vow: object, updated_at: string }>>} Raw rows (same shape as fetchListings); map with mapListingToProperty().
 */
export async function fetchListingsSearch(filters) {
  const session = await getSession();
  const headers = { "Content-Type": "application/json", ...getApiHeaders(session) };
  const res = await fetch("/api/listings/search", {
    method: "POST",
    headers,
    body: JSON.stringify({ filters: filters || {} }),
  });
  if (!res.ok) {
    if (res.status === 503) throw new Error("Search not configured.");
    throw new Error(res.status === 401 ? "Sign in to search listings." : "Search failed.");
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/** Fetch listings from listings_unified_clean. Login required; no data for anonymous users. Uses Supabase when configured (RLS: authenticated read-only). Fetches in chunks to return all requested rows. When options.includeCount is true, returns { data, total } instead of an array. */
export async function fetchListings(options = {}) {
  const requestedLimit = options.limit ?? 500;
  const limit = Math.min(requestedLimit, 50000);
  const offset = options.offset ?? 0;
  const includeCount = options.includeCount === true;
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:entry',message:'fetchListings entry',data:{hasSupabase:hasSupabase(),API_BASE,limit,offset},timestamp:Date.now(),hypothesisId:'H1-H2-H5'})}).catch(()=>{});
  // #endregion

  if (hasSupabase()) {
    const session = await getSession();
    if (!session) return includeCount ? { data: [], total: 0 } : [];
    const all = [];
    let from = offset;
    const toEnd = offset + limit;
    let totalCount = null;
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:supabase-branch',message:'using Supabase branch',data:{from,toEnd},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      while (from < toEnd) {
        const chunkSize = Math.min(SUPABASE_CHUNK_SIZE, toEnd - from);
        const selectOpts = includeCount && from === offset ? { count: "exact" } : {};
        const query = supabase
          .from("listings_unified_clean")
          .select("listing_key, idx, vow, updated_at", selectOpts)
          .order("updated_at", { ascending: false })
          .range(from, from + chunkSize - 1);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Listings request timed out. Increase Supabase statement timeout in Database settings or reduce load.")), FETCH_LISTINGS_TIMEOUT_MS)
        );
        const result = await Promise.race([query, timeoutPromise]);
        const { data, error, count } = result;
        if (error) throw new Error(error.message);
        if (includeCount && typeof count === "number") totalCount = count;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < chunkSize) break;
        from += rows.length;
      }
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:supabase-success',message:'fetchListings Supabase branch succeeded',data:{count:all.length},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (includeCount) return { data: all, total: totalCount ?? all.length };
      return all;
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:supabase-catch',message:'fetchListings Supabase branch threw',data:{errName:e?.name,errMessage:e?.message,isAbortError:e?.name==='AbortError'},timestamp:Date.now(),hypothesisId:'H2-H3-H4'})}).catch(()=>{});
      // #endregion
      if (e?.message?.includes("timed out")) throw e;
      const isNetworkError = e?.name === "TypeError" && (e?.message === "Failed to fetch" || e?.message?.toLowerCase?.().includes("fetch"));
      if (isNetworkError && API_BASE) {
        try {
          const session = await getSession();
          const page = offset === 0 ? 1 : Math.floor(offset / limit) + 1;
          const url = `${API_BASE}/api/listings?page=${page}&limit=${limit}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers: getApiHeaders(session) });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
          const json = await parseJson(res, url);
          return Array.isArray(json) ? json : (json?.data ?? []);
        } catch (expressErr) {
          const supabaseUrl = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "(not set)";
          throw new Error(
            `Cannot reach Supabase (${supabaseUrl}) or backend (${API_BASE}). Check NEXT_PUBLIC_SUPABASE_URL and network, or start the backend: npm run serve`
          );
        }
      }
      if (isNetworkError) {
        const supabaseUrl = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" ? process.env.NEXT_PUBLIC_SUPABASE_URL : "(not set)";
        throw new Error(
          `Cannot reach Supabase (${supabaseUrl}). Check NEXT_PUBLIC_SUPABASE_URL in frontend/.env.local and your network. Or set NEXT_PUBLIC_API_URL and start the backend (npm run serve).`
        );
      }
      throw e;
    }
  }

  const session = await getSession();
  const page = offset === 0 ? 1 : Math.floor(offset / limit) + 1;
  const url = `${API_BASE}/api/listings?page=${page}&limit=${limit}`;
  const headers = getApiHeaders(session);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:before-express-fetch',message:'about to fetch Express listings',data:{url},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    // #endregion
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
    const json = await parseJson(res, url);
    return Array.isArray(json) ? json : (json?.data ?? []);
  } catch (e) {
    clearTimeout(timeoutId);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchListings:express-catch',message:'fetchListings Express branch threw',data:{errName:e?.name,errMessage:e?.message,url,isAbortError:e?.name==='AbortError'},timestamp:Date.now(),hypothesisId:'H1-H3-H4-H5'})}).catch(()=>{});
    // #endregion
    if (e.name === "AbortError") {
      throw new Error(
        "Request timed out. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local to load listings from Supabase, or start the backend (npm run serve) and set NEXT_PUBLIC_API_URL."
      );
    }
    throw e;
  }
}

// Client-side cache for listing detail (prefetch on hover for instant load)
const listingDetailCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCachedListing(key) {
  const entry = listingDetailCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    listingDetailCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedListing(key, data) {
  listingDetailCache.set(key, { data, at: Date.now() });
}

/** Get listing from cache only (for instant display after prefetch). */
export function getCachedListingById(listingKey) {
  return listingKey ? getCachedListing(listingKey) : null;
}

/** Prefetch a listing and store in cache. Call on card hover. No-op when not logged in. */
export function prefetchListingById(listingKey) {
  if (!listingKey || getCachedListing(listingKey)) return;
  if (!hasSupabase()) return;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    supabase
      .from("listings_unified_clean")
      .select("listing_key, idx, vow, updated_at")
      .eq("listing_key", listingKey)
      .single()
      .then(({ data }) => {
        if (data) setCachedListing(listingKey, data);
      })
      .catch(() => {});
  });
}

/** Fetch listings by listing_key list (e.g. saved IDs). Uses Supabase when configured; returns rows in same order as ids where found. Login required. */
export async function fetchListingsByIds(ids) {
  const keys = Array.isArray(ids) ? ids.filter((k) => k != null && String(k).trim()) : [];
  if (keys.length === 0) return [];

  if (hasSupabase()) {
    const session = await getSession();
    if (!session) return [];
    const idSet = new Set(keys);
    const CHUNK = 100;
    const all = [];
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("listings_unified_clean")
        .select("listing_key, idx, vow, updated_at")
        .in("listing_key", chunk);
      if (error) throw new Error(error.message);
      (data ?? []).forEach((row) => all.push(row));
    }
    return keys.map((k) => all.find((r) => r.listing_key === k)).filter(Boolean);
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const session = await getSession();
  const out = [];
  for (const id of keys) {
    try {
      const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(id)}`, { cache: "no-store", headers: getApiHeaders(session) });
      if (res.ok) {
        const data = await parseJson(res, `${API_BASE}/api/listings/${id}`);
        if (data) out.push(data);
      }
    } catch (_) {}
  }
  return keys.map((k) => out.find((r) => (r.listing_key || r.id) === k)).filter(Boolean);
}

/** Fetch a single listing by id. Login required; returns null when not authenticated. */
export async function fetchListingById(listingKey) {
  if (!listingKey) return null;
  const cached = getCachedListing(listingKey);
  if (cached) return cached;

  if (hasSupabase()) {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await supabase
      .from("listings_unified_clean")
      .select("listing_key, idx, vow, updated_at")
      .eq("listing_key", listingKey)
      .single();
    if (error || !data) return null;
    setCachedListing(listingKey, data);
    return data;
  }

  const session = await getSession();
  const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(listingKey)}`, { cache: "no-store", headers: getApiHeaders(session) });
  if (!res.ok) return null;
  const data = await parseJson(res, `${API_BASE}/api/listings/${listingKey}`);
  if (data) setCachedListing(listingKey, data);
  return data;
}

/** Fetch sold/expired/terminated listings. VOW: login required; unauthenticated gets [] or 401.
 * Same row shape as fetchListings: listing_key, idx, vow, updated_at. Map with mapListingToProperty().
 */
export async function fetchSoldTerminatedListings(options = {}) {
  const limit = options.limit ?? 500;
  const session = await getSession();

  if (hasSupabase()) {
    if (!session) return []; // RLS: sold_listings is authenticated read-only
    let query = supabase
      .from("sold_listings")
      .select("listing_key, idx, vow, updated_at")
      .order("closed_date", { ascending: false })
      .order("updated_at", { ascending: false });
    if (limit > 0) query = query.limit(limit);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase.from("v_listings_sold_terminated").select("listing_key, idx, vow, updated_at").order("updated_at", { ascending: false }).limit(limit);
      if (!fallback.error) return fallback.data ?? [];
      throw new Error(error.message);
    }
    if ((data ?? []).length > 0) return data;
    const fallback = await supabase.from("v_listings_sold_terminated").select("listing_key, idx, vow, updated_at").order("updated_at", { ascending: false }).limit(limit);
    return fallback.data ?? [];
  }

  const url = `${API_BASE}/api/listings/sold?page=1&limit=${limit}`;
  const headers = getApiHeaders(session);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (res.status === 401) throw new Error("Login required to view sold listings (VOW compliance).");
    if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
    const json = await parseJson(res, url);
    return Array.isArray(json) ? json : (json?.data ?? []);
  } catch (e) {
    clearTimeout(timeoutId);
    fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'api.js:fetchSoldTerminatedListings:catch',message:'fetchSoldTerminatedListings threw',data:{errName:e?.name,errMessage:e?.message,isAbortError:e?.name==='AbortError'},timestamp:Date.now(),hypothesisId:'H3-H4'})}).catch(()=>{});
    if (e.name === "AbortError") throw new Error("Request timed out.");
    throw e;
  }
}

/** Fetch only analytics_area_market_health from Supabase (or backend). */
export async function fetchAreaMarketHealth() {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from("analytics_area_market_health")
      .select("*")
      .order("total_active", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  const url = `${API_BASE}/api/analytics`;
  const res = await fetch(url, { cache: "no-store", headers: getApiHeaders(null) });
  if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
  const json = await parseJson(res, url);
  return json.area_market_health ?? [];
}

/** Fetch analytics_monthly (time-series) for combined chart. */
export async function fetchAnalyticsMonthly() {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from("analytics_monthly")
      .select("*")
      .order("year_month", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  const url = `${API_BASE}/api/analytics`;
  const res = await fetch(url, { cache: "no-store", headers: getApiHeaders(null) });
  if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
  const json = await parseJson(res, url);
  return json.monthly ?? [];
}

/** Fetch market analytics from Supabase: all 5 analytics_* tables. */
export async function fetchAnalytics() {
  if (hasSupabase()) {
    const [areaHealth, listToSale, avgDom, avgDomByPrice, monthly] = await Promise.all([
      supabase.from("analytics_area_market_health").select("*").order("total_active", { ascending: false }),
      supabase.from("analytics_list_to_sale").select("*").order("sale_count", { ascending: false }),
      supabase.from("analytics_avg_dom").select("*").order("listing_count", { ascending: false }),
      supabase.from("analytics_avg_dom_by_price").select("*").order("listing_count", { ascending: false }),
      supabase.from("analytics_monthly").select("*").order("year_month", { ascending: true }),
    ]);
    if (areaHealth.error || listToSale.error || avgDom.error || avgDomByPrice.error || monthly.error) {
      const err = areaHealth.error || listToSale.error || avgDom.error || avgDomByPrice.error || monthly.error;
      throw new Error(err?.message || "Failed to load analytics from Supabase");
    }
    return {
      area_market_health: areaHealth.data ?? [],
      list_to_sale: listToSale.data ?? [],
      avg_dom: avgDom.data ?? [],
      avg_dom_by_price: avgDomByPrice.data ?? [],
      monthly: monthly.data ?? [],
    };
  }

  const url = `${API_BASE}/api/analytics`;
  const res = await fetch(url, { cache: "no-store", headers: getApiHeaders(null) });
  if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
  const json = await parseJson(res, url);
  return {
    area_market_health: json.area_market_health ?? [],
    list_to_sale: json.list_to_sale ?? [],
    avg_dom: json.avg_dom ?? [],
    avg_dom_by_price: json.avg_dom_by_price ?? [],
    monthly: json.monthly ?? [],
  };
}

/** Distance in km between two points (Haversine approximation). */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** Normalize school row from school_locations (or schools) to a consistent shape for UI. */
function normalizeSchoolRow(row) {
  const lat = row.lat ?? row.latitude ?? row.LATITUDE;
  const lng = row.lng ?? row.longitude ?? row.LONGITUDE;
  const name = row.name ?? row.NAME ?? row.school_name ?? row.schoolname ?? "School";
  return {
    id: row.id ?? row._id ?? row.OBJECTID ?? row.GEO_ID ?? row.school_id ?? `${name}-${lat}-${lng}`,
    name: String(name ?? "School"),
    type: row.type ?? row.SCHOOL_TYPE ?? row.SCHOOL_LEVEL ?? row.school_type ?? row.school_type_desc ?? null,
    address: row.address ?? row.ADDRESS_FULL ?? row.SOURCE_ADDRESS ?? row.LINEAR_NAME_FULL ?? row.street ?? null,
    city: row.city ?? row.CITY ?? row.MUNICIPALITY ?? row.PLACE_NAME ?? null,
    province: row.province ?? row.state ?? null,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
  };
}

/** Fetch from one Supabase table. Tries lat/lng, then latitude/longitude, then LATITUDE/LONGITUDE. */
async function fetchSchoolsFromTable(supabase, table, lat, lng, delta) {
  const { data: d1, error: e1 } = await supabase
    .from(table)
    .select("*")
    .gte("lat", lat - delta)
    .lte("lat", lat + delta)
    .gte("lng", lng - delta)
    .lte("lng", lng + delta);
  if (!e1?.message?.includes("column")) return { rows: d1 ?? [], error: e1 };

  const { data: d2, error: e2 } = await supabase
    .from(table)
    .select("*")
    .gte("latitude", lat - delta)
    .lte("latitude", lat + delta)
    .gte("longitude", lng - delta)
    .lte("longitude", lng + delta);
  if (!e2?.message?.includes("column")) return { rows: d2 ?? [], error: e2 };

  const { data: d3, error: e3 } = await supabase
    .from(table)
    .select("*")
    .gte("LATITUDE", lat - delta)
    .lte("LATITUDE", lat + delta)
    .gte("LONGITUDE", lng - delta)
    .lte("LONGITUDE", lng + delta);
  return { rows: d3 ?? [], error: e3 };
}

/** Normalize lat/lng: ensure valid ranges; fix common swap (longitude in lat field, latitude in lng). */
function normalizeSchoolCoords(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { lat: a, lng: b };
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (absA <= 90 && absB <= 180) return { lat: a, lng: b };
  if (absA <= 180 && absB <= 90) return { lat: b, lng: a };
  return {
    lat: Math.max(-90, Math.min(90, a)),
    lng: Math.max(-180, Math.min(180, b)),
  };
}

/** Max distance (km) from listing to include a school. Only schools within this radius are shown. */
const MAX_SCHOOL_DISTANCE_KM = 10;

/** Fetch schools near a location. Fetches from Google Places API (via backend or Next.js route) or falls back to Supabase. */
export async function fetchSchoolsNear(lat, lng, limit = 10) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const { lat: nLat, lng: nLng } = normalizeSchoolCoords(lat, lng);

  if (API_BASE) {
    try {
      const url = `${API_BASE}/api/schools?lat=${encodeURIComponent(nLat)}&lng=${encodeURIComponent(nLng)}&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store", headers: getApiHeaders(null) });
      if (res.ok) return await parseJson(res, url);
    } catch (_) {}
  }

  try {
    const nearUrl = `/api/schools/near?lat=${encodeURIComponent(nLat)}&lng=${encodeURIComponent(nLng)}&limit=${limit}`;
    const res = await fetch(nearUrl, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (_) {}

  if (hasSupabase()) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("schools_near", {
      center_lat: nLat,
      center_lng: nLng,
      radius_km: MAX_SCHOOL_DISTANCE_KM,
      max_count: limit,
    });
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData.map((s) => ({ ...s, distance_km: Number(s.distance_km) }));
    }
    const { data: placesData, error: placesErr } = await supabase.rpc("places_schools_near", {
      center_lat: nLat,
      center_lng: nLng,
      radius_km: MAX_SCHOOL_DISTANCE_KM,
      max_count: limit,
    });
    if (!placesErr && Array.isArray(placesData) && placesData.length > 0) {
      return placesData.map((s) => ({
        id: s.place_id,
        name: s.name,
        type: s.level ?? "school",
        address: s.address,
        city: s.city,
        province: s.province,
        lat: s.lat,
        lng: s.lng,
        distance_km: Number(s.distance_km ?? s.d ?? 0),
      }));
    }
    const delta = 0.2;
    let rows = [];
    const tryTable = async (table) => {
      const { rows: r, error } = await fetchSchoolsFromTable(supabase, table, nLat, nLng, delta);
      if (!error && r?.length) return r;
      return [];
    };
    rows = await tryTable("school_locations");
    if (rows.length === 0) rows = await tryTable("schools");
    const normalized = rows.map(normalizeSchoolRow).filter((s) => s.lat != null && s.lng != null);
    const withDist = normalized
      .map((s) => ({ ...s, distance_km: haversineKm(nLat, nLng, s.lat, s.lng) }))
      .filter((s) => s.distance_km <= MAX_SCHOOL_DISTANCE_KM);
    withDist.sort((a, b) => a.distance_km - b.distance_km);
    return withDist.slice(0, limit);
  }
  return [];
}

/** Fetch transit stops near a listing's coordinates via the Next.js API route (Google Places). */
export async function fetchTransitNear(lat, lng, limit = 20) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  try {
    const url = `/api/transit/near?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (_) {}
  return [];
}

/** VIP deals: discounts/coupons/perks. Table stores content in one JSONB column (data). RLS filters by chosen agent. */
export async function fetchVipDeals() {
  if (!hasSupabase()) return [];
  const { data, error } = await supabase
    .from("vip_deals")
    .select("id, agent_id, data, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    ...(typeof row.data === "object" && row.data !== null ? row.data : {}),
    created_at: row.created_at,
  }));
}

/** Agent only: add a VIP deal. Content saved in data JSONB. Table must have columns: id, agent_id, data (jsonb), created_at, updated_at. Run sql/vip_deals.sql in Supabase. */
export async function addVipDeal(deal) {
  if (!hasSupabase()) return { error: new Error("Not configured") };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { error: new Error("Sign in required") };
  const title = (deal?.title ?? "").trim();
  const offer = (deal?.offer ?? "").trim();
  if (!title || !offer) return { error: new Error("Title and offer are required") };
  const payload = {
    agent_id: user.id,
    data: {
      title,
      description: (deal?.description ?? "").trim() || null,
      offer,
      image_url: (deal?.image_url ?? "").trim() || null,
      link_url: (deal?.link_url ?? "").trim() || null,
      coupon_code: (deal?.coupon_code ?? "").trim() || null,
    },
  };
  const { error } = await supabase.from("vip_deals").insert(payload);
  if (error) {
    const msg = error.message || error.error_description || (error.code ? `Error ${error.code}` : "Failed to add");
    return { error: new Error(msg) };
  }
  return {};
}

/** Agent only: remove a VIP deal by id. */
export async function removeVipDeal(dealId) {
  if (!hasSupabase() || !dealId) return { error: new Error("Invalid deal") };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { error: new Error("Sign in required") };
  const { error } = await supabase.from("vip_deals").delete().eq("agent_id", user.id).eq("id", dealId);
  return error ? { error: error instanceof Error ? error : new Error(error.message || "Failed to remove") } : {};
}

/** Fetch open house events from Supabase (table: open_house_events).
 * data JSONB holds open_house_*, address, lat, lng. Returns [] if table missing or error.
 */
export async function fetchOpenHouseEvents() {
  if (!hasSupabase()) return [];
  const { data, error } = await supabase
    .from("open_house_events")
    .select("id, listing_key, start_ts, end_ts, remarks, data")
    .order("start_ts", { ascending: true });
  if (error) return [];
  return data ?? [];
}

/** AI voice/natural language search. Requires Express backend (NEXT_PUBLIC_API_URL) and auth. Returns { intent, ... } per backend contract. */
export async function aiSearch(query) {
  const session = await getSession();
  const url = `${API_BASE}/api/ai-search`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getApiHeaders(session) },
    body: JSON.stringify({ query: String(query).trim().slice(0, 500) }),
  });
  const data = await parseJson(res, url);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

