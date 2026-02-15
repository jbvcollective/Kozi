/**
 * Sync sold or terminated listings from listings_unified into listings_sold_terminated.
 * Reads all rows from listings_unified where vow IS NOT NULL or status is Sold/Terminated/Expired/Canceled,
 * then upserts those rows into listings_sold_terminated.
 *
 * Run after fetchAllListingsUnified.js (or on a schedule) so listings_sold_terminated stays in sync.
 * Usage: node syncSoldTerminatedListings.js
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

const SOLD_TERMINATED_STATUSES = new Set([
  "Sold", "Terminated", "Expired", "Canceled", "Closed",
]);

function isSoldOrTerminated(row) {
  if (row.vow != null && typeof row.vow === "object" && Object.keys(row.vow).length > 0) {
    return true;
  }
  const idx = row.idx || {};
  const status =
    idx.StandardStatus ?? idx.Status ?? idx.MlsStatus ?? "";
  const normalized = String(status).trim();
  return SOLD_TERMINATED_STATUSES.has(normalized);
}

async function run() {
  console.log("Fetching all rows from listings_unified...");
  const { data: all, error: fetchError } = await supabase
    .from("listings_unified")
    .select("listing_key, idx, vow, updated_at");

  if (fetchError) {
    console.error("Failed to fetch listings_unified:", fetchError.message);
    process.exit(1);
  }

  const rows = all ?? [];
  const soldTerminated = rows.filter(isSoldOrTerminated);

  console.log(`Total listings: ${rows.length}. Sold/terminated: ${soldTerminated.length}`);

  if (soldTerminated.length === 0) {
    console.log("No sold/terminated rows to sync. Exiting.");
    return;
  }

  const BATCH = 100;
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < soldTerminated.length; i += BATCH) {
    const chunk = soldTerminated.slice(i, i + BATCH);
    const { error } = await supabase
      .from("listings_sold_terminated")
      .upsert(chunk, { onConflict: "listing_key" });

    if (error) {
      console.error("Upsert error:", error.message);
      fail += chunk.length;
    } else {
      ok += chunk.length;
    }
  }

  console.log(`listings_sold_terminated: ${ok} upserted, ${fail} failed.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
