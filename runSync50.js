/**
 * Run full sync with 50 listings: fetch unified → sync sold → analytics.
 * Single command to do everything at once. Overrides LISTING_LIMIT=50 for this run.
 *
 * Data flow: listings_unified is the source. Fetch writes idx/vow there; then
 * sync-sold, analytics, and open-house all read from listings_unified and update
 * sold_listings, analytics_*, and open_house_events. So when you fetch 50, all
 * derived data updates from that same table.
 */
import { spawnSync } from "child_process";

const limit = "50";
const env = { ...process.env, LISTING_LIMIT: limit };

const steps = [
  { name: "Fetch unified (IDX + VOW)", cmd: "node", args: ["fetchAllListingsUnified.js"] },
  { name: "Sync sold listings", cmd: "node", args: ["syncSoldListings.js"] },
  { name: "Analytics + open house", cmd: "node", args: ["runAnalyticsAndOpenHouse.js"] },
];

for (const step of steps) {
  console.log("\n---", step.name, "---");
  const r = spawnSync(step.cmd, step.args, { stdio: "inherit", env });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}
console.log("\nDone. Fetched", limit, "listings and ran full sync.");
