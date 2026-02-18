/**
 * Sync sold / expired / terminated listings from listings_unified into sold_listings.
 * Copies full idx + vow (info + media) and sets status + closed_date for display/sorting.
 * Reads listings_unified in batches to avoid query timeout; writes to sold_listings in batches.
 *
 * Run after fetch-unified. Usage: npm run sync-sold-listings
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Read/write batch size (300–1000 ideal; avoid timeout and ~2MB limit). */
const BATCH_SIZE = Math.min(Math.max(parseInt(process.env.SYNC_SOLD_BATCH_SIZE, 10) || 500, 100), 1000);

const OFF_MARKET_STATUSES = new Set([
  "Sold", "Terminated", "Expired", "Canceled", "Closed",
]);

/** Current listing is on market (For Sale, Active, etc.) — do not treat as sold even if history has sold/terminated. */
const ON_MARKET_STATUSES = new Set([
  "Active", "For Sale", "New", "Coming Soon", "Pending", "Active Under Contract",
]);

function getCurrentStatus(row) {
  const idx = row.idx || {};
  const vow = row.vow || {};
  const idxStatus = idx.StandardStatus ?? idx.Status ?? idx.MlsStatus ?? "";
  const vowStatus = vow.StandardStatus ?? vow.Status ?? vow.MlsStatus ?? "";
  return String(idxStatus || vowStatus).trim();
}

function getStatus(row) {
  const status = getCurrentStatus(row);
  if (OFF_MARKET_STATUSES.has(status)) return status;
  const vow = row.vow || {};
  if (vow?.CloseDate || vow?.SoldEntryTimestamp) return "Sold";
  return null;
}

function getClosedDate(row) {
  const vow = row.vow || {};
  const raw = vow.CloseDate ?? vow.SoldEntryTimestamp ?? vow.PurchaseContractDate;
  if (raw == null) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Only true if listing is currently off market (sold/expired/terminated). If current status is For Sale / Active, not sold. */
function isSoldExpiredOrTerminated(row) {
  const currentStatus = getCurrentStatus(row);
  if (ON_MARKET_STATUSES.has(currentStatus)) return false;
  if (OFF_MARKET_STATUSES.has(currentStatus)) return true;
  const idx = row.idx || {};
  const vow = row.vow || {};
  const hasIdx = idx && typeof idx === "object" && Object.keys(idx).length > 0;
  if (hasIdx) return false;
  return !!(vow && typeof vow === "object" && Object.keys(vow).length > 0 && (vow.ClosePrice ?? vow.SoldEntryTimestamp ?? vow.CloseDate));
}

async function run() {
  console.log("Fetching listings_unified in batches of", BATCH_SIZE, "...");
  const rows = [];
  let from = 0;
  while (true) {
    const { data: page, error: fetchError } = await supabase
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + BATCH_SIZE - 1);

    if (fetchError) {
      console.error("Failed to fetch listings_unified:", fetchError.message);
      process.exit(1);
    }
    const list = page ?? [];
    rows.push(...list);
    if (list.length < BATCH_SIZE) break;
    from += list.length;
    if (rows.length % (BATCH_SIZE * 5) === 0 || list.length < BATCH_SIZE) {
      console.log("  Read", rows.length, "rows...");
    }
  }

  const sold = rows.filter(isSoldExpiredOrTerminated);
  console.log(`Total: ${rows.length}. Sold/expired/terminated: ${sold.length}`);

  if (sold.length === 0) {
    console.log("No sold/expired/terminated rows to sync.");
    return;
  }

  const toUpsert = sold.map((row) => ({
    listing_key: row.listing_key,
    idx: row.idx ?? {},
    vow: row.vow ?? null,
    status: getStatus(row),
    closed_date: getClosedDate(row),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }));

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const chunk = toUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("sold_listings")
      .upsert(chunk, { onConflict: "listing_key" });

    if (error) {
      console.error("Upsert error:", error.message);
      fail += chunk.length;
    } else {
      ok += chunk.length;
      console.log(`Inserted sold_listings batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }
  }

  console.log(`sold_listings: ${ok} upserted, ${fail} failed.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
