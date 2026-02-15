import { supabase, hasSupabase } from "./supabase";

// Backend API (optional). Set NEXT_PUBLIC_API_URL in .env.local if you use the Express server.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

const FETCH_LISTINGS_TIMEOUT_MS = 25000;

/** VOW compliance: get current session; authenticated users may receive full (idx+vow) data. */
async function getSession() {
  if (!supabase?.auth) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}

/** Fetch listings from listings_unified. Login required; no data for anonymous users. */
export async function fetchListings(options = {}) {
  const limit = Math.min(options.limit ?? 500, 2000);
  const offset = options.offset ?? 0;

  if (hasSupabase()) {
    const session = await getSession();
    if (!session) return [];
    let query = supabase
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .order("updated_at", { ascending: false });
    if (limit > 0) query = query.range(offset, offset + limit - 1);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Listings request timed out. Try fewer listings or increase Supabase statement timeout in Database settings.")), FETCH_LISTINGS_TIMEOUT_MS)
    );
    try {
      const result = await Promise.race([query, timeoutPromise]);
      const { data, error } = result;
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (e) {
      if (e?.message?.includes("timed out")) throw e;
      throw e;
    }
  }

  const session = await getSession();
  const url = `${API_BASE}/api/listings?limit=${limit}&offset=${offset}`;
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
    return parseJson(res, url);
  } catch (e) {
    clearTimeout(timeoutId);
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
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .eq("listing_key", listingKey)
      .single()
      .then(({ data }) => {
        if (data) setCachedListing(listingKey, data);
      })
      .catch(() => {});
  });
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
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .eq("listing_key", listingKey)
      .single();
    if (error || !data) return null;
    setCachedListing(listingKey, data);
    return data;
  }

  const session = await getSession();
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(`${API_BASE}/api/listings/${encodeURIComponent(listingKey)}`, { cache: "no-store", headers });
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
    if (!session) return []; // RLS: sold_listings is authenticated-only
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

  const url = `${API_BASE}/api/listings/sold?limit=${limit}`;
  const headers = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
    clearTimeout(timeoutId);
    if (res.status === 401) throw new Error("Login required to view sold listings (VOW compliance).");
    if (!res.ok) throw new Error(res.status === 503 ? "Backend not configured" : res.statusText);
    return parseJson(res, url);
  } catch (e) {
    clearTimeout(timeoutId);
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
  const res = await fetch(url, { cache: "no-store" });
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
  const res = await fetch(url, { cache: "no-store" });
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
  const res = await fetch(url, { cache: "no-store" });
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

/** Fetch schools near a location. Only returns schools within 10 km of the listing. Uses listing lat/lng for distance. */
export async function fetchSchoolsNear(lat, lng, limit = 10) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const { lat: nLat, lng: nLng } = normalizeSchoolCoords(lat, lng);
  const url = `${API_BASE}/api/schools?lat=${encodeURIComponent(nLat)}&lng=${encodeURIComponent(nLng)}&limit=${limit}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return await parseJson(res, url);
  } catch (_) {
    // Backend not available; try Supabase directly
  }
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

const API_BASE_STRIPE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/** Create a Stripe Checkout Session for Agent Pro subscription. Returns { url } to redirect to Stripe. Requires broker/agent account. */
export async function createCheckoutSession(options = {}) {
  const headers = { "Content-Type": "application/json" };
  const session = await getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(`${API_BASE_STRIPE}/api/create-checkout-session`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      priceId: options.priceId || undefined,
      customerEmail: options.customerEmail || session?.user?.email || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || res.statusText || "Failed to start checkout");
  }
  return res.json();
}

/** Create a Stripe Customer Portal session. Returns { url } to redirect. */
export async function createPortalSession(customerId) {
  const res = await fetch(`${API_BASE_STRIPE}/api/create-portal-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || res.statusText || "Failed to open billing portal");
  }
  return res.json();
}
