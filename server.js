/**
 * Serves the frontend and handles /listings/:id so direct links don't 404.
 * GET /listings/:id -> index.html (SPA loads; client can open that listing)
 * GET /api/listings/:id -> JSON from Supabase or 404
 */
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PORT = parseInt(process.env.PORT, 10) || 3000;

const app = express();
const publicDir = path.join(__dirname, "public");

// CORS: allow Next.js frontend (e.g. localhost:3001) to fetch /api/* from this server
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "http://localhost:3001");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3001";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_AGENT_PRO_PRICE_ID = process.env.STRIPE_AGENT_PRO_PRICE_ID;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Stripe webhook: must use raw body for signature verification (before express.json())
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe not configured" });
  }
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err?.message || err}`);
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Subscription created; optionally save session.customer, session.subscription to your DB
      break;
    }
    case "invoice.paid":
      // Continue to provision access as payments recur
      break;
    case "invoice.payment_failed":
      // Notify customer, send to customer portal to update payment method
      break;
    default:
      break;
  }
  res.sendStatus(200);
});

// Parse JSON for all other routes
app.use(express.json());

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const supabaseAnon = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/** VOW compliance: verify JWT; if valid, user is authenticated and may receive VOW data. */
async function isAuthenticated(req) {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token || !supabaseAnon) return false;
  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    return !error && !!user;
  } catch {
    return false;
  }
}

/** Get the authenticated user from the request (JWT). Returns user or null. */
async function getAuthenticatedUser(req) {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token || !supabaseAnon) return null;
  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    return !error && user ? user : null;
  } catch {
    return null;
  }
}

// API: create Stripe Checkout Session for Agent Pro subscription (redirects to Stripe-hosted page). Only brokers/agents may subscribe.
app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe || !STRIPE_AGENT_PRO_PRICE_ID) {
    return res.status(503).json({ error: "Stripe or Agent Pro price not configured. Set STRIPE_SECRET_KEY and STRIPE_AGENT_PRO_PRICE_ID." });
  }
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Sign in required to subscribe to Agent Pro." });
  }
  if (user.user_metadata?.user_type !== "agent") {
    return res.status(403).json({ error: "Agent Pro is for brokers and agents only. Your account is registered as a user. Sign up as a Broker/Agent to subscribe." });
  }
  const priceId = req.body?.priceId || STRIPE_AGENT_PRO_PRICE_ID;
  const customerEmail = req.body?.customerEmail || user.email || null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/pricing?canceled=1`,
      ...(customerEmail && { customer_email: customerEmail }),
      subscription_data: {
        metadata: { plan: "agent_pro" },
      },
    });
    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to create checkout session" });
  }
});

// API: create Stripe Customer Portal session (manage subscription, payment method, cancel)
app.post("/api/create-portal-session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
  const { customerId } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId required" });
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/pricing`,
    });
    return res.json({ url: portalSession.url });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to create portal session" });
  }
});

// API: market heat analytics (list-to-sale, avg DOM, monthly time-series) for frontend
app.get("/api/analytics", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  const [listToSale, avgDom, avgDomByPrice, monthly, areaHealth] = await Promise.all([
    supabase.from("analytics_list_to_sale").select("*").order("sale_count", { ascending: false }),
    supabase.from("analytics_avg_dom").select("*").order("listing_count", { ascending: false }),
    supabase.from("analytics_avg_dom_by_price").select("*").order("listing_count", { ascending: false }),
    supabase.from("analytics_monthly").select("*").order("year_month", { ascending: true }),
    supabase.from("analytics_area_market_health").select("*").order("total_active", { ascending: false }),
  ]);
  return res.json({
    list_to_sale: listToSale.data ?? [],
    avg_dom: avgDom.data ?? [],
    avg_dom_by_price: avgDomByPrice.data ?? [],
    monthly: monthly.data ?? [],
    area_market_health: areaHealth.data ?? [],
  });
});

// API: all listings (for Explore page). Login required; 401 when not authenticated.
app.get("/api/listings", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  const auth = await isAuthenticated(req);
  if (!auth) return res.status(401).json({ error: "Login required to view listings." });
  const limit = Math.min(parseInt(req.query.limit, 10) || 400, 2000);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const { data, error } = await supabase
    .from("listings_unified")
    .select("listing_key, idx, vow, updated_at")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// API: sold/expired/terminated listings (from sold_listings). VOW data = login required.
app.get("/api/listings/sold", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  const auth = await isAuthenticated(req);
  if (!auth) return res.status(401).json({ error: "Login required to view sold listings (VOW compliance)." });
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  let { data, error } = await supabase
    .from("sold_listings")
    .select("listing_key, idx, vow, updated_at")
    .order("closed_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) {
    const fallback = await supabase.from("v_listings_sold_terminated").select("listing_key, idx, vow, updated_at").order("updated_at", { ascending: false }).limit(limit);
    if (!fallback.error) return res.json(fallback.data ?? []);
  }
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

// API: schools near a location. Tries school_locations then schools. Supports lat/lng, latitude/longitude, LATITUDE/LONGITUDE.
async function fetchSchoolsFromTable(supabase, table, lat, lng, delta) {
  let { data, error } = await supabase.from(table).select("*")
    .gte("lat", lat - delta).lte("lat", lat + delta)
    .gte("lng", lng - delta).lte("lng", lng + delta);
  if (!error?.message?.includes("column")) return { data: data ?? [], error };

  const r2 = await supabase.from(table).select("*")
    .gte("latitude", lat - delta).lte("latitude", lat + delta)
    .gte("longitude", lng - delta).lte("longitude", lng + delta);
  if (!r2.error?.message?.includes("column")) return { data: r2.data ?? [], error: r2.error };

  const r3 = await supabase.from(table).select("*")
    .gte("LATITUDE", lat - delta).lte("LATITUDE", lat + delta)
    .gte("LONGITUDE", lng - delta).lte("LONGITUDE", lng + delta);
  return { data: r3.data ?? [], error: r3.error };
}

const MAX_SCHOOL_DISTANCE_KM = 10;

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

app.get("/api/schools", async (req, res) => {
  const rawLat = parseFloat(req.query.lat);
  const rawLng = parseFloat(req.query.lng);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return res.status(400).json({ error: "Missing or invalid lat/lng" });
  }
  const { lat, lng } = normalizeSchoolCoords(rawLat, rawLng);
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });

  // Prefer accurate DB Haversine via RPC (schools table)
  const { data: rpcData, error: rpcError } = await supabase.rpc("schools_near", {
    center_lat: lat,
    center_lng: lng,
    radius_km: MAX_SCHOOL_DISTANCE_KM,
    max_count: limit,
  });
  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return res.json(rpcData.map((s) => ({ ...s, distance_km: Number(s.distance_km) })));
  }

  const delta = 0.2;
  let rows = [];
  const tryTable = async (table) => {
    const { data: r, error } = await fetchSchoolsFromTable(supabase, table, lat, lng, delta);
    return !error && r?.length ? r : [];
  };
  rows = await tryTable("school_locations");
  if (rows.length === 0) rows = await tryTable("schools");
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
  return res.json(withDist.slice(0, limit));
});

// API: single listing by id (listing_key). Login required.
app.get("/api/listings/:id", async (req, res) => {
  const id = (req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing listing id" });
  if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
  const auth = await isAuthenticated(req);
  if (!auth) return res.status(401).json({ error: "Login required to view listing." });
  const { data, error } = await supabase
    .from("listings_unified")
    .select("listing_key, idx, vow, updated_at")
    .eq("listing_key", id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Listing not found" });
  res.json(data);
});

// SPA: any /listings/:id serves index.html so the app loads and can open that listing
app.get("/listings/:id", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Static files
app.use(express.static(publicDir));

// Fallback for SPA: non-file requests get index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

function tryListen(port) {
  const maxPort = Math.min(PORT + 10, 3010);
  const server = app.listen(port, () => {
    console.log("Server at http://localhost:" + port);
    console.log("  /listings/:id -> app; /api/listings/:id -> JSON; /api/analytics -> market heat");
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port < maxPort) {
      console.warn("Port " + port + " in use, trying " + (port + 1) + "...");
      tryListen(port + 1);
    } else {
      console.error("Cannot listen:", err.message);
      process.exit(1);
    }
  });
}
tryListen(PORT);
