import { NextResponse } from "next/server";
import { parseSearchBodySchema } from "@/lib/validationSchemas";

// Server-only. Never expose via NEXT_PUBLIC_* or client bundle.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const MAX_QUERY_LENGTH = 500;
const MAX_LOCATION_LENGTH = 100;
const MAX_RESPONSE_LENGTH = 300;
const MAX_PRICE = 1e10;
const MIN_PRICE = 0;
const MAX_BEDS_BATHS = 20;
const ALLOWED_TYPES = ["condo", "house", "townhouse", "commercial", "land", "multi-family"];
const ALLOWED_AMENITIES = ["Pool", "Parking", "Garage", "Gym", "Waterfront", "Guest House", "Concierge", "Smart Home", "Laundry", "Balcony", "Fireplace", "Air Conditioning", "Elevator", "Storage"];

/** Strip control chars and limit length to prevent injection / abuse. */
function sanitizeQuery(input) {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  const noControl = trimmed.replace(/[\x00-\x1f\x7f]/g, "");
  return noControl.slice(0, MAX_QUERY_LENGTH);
}

/** Sanitize string for safe display (no HTML/script). */
function sanitizeString(s, maxLen) {
  if (s == null || typeof s !== "string") return undefined;
  const noHtml = s.replace(/<[^>]*>/g, "").replace(/[\x00-\x1f\x7f]/g, "").trim();
  return noHtml.slice(0, maxLen) || undefined;
}

/** Validate and clamp numbers from Gemini. */
function sanitizeNumber(value, min, max) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.max(min, Math.min(max, n));
  return clamped === min || clamped === max ? clamped : Math.floor(clamped);
}

export async function POST(request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Search parsing not configured." },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = parseSearchBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors?.[0]?.message ?? "Missing or invalid query." },
        { status: 400 }
      );
    }
    const raw = (parsed.data.q ?? parsed.data.query ?? "").trim();
    const query = sanitizeQuery(raw);
    if (!query) {
      return NextResponse.json(
        { error: "Missing or invalid query." },
        { status: 400 }
      );
    }

    const systemPrompt = `You extract real estate search filters from the user's message. CRITICAL: Extract EVERY criterion the user mentions. NEVER return only location when they also said a price, type, or beds. If they say "home for 800k in Toronto" you MUST return location Toronto AND maxPrice 800000 AND type house — all three. If they mention a number with k or million, extract it as minPrice or maxPrice. If they say home, house, or condo, extract type. Output every filter they mention.

RULES:
- location: city or region (Toronto, Oakville, Vancouver, GTA, etc). Use null only if no place mentioned.
- beds: integer. "3 bedroom", "three bedroom", "3 bed" → 3. Words: one→1, two→2, three→3, four→4, five→5.
- baths: integer. Same. "2 bath", "two bathroom" → 2.
- type: exactly one of condo, house, townhouse, commercial, land, multi-family, or null. "home" or "house" or "detached" → house. "condo" or "apartment" → condo.
- minPrice/maxPrice: numbers. "under 800k", "less than 800k", "less than 800k amount", "below 500k", "for 800k", "for 800k in Toronto", "at 800k", "around 800k", "800k" (as budget) → maxPrice 800000. "under 500k" → maxPrice 500000. "under 1 million" or "under 1M" → maxPrice 1000000. "over 400k" → minPrice 400000.
- amenities: array of strings. Extract when user says "with gym or pool", "amenities like gym, pool", "with pool", "has gym", "with parking", "with garage", etc. Use ONLY these exact values (capitalized): Pool, Parking, Garage, Gym, Waterfront, Guest House, Concierge, Smart Home, Laundry, Balcony, Fireplace, Air Conditioning, Elevator, Storage. Map: gym/fitness/exercise → Gym, pool/swimming → Pool, parking/driveway → Parking, garage → Garage, waterfront/lakefront → Waterfront, guest house/in-law suite → Guest House, concierge → Concierge, smart home → Smart Home, laundry/washer/dryer → Laundry, balcony/terrace/deck → Balcony, fireplace → Fireplace, AC/air conditioning/central air → Air Conditioning, elevator/lift → Elevator, storage/locker → Storage. Return [] if no amenities mentioned.
- conversationalResponse: one short sentence summarizing ALL criteria INCLUDING PRICE when user gave one, AND AMENITIES when mentioned (e.g. "Homes in Oakville under $800K." or "Homes with gym, pool."). Plain text only.
- forSaleOnly: boolean. If the user asks for a home, house, condo, etc. and does NOT say "rent", "rentals", "rental", "monthly", "per month", "$/mo", or "lease", set forSaleOnly to true (they want to buy). If they say rent, rentals, rental, monthly, per month, lease, or "add rentals" (show me rentals), set forSaleOnly to false. Default true when type is house/condo/townhouse and rent not mentioned.

EXAMPLES (return every mentioned criterion):
"find me a home under 800k in Oakville" → {"location":"Oakville","minPrice":null,"maxPrice":800000,"beds":null,"baths":null,"type":"house","forSaleOnly":true,"conversationalResponse":"Homes in Oakville under $800K."}
"find me a home for 800k in Toronto" → {"location":"Toronto","minPrice":null,"maxPrice":800000,"beds":null,"baths":null,"type":"house","forSaleOnly":true,"conversationalResponse":"Homes in Toronto for $800K or less."}
"house with 3 bedrooms" → {"location":null,"minPrice":null,"maxPrice":null,"beds":3,"baths":null,"type":"house","conversationalResponse":"Here are 3 bedroom homes."}
"condo in Toronto under 800k" → {"location":"Toronto","minPrice":null,"maxPrice":800000,"beds":null,"baths":null,"type":"condo","conversationalResponse":"Condos in Toronto under $800K."}
"2 bed 1 bath in Oakville under 600k" → {"location":"Oakville","minPrice":null,"maxPrice":600000,"beds":2,"baths":1,"type":null,"conversationalResponse":"2 bed, 1 bath in Oakville under $600K."}
"find me a home less than 800k" → {"location":null,"minPrice":null,"maxPrice":800000,"beds":null,"baths":null,"type":"house","forSaleOnly":true,"conversationalResponse":"Homes under $800K."}
"home with gym or pool" → {"location":null,"minPrice":null,"maxPrice":null,"beds":null,"baths":null,"type":"house","forSaleOnly":true,"amenities":["Gym","Pool"],"conversationalResponse":"Homes with gym, pool."}
"condo with amenities like a gym and pool" → {"location":null,"minPrice":null,"maxPrice":null,"beds":null,"baths":null,"type":"condo","forSaleOnly":true,"amenities":["Gym","Pool"],"conversationalResponse":"Condos with gym, pool."}
"rentals" or "add rentals" or "show rentals" → {"location":null,"minPrice":null,"maxPrice":null,"beds":null,"baths":null,"type":null,"forSaleOnly":false,"conversationalResponse":"Here are rentals."}

Output the JSON object only.`;
    const userMessage = `User message: ${query}`;

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] },
        ],
        generationConfig: { temperature: 0.05, maxOutputTokens: 512 },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Search parsing failed." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "No response from parser." },
        { status: 502 }
      );
    }

    const cleaned = text.replace(/^```json?\s*|\s*```$/g, "").trim();
    let filters;
    try {
      filters = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Invalid parser response." },
        { status: 502 }
      );
    }

    let location = sanitizeString(filters.location, MAX_LOCATION_LENGTH);
    let minPrice = sanitizeNumber(filters.minPrice, MIN_PRICE, MAX_PRICE);
    let maxPrice = sanitizeNumber(filters.maxPrice, MIN_PRICE, MAX_PRICE);
    let beds = sanitizeNumber(filters.beds, 0, MAX_BEDS_BATHS);
    let baths = sanitizeNumber(filters.baths, 0, MAX_BEDS_BATHS);
    let typeRaw = typeof filters.type === "string" ? filters.type.trim().toLowerCase() : "";
    if (typeRaw === "apartment" || typeRaw === "detached") typeRaw = typeRaw === "apartment" ? "condo" : "house";
    let type = ALLOWED_TYPES.includes(typeRaw) ? typeRaw : undefined;
    const rawAmenities = Array.isArray(filters.amenities) ? filters.amenities : [];
    const allowedLower = Object.fromEntries(ALLOWED_AMENITIES.map((x) => [x.toLowerCase(), x]));
    const amenities = rawAmenities
      .filter((a) => typeof a === "string" && a.trim())
      .map((a) => ALLOWED_AMENITIES.includes(a.trim()) ? a.trim() : allowedLower[a.trim().toLowerCase()] || null)
      .filter(Boolean);
    const uniqueAmenities = [...new Set(amenities)];

    const qLower = query.toLowerCase();
    if (maxPrice == null && minPrice == null) {
      const underM = query.match(/\b(?:under|for|at|around)\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/i);
      if (underM) {
        let v = parseFloat(underM[1]);
        if ((underM[2] || "").toLowerCase() === "k") v *= 1000;
        if ((underM[2] || "").toLowerCase() === "m" || (underM[2] || "").toLowerCase() === "million") v *= 1000000;
        if (Number.isFinite(v) && v >= MIN_PRICE && v <= MAX_PRICE) maxPrice = Math.floor(v);
      }
      const overM = query.match(/\bover\s+\$?(\d+(?:\.\d+)?)\s*(k|m|million)?/i);
      if (overM && maxPrice == null) {
        let v = parseFloat(overM[1]);
        if ((overM[2] || "").toLowerCase() === "k") v *= 1000;
        if ((overM[2] || "").toLowerCase() === "m" || (overM[2] || "").toLowerCase() === "million") v *= 1000000;
        if (Number.isFinite(v) && v >= MIN_PRICE && v <= MAX_PRICE) minPrice = Math.floor(v);
      }
    }
    if (!type) {
      if (/\b(?:home|house|detached)\b/.test(qLower)) type = "house";
      else if (/\b(?:condo|apartment)\b/.test(qLower)) type = "condo";
      else if (/\btownhouse\b/.test(qLower)) type = "townhouse";
      else if (/\bcommercial\b/.test(qLower)) type = "commercial";
    }
    const conversationalResponse = sanitizeString(
      filters.conversationalResponse ?? `Showing properties matching "${query}".`,
      MAX_RESPONSE_LENGTH
    ) || `Showing properties matching "${query}".`;

    const hasFilters = location || minPrice != null || maxPrice != null || beds != null || baths != null || type || uniqueAmenities.length > 0 || filters.forSaleOnly === true || filters.forSaleOnly === false;
    if (!hasFilters) {
      return NextResponse.json(
        { location: undefined, minPrice: undefined, maxPrice: undefined, beds: undefined, baths: undefined, type: undefined, forSaleOnly: undefined, amenities: [], conversationalResponse },
        { status: 200 }
      );
    }

    const forSaleOnly =
      filters.forSaleOnly === false ? false :
      filters.forSaleOnly === true ? true :
      type != null ? true : undefined;

    return NextResponse.json({
      location: location ?? undefined,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      beds: beds ?? undefined,
      baths: baths ?? undefined,
      type: type ?? undefined,
      forSaleOnly: forSaleOnly ?? undefined,
      amenities: uniqueAmenities.length ? uniqueAmenities : undefined,
      conversationalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Search parsing failed." },
      { status: 500 }
    );
  }
}
