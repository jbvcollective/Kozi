import { NextResponse } from "next/server";
import { suggestSearchBodySchema } from "@/lib/validationSchemas";

// Server-only. Never expose via NEXT_PUBLIC_* or client bundle.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const MAX_LOCATION_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 200;
const MAX_PRICE = 1e10;
const MIN_PRICE = 0;
const MAX_BEDS_BATHS = 20;
const ALLOWED_TYPES = ["condo", "house", "townhouse", "commercial", "land", "multi-family"];

function sanitizeString(s, maxLen) {
  if (s == null || typeof s !== "string") return undefined;
  const noHtml = s.replace(/<[^>]*>/g, "").replace(/[\x00-\x1f\x7f]/g, "").trim();
  return noHtml.slice(0, maxLen) || undefined;
}

function sanitizeNumber(value, min, max) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.max(min, Math.min(max, n));
  return clamped === min || clamped === max ? clamped : Math.floor(clamped);
}

function getOriginalSummary(filters) {
  const parts = [];
  if (filters.location) parts.push(`location: ${filters.location}`);
  if (filters.minPrice != null) parts.push(`minPrice: ${filters.minPrice}`);
  if (filters.maxPrice != null) parts.push(`maxPrice: ${filters.maxPrice}`);
  if (filters.beds != null) parts.push(`beds: ${filters.beds}`);
  if (filters.baths != null) parts.push(`baths: ${filters.baths}`);
  if (filters.type) parts.push(`type: ${filters.type}`);
  return parts.length ? parts.join(", ") : "none";
}

export async function POST(request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Suggestions not configured." }, { status: 503 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = suggestSearchBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const raw = parsed.data.originalFilters ?? parsed.data.filters ?? {};
    const originalQuery = parsed.data.originalQuery ?? "";

    const originalFilters = {
      location: raw.location,
      minPrice: raw.minPrice,
      maxPrice: raw.maxPrice,
      beds: raw.beds,
      baths: raw.baths,
      type: raw.type,
    };

    const hasAny = originalFilters.location || originalFilters.minPrice != null || originalFilters.maxPrice != null ||
      originalFilters.beds != null || originalFilters.baths != null || originalFilters.type;
    if (!hasAny) {
      return NextResponse.json({ error: "No filters to relax." }, { status: 400 });
    }

    const summary = getOriginalSummary(originalFilters);
    const systemPrompt = `You are a real estate search assistant. The user's search had NO results. Their criteria were: ${summary}.${originalQuery ? ` Their exact words: "${originalQuery}".` : ""}

Suggest ONE similar search so they still see relevant listings. IMPORTANT: Prefer keeping location, beds, baths, and type the SAME as they asked. It is OK to relax or REMOVE price (set minPrice and maxPrice to null) so that similar listings can be shown — same area, same size/type, even if not in their price range. For example: if they asked "homes in Wichita 2 bed under $1K" and nothing exists at that price, suggest the same location + beds + type but with no price filter, message like "No 2 bed homes under $1K in Wichita. Here are 2 bedroom homes in Wichita (any price)." Only change price or other criteria when dropping price alone would still give no results. The suggestion must keep at least one of their criteria (location, type, beds, baths, or price).

Return ONLY a valid JSON object with: location (string or null), minPrice (number or null), maxPrice (number or null), beds (number or null), baths (number or null), type (exactly one of: condo, house, townhouse, commercial, land, multi-family, or null), and message (one short plain-text sentence, no HTML, e.g. "Similar: 2 bed homes in Wichita (any price).").`;

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 384 },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Suggestion failed." }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "No suggestion." }, { status: 502 });
    }

    const cleaned = text.replace(/^```json?\s*|\s*```$/g, "").trim();
    let suggestion;
    try {
      suggestion = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Invalid suggestion." }, { status: 502 });
    }

    const location = sanitizeString(suggestion.location, MAX_LOCATION_LENGTH);
    const minPrice = sanitizeNumber(suggestion.minPrice, MIN_PRICE, MAX_PRICE);
    const maxPrice = sanitizeNumber(suggestion.maxPrice, MIN_PRICE, MAX_PRICE);
    const beds = sanitizeNumber(suggestion.beds, 0, MAX_BEDS_BATHS);
    const baths = sanitizeNumber(suggestion.baths, 0, MAX_BEDS_BATHS);
    const typeRaw = typeof suggestion.type === "string" ? suggestion.type.trim().toLowerCase() : "";
    const type = ALLOWED_TYPES.includes(typeRaw) ? typeRaw : undefined;
    const message = sanitizeString(suggestion.message ?? "Here are similar listings.", MAX_MESSAGE_LENGTH) || "Here are similar listings.";

    const suggestedHasAny = location || minPrice != null || maxPrice != null || beds != null || baths != null || type;
    if (!suggestedHasAny) {
      return NextResponse.json({ error: "Suggestion had no filters." }, { status: 502 });
    }

    const hasLocation = Boolean(originalFilters.location && location);
    const hasType = Boolean(originalFilters.type && type);
    const hasBeds = Boolean(originalFilters.beds != null && beds != null);
    const hasBaths = Boolean(originalFilters.baths != null && baths != null);
    const hasPrice = (originalFilters.minPrice != null || originalFilters.maxPrice != null) && (minPrice != null || maxPrice != null);
    const hasOverlap = hasLocation || hasType || hasBeds || hasBaths || hasPrice;
    if (!hasOverlap) {
      return NextResponse.json({ error: "Suggestion must share at least one criterion (location, type, beds, baths, or price)." }, { status: 502 });
    }

    return NextResponse.json({
      location: location ?? undefined,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      beds: beds ?? undefined,
      baths: baths ?? undefined,
      type: type ?? undefined,
      message,
    });
  } catch (err) {
    return NextResponse.json({ error: "Suggestion failed." }, { status: 500 });
  }
}
