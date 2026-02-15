/**
 * Single run: analytics + open house sync only.
 * Does NOT fetch listings_unified or school_locations.
 * - Runs computeMarketHeatAnalytics.js (reads existing listings_unified, writes analytics_*).
 * - Syncs open house from listings_unified.idx into open_house_events.
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function runAnalytics() {
  console.log("\n--- 1/2 Analytics (from existing listings_unified) ---\n");
  execSync("node computeMarketHeatAnalytics.js", {
    stdio: "inherit",
    cwd: __dirname,
  });
}

function parseOpenHouseDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (timeStr) {
    const [h, m] = String(timeStr).split(":").map(Number);
    if (!isNaN(h)) d.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
  }
  return d.toISOString();
}

async function syncOpenHouse() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("Supabase not configured; skipping open house sync.");
    return;
  }
  console.log("\n--- 2/2 Open house sync (from listings_unified idx/vow → open_house_events) ---\n");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Fetch ALL listings (no limit): paginate to get every row, only for open house extraction
  const PAGE_SIZE = 1000;
  let rows = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: page, error: fetchErr } = await supabase
      .from("listings_unified")
      .select("listing_key, idx, vow")
      .range(from, from + PAGE_SIZE - 1);
    if (fetchErr) {
      console.error("listings_unified select error:", fetchErr.message);
      return;
    }
    const list = page || [];
    rows = rows.concat(list);
    hasMore = list.length === PAGE_SIZE;
    from += PAGE_SIZE;
    if (list.length > 0) console.log("  Fetched", rows.length, "listings for open house scan...");
  }
  console.log("  Total listings scanned:", rows.length);

  const eventsToInsert = [];
  const listingKeysWithOpenHouse = [];
  for (const row of rows) {
    const idx = row.idx || {};
    const vow = row.vow || {};
    // Prefer idx, fallback to vow for all open house fields (IDX and VOW)
    const unparsed = idx.UnparsedOpenHouse ?? idx.PublicOpenHouse ?? vow.UnparsedOpenHouse ?? vow.PublicOpenHouse;
    const dateStr = idx.OpenHouseDate ?? idx.PublicOpenHouseDate ?? vow.OpenHouseDate ?? vow.PublicOpenHouseDate;
    const startTime = idx.OpenHouseStartTime ?? idx.OpenHouseTime ?? vow.OpenHouseStartTime ?? vow.OpenHouseTime;
    const endTime = idx.OpenHouseEndTime ?? vow.OpenHouseEndTime;
    const openHouseId = idx.OpenHouseId ?? vow.OpenHouseId ?? null;
    const openHouseKey = idx.OpenHouseKey ?? vow.OpenHouseKey ?? null;
    const openHouseFormat = idx.OpenHouseFormat ?? vow.OpenHouseFormat ?? null;
    const openHouseStatus = idx.OpenHouseStatus ?? vow.OpenHouseStatus ?? null;
    const openHouseType = idx.OpenHouseType ?? vow.OpenHouseType ?? null;
    const openHouseUrl = idx.OpenHouseURL ?? idx.OpenHouseUrl ?? vow.OpenHouseURL ?? vow.OpenHouseUrl ?? null;
    const hasOpenHouse =
      (typeof unparsed === "string" && unparsed.trim()) ||
      (Array.isArray(unparsed) && unparsed.length) ||
      dateStr ||
      startTime ||
      openHouseId ||
      openHouseKey;
    if (!hasOpenHouse) continue;

    listingKeysWithOpenHouse.push(row.listing_key);
    const start_ts = parseOpenHouseDate(dateStr, startTime) || new Date().toISOString();
    const end_ts = endTime ? parseOpenHouseDate(dateStr, endTime) : null;
    let remarks = null;
    if (typeof unparsed === "string" && unparsed.trim()) remarks = unparsed.trim();
    else if (Array.isArray(unparsed) && unparsed.length)
      remarks = unparsed.map((e) => (typeof e === "string" ? e : e?.StartTime || e?.EndTime || "")).filter(Boolean).join("; ");
    if (!remarks && dateStr) remarks = [dateStr, startTime, endTime].filter(Boolean).join(" ");

    // Location from same listing (idx or vow) for map display
    const merged = { ...vow, ...idx };
    const address =
      merged.UnparsedAddress ??
      ([merged.StreetNumber, merged.StreetName, merged.StreetSuffix, merged.UnitNumber ? `#${merged.UnitNumber}` : null, merged.City, merged.StateOrProvince || merged.Province]
        .filter(Boolean)
        .join(" ") || null);
    const lat = merged.Latitude != null ? Number(merged.Latitude) : null;
    const lng = merged.Longitude != null ? Number(merged.Longitude) : null;
    const openHouseDateOnly = dateStr ? (() => { const d = new Date(dateStr); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); })() : null;

    const data = {};
    if (openHouseDateOnly != null) data.open_house_date = openHouseDateOnly;
    if (openHouseId != null) data.open_house_id = openHouseId;
    if (openHouseKey != null) data.open_house_key = openHouseKey;
    if (openHouseFormat != null) data.open_house_format = openHouseFormat;
    if (openHouseStatus != null) data.open_house_status = openHouseStatus;
    if (openHouseType != null) data.open_house_type = openHouseType;
    if (openHouseUrl != null) data.open_house_url = openHouseUrl;
    if (address) data.address = address;
    if (Number.isFinite(lat)) data.lat = lat;
    if (Number.isFinite(lng)) data.lng = lng;

    eventsToInsert.push({
      listing_key: row.listing_key,
      start_ts,
      end_ts,
      remarks: remarks || "Open house",
      data,
    });
  }

  if (listingKeysWithOpenHouse.length === 0) {
    console.log("No open house data found in listings_unified (idx or vow).");
    return;
  }

  const { error: delErr } = await supabase
    .from("open_house_events")
    .delete()
    .in("listing_key", listingKeysWithOpenHouse);
  if (delErr) {
    console.warn("open_house_events delete (cleanup) error:", delErr.message, "- table may not exist yet. Run sql/open_house_events.sql");
  }

  const { error: insErr } = await supabase.from("open_house_events").insert(eventsToInsert);
  if (insErr) {
    console.error("open_house_events insert error:", insErr.message);
    return;
  }
  console.log("open_house_events:", eventsToInsert.length, "rows synced from idx/vow.");
}

async function main() {
  console.log("Run session: analytics + open house only (no listings fetch, no school locations).\n");
  await runAnalytics();
  await syncOpenHouse();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
