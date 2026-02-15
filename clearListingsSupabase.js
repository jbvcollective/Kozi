/**
 * Clear all rows from Supabase idx_listings table (IDX payload).
 * Run this before re-fetching to start fresh.
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

async function clear() {
  const { error } = await supabase.from("idx_listings").delete().gte("listing_key", "");
  if (error) {
    console.error("Delete error:", error.message);
    process.exit(1);
  }
  console.log("Cleared all rows from idx_listings.");
}

clear();
