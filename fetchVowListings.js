/**
 * VOW only: fetch full PropTx VOW Property (all VOW property fields) + media (photos) per listing.
 * Only sold status, within last N months. Saves to vow_listings.data JSONB. Does not fetch or touch IDX.
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
import { VOW_PROPERTY_FIELDS } from "./vowPropertyFields.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const PROPTX_VOW_TOKEN = process.env.PROPTX_VOW_TOKEN || process.env.PROPTX_IDX_TOKEN;
const PROPTX_VOW_BASE_URL = (process.env.PROPTX_VOW_BASE_URL || process.env.PROPTX_BASE_URL || "").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!PROPTX_VOW_TOKEN || !PROPTX_VOW_BASE_URL) {
  console.error("Missing PROPTX_VOW_TOKEN/PROPTX_IDX_TOKEN or PROPTX_VOW_BASE_URL/PROPTX_BASE_URL in .env");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to save VOW listings.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** $select for VOW Property: ListingKey + all property Standard Names (full VOW schema). */
const VOW_SELECT = ["ListingKey", ...VOW_PROPERTY_FIELDS].join(",");

const headers = {
  Authorization: `Bearer ${PROPTX_VOW_TOKEN}`,
  Accept: "application/json",
};

const VOW_SOLD_LIMIT = 10;
const PAGE_SIZE = 100;
const MEDIA_PAGE_SIZE = 100;

/** Cutoff: only sold within this many months before today (e.g. 5 = last 5 months). */
const VOW_SOLD_MONTHS_RECENT = 5;

function getSoldDate(item) {
  const raw = item.SoldEntryTimestamp ?? item.PurchaseContractDate;
  if (raw == null) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function isSoldWithinMonths(item, monthsAgo) {
  const sold = getSoldDate(item);
  if (!sold) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);
  return sold >= cutoff;
}

async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 500 && i < maxRetries) {
      await sleep(2000);
      continue;
    }
    const text = await res.text();
    throw new Error(`PropTx VOW error: ${res.status} ${text}`);
  }
}

/** Build data payload: full VOW Property record (all fields) + photos. Stored in data JSONB. */
function mapRecord(item) {
  const data = { ...item, photos: [] };
  return data;
}

async function fetchMediaRaw(filterExpr) {
  const all = [];
  const base = `${PROPTX_VOW_BASE_URL}/Media?$filter=${encodeURIComponent(filterExpr)}&$top=${MEDIA_PAGE_SIZE}`;
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

function filterWatermarkedUrls(urls) {
  return urls.filter((u) => {
    const s = String(u);
    return s.includes("wm:") && s.includes("wmsh");
  });
}

function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter((u) => {
    const key = String(u).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  return order.map((base) => byBase.get(base).url);
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
  if (raw.length === 0) {
    raw = items.flatMap((m) => {
      const fromItems = m.MediaItems?.map((mi) => mi.MediaURL ?? mi.MediaUrl ?? mi.URL).filter(Boolean);
      if (fromItems?.length) return fromItems;
      const top = m.MediaURL ?? m.MediaUrl ?? m.URL;
      return top ? [top] : [];
    }).filter(Boolean);
  }
  raw = filterWatermarkedUrls(raw);
  raw = dedupeUrls(raw);
  raw = raw.filter((u) => String(u).includes("1920:1920"));
  return pickHighestResolutionPerBase(raw);
}

function only1920x1920Urls(urls) {
  return (urls || []).filter((u) => String(u).includes("1920:1920"));
}

async function fetchMediaForListing(listingKey) {
  const key = String(listingKey).replace(/'/g, "''");
  let items = await fetchMediaRaw(`ListingKey eq '${key}'`);
  if (items.length === 0) items = await fetchMediaRaw(`ResourceRecordKey eq '${key}'`);
  const rawPhotos = extractPhotoUrls(items);
  const processed = processListingPhotos({ listingNumber: listingKey }, rawPhotos);
  const webPhotos = only1920x1920Urls(processed.webPhotos || []);
  const mobilePhotos = only1920x1920Urls(processed.mobilePhotos || []);
  return webPhotos.length ? webPhotos : mobilePhotos;
}

/** Fetch sold properties only (sold within last VOW_SOLD_MONTHS_RECENT months), up to 10, save to Supabase. */
async function fetchAllVowListings() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - VOW_SOLD_MONTHS_RECENT);
  console.log(`VOW: sold status, on or after ${cutoff.toISOString().slice(0, 10)} (last ${VOW_SOLD_MONTHS_RECENT} months).`);

  const all = [];
  let skip = 0;
  const soldFilter = "StandardStatus eq 'Sold'";
  let useSoldFilter = true;
  let useSelect = true;
  while (all.length < VOW_SOLD_LIMIT) {
    let url = `${PROPTX_VOW_BASE_URL}/Property?$top=${PAGE_SIZE}&$skip=${skip}`;
    if (useSelect) url = `${PROPTX_VOW_BASE_URL}/Property?$select=${encodeURIComponent(VOW_SELECT)}&$top=${PAGE_SIZE}&$skip=${skip}`;
    if (useSoldFilter) url += (url.includes("?") ? "&" : "?") + `$filter=${encodeURIComponent(soldFilter)}`;
    console.log("Fetching VOW Property (" + (useSelect ? "all VOW fields" : "full payload") + (useSoldFilter ? ", sold only" : "") + "):", url.split("?")[0] + "?...");
    const res = await fetch(url, { headers });
    if (!res.ok && res.status === 400) {
      if (useSoldFilter) {
        useSoldFilter = false;
        console.log("VOW: $filter=StandardStatus not supported, filtering client-side.");
      } else if (useSelect) {
        useSelect = false;
        console.log("VOW: long $select not supported, requesting full payload.");
      } else throw new Error(`PropTx VOW error: 400 ${await res.text()}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PropTx VOW error: ${res.status} ${text}`);
    }
    const data = await res.json();
    const items = data.value ?? [];
    for (const item of items) {
      const isSold = item.StandardStatus === "Sold" || item.SoldEntryTimestamp != null || item.PurchaseContractDate != null;
      if (item.ListingKey && isSold && isSoldWithinMonths(item, VOW_SOLD_MONTHS_RECENT)) {
        all.push({ listing_key: item.ListingKey, data: mapRecord(item) });
        if (all.length >= VOW_SOLD_LIMIT) break;
      }
    }
    if (items.length < PAGE_SIZE || all.length >= VOW_SOLD_LIMIT) break;
    skip += PAGE_SIZE;
    await sleep(100);
  }

  const limited = all.slice(0, VOW_SOLD_LIMIT);
  console.log(`Fetched ${limited.length} VOW sold records (last ${VOW_SOLD_MONTHS_RECENT} months, limit ${VOW_SOLD_LIMIT}). Fetching media for each...`);

  for (let i = 0; i < limited.length; i++) {
    const row = limited[i];
    try {
      const photos = await fetchMediaForListing(row.listing_key);
      row.data.photos = photos;
      if (photos.length > 0) console.log(`  ${row.listing_key}: ${photos.length} photo(s)`);
    } catch (e) {
      console.warn("  Media fetch failed for", row.listing_key, e.message);
    }
    if (i < limited.length - 1) await sleep(100);
  }

  let ok = 0;
  let fail = 0;
  for (const row of limited) {
    const { error } = await supabase.from("vow_listings").upsert(
      { listing_key: row.listing_key, data: row.data, updated_at: new Date().toISOString() },
      { onConflict: "listing_key" }
    );
    if (error) {
      fail++;
      console.error("VOW upsert error:", error.message, "listing_key:", row.listing_key);
    } else {
      ok++;
    }
  }

  console.log(`Supabase vow_listings: ${ok} upserted, ${fail} failed.`);
  return limited;
}

fetchAllVowListings().then((list) => {
  console.log("Done. VOW sold properties saved:", list.length);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
