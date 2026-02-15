/**
 * Run the full sync (fetch unified → sold listings → analytics) every 30 minutes.
 * Use for continuous updates: always overwrites with current feed data; no old data kept.
 * Start once: node runSyncEvery30Mins.js (or npm run sync-watch)
 * Stop with Ctrl+C.
 */

import { spawn } from "child_process";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function runSync() {
  const start = new Date().toISOString();
  console.log(`[${start}] Starting sync...`);
  const child = spawn("npm", ["run", "sync"], {
    stdio: "inherit",
    shell: true,
  });
  child.on("close", (code) => {
    const end = new Date().toISOString();
    console.log(`[${end}] Sync finished with code ${code}`);
  });
}

runSync();
setInterval(runSync, INTERVAL_MS);
console.log(`Sync will run every ${INTERVAL_MS / 60000} minutes. Press Ctrl+C to stop.`);
