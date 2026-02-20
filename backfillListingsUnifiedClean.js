/**
 * One-time (or anytime) backfill: copy listings_unified → listings_unified_clean
 * with null- and []-valued keys stripped from idx and vow.
 *
 * Use when the DB trigger isn't set up or listings_unified_clean is out of sync.
 * Usage: node backfillListingsUnifiedClean.js  or  npm run backfill-clean
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

/** Read from listings_unified and write to listings_unified_clean in batches (smaller = fewer timeouts). */
const PAGE_SIZE = 300;
const UPSERT_BATCH_SIZE = Math.min(Math.max(parseInt(process.env.UPSERT_BATCH_SIZE, 10) || 250, 100), 1000);

/** Same as SQL trigger: strip keys where value is null or empty array []. */
function stripNullAndEmptyArray(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

async function run() {
  console.log("Loading listings_unified...");
  const all = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from("listings_unified")
      .select("listing_key, idx, vow, updated_at")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      console.error("Supabase error:", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log("Found", all.length, "rows. Building clean idx/vow and upserting to listings_unified_clean...");

  let ok = 0;
  let fail = 0;
  const MAX_RETRIES = 3;
  const isRetryable = (msg) => /fetch failed|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(msg || "");

  for (let i = 0; i < all.length; i += UPSERT_BATCH_SIZE) {
    const batch = all.slice(i, i + UPSERT_BATCH_SIZE).map((row) => ({
      listing_key: row.listing_key,
      idx: stripNullAndEmptyArray(row.idx ?? {}),
      vow: row.vow != null ? stripNullAndEmptyArray(row.vow) : null,
      updated_at: row.updated_at ?? new Date().toISOString(),
    }));
    let lastError = null;
    let succeeded = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { error } = await supabase.from("listings_unified_clean").upsert(batch, { onConflict: "listing_key" });
      if (!error) {
        ok += batch.length;
        succeeded = true;
        break;
      }
      lastError = error;
      if (!isRetryable(error.message) || attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    if (!succeeded) {
      // Fallback: try one row at a time so one bad row doesn't fail the whole batch
      if (lastError) console.warn("  Batch failed after retries:", lastError.message, "— retrying rows individually.");
      for (const row of batch) {
        const { error } = await supabase.from("listings_unified_clean").upsert(row, { onConflict: "listing_key" });
        if (error) {
          fail++;
          if (fail <= 5) console.error("Upsert error:", error.message, "listing_key:", row.listing_key);
        } else {
          ok++;
        }
      }
    }
    const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    if (batchNum % 5 === 0 || i + UPSERT_BATCH_SIZE >= all.length) {
      console.log("  Inserted batch", batchNum, "—", Math.min(i + UPSERT_BATCH_SIZE, all.length), "/", all.length);
    }
  }

  console.log("listings_unified_clean:", ok, "upserted,", fail, "failed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
