import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount";

const SCHOOL_TYPE_GROUPS = [
  ["school"],
  ["primary_school"],
  ["secondary_school"],
  ["university"],
  ["preschool"],
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

const labelFromLevel = (level) => {
  if (level === "preschool") return "Preschool";
  if (level === "primary_school") return "Elementary";
  if (level === "secondary_school") return "High School";
  if (level === "university") return "University / College";
  return "School";
};

const labelFromTypes = (types) => {
  const t = Array.isArray(types) ? types : [];
  if (t.includes("preschool")) return "Preschool";
  if (t.includes("primary_school")) return "Elementary";
  if (t.includes("secondary_school")) return "High School";
  if (t.includes("university")) return "University / College";
  return "School";
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
    const { data, error } = await supabase.rpc("places_schools_near", {
      center_lat: lat,
      center_lng: lng,
      radius_km: MAX_DISTANCE_KM,
      max_count: limit,
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data.map((s) => ({
      id: s.place_id,
      name: s.name,
      type: labelFromLevel(s.level),
      address: s.address,
      city: s.city,
      province: s.province,
      lat: s.lat,
      lng: s.lng,
      distance_km: Number(s.distance_km),
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
    return NextResponse.json({ error: "Schools API not configured." }, { status: 503 });
  }

  try {
    const allPlaces = (await Promise.all(
      SCHOOL_TYPE_GROUPS.map((types) => fetchTypeFromGoogle(apiKey, lat, lng, types))
    )).flat();

    const seen = new Set();
    const schools = allPlaces
      .filter((p) => {
        if (!p.location?.latitude || !p.location?.longitude) return false;
        const key = p.id || `${p.location.latitude},${p.location.longitude}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => {
        const placeId = (p.id || "").replace(/^places\//, "") || `school-${p.location.latitude}-${p.location.longitude}`;
        const name = p.displayName?.text || p.displayName || "School";
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
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
        };
      })
      .filter((s) => s.distance_km <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    // Save to Supabase in the background (fire and forget)
    const supabase = getSupabase();
    if (supabase && schools.length > 0) {
      const rows = schools.map((s) => ({
        place_id: s.id,
        name: s.name,
        level: s.type === "Elementary" ? "primary_school" : s.type === "High School" ? "secondary_school" : s.type === "University / College" ? "university" : s.type === "Preschool" ? "preschool" : "school",
        address: s.address,
        city: s.city,
        province: s.province,
        lat: s.lat,
        lng: s.lng,
        updated_at: new Date().toISOString(),
      }));
      supabase.from("places_schools").upsert(rows, { onConflict: "place_id" }).then(() => {});
    }

    return NextResponse.json(schools);
  } catch (err) {
    return NextResponse.json({ error: "Schools fetch failed." }, { status: 500 });
  }
}
