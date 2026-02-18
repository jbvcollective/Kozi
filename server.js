import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import * as aiSearch from "./services/aiSearch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:3001";
const PORT = parseInt(process.env.PORT, 10) || 3000;
const BODY_LIMIT = process.env.BODY_LIMIT || "256kb";
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 30000;
const API_KEY = process.env.API_KEY;

const requiredEnv = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
];
for (const [name, value] of requiredEnv) {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    console.error(`Fatal: ${name} is required. Set it in .env.`);
    process.exit(1);
  }
}

const allowedOrigins = CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
if (allowedOrigins.length === 0) allowedOrigins.push("http://localhost:3001");

const app = express();
app.disable("x-powered-by");
const publicDir = path.join(__dirname, "public");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3001";

const LISTINGS_SELECT_COLS = "listing_key, idx, vow, updated_at";
const MAX_LISTINGS_LIMIT = 5000;
const MAX_PAGINATION_LIMIT = 1000;
const ANALYTICS_ROW_LIMIT = 2000;
const RAPID_PAGINATION_MS = 400;
const paginationLastReq = new Map();

function logSuspicious(msg, req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  console.warn(`[suspicious] ${msg} ip=${ip} path=${req.path}`);
}

function safeSupabaseError() {
  return isProd ? "A server error occurred." : "Database error.";
}

app.use(helmet({ contentSecurityPolicy: isProd }));
app.use(compression());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
    credentials: true,
  })
);

app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {});
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {});
  next();
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
});
app.use("/api", globalLimiter);

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
});

if (API_KEY) {
  app.use("/api", (req, res, next) => {
    const key = req.headers["x-api-key"];
    if (key === API_KEY) return next();
    res.status(401).json({ error: "Unauthorized" });
  });
}

app.use(express.json({ limit: BODY_LIMIT, strict: true }));

async function isAuthenticated(req) {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return false;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return !error && !!user;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser(req) {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return !error && user ? user : null;
  } catch {
    return null;
  }
}

const listingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LISTINGS_LIMIT).default(MAX_LISTINGS_LIMIT),
});

const soldListingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LISTINGS_LIMIT).default(MAX_LISTINGS_LIMIT),
});

const schoolsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const listingIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.-]+$/);

app.get("/api/listings", strictLimiter, async (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress;
  const now = Date.now();
  const last = paginationLastReq.get(ip);
  if (last && now - last < RAPID_PAGINATION_MS) {
    logSuspicious("Rapid pagination", req);
  }
  paginationLastReq.set(ip, now);
  setTimeout(() => paginationLastReq.delete(ip), 60000);

  const parsed = listingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(isProd ? { error: "Invalid query" } : { error: "Invalid query", details: parsed.error.flatten() });
  }
  const { page, limit } = parsed.data;
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: "Login required to view listings." });
  }

  const offset = (page - 1) * limit;
  const from = offset;
  const to = offset + limit - 1;

  try {
    const { data, error } = await supabase
      .from("listings_unified_clean")
      .select(LISTINGS_SELECT_COLS)
      .order("updated_at", { ascending: false })
      .range(from, to)
      .limit(limit);
    if (error) {
      return res.status(500).json({ error: safeSupabaseError() });
    }
    res.json({
      data: data ?? [],
      page,
      limit,
    });
  } catch {
    res.status(500).json({ error: safeSupabaseError() });
  }
});

app.get("/api/listings/sold", strictLimiter, async (req, res, next) => {
  const parsed = soldListingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(isProd ? { error: "Invalid query" } : { error: "Invalid query", details: parsed.error.flatten() });
  }
  const { page, limit } = parsed.data;
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: "Login required to view sold listings." });
  }

  const offset = (page - 1) * limit;
  try {
    let { data, error } = await supabase
      .from("sold_listings")
      .select(LISTINGS_SELECT_COLS)
      .order("closed_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)
      .limit(limit);
    if (error || !data?.length) {
      const fallback = await supabase
        .from("v_listings_sold_terminated")
        .select(LISTINGS_SELECT_COLS)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1)
        .limit(limit);
      if (!fallback.error) {
        return res.json({ data: fallback.data ?? [], page, limit });
      }
    }
    if (error) return res.status(500).json({ error: safeSupabaseError() });
    res.json({ data: data ?? [], page, limit });
  } catch {
    res.status(500).json({ error: safeSupabaseError() });
  }
});

app.get("/api/listings/:id", strictLimiter, async (req, res) => {
  const parsed = listingIdSchema.safeParse((req.params.id || "").trim());
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid listing id" });
  }
  const id = parsed.data;
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: "Login required to view listing." });
  }
  try {
    const { data, error } = await supabase
      .from("listings_unified_clean")
      .select(LISTINGS_SELECT_COLS)
      .eq("listing_key", id)
      .limit(1)
      .single();
    if (error || !data) return res.status(404).json({ error: "Listing not found" });
    res.json(data);
  } catch {
    res.status(500).json({ error: safeSupabaseError() });
  }
});

app.get("/api/analytics", strictLimiter, async (req, res) => {
  try {
    const [listToSale, avgDom, avgDomByPrice, monthly, areaHealth] = await Promise.all([
      supabase.from("analytics_list_to_sale").select("area_type, area_value, list_to_sale_ratio, sale_count, updated_at").order("sale_count", { ascending: false }).limit(ANALYTICS_ROW_LIMIT),
      supabase.from("analytics_avg_dom").select("city_region, property_sub_type, avg_dom, listing_count, updated_at").order("listing_count", { ascending: false }).limit(ANALYTICS_ROW_LIMIT),
      supabase.from("analytics_avg_dom_by_price").select("area_type, area_value, price_bracket, avg_dom, listing_count, updated_at").order("listing_count", { ascending: false }).limit(ANALYTICS_ROW_LIMIT),
      supabase.from("analytics_monthly").select("year_month, sold_count, new_listings_count, active_count, median_sold_price, avg_dom, updated_at").order("year_month", { ascending: true }).limit(ANALYTICS_ROW_LIMIT),
      supabase.from("analytics_area_market_health").select("*").order("total_active", { ascending: false }).limit(ANALYTICS_ROW_LIMIT),
    ]);
    const hasError = [listToSale, avgDom, avgDomByPrice, monthly, areaHealth].some((r) => r.error);
    if (hasError) return res.status(500).json({ error: safeSupabaseError() });
    res.json({
      list_to_sale: listToSale.data ?? [],
      avg_dom: avgDom.data ?? [],
      avg_dom_by_price: avgDomByPrice.data ?? [],
      monthly: monthly.data ?? [],
      area_market_health: areaHealth.data ?? [],
    });
  } catch {
    res.status(500).json({ error: safeSupabaseError() });
  }
});

const aiSearchBodySchema = z.object({ query: z.string().min(1).max(500).trim() });

app.post("/api/ai-search", strictLimiter, async (req, res) => {
  const parsed = aiSearchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(isProd ? { error: "Invalid request" } : { error: "Invalid request", details: parsed.error.flatten() });
  }
  if (!(await isAuthenticated(req))) {
    return res.status(401).json({ error: "Login required for AI search." });
  }
  const { query } = parsed.data;
  try {
    const classified = await aiSearch.classifyIntent(query);
    if (classified.error) {
      return res.status(400).json({ error: classified.error });
    }
    const { intent, ...rest } = classified.data;
    if (intent === "search") {
      const filters = rest.filters ?? {};
      const result = await aiSearch.runSearch(supabase, filters);
      if (result.error) return res.status(500).json({ error: isProd ? safeSupabaseError() : result.error });
      return res.json({ intent: "search", count: result.count, listings: result.listings ?? [] });
    }
    if (intent === "market_info") {
      const market = await aiSearch.getMarketInfo(supabase, rest.topic ?? "", rest.city ?? null);
      if (market.error) return res.status(500).json({ error: isProd ? safeSupabaseError() : market.error });
      return res.json({ intent: "market_info", topic: rest.topic, city: rest.city ?? null, answer: market.answer });
    }
    if (intent === "real_estate_question") {
      const ans = await aiSearch.answerRealEstateQuestion(rest.question ?? query);
      if (ans.error) return res.status(500).json({ error: isProd ? safeSupabaseError() : ans.error });
      return res.json({ intent: "real_estate_question", question: rest.question ?? query, answer: ans.answer });
    }
    if (intent === "clarification_needed") {
      return res.json({ intent: "clarification_needed", question: rest.question ?? "Can you tell me more about what you're looking for?" });
    }
    return res.status(400).json({ error: "Unknown intent" });
  } catch (e) {
    if (!isProd && e?.message) console.error("[ai-search]", e.message);
    res.status(500).json({ error: safeSupabaseError() });
  }
});

const MAX_SCHOOL_DISTANCE_KM = 10;

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

async function fetchSchoolsFromTable(sb, table, lat, lng, delta) {
  const cols = "id, name, type, address, city, province, lat, lng";
  let { data, error } = await sb.from(table).select(cols).gte("lat", lat - delta).lte("lat", lat + delta).gte("lng", lng - delta).lte("lng", lng + delta).limit(100);
  if (!error?.message?.includes("column")) return { data: data ?? [], error };
  const r2 = await sb.from(table).select(cols).gte("latitude", lat - delta).lte("latitude", lat + delta).gte("longitude", lng - delta).lte("longitude", lng + delta).limit(100);
  if (!r2.error?.message?.includes("column")) return { data: r2.data ?? [], error: r2.error };
  const r3 = await sb.from(table).select(cols).gte("LATITUDE", lat - delta).lte("LATITUDE", lat + delta).gte("LONGITUDE", lng - delta).lte("LONGITUDE", lng + delta).limit(100);
  return { data: r3.data ?? [], error: r3.error };
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const SCHOOL_TYPES = ["preschool", "primary_school", "secondary_school", "school", "university", "educational_institution"];

async function fetchSchoolsFromGooglePlaces(apiKey, lat, lng, limit = 20) {
  const res = await fetch(PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 10000,
        },
      },
      includedTypes: SCHOOL_TYPES,
      maxResultCount: Math.min(limit, 20),
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const places = data.places || [];
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };
  const levelFromTypes = (types) => {
    const t = Array.isArray(types) ? types : [];
    if (t.includes("preschool")) return "preschool";
    if (t.includes("primary_school")) return "primary_school";
    if (t.includes("secondary_school")) return "secondary_school";
    if (t.includes("university")) return "university";
    if (t.includes("educational_institution")) return "educational_institution";
    return t.includes("school") ? "school" : "school";
  };
  const parseAddr = (formattedAddress) => {
    if (!formattedAddress) return { address: null, city: null, province: null };
    const parts = formattedAddress.split(",").map((s) => s.trim());
    return {
      address: parts[0] || null,
      city: parts.length >= 2 ? parts[parts.length - 2] : null,
      province: parts.length >= 1 ? parts[parts.length - 1] : null,
    };
  };
  return places
    .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => {
      const placeId = (p.id || "").replace(/^places\//, "") || `school-${p.location.latitude}-${p.location.longitude}`;
      const name = p.displayName?.text || p.displayName || "School";
      const latP = p.location.latitude;
      const lngP = p.location.longitude;
      const { address, city, province } = parseAddr(p.formattedAddress);
      return {
        id: placeId,
        name: String(name),
        type: levelFromTypes(p.types || []),
        address,
        city,
        province,
        lat: latP,
        lng: lngP,
        distance_km: haversineKm(lat, lng, latP, lngP),
      };
    })
    .filter((s) => s.distance_km <= MAX_SCHOOL_DISTANCE_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}

app.get("/api/schools", strictLimiter, async (req, res) => {
  const parsed = schoolsQuerySchema.safeParse({
    lat: req.query.lat ?? req.query.latitude ?? req.query.LATITUDE,
    lng: req.query.lng ?? req.query.longitude ?? req.query.LONGITUDE,
    limit: req.query.limit,
  });
  if (!parsed.success) {
    return res.status(400).json(isProd ? { error: "Invalid query" } : { error: "Invalid query", details: parsed.error.flatten() });
  }
  const { lat: rawLat, lng: rawLng, limit } = parsed.data;
  const { lat, lng } = normalizeSchoolCoords(rawLat, rawLng);

  if (GOOGLE_PLACES_API_KEY) {
    try {
      const fromGoogle = await fetchSchoolsFromGooglePlaces(GOOGLE_PLACES_API_KEY, lat, lng, limit);
      if (fromGoogle && fromGoogle.length > 0) return res.json(fromGoogle);
    } catch (_) {
      // fall through to Supabase
    }
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("schools_near", {
      center_lat: lat,
      center_lng: lng,
      radius_km: MAX_SCHOOL_DISTANCE_KM,
      max_count: limit,
    });
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return res.json(rpcData.map((s) => ({ ...s, distance_km: Number(s.distance_km) })));
    }
  } catch {
    return res.status(500).json({ error: safeSupabaseError() });
  }

  const delta = 0.2;
  let rows = [];
  const tryTable = async (table) => {
    const { data: r, error } = await fetchSchoolsFromTable(supabase, table, lat, lng, delta);
    return !error && r?.length ? r : [];
  };
  rows = await tryTable("school_locations");
  if (rows.length === 0) rows = await tryTable("schools");
  if (rows.length === 0) {
    const { data: placesData, error: placesErr } = await supabase.rpc("places_schools_near", {
      center_lat: lat,
      center_lng: lng,
      radius_km: MAX_SCHOOL_DISTANCE_KM,
      max_count: limit,
    });
    if (!placesErr && Array.isArray(placesData) && placesData.length > 0) {
      return res.json(
        placesData.map((s) => ({
          id: s.place_id,
          name: s.name,
          type: s.level ?? "school",
          address: s.address,
          city: s.city,
          province: s.province,
          lat: s.lat,
          lng: s.lng,
          distance_km: Number(s.distance_km ?? s.d ?? 0),
        }))
      );
    }
  }
  const norm = (s) => {
    const slat = s.lat ?? s.latitude ?? s.LATITUDE;
    const slng = s.lng ?? s.longitude ?? s.LONGITUDE;
    const name = s.name ?? s.NAME ?? s.school_name ?? s.schoolname ?? "School";
    return {
      id: s.id ?? s._id ?? s.OBJECTID ?? s.GEO_ID ?? s.school_id ?? `${name}-${slat}-${slng}`,
      name: String(name ?? "School"),
      type: s.type ?? s.SCHOOL_TYPE ?? s.SCHOOL_LEVEL ?? s.school_type ?? s.SCHOOL_TYPE_DESC ?? null,
      address: s.address ?? s.ADDRESS_FULL ?? s.SOURCE_ADDRESS ?? s.LINEAR_NAME_FULL ?? s.street ?? null,
      city: s.city ?? s.CITY ?? s.MUNICIPALITY ?? s.PLACE_NAME ?? null,
      province: s.province ?? s.state ?? null,
      lat: slat,
      lng: slng,
    };
  };
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };
  const withDist = rows
    .map((s) => {
      const n = norm(s);
      if (n.lat == null || n.lng == null) return null;
      return { ...n, distance_km: haversineKm(lat, lng, n.lat, n.lng) };
    })
    .filter(Boolean)
    .filter((s) => s.distance_km <= MAX_SCHOOL_DISTANCE_KM);
  withDist.sort((a, b) => a.distance_km - b.distance_km);
  res.json(withDist.slice(0, limit));
});

app.get("/listings/:id", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use(express.static(publicDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, req, res, next) => {
  if (err.message === "CORS not allowed") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (err.status === 429) {
    return res.status(429).json({ error: "Too many requests" });
  }
  const status = err.statusCode || err.status || 500;
  const message = isProd ? "An error occurred." : (err.message || "Internal server error");
  if (!isProd && err.stack) console.error(err.stack);
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
  console.log("Server at http://localhost:" + PORT);
});

server.on("error", (err) => {
  console.error("Cannot listen:", err.message);
  process.exit(1);
});

server.setTimeout(REQUEST_TIMEOUT_MS || 30000);
