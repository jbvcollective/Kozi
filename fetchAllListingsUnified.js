/**
 * Fetch all data from PropTx IDX and VOW feeds per listing.
 * One row per listing in listings_unified; data sorted into two JSONB columns:
 *   idx = full IDX feed payload (property + media) for that listing, or {} when IDX has no data for it
 *   vow = full VOW feed payload (property + media) for that listing, or null when VOW has no data for it
 * Each run overwrites with current feed state only: if a listing moves from IDX to VOW (e.g. sold), we write idx: {}, vow: <data>. No old data is kept.
 * Optional: set CLEANUP_MISSING_LISTINGS=true to delete rows that no longer appear in either feed.
 * Uses IDX token for IDX, VOW token for VOW. Set LISTING_LIMIT in .env to control how many listings to fetch (e.g. 100, 5000).
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
import { VOW_PROPERTY_FIELDS } from "./vowPropertyFields.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const PROPTX_IDX_TOKEN = process.env.PROPTX_IDX_TOKEN;
const PROPTX_BASE_URL = (process.env.PROPTX_BASE_URL || "").replace(/\/$/, "");
const PROPTX_VOW_TOKEN = process.env.PROPTX_VOW_TOKEN || process.env.PROPTX_IDX_TOKEN;
const PROPTX_VOW_BASE_URL = (process.env.PROPTX_VOW_BASE_URL || process.env.PROPTX_BASE_URL || "").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!PROPTX_IDX_TOKEN || !PROPTX_BASE_URL) {
  console.error("Missing PROPTX_IDX_TOKEN or PROPTX_BASE_URL in .env");
  process.exit(1);
}
if (!PROPTX_VOW_TOKEN || !PROPTX_VOW_BASE_URL) {
  console.error("Missing PROPTX_VOW_TOKEN/PROPTX_IDX_TOKEN or PROPTX_VOW_BASE_URL/PROPTX_BASE_URL in .env");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Request timeout (ms). Prevents hangs; set REQUEST_TIMEOUT_MS in .env (default 90s). */
const REQUEST_TIMEOUT_MS = Math.min(Math.max(parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 90000, 10000), 300000);
/** Log progress every N listings (set PROGRESS_INTERVAL in .env, default 10). */
const PROGRESS_INTERVAL = Math.max(parseInt(process.env.PROGRESS_INTERVAL, 10) || 10, 1);
/** Supabase upsert timeout (ms); set SUPABASE_TIMEOUT_MS in .env (default 30s). */
const SUPABASE_TIMEOUT_MS = Math.min(Math.max(parseInt(process.env.SUPABASE_TIMEOUT_MS, 10) || 30000, 5000), 120000);

/** Fetch with timeout so long-running requests don't hang. */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(to);
    return res;
  } catch (e) {
    clearTimeout(to);
    if (e.name === "AbortError") throw new Error(`Request timeout after ${timeoutMs}ms`);
    throw e;
  }
}

/** Fetch with retries on 502/503/504 (service unavailable). Returns res for 200 or 400 so caller can handle. */
async function fetchWithRetry(url, headers, maxRetries = 3) {
  const retryStatuses = [502, 503, 504];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchWithTimeout(url, { headers });
    if (res.ok || res.status === 400) return res;
    const text = await res.text();
    if (retryStatuses.includes(res.status) && attempt < maxRetries) {
      const delay = (attempt + 1) * 3000;
      console.warn("  VOW:", res.status, "Service unavailable, retry", attempt + 1, "/", maxRetries, "in", delay / 1000, "s...");
      await sleep(delay);
      continue;
    }
    throw new Error(`VOW Property: ${res.status} ${text.slice(0, 200)}`);
  }
}

const IDX_HEADERS = { Authorization: `Bearer ${PROPTX_IDX_TOKEN}`, Accept: "application/json" };
const VOW_HEADERS = { Authorization: `Bearer ${PROPTX_VOW_TOKEN}`, Accept: "application/json" };

const LISTING_LIMIT = Math.max(parseInt(process.env.LISTING_LIMIT, 10) || 100, 1);
const PAGE_SIZE = 100;
const MEDIA_PAGE_SIZE = 100;
const IDX_SELECT = ["ListingKey", ...IDX_PROPERTY_FIELDS].join(",");
const VOW_SELECT = ["ListingKey", ...VOW_PROPERTY_FIELDS].join(",");
// Fetch all VOW data (no status filter). Set VOW_FILTER_SOLD_ONLY=true in .env to restrict to sold only.
const VOW_FILTER_SOLD_ONLY = process.env.VOW_FILTER_SOLD_ONLY === "true" || process.env.VOW_FILTER_SOLD_ONLY === "1";

async function fetchMediaRaw(baseUrl, headers, filterExpr) {
  const all = [];
  const base = `${baseUrl}/Media?$filter=${encodeURIComponent(filterExpr)}&$top=${MEDIA_PAGE_SIZE}`;
  let nextUrl = base;
  while (nextUrl) {
    const res = await fetchWithTimeout(nextUrl, { headers });
    if (!res.ok) {
      if (res.status === 400) return all;
      throw new Error(`${res.status}`);
    }
    const data = await res.json();
    const items = data.value ?? [];
    all.push(...items);
    nextUrl = data["@odata.nextLink"] || null;
    if (!nextUrl && items.length >= MEDIA_PAGE_SIZE) nextUrl = `${base}&$skip=${all.length}`;
  }
  return all;
}

function filterWatermarkedUrls(urls) {
  return urls.filter((u) => { const s = String(u); return s.includes("wm:") && s.includes("wmsh"); });
}

function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter((u) => { const k = String(u).trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function pickHighestResolutionPerBase(urls) {
  const byBase = new Map();
  const order = [];
  for (const u of urls) {
    const s = String(u).trim();
    if (!s) continue;
    const base = getUrlSignature(s);
    const res = getResolutionScore(s);
    const existing = byBase.get(base);
    if (!existing || res > existing.res) {
      byBase.set(base, { url: s, res });
      if (!existing) order.push(base);
    }
  }
  return order.map((b) => byBase.get(b).url);
}

function extractPhotoUrls(items) {
  let raw = items
    .filter((m) => !m.ClassName || m.ClassName === "Photo")
    .flatMap((m) => {
      const fromItems = m.MediaItems?.map((mi) => mi.MediaURL ?? mi.MediaUrl ?? mi.URL).filter(Boolean);
      if (fromItems?.length) return fromItems;
      const top = m.MediaURL ?? m.MediaUrl ?? m.URL;
      return top ? [top] : [];
    })
    .filter(Boolean);
  if (raw.length === 0) raw = items.flatMap((m) => {
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

function only1920(urls) {
  return (urls || []).filter((u) => String(u).includes("1920:1920"));
}

async function fetchMediaForListing(baseUrl, headers, listingKey) {
  const key = String(listingKey).replace(/'/g, "''");
  let items = await fetchMediaRaw(baseUrl, headers, `ListingKey eq '${key}'`);
  if (items.length === 0) items = await fetchMediaRaw(baseUrl, headers, `ResourceRecordKey eq '${key}'`);
  const rawPhotos = extractPhotoUrls(items);
  const processed = processListingPhotos({ listingNumber: listingKey }, rawPhotos);
  const web = only1920(processed.webPhotos || []);
  const mobile = only1920(processed.mobilePhotos || []);
  return web.length ? web : mobile;
}

/** Fetch IDX Property list (limit LISTING_LIMIT). */
async function fetchIDXPropertyList() {
  const list = [];
  let useSelect = true;
  let skip = 0;
  while (list.length < LISTING_LIMIT) {
    let url = `${PROPTX_BASE_URL}/Property?$top=${PAGE_SIZE}&$skip=${skip}`;
    if (useSelect) url = `${PROPTX_BASE_URL}/Property?$select=${encodeURIComponent(IDX_SELECT)}&$top=${PAGE_SIZE}&$skip=${skip}`;
    const res = await fetchWithTimeout(url, { headers: IDX_HEADERS });
    if (!res.ok && res.status === 400 && useSelect) {
      useSelect = false;
      continue;
    }
    if (!res.ok) throw new Error(`IDX Property: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const items = data.value ?? [];
    for (const item of items) {
      if (item.ListingKey) list.push(item);
      if (list.length >= LISTING_LIMIT) break;
    }
    if (items.length < PAGE_SIZE || list.length >= LISTING_LIMIT) break;
    skip += PAGE_SIZE;
    await sleep(100);
  }
  return list.slice(0, LISTING_LIMIT);
}

/** Fetch VOW Property: all data from VOW feed (no status filter by default). Returns Map<listing_key, vowRecord>. */
async function fetchVOWPropertyMap() {
  const map = new Map();
  let useSelect = true;
  let useFilter = VOW_FILTER_SOLD_ONLY;
  let skip = 0;
  const soldFilter = "StandardStatus eq 'Sold'";
  let totalItemsSeen = 0;
  while (map.size < LISTING_LIMIT) {
    let url = `${PROPTX_VOW_BASE_URL}/Property?$top=${PAGE_SIZE}&$skip=${skip}`;
    if (useSelect) url = `${PROPTX_VOW_BASE_URL}/Property?$select=${encodeURIComponent(VOW_SELECT)}&$top=${PAGE_SIZE}&$skip=${skip}`;
    if (useFilter) url += (url.includes("?") ? "&" : "?") + `$filter=${encodeURIComponent(soldFilter)}`;
    let res;
    try {
      res = await fetchWithRetry(url, VOW_HEADERS);
    } catch (e) {
      throw e;
    }
    const text = await res.text();
    if (!res.ok && res.status === 400) {
      if (useFilter) {
        console.log("  VOW: $filter not supported, retrying without filter.");
        useFilter = false;
        continue;
      }
      if (useSelect) {
        console.log("  VOW: $select not supported, retrying without $select.");
        useSelect = false;
        continue;
      }
      throw new Error(`VOW Property: 400 ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`VOW Property: ${res.status} ${text.slice(0, 200)}`);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`VOW Property: invalid JSON (${res.status}) ${text.slice(0, 100)}`);
    }
    const items = data.value ?? [];
    totalItemsSeen += items.length;
    for (const item of items) {
      if (item.ListingKey) {
        map.set(item.ListingKey, { ...item, photos: [] });
        if (map.size >= LISTING_LIMIT) break;
      }
    }
    if (items.length < PAGE_SIZE || map.size >= LISTING_LIMIT) break;
    skip += PAGE_SIZE;
    await sleep(100);
  }
  if (totalItemsSeen === 0) {
    console.log("  VOW: API returned 0 properties. Check PROPTX_VOW_BASE_URL and PROPTX_VOW_TOKEN (must be VOW token, not IDX).");
  }
  return map;
}

async function run() {
  console.log("LISTING_LIMIT:", LISTING_LIMIT, "| request timeout:", REQUEST_TIMEOUT_MS / 1000, "s | progress every", PROGRESS_INTERVAL, "listings");
  console.log("Fetching IDX Property list...");
  const idxList = await fetchIDXPropertyList();
  console.log("IDX: got", idxList.length, "listings.");

  console.log("Fetching VOW Property (all data from VOW feed)...");
  let vowMap;
  try {
    vowMap = await fetchVOWPropertyMap();
  } catch (e) {
    console.warn("VOW fetch failed after retries:", e.message);
    console.warn("Continuing with IDX only; vow column will be null for all rows.");
    vowMap = new Map();
  }
  console.log("VOW: got", vowMap.size, "listings.");

  const allKeys = new Set(idxList.map((r) => r.ListingKey));
  vowMap.forEach((_, key) => allKeys.add(key));

  const totalListings = allKeys.size;
  console.log("Fetching media and building unified data for", totalListings, "listings (timeout", REQUEST_TIMEOUT_MS / 1000, "s per request)...");
  let ok = 0;
  let fail = 0;
  let index = 0;
  for (const key of allKeys) {
    index++;
    if (index % PROGRESS_INTERVAL === 0 || index === totalListings) {
      console.log("  Progress:", index, "/", totalListings, "listings —", ok, "upserted,", fail, "failed");
    }
    let idxPayload = null;
    let vowPayload = null;

    const idxRecord = idxList.find((r) => r.ListingKey === key);
    if (idxRecord) {
      try {
        const photos = await fetchMediaForListing(PROPTX_BASE_URL, IDX_HEADERS, key);
        idxPayload = { ...idxRecord, photos };
      } catch (e) {
        console.warn("  IDX media failed for", key, e.message);
        idxPayload = { ...idxRecord, photos: [] };
      }
    }

    if (vowMap.has(key)) {
      try {
        const photos = await fetchMediaForListing(PROPTX_VOW_BASE_URL, VOW_HEADERS, key);
        vowPayload = { ...vowMap.get(key), photos };
      } catch (e) {
        console.warn("  VOW media failed for", key, e.message);
        vowPayload = { ...vowMap.get(key), photos: [] };
      }
    }

    // Always overwrite with current run: no merging with old data. If IDX no longer has this listing → idx: {}; if VOW no longer has it → vow: null.
    const row = {
      listing_key: key,
      idx: idxPayload ?? {},
      vow: vowPayload,
      updated_at: new Date().toISOString(),
    };
    const maxUpsertRetries = 3;
    let error;
    for (let attempt = 1; attempt <= maxUpsertRetries; attempt++) {
      try {
        const result = await Promise.race([
          supabase.from("listings_unified").upsert(row, { onConflict: "listing_key" }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase upsert timeout")), SUPABASE_TIMEOUT_MS)),
        ]);
        error = result?.error;
      } catch (e) {
        error = { message: e.message || "Upsert timeout or error" };
      }
      if (!error) break;
      const isRetryable = /fetch failed|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(error.message || "");
      if (!isRetryable || attempt === maxUpsertRetries) break;
      await sleep(500 * attempt);
    }
    if (error) {
      fail++;
      console.error("Upsert error:", error.message, "listing_key:", key);
    } else {
      ok++;
    }
    await sleep(100);
  }

  console.log("listings_unified:", ok, "upserted,", fail, "failed.");

  // Optional: remove rows that are no longer in either feed (so table only has current data). Set CLEANUP_MISSING_LISTINGS=true in .env.
  const cleanup = process.env.CLEANUP_MISSING_LISTINGS === "true" || process.env.CLEANUP_MISSING_LISTINGS === "1";
  if (cleanup && allKeys.size > 0) {
    const { data: existing } = await supabase.from("listings_unified").select("listing_key");
    const currentSet = new Set(allKeys);
    const toRemove = (existing || []).map((r) => r.listing_key).filter((k) => !currentSet.has(k));
    if (toRemove.length > 0) {
      const { error: delError } = await supabase.from("listings_unified").delete().in("listing_key", toRemove);
      if (delError) console.warn("Cleanup delete warning:", delError.message);
      else console.log("listings_unified: removed", toRemove.length, "stale rows (no longer in IDX or VOW).");
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
