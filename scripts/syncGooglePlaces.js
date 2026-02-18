/**
 * Fetch schools (all levels) and transportation from Google Places API and save to Supabase.
 * Uses: GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: GOOGLE_PLACES_CENTERS="lat1,lng1|lat2,lng2" (default: Toronto 43.65,-79.38).
 *
 * Run: node scripts/syncGooglePlaces.js
 * Set your API key in .env — never commit the key. Enable Places API (New) in Google Cloud.
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType";
const RADIUS_METERS = 15000;
const MAX_RESULTS = 20;
const DELAY_MS = 200;

const SCHOOL_TYPES = [
  "preschool",
  "primary_school",
  "secondary_school",
  "school",
  "university",
  "educational_institution",
];

const TRANSPORT_TYPES = [
  "transit_station",
  "bus_station",
  "train_station",
  "subway_station",
  "light_rail_station",
  "bus_stop",
];

const CANADA_CITY_CENTERS = [
  { latitude: 43.65, longitude: -79.38, name: "Toronto" },
  { latitude: 43.68, longitude: -79.61, name: "Toronto W (Etobicoke)" },
  { latitude: 43.78, longitude: -79.19, name: "Toronto E (Scarborough)" },
  { latitude: 43.85, longitude: -79.44, name: "North York" },
  { latitude: 43.59, longitude: -79.64, name: "Mississauga" },
  { latitude: 43.69, longitude: -79.87, name: "Brampton" },
  { latitude: 43.46, longitude: -79.69, name: "Oakville / Burlington" },
  { latitude: 43.25, longitude: -79.87, name: "Hamilton" },
  { latitude: 43.90, longitude: -79.26, name: "Markham" },
  { latitude: 44.06, longitude: -79.46, name: "Newmarket / Aurora" },
  { latitude: 43.52, longitude: -79.87, name: "Milton" },
  { latitude: 43.37, longitude: -80.31, name: "Kitchener / Waterloo" },
  { latitude: 43.55, longitude: -80.25, name: "Guelph" },
  { latitude: 43.01, longitude: -81.23, name: "London" },
  { latitude: 42.98, longitude: -79.25, name: "Niagara / St. Catharines" },
  { latitude: 44.23, longitude: -76.49, name: "Kingston" },
  { latitude: 44.36, longitude: -78.74, name: "Peterborough" },
  { latitude: 44.39, longitude: -79.69, name: "Barrie" },
  { latitude: 45.42, longitude: -75.69, name: "Ottawa" },
  { latitude: 45.50, longitude: -73.57, name: "Montreal" },
  { latitude: 45.38, longitude: -73.75, name: "Montreal W (Lachine)" },
  { latitude: 45.55, longitude: -73.43, name: "Montreal E (Anjou)" },
  { latitude: 45.53, longitude: -73.65, name: "Laval" },
  { latitude: 45.58, longitude: -73.45, name: "Longueuil" },
  { latitude: 46.81, longitude: -71.21, name: "Quebec City" },
  { latitude: 45.40, longitude: -71.89, name: "Sherbrooke" },
  { latitude: 46.35, longitude: -72.55, name: "Trois-Rivières" },
  { latitude: 49.28, longitude: -123.12, name: "Vancouver" },
  { latitude: 49.23, longitude: -123.00, name: "Burnaby" },
  { latitude: 49.19, longitude: -122.85, name: "Surrey" },
  { latitude: 49.14, longitude: -122.33, name: "Langley / Abbotsford" },
  { latitude: 49.32, longitude: -123.07, name: "North Vancouver" },
  { latitude: 49.21, longitude: -122.91, name: "New Westminster / Coquitlam" },
  { latitude: 49.17, longitude: -123.14, name: "Richmond" },
  { latitude: 48.43, longitude: -123.37, name: "Victoria" },
  { latitude: 49.88, longitude: -119.50, name: "Kelowna" },
  { latitude: 50.67, longitude: -120.34, name: "Kamloops" },
  { latitude: 51.05, longitude: -114.07, name: "Calgary" },
  { latitude: 51.08, longitude: -114.22, name: "Calgary W" },
  { latitude: 51.12, longitude: -113.93, name: "Calgary NE" },
  { latitude: 53.55, longitude: -113.49, name: "Edmonton" },
  { latitude: 53.52, longitude: -113.62, name: "Edmonton W" },
  { latitude: 52.27, longitude: -113.81, name: "Red Deer" },
  { latitude: 50.40, longitude: -105.53, name: "Regina" },
  { latitude: 52.13, longitude: -106.67, name: "Saskatoon" },
  { latitude: 49.88, longitude: -97.15, name: "Winnipeg" },
  { latitude: 46.09, longitude: -64.77, name: "Moncton" },
  { latitude: 45.27, longitude: -66.06, name: "Saint John" },
  { latitude: 44.65, longitude: -63.57, name: "Halifax" },
  { latitude: 46.24, longitude: -63.13, name: "Charlottetown" },
  { latitude: 47.56, longitude: -52.71, name: "St. John's" },
];

function parseCenters(envValue) {
  if (!envValue || typeof envValue !== "string") return CANADA_CITY_CENTERS;
  return envValue
    .split("|")
    .map((s) => {
      const [lat, lng] = s.trim().split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { latitude: lat, longitude: lng };
    })
    .filter(Boolean);
}

async function searchNearby(apiKey, center, includedTypes) {
  const res = await fetch(PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: center.latitude, longitude: center.longitude },
          radius: RADIUS_METERS,
        },
      },
      includedTypes: includedTypes.length ? includedTypes : ["school"],
      maxResultCount: MAX_RESULTS,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.places || [];
}

function extractPlaceId(idOrName) {
  if (!idOrName) return null;
  const s = String(idOrName);
  if (s.startsWith("places/")) return s.replace("places/", "");
  return s;
}

function schoolLevel(types) {
  const t = Array.isArray(types) ? types : [];
  if (t.includes("preschool")) return "preschool";
  if (t.includes("primary_school")) return "primary_school";
  if (t.includes("secondary_school")) return "secondary_school";
  if (t.includes("university")) return "university";
  if (t.includes("educational_institution")) return "educational_institution";
  if (t.includes("school")) return "school";
  return t[0] || "school";
}

function transportType(types) {
  const t = Array.isArray(types) ? types : [];
  const prefer = ["subway_station", "train_station", "light_rail_station", "bus_station", "transit_station", "bus_stop"];
  for (const p of prefer) {
    if (t.includes(p)) return p;
  }
  return t[0] || "transit_station";
}

function parseAddress(formattedAddress) {
  if (!formattedAddress) return { address: null, city: null, province: null };
  const parts = formattedAddress.split(",").map((s) => s.trim());
  const address = parts[0] || null;
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  const province = parts.length >= 1 ? parts[parts.length - 1] : null;
  return { address, city, province };
}

async function run() {
  if (!GOOGLE_API_KEY) {
    console.error("Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY in .env (do not commit the key).");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const centers = parseCenters(process.env.GOOGLE_PLACES_CENTERS);
  console.log("Centers:", centers.length, "| Radius:", RADIUS_METERS / 1000, "km");

  const allSchools = new Map();
  const allTransport = new Map();

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const center of centers) {
    console.log("Fetching schools near", center.latitude.toFixed(2), center.longitude.toFixed(2), "...");
    try {
      const places = await searchNearby(GOOGLE_API_KEY, center, SCHOOL_TYPES);
      for (const p of places) {
        const placeId = extractPlaceId(p.id);
        if (!placeId) continue;
        const name = p.displayName?.text || p.displayName || "School";
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const types = p.types || [];
        const { address, city, province } = parseAddress(p.formattedAddress);
        allSchools.set(placeId, {
          place_id: placeId,
          name,
          level: schoolLevel(types),
          address,
          city,
          province,
          lat,
          lng,
          types_json: types.length ? types : null,
          updated_at: new Date().toISOString(),
        });
      }
      console.log("  Schools this center:", places.length);
    } catch (e) {
      console.error("  Schools error:", e.message);
    }
    await delay(DELAY_MS);

    console.log("Fetching transport near", center.latitude.toFixed(2), center.longitude.toFixed(2), "...");
    try {
      const places = await searchNearby(GOOGLE_API_KEY, center, TRANSPORT_TYPES);
      for (const p of places) {
        const placeId = extractPlaceId(p.id);
        if (!placeId) continue;
        const name = p.displayName?.text || p.displayName || "Transit";
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const types = p.types || [];
        const { address, city, province } = parseAddress(p.formattedAddress);
        allTransport.set(placeId, {
          place_id: placeId,
          name,
          transport_type: transportType(types),
          address,
          city,
          province,
          lat,
          lng,
          types_json: types.length ? types : null,
          updated_at: new Date().toISOString(),
        });
      }
      console.log("  Transport this center:", places.length);
    } catch (e) {
      console.error("  Transport error:", e.message);
    }
    await delay(DELAY_MS);
  }

  const schoolRows = [...allSchools.values()];
  const transportRows = [...allTransport.values()];

  if (schoolRows.length > 0) {
    const { error } = await supabase.from("places_schools").upsert(schoolRows, { onConflict: "place_id" });
    if (error) console.error("places_schools upsert error:", error.message);
    else console.log("Saved to Supabase places_schools:", schoolRows.length);
  } else {
    console.log("No schools to save.");
  }
  if (transportRows.length > 0) {
    const { error } = await supabase.from("places_transport").upsert(transportRows, { onConflict: "place_id" });
    if (error) console.error("places_transport upsert error:", error.message);
    else console.log("Saved to Supabase places_transport:", transportRows.length);
  } else {
    console.log("No transport to save.");
  }

  console.log("Done. Tables: places_schools, places_transport.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
