/**
 * Backfill Latitude/Longitude for listings that have an address but no coordinates.
 * Uses Google Geocoding API. Updates listings_unified.idx (trigger syncs listings_unified_clean).
 * Run after sync; then reload the map to see pinpoints with prices.
 *
 * Usage: Set GEOCODING_API_KEY or GOOGLE_PLACES_API_KEY in .env, then:
 *   npm run geocode-listings   or   node geocodeListingsMissingCoords.js
 *
 * Optional .env: GEOCODE_BATCH_SIZE=50, GEOCODE_DELAY_MS=200
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const GEOCODING_API_KEY =
  process.env.GEOCODING_API_KEY?.trim() ||
  process.env.GOOGLE_PLACES_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!GEOCODING_API_KEY) {
  console.error("Set GEOCODING_API_KEY (or GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY) in .env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE_SIZE = 500;
const DELAY_MS = Math.max(100, parseInt(process.env.GEOCODE_DELAY_MS, 10) || 200);
const MAX_TO_PROCESS = Math.min(Math.max(parseInt(process.env.GEOCODE_BATCH_SIZE, 10) || 0, 0), 10000) || 5000;

function hasCoords(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const lat = idx.Latitude ?? vow.Latitude ?? idx.latitude ?? vow.latitude;
  const lng = idx.Longitude ?? vow.Longitude ?? idx.longitude ?? vow.longitude;
  if (lat == null || lng == null) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && nLat >= -90 && nLat <= 90 && Number.isFinite(nLng) && nLng >= -180 && nLng <= 180;
}

function buildAddress(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const merged = { ...vow, ...idx };
  const streetParts = [
    merged.StreetNumber,
    merged.StreetDirPrefix,
    merged.StreetName,
    merged.StreetSuffix,
    merged.StreetDirSuffix,
  ].filter(Boolean);
  const street = streetParts.join(" ").trim();
  const city = merged.City ? String(merged.City).trim() : null;
  const province = merged.StateOrProvince || merged.Province || merged.State;
  const postal = merged.PostalCode ? String(merged.PostalCode).trim() : null;
  const parts = [street, city, province, postal].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY.trim()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    if (data.status === "OVER_QUERY_LIMIT") throw new Error("Geocoding rate limit hit. Increase GEOCODE_DELAY_MS or run later.");
    return null;
  }
  const first = data.results?.[0];
  if (!first?.geometry?.location) return null;
  const { lat, lng } = first.geometry.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log("Loading listings_unified (missing coordinates only)...");
  const missing = [];
  let page = 0;
  while (missing.length < MAX_TO_PROCESS) {
    const { data, error } = await supabase
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      console.error("Supabase error:", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    for (const row of data) {
      if (!hasCoords(row) && buildAddress(row)) missing.push(row);
      if (missing.length >= MAX_TO_PROCESS) break;
    }
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log("Found", missing.length, "listings with address but no coordinates (max processed:", MAX_TO_PROCESS, ").");
  if (missing.length === 0) {
    console.log("Nothing to geocode. Exiting.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < missing.length; i++) {
    const row = missing[i];
    const address = buildAddress(row);
    if (!address) continue;
    try {
      const coords = await geocode(address);
      await sleep(DELAY_MS);
      if (!coords) {
        fail++;
        if (fail <= 5) console.warn("  No result for:", address.slice(0, 60) + "...");
        continue;
      }
      const idx = { ...(row.idx || {}), Latitude: coords.lat, Longitude: coords.lng };
      const { error } = await supabase
        .from("listings_unified")
        .update({ idx, updated_at: new Date().toISOString() })
        .eq("listing_key", row.listing_key);
      if (error) {
        fail++;
        if (fail <= 5) console.error("  Update error:", error.message, row.listing_key);
      } else {
        ok++;
      }
    } catch (e) {
      fail++;
      console.error("  Error for", row.listing_key, e.message);
      if (e.message && e.message.includes("rate limit")) throw e;
    }
    if ((i + 1) % 50 === 0) console.log("  Progress:", i + 1, "/", missing.length, "—", ok, "updated,", fail, "failed.");
  }
  console.log("Done. Updated:", ok, "Failed:", fail);
  if (ok > 0) console.log("Trigger will sync listings_unified_clean. Reload the explore map to see pinpoints with prices.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
