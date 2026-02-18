/**
 * Persist last PropTx sync time for incremental fetches.
 * File: .last-proptx-sync (one line, ISO timestamp).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, ".last-proptx-sync");
const OFFSET_FILE = path.join(__dirname, ".last-proptx-sync-offset");
export const SYNC_OFFSET_FILE_PATH = OFFSET_FILE;

export function getLastSyncTime() {
  try {
    const s = fs.readFileSync(STATE_FILE, "utf8").trim();
    const date = new Date(s);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function setLastSyncTime(date = new Date()) {
  try {
    const iso = (date instanceof Date ? date : new Date(date)).toISOString();
    fs.writeFileSync(STATE_FILE, iso + "\n", "utf8");
    return true;
  } catch (e) {
    console.warn("Could not write sync state file:", e.message);
    return false;
  }
}

/** Sync offset for batch mode: next $skip value (0 = start). Used when SYNC_ONE_BATCH_PER_RUN=true. */
export function getSyncOffset() {
  try {
    const s = fs.readFileSync(OFFSET_FILE, "utf8").trim();
    const n = parseInt(s, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  } catch {
    return 0;
  }
}

export function setSyncOffset(offset) {
  try {
    const n = Math.max(0, parseInt(offset, 10) || 0);
    fs.writeFileSync(OFFSET_FILE, String(n) + "\n", "utf8");
    return true;
  } catch (e) {
    console.warn("Could not write sync offset file:", e.message);
    return false;
  }
}
