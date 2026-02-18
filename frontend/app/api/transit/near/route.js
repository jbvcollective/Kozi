import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types";

const TRANSIT_TYPE_GROUPS = [
  ["subway_station"],
  ["train_station"],
  ["bus_station"],
  ["light_rail_station"],
  ["transit_station"],
  ["airport"],
];

const MAX_DISTANCE_KM = 15;
const SEARCH_RADIUS_M = 15000;
const PER_TYPE_MAX = 20;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};

const labelFromTransportType = (tt) => {
  if (tt === "subway_station") return "Subway";
  if (tt === "light_rail_station") return "Light Rail";
  if (tt === "train_station") return "Train";
  if (tt === "bus_station" || tt === "bus_stop") return "Bus";
  if (tt === "airport") return "Airport";
  return "Transit";
};

const labelFromTypes = (types) => {
  const t = Array.isArray(types) ? types : [];
  if (t.includes("subway_station")) return "Subway";
  if (t.includes("light_rail_station")) return "Light Rail";
  if (t.includes("train_station")) return "Train";
  if (t.includes("bus_station")) return "Bus";
  if (t.includes("airport")) return "Airport";
  if (t.includes("transit_station")) return "Transit";
  return "Transit";
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

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function fetchFromSupabase(lat, lng, limit) {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("places_transport_near", {
      center_lat: lat,
      center_lng: lng,
      radius_km: MAX_DISTANCE_KM,
      max_count: limit,
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data.map((t) => ({
      id: t.place_id,
      name: t.name,
      type: labelFromTransportType(t.transport_type),
      address: t.address,
      city: t.city,
      province: t.province,
      lat: t.lat,
      lng: t.lng,
      distance_km: Number(t.distance_km),
    }));
  } catch { return null; }
}

async function fetchTypeFromGoogle(apiKey, lat, lng, includedTypes) {
  try {
    const res = await fetch(PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: SEARCH_RADIUS_M },
        },
        includedTypes,
        maxResultCount: PER_TYPE_MAX,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.places || [];
  } catch { return []; }
}

function typesToTransportType(types) {
  const t = Array.isArray(types) ? types : [];
  if (t.includes("subway_station")) return "subway_station";
  if (t.includes("light_rail_station")) return "light_rail_station";
  if (t.includes("train_station")) return "train_station";
  if (t.includes("bus_station")) return "bus_station";
  if (t.includes("airport")) return "airport";
  return "transit_station";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lng = parseFloat(searchParams.get("lng"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid lat or lng." }, { status: 400 });
  }

  // Try Supabase cache first (fast, no API cost)
  const cached = await fetchFromSupabase(lat, lng, limit);
  if (cached && cached.length > 0) {
    return NextResponse.json(cached);
  }

  // Fall back to Google Places API (live)
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Transit API not configured." }, { status: 503 });
  }

  try {
    const allPlaces = (await Promise.all(
      TRANSIT_TYPE_GROUPS.map((types) => fetchTypeFromGoogle(apiKey, lat, lng, types))
    )).flat();

    const seen = new Set();
    const stops = allPlaces
      .filter((p) => {
        if (!p.location?.latitude || !p.location?.longitude) return false;
        const key = p.id || `${p.location.latitude},${p.location.longitude}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => {
        const placeId = (p.id || "").replace(/^places\//, "") || `transit-${p.location.latitude}-${p.location.longitude}`;
        const name = p.displayName?.text || p.displayName || "Transit Stop";
        const latP = p.location.latitude;
        const lngP = p.location.longitude;
        const { address, city, province } = parseAddr(p.formattedAddress);
        return {
          id: placeId,
          name: String(name),
          type: labelFromTypes(p.types || []),
          address,
          city,
          province,
          lat: latP,
          lng: lngP,
          distance_km: haversineKm(lat, lng, latP, lngP),
          _rawTypes: p.types || [],
        };
      })
      .filter((s) => s.distance_km <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    // Save to Supabase in the background (fire and forget)
    const supabase = getSupabase();
    if (supabase && stops.length > 0) {
      const rows = stops.map((s) => ({
        place_id: s.id,
        name: s.name,
        transport_type: typesToTransportType(s._rawTypes),
        address: s.address,
        city: s.city,
        province: s.province,
        lat: s.lat,
        lng: s.lng,
        updated_at: new Date().toISOString(),
      }));
      supabase.from("places_transport").upsert(rows, { onConflict: "place_id" }).then(() => {});
    }

    const result = stops.map(({ _rawTypes, ...rest }) => rest);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Transit fetch failed." }, { status: 500 });
  }
}
