import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapListingToProperty } from "@/lib/propertyUtils";
import { matchesVoiceSearchFilters } from "@/lib/voiceSearchFilters";
import { listingsSearchBodySchema } from "@/lib/validationSchemas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Anon key is safe for this server-side route; RLS applies. Never use service role here unless required.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const CHUNK_SIZE = 1000;
const MAX_SCAN = 10000;
const MAX_RESULTS = 2000;

export async function POST(request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Search not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = listingsSearchBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const filters = parsed.data.filters ?? {};
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  // Query runs as anon; if RLS requires auth, frontend falls back to client-side filter

  const results = [];
  let scanned = 0;

  try {
    while (scanned < MAX_SCAN && results.length < MAX_RESULTS) {
      const { data: rows, error } = await supabase
        .from("listings_unified_clean")
        .select("listing_key, idx, vow, updated_at")
        .order("updated_at", { ascending: false })
        .range(scanned, scanned + CHUNK_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!rows?.length) break;

      for (const row of rows) {
        const property = mapListingToProperty(row);
        if (matchesVoiceSearchFilters(property, filters)) {
          results.push(row);
          if (results.length >= MAX_RESULTS) break;
        }
      }
      scanned += rows.length;
      if (rows.length < CHUNK_SIZE) break;
    }

    return NextResponse.json({ data: results });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Search failed." }, { status: 500 });
  }
}
