/**
 * Fetch one batch of listings from PropTx IDX + VOW and upsert to Supabase.
 * Intended to be run by the scheduler (runSyncEvery30Mins.js) every N minutes.
 * One row per listing in listings_unified: listing_key, idx (JSONB), vow (JSONB), updated_at.
 * Each run fetches one page (SYNC_BATCH_PAGE_SIZE) at current offset; offset is persisted in .last-proptx-sync-offset.
 * Uses IDX token for IDX, VOW token for VOW.
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getSyncOffset, setSyncOffset, SYNC_OFFSET_FILE_PATH } from "./syncState.js";
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

const MEDIA_PAGE_SIZE = 100;
const IDX_SELECT = ["ListingKey", ...IDX_PROPERTY_FIELDS].join(",");
const VOW_SELECT = ["ListingKey", ...VOW_PROPERTY_FIELDS].join(",");
/** Supabase upsert batch size (default 500). */
const UPSERT_BATCH_SIZE = Math.min(Math.max(parseInt(process.env.UPSERT_BATCH_SIZE, 10) || 500, 100), 1000);
const batchSize = UPSERT_BATCH_SIZE;
/** Pause (ms) between batch flushes. Set FETCH_BATCH_BUFFER_MS in .env (default 2000). */
const BATCH_BUFFER_MS = Math.max(0, parseInt(process.env.FETCH_BATCH_BUFFER_MS, 10) || 2000);
/** Listings per scheduler run (default 10). Set SYNC_BATCH_PAGE_SIZE in .env to override. */
const SYNC_BATCH_PAGE_SIZE = Math.min(Math.max(parseInt(process.env.SYNC_BATCH_PAGE_SIZE, 10) || 10, 1), 500);

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

/** Fetch a single page of IDX Property. Newest first when orderByModification=true. */
async function fetchIDXPropertyListOnePage(skip, top, orderByModification = true) {
  const list = [];
  let useSelect = true;
  let orderBy = orderByModification ? "ModificationTimestamp desc" : null;
  let url = `${PROPTX_BASE_URL}/Property?$top=${top}&$skip=${skip}`;
  if (useSelect) url = `${PROPTX_BASE_URL}/Property?$select=${encodeURIComponent(IDX_SELECT)}&$top=${top}&$skip=${skip}`;
  if (orderBy) url += (url.includes("?") ? "&" : "?") + `$orderby=${encodeURIComponent(orderBy)}`;
  const res = await fetchWithTimeout(url, { headers: IDX_HEADERS });
  if (!res.ok && res.status === 400) {
    if (orderBy) return fetchIDXPropertyListOnePage(skip, top, false);
    if (useSelect) {
      url = `${PROPTX_BASE_URL}/Property?$top=${top}&$skip=${skip}`;
      const r2 = await fetchWithTimeout(url, { headers: IDX_HEADERS });
      if (!r2.ok) throw new Error(`IDX Property: ${r2.status} ${await r2.text()}`);
      const data = await r2.json();
      const items = data.value ?? [];
      items.forEach((item) => { if (item.ListingKey) list.push(item); });
      return list;
    }
  }
  if (!res.ok) throw new Error(`IDX Property: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const items = data.value ?? [];
  items.forEach((item) => { if (item.ListingKey) list.push(item); });
  return list;
}

/** Fetch a single page of VOW Property (for batch mode). Returns Map<listing_key, record>. */
async function fetchVOWPropertyMapOnePage(skip, top, orderByModification = true) {
  const map = new Map();
  let useSelect = true;
  let orderBy = orderByModification ? "ModificationTimestamp desc" : null;
  let url = `${PROPTX_VOW_BASE_URL}/Property?$top=${top}&$skip=${skip}`;
  if (useSelect) url = `${PROPTX_VOW_BASE_URL}/Property?$select=${encodeURIComponent(VOW_SELECT)}&$top=${top}&$skip=${skip}`;
  if (orderBy) url += (url.includes("?") ? "&" : "?") + `$orderby=${encodeURIComponent(orderBy)}`;
  const res = await fetchWithRetry(url, VOW_HEADERS);
  if (!res.ok && res.status === 400) {
    if (orderBy) return fetchVOWPropertyMapOnePage(skip, top, false);
    if (useSelect) {
      url = `${PROPTX_VOW_BASE_URL}/Property?$top=${top}&$skip=${skip}`;
      const r2 = await fetchWithRetry(url, VOW_HEADERS);
      if (!r2.ok) throw new Error(`VOW Property: ${r2.status} ${await r2.text()}`);
      const data = await r2.json();
      (data.value ?? []).forEach((item) => { if (item.ListingKey) map.set(item.ListingKey, { ...item, photos: [] }); });
      return map;
    }
  }
  if (!res.ok) throw new Error(`VOW Property: ${res.status} ${await res.text()}`);
  const data = await res.json();
  (data.value ?? []).forEach((item) => { if (item.ListingKey) map.set(item.ListingKey, { ...item, photos: [] }); });
  return map;
}

const LOG_ENDPOINT = "http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e";
function debugLog(location, message, data, hypothesisId) {
  const body = JSON.stringify({ sessionId: "aec536", location, message, data: { ...data }, timestamp: Date.now(), hypothesisId });
  fetch(LOG_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "aec536" }, body }).catch(() => {});
}

async function run() {
  const offset = getSyncOffset();
  const pageSize = SYNC_BATCH_PAGE_SIZE;
  // #region agent log
  debugLog("fetchAllListingsUnified.js:run:start", "batch run start", { offset, pageSize, offsetFilePath: SYNC_OFFSET_FILE_PATH }, "H1-H2");
  // #endregion
  console.log("Scheduler batch: fetching IDX + VOW in parallel (offset", offset, ", top", pageSize, ").");
  console.log("Request timeout:", REQUEST_TIMEOUT_MS / 1000, "s");
  let idxList;
  let vowMapPage;
  try {
    [idxList, vowMapPage] = await Promise.all([
      fetchIDXPropertyListOnePage(offset, pageSize),
      fetchVOWPropertyMapOnePage(offset, pageSize),
    ]);
  } catch (e) {
    console.warn("Parallel fetch failed:", e.message, "— retrying IDX and VOW in parallel once.");
    await sleep(2000);
    try {
      [idxList, vowMapPage] = await Promise.all([
        fetchIDXPropertyListOnePage(offset, pageSize),
        fetchVOWPropertyMapOnePage(offset, pageSize),
      ]);
    } catch (e2) {
      console.warn("Retry failed:", e2.message, "— falling back to IDX only.");
      idxList = await fetchIDXPropertyListOnePage(offset, pageSize);
      vowMapPage = new Map();
    }
  }
  if (vowMapPage == null) vowMapPage = new Map();
  const vowMap = vowMapPage;
  console.log("IDX: got", idxList.length, "listings (page). VOW: got", vowMap.size, "listings (page).");
  const allKeys = new Set([...idxList.map((r) => r.ListingKey), ...vowMap.keys()]);
  console.log("Merged IDX + VOW:", allKeys.size, "unique listing keys for this batch.");
  if (allKeys.size === 0) {
    console.log("No listings in this page; resetting offset to 0 for next full sweep.");
    setSyncOffset(0);
    debugLog("fetchAllListingsUnified.js:run:empty", "empty page, reset offset to 0", { offset, idxListLength: idxList.length, vowMapSize: vowMap.size }, "H2");
    return;
  }

  const totalListings = allKeys.size;
  console.log("Fetching media and building unified data for", totalListings, "listings (batch size", batchSize, ", timeout", REQUEST_TIMEOUT_MS / 1000, "s per request)...");
  let ok = 0;
  let fail = 0;
  let index = 0;
  let batchNumber = 0;
  const batch = [];
  const maxUpsertRetries = 3;

  async function flushBatch(rows, batchNumber) {
    if (rows.length === 0) return;
    let error;
    for (let attempt = 1; attempt <= maxUpsertRetries; attempt++) {
      try {
        const result = await Promise.race([
          supabase.from("listings_unified").upsert(rows, { onConflict: "listing_key" }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase upsert timeout")), SUPABASE_TIMEOUT_MS)),
        ]);
        error = result?.error;
      } catch (e) {
        error = { message: e.message || "Upsert timeout or error" };
      }
      if (!error) {
        ok += rows.length;
        console.log(`Inserted batch ${batchNumber}`);
        return;
      }
      const isRetryable = /fetch failed|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(error.message || "");
      if (!isRetryable || attempt === maxUpsertRetries) break;
      await sleep(500 * attempt);
    }
    console.warn("Batch upsert failed after retries:", error?.message, "— falling back to single-row upserts for this batch");
    for (const row of rows) {
      const r = await Promise.race([
        supabase.from("listings_unified").upsert(row, { onConflict: "listing_key" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), SUPABASE_TIMEOUT_MS)),
      ]);
      if (r?.error) {
        fail++;
        console.error("Upsert error:", r.error.message, "listing_key:", row.listing_key);
      } else {
        ok++;
      }
      await sleep(50);
    }
  }

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

    const row = {
      listing_key: key,
      idx: idxPayload ?? {},
      vow: vowPayload,
      updated_at: new Date().toISOString(),
    };
    batch.push(row);

    if (batch.length >= batchSize) {
      batchNumber++;
      const toUpsert = batch.splice(0, batch.length);
      await flushBatch(toUpsert, batchNumber);
      if (BATCH_BUFFER_MS > 0) await sleep(BATCH_BUFFER_MS);
    }
    await sleep(100);
  }

  if (batch.length > 0) {
    batchNumber++;
    await flushBatch(batch, batchNumber);
  }

  console.log("listings_unified:", ok, "upserted,", fail, "failed.");

  const nextOffset = idxList.length < SYNC_BATCH_PAGE_SIZE ? 0 : offset + SYNC_BATCH_PAGE_SIZE;
  const didReset = nextOffset === 0;
  setSyncOffset(nextOffset);
  // #region agent log
  debugLog("fetchAllListingsUnified.js:run:end", "batch run end", { nextOffset, idxListLength: idxList.length, pageSize: SYNC_BATCH_PAGE_SIZE, didReset, reason: didReset ? "idxList.length < pageSize (reset)" : "advance" }, "H1-H2-H3");
  // #endregion
  if (nextOffset === 0) console.log("Full sweep complete; offset reset to 0. Next run will fetch newest again.");
  else console.log("Next run will use offset", nextOffset, ".");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
