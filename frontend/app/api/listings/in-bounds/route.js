import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backendUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const geocodingKey =
  process.env.GEOCODING_API_KEY?.trim() ||
  process.env.GOOGLE_PLACES_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const LISTINGS_SELECT_COLS = "listing_key, idx, vow, updated_at";
const GEOCODE_MAX = Math.min(parseInt(process.env.GEOCODE_MAX_PER_REQUEST, 10) || 30, 50);
const GEOCODE_DELAY_MS = Math.max(50, parseInt(process.env.GEOCODE_DELAY_MS, 10) || 120);

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

function buildAddressFromRow(row) {
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

async function geocodeAddress(address, apiKey) {
  if (!apiKey || !address || typeof address !== "string" || !address.trim()) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return null;
    const first = data.results?.[0];
    if (!first?.geometry?.location) return null;
    const { lat, lng } = first.geometry.location;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRowCommercial(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const t = String(idx.PropertyType || idx.PropertySubType || vow.PropertyType || vow.PropertySubType || "").toLowerCase();
  return t.includes("commercial");
}

function filterRowsByType(rows, type) {
  if (!type || type === "all") return rows;
  if (type === "commercial") return rows.filter(isRowCommercial);
  if (type === "residential") return rows.filter((r) => !isRowCommercial(r));
  return rows;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Login required to view listings." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const minLat = searchParams.get("minLat");
  const maxLat = searchParams.get("maxLat");
  const minLng = searchParams.get("minLng");
  const maxLng = searchParams.get("maxLng");
  const limitParam = searchParams.get("limit");
  const type = searchParams.get("type") || "all";
  const limit = Math.min(parseInt(limitParam, 10) || 500, 1000);
  const minLatN = minLat != null ? Number(minLat) : NaN;
  const maxLatN = maxLat != null ? Number(maxLat) : NaN;
  const minLngN = minLng != null ? Number(minLng) : NaN;
  const maxLngN = maxLng != null ? Number(maxLng) : NaN;
  if (
    !Number.isFinite(minLatN) || !Number.isFinite(maxLatN) || !Number.isFinite(minLngN) || !Number.isFinite(maxLngN) ||
    minLatN >= maxLatN ||
    minLngN >= maxLngN
  ) {
    return NextResponse.json({ error: "Invalid query. minLat, maxLat, minLng, maxLng required and min < max." }, { status: 400 });
  }

  if (backendUrl) {
    const q = new URLSearchParams({
      minLat: String(minLatN),
      maxLat: String(maxLatN),
      minLng: String(minLngN),
      maxLng: String(maxLngN),
      limit: String(limit),
    });
    if (type && type !== "all") q.set("type", type);
    try {
      const res = await fetch(`${backendUrl}/api/listings/in-bounds?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        return NextResponse.json(json || { error: res.statusText }, { status: res.status });
      }
      return NextResponse.json(json);
    } catch (e) {
      return NextResponse.json({ error: e?.message || "Backend request failed." }, { status: 502 });
    }
  }

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return NextResponse.json({ error: "Map listings not configured." }, { status: 503 });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Login required to view listings." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.rpc("listings_in_bounds", {
      min_lat: minLatN,
      max_lat: maxLatN,
      min_lng: minLngN,
      max_lng: maxLngN,
      max_count: limit,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    let rows = Array.isArray(data) ? data : [];
    const haveKeys = new Set(rows.map((r) => r.listing_key));

    if (geocodingKey && rows.length > 0) {
      let geocoded = 0;
      for (const row of rows) {
        if (geocoded >= GEOCODE_MAX) break;
        if (hasCoords(row)) continue;
        const address = buildAddressFromRow(row);
        if (!address) continue;
        const coords = await geocodeAddress(address, geocodingKey);
        await sleep(GEOCODE_DELAY_MS);
        if (coords) {
          row.idx = { ...(row.idx || {}), Latitude: coords.lat, Longitude: coords.lng };
          geocoded++;
        }
      }
    }

    if (geocodingKey && rows.length < 50) {
      const { data: recent } = await supabase
        .from("listings_unified_clean")
        .select(LISTINGS_SELECT_COLS)
        .order("updated_at", { ascending: false })
        .limit(150);
      const withoutCoords = (recent || []).filter(
        (row) => !haveKeys.has(row.listing_key) && !hasCoords(row) && buildAddressFromRow(row)
      );
      let geocoded = 0;
      for (const row of withoutCoords) {
        if (geocoded >= GEOCODE_MAX) break;
        const address = buildAddressFromRow(row);
        if (!address) continue;
        const coords = await geocodeAddress(address, geocodingKey);
        await sleep(GEOCODE_DELAY_MS);
        if (!coords) continue;
        row.idx = { ...(row.idx || {}), Latitude: coords.lat, Longitude: coords.lng };
        geocoded++;
        const { lat, lng } = coords;
        if (lat >= minLatN && lat <= maxLatN && lng >= minLngN && lng <= maxLngN) {
          rows.push(row);
          haveKeys.add(row.listing_key);
        }
      }
    }

    const filtered = filterRowsByType(rows, type);
    return NextResponse.json({ data: filtered });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Map listings failed." }, { status: 500 });
  }
}
