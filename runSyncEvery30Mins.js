/**
 * Scheduler: run the full sync every N minutes with a buffer between runs.
 * Each run: fetch one batch of listings from PropTx (IDX + VOW) → listings_unified → sold_listings → analytics + open_house → listings_unified_clean.
 *
 * Start: npm run sync-every-5  or  npm run sync-watch   (runs full sync every 5 min by default)
 * Stop with Ctrl+C.
 *
 * Set in .env:
 *   SYNC_INTERVAL_MINUTES=5   — minimum minutes between run starts (default 5)
 *   SYNC_BUFFER_SECONDS=90    — minimum seconds to wait after a run ends before next start (default 90; increase if Supabase times out)
 *   SYNC_BATCH_PAGE_SIZE=10   — listings per batch (default 10); offset in .last-proptx-sync-offset
 */

import { spawn } from "child_process";

const INTERVAL_MINUTES = Math.max(1, parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 5);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const BUFFER_SECONDS = Math.max(0, parseInt(process.env.SYNC_BUFFER_SECONDS, 10) || 90);
const BUFFER_MS = BUFFER_SECONDS * 1000;

function runSync() {
  const runStart = Date.now();
  const start = new Date().toISOString();
  console.log(`[${start}] Starting sync (PropTx → listings_unified → sold → analytics → backfill)...`);
  const child = spawn("npm", ["run", "sync"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  child.on("close", (code) => {
    const end = new Date().toISOString();
    const elapsed = Date.now() - runStart;
    const nextInMs = Math.max(BUFFER_MS, INTERVAL_MS - elapsed);
    const nextInMins = (nextInMs / 60000).toFixed(1);
    console.log(`[${end}] Sync finished with code ${code}. Next run in ${nextInMins} min (buffer + interval).`);
    setTimeout(runSync, nextInMs);
  });
}

runSync();
console.log(`Sync will run every ${INTERVAL_MINUTES} min (min interval) with ${BUFFER_SECONDS}s buffer after each run. Press Ctrl+C to stop.`);
