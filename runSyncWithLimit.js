/**
 * Run full sync with a custom listing limit. Updates all tables in one run.
 * Usage: node runSyncWithLimit.js <limit>   or   npm run sync-with-limit -- <limit>
 * The number you pass is exactly how many listings IDX and VOW will fetch (e.g. 50, 100, 5000).
 *
 * Tables updated:
 * 1. listings_unified        — fetch up to LIMIT from IDX + VOW
 * 2. sold_listings           — from listings_unified (sold/terminated)
 * 3. analytics_* + open_house_events — from listings_unified
 * 4. listings_unified_clean  — backfill from listings_unified (strip null/[])
 */
import { spawnSync } from "child_process";

const raw = process.argv[2] ?? process.env.LISTING_LIMIT;
const num = raw != null ? parseInt(String(raw).trim(), 10) : NaN;
const limit = Number.isNaN(num) || num < 1 ? null : num;

if (limit == null) {
  console.error("Usage: node runSyncWithLimit.js <limit>  (positive integer, e.g. 100)");
  console.error("Example: npm run sync-with-limit -- 100");
  process.exit(1);
}

const env = { ...process.env, LISTING_LIMIT: String(limit) };

const steps = [
  { name: `1/4 Fetch unified (IDX + VOW) — limit ${limit}`, cmd: "node", args: ["fetchAllListingsUnified.js"] },
  { name: "2/4 Sync sold listings", cmd: "node", args: ["syncSoldListings.js"] },
  { name: "3/4 Analytics + open house", cmd: "node", args: ["runAnalyticsAndOpenHouse.js"] },
  { name: "4/4 Backfill listings_unified_clean", cmd: "node", args: ["backfillListingsUnifiedClean.js"] },
];

for (const step of steps) {
  console.log("\n---", step.name, "---");
  const r = spawnSync(step.cmd, step.args, { stdio: "inherit", env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}
console.log("\nDone. All tables updated: listings_unified, sold_listings, analytics_*, open_house_events, listings_unified_clean.");
