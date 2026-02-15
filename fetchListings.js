/**
 * IDX only: fetch full PropTx IDX Property (all IDX property fields) + media photos per listing.
 * Saves to listings_unified.idx JSONB. Does not fetch or touch VOW (existing vow preserved on upsert).
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  processListingPhotos,
  getUrlSignature,
  getResolutionScore,
} from "./processListingPhotos.js";
import { IDX_PROPERTY_FIELDS } from "./idxPropertyFields.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const PROPTX_IDX_TOKEN = process.env.PROPTX_IDX_TOKEN;
const PROPTX_BASE_URL = process.env.PROPTX_BASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!PROPTX_IDX_TOKEN || !PROPTX_BASE_URL) {
  console.error("Missing PROPTX_IDX_TOKEN or PROPTX_BASE_URL in .env");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to save listings.");
  console.error("  SUPABASE_URL:", SUPABASE_URL ? "set" : "missing");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_KEY ? "set" : "missing");
}

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 500 && i < maxRetries) {
      console.warn(`Server 500, retry ${i + 1}/${maxRetries} in 2s...`);
      await sleep(2000);
      continue;
    }
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {}
    console.error("Request URL:", url);
    console.error("Response", res.status, body);
    throw new Error(`PropTx API error: ${res.status} ${res.statusText}`);
  }
}

const headers = {
  Authorization: `Bearer ${PROPTX_IDX_TOKEN}`,
  Accept: "application/json",
};

/** $select for IDX Property: ListingKey + all IDX property Standard Names. */
const IDX_SELECT = ["ListingKey", ...IDX_PROPERTY_FIELDS].join(",");

const MEDIA_PAGE_SIZE = 100;
const PROPERTY_PAGE_SIZE = 100;

/** Fetch all raw items from /Media for a filter (paginated: nextLink or $skip until no full page). */
async function fetchMediaRaw(filterExpr) {
  const all = [];
  const base = `${PROPTX_BASE_URL}/Media?$filter=${encodeURIComponent(filterExpr)}&$top=${MEDIA_PAGE_SIZE}`;
  let nextUrl = base;
  while (nextUrl) {
    const res = await fetch(nextUrl, { headers });
    if (!res.ok) {
      if (res.status === 400) return all;
      throw new Error(`${res.status}`);
    }
    const data = await res.json();
    const items = data.value ?? [];
    all.push(...items);
    nextUrl = data["@odata.nextLink"] || null;
    if (!nextUrl && items.length >= MEDIA_PAGE_SIZE)
      nextUrl = `${base}&$skip=${all.length}`;
  }
  return all;
}

/** Keep only PropTx URLs that include watermark/signing params (e.g. wm:.5:so:0:50:.4/wmsh:10). */
function filterWatermarkedUrls(urls) {
  return urls.filter((u) => {
    const s = String(u);
    return s.includes("wm:") && s.includes("wmsh");
  });
}

/** Deduplicate by exact URL string, preserving first occurrence order. */
function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter((u) => {
    const key = String(u).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate by base image (origin + pathname; ignore URL parameters).
 * For each base image, keep the single highest-resolution variant (PropTx rs:fit:W:H or w/h params).
 * Order preserved by first occurrence of each base.
 */
function pickHighestResolutionPerBase(urls) {
  const byBase = new Map();
  const order = [];
  for (const u of urls) {
    const s = String(u).trim();
    if (!s) continue;
    const base = getUrlSignature(s); // origin + pathname, params ignored
    const res = getResolutionScore(s);
    const existing = byBase.get(base);
    if (!existing || res > existing.res) {
      byBase.set(base, { url: s, res });
      if (!existing) order.push(base);
    }
  }
  return order.map((base) => byBase.get(base).url);
}

/** Extract photo URLs from media items. Dedupe by base image; pick highest resolution per base. */
function extractPhotoUrls(items) {
  let raw = [];
  const fromPhoto = items
    .filter((m) => !m.ClassName || m.ClassName === "Photo")
    .flatMap((m) => {
      const fromItems = m.MediaItems?.map((mi) => mi.MediaURL ?? mi.MediaUrl ?? mi.URL).filter(Boolean);
      if (fromItems?.length) return fromItems;
      const top = m.MediaURL ?? m.MediaUrl ?? m.URL;
      return top ? [top] : [];
    })
    .filter(Boolean);
  if (fromPhoto.length) raw = fromPhoto;
  else
    raw = items.flatMap((m) => {
      const fromItems = m.MediaItems?.map((mi) => mi.MediaURL ?? mi.MediaUrl ?? mi.URL).filter(Boolean);
      if (fromItems?.length) return fromItems;
      const top = m.MediaURL ?? m.MediaUrl ?? m.URL;
      return top ? [top] : [];
    }).filter(Boolean);
  raw = filterWatermarkedUrls(raw);
  raw = dedupeUrls(raw);
  raw = raw.filter((u) => String(u).includes("1920:1920"));
  return pickHighestResolutionPerBase(raw);
}

/** Keep only photo URLs that contain fit:1920:1920; discard 1080 and all others. */
function only1920x1920Urls(urls) {
  return (urls || []).filter((u) => String(u).includes("1920:1920"));
}

/** Fetch media for one listing. Tries ListingKey then ResourceRecordKey (some APIs use the latter). */
async function fetchMediaForListing(listingKey, options = {}) {
  const { returnRaw = false, debug = false } = options;
  const key = String(listingKey).replace(/'/g, "''");
  let items = await fetchMediaRaw(`ListingKey eq '${key}'`);
  if (items.length === 0) {
    items = await fetchMediaRaw(`ResourceRecordKey eq '${key}'`);
    if (debug && items.length > 0) console.log("Media returned data using ResourceRecordKey filter");
  }
  const rawPhotos = extractPhotoUrls(items);
  const processed = processListingPhotos({ listingNumber: listingKey }, rawPhotos);
  if (debug) {
    console.log("Media URL:", `${PROPTX_BASE_URL}/Media?$filter=ListingKey eq '${listingKey}'&$top=100`);
    console.log("Media response: items count =", items.length, "→ web photos =", processed.webPhotos.length);
    if (items.length > 0 && processed.webPhotos.length === 0) console.log("First item keys (check structure):", Object.keys(items[0]));
  }
  if (returnRaw) return { photos: processed, rawItems: items };
  return processed;
}

const LISTING_LIMIT = Math.max(1, parseInt(process.argv[2], 10) || parseInt(process.env.LISTING_LIMIT, 10) || 10);

/** Fetch full IDX Property (all IDX fields) + media photos per listing. Save to listings_unified.idx JSONB. */
async function fetchAllListingsWithPhotos() {
  console.log("LISTING_LIMIT:", LISTING_LIMIT);
  const allListings = [];
  const top = Math.min(PROPERTY_PAGE_SIZE, LISTING_LIMIT);
  let useSelect = true;
  let skip = 0;
  const propertyRecords = [];

  try {
    while (propertyRecords.length < LISTING_LIMIT) {
      let url = `${PROPTX_BASE_URL}/Property?$top=${top}&$skip=${skip}`;
      if (useSelect) url = `${PROPTX_BASE_URL}/Property?$select=${encodeURIComponent(IDX_SELECT)}&$top=${top}&$skip=${skip}`;
      console.log("Fetching IDX Property (" + (useSelect ? "all IDX fields" : "full payload") + "):", url.split("?")[0] + "?...");
      const res = await fetch(url, { headers });
      if (!res.ok && res.status === 400 && useSelect) {
        useSelect = false;
        console.log("IDX: long $select not supported, requesting full payload.");
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PropTx IDX error: ${res.status} ${text}`);
      }
      const data = await res.json();
      const items = data.value ?? [];
      for (const item of items) {
        if (item.ListingKey) propertyRecords.push(item);
        if (propertyRecords.length >= LISTING_LIMIT) break;
      }
      if (items.length < top || propertyRecords.length >= LISTING_LIMIT) break;
      skip += top;
      await sleep(100);
    }
    const limited = propertyRecords.slice(0, LISTING_LIMIT);
    if (limited.length < propertyRecords.length) {
      console.log(`Limiting to ${LISTING_LIMIT} IDX listings.`);
    }

    if (limited.length > 0) {
      const probeRes = await fetch(`${PROPTX_BASE_URL}/Media?$top=5`, { headers });
      const probeData = probeRes.ok ? await probeRes.json() : {};
      const probeItems = probeData.value ?? [];
      console.log("Media endpoint probe (IDX):", probeItems.length, "items.");
    }

    console.log(`Found ${limited.length} IDX listings, fetching media per listing...`);
    let supabaseOk = 0;
    let supabaseFail = 0;
    const keys = limited.map((r) => r.ListingKey);
    const vowByKey = new Map();
    if (supabase && keys.length > 0) {
      const { data: existing } = await supabase.from("listings_unified").select("listing_key, vow").in("listing_key", keys);
      (existing || []).forEach((r) => vowByKey.set(r.listing_key, r.vow));
    }
    for (let i = 0; i < limited.length; i++) {
      const record = limited[i];
      const key = record.ListingKey;
      const isFirst = i === 0;

      const result = await fetchMediaForListing(key, { returnRaw: isFirst, debug: isFirst });
      const photos = isFirst ? result.photos : result;
      const webPhotos = only1920x1920Urls(photos.webPhotos || []);
      const mobilePhotos = only1920x1920Urls(photos.mobilePhotos || []);
      const payload = { ...record, photos: webPhotos, photosMobile: mobilePhotos };

      allListings.push({ listing_key: key, data: payload });

      if (supabase) {
        const row = {
          listing_key: key,
          idx: payload,
          vow: vowByKey.get(key) ?? null,
          updated_at: new Date().toISOString(),
        };
        if (isFirst && (payload.photos?.length > 0)) console.log("Sample payload keys:", Object.keys(payload).slice(0, 15).join(", "), "... photos:", payload.photos.length);
        const { error } = await supabase.from("listings_unified").upsert(row, {
          onConflict: "listing_key",
        });
        if (error) {
          supabaseFail++;
          console.error("Supabase upsert error:", error.message, "code:", error.code, "listing_key:", key);
          if (error.details) console.error("  details:", error.details);
        } else {
          supabaseOk++;
        }
      }

      if ((i + 1) % 50 === 0) console.log(`Media: ${i + 1}/${limited.length}`);
      if (i < limited.length - 1) await sleep(100);
    }

    console.log(`Fetched ${allListings.length} IDX listings (full property + media).`);
    if (supabase) {
      console.log(`Supabase listings_unified: ${supabaseOk} upserted, ${supabaseFail} failed.`);
      if (supabaseFail > 0) console.error("Run sql/listings_unified.sql in Supabase SQL Editor if listings_unified table is missing.");
    } else {
      console.log("Supabase: skipped (not configured).");
    }
    return allListings;
  } catch (err) {
    console.error("Error fetching IDX listings:", err);
    return allListings;
  }
}

fetchAllListingsWithPhotos().then((listings) => {
  console.log("Done. Listings in Supabase:", listings.length);
});
