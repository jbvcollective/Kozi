/**
 * processListingPhotos.js
 * Processes PropTx MLS listing photos: dedupe, pick best resolution/orientation,
 * prioritize hero image, and return web (10–12) and mobile (6–8) arrays.
 * Optimized for Node.js; no external dependencies.
 */

// --- Constants (tunable) ---
const WEB_PHOTO_COUNT = { min: 10, max: 12 };
const MOBILE_PHOTO_COUNT = { min: 6, max: 8 };
const WEB_SIZE = { w: 1920, h: 1920 };   // rs:fit:1920:1920
const MOBILE_SIZE = { w: 1080, h: 1080 }; // rs:fit:1080:1080

// Keywords that suggest "hero" image (front exterior / main living). Order matters for tie-breaks.
const HERO_KEYWORDS = [
  "front", "exterior", "facade", "street", "curb", "frontview",
  "living", "familyroom", "greatroom", "main", "hero", "feature",
  "aerial", "overview", "1_", "01_", "photo_1", "image_1", "img_1",
];
const LANDSCAPE_RATIO_THRESHOLD = 1.1;  // width/height >= 1.1 => landscape
const PORTRAIT_RATIO_THRESHOLD = 0.9;   // width/height <= 0.9 => portrait

// --- Helper: Base image (ignore URL parameters) ---
/**
 * Base image key: origin + pathname only. Query string and hash are ignored so
 * the same image at different sizes (e.g. rs:fit:400:300 vs rs:fit:1200:800) groups together.
 * @param {string} url
 * @returns {string}
 */
function getUrlSignature(url) {
  try {
    const u = new URL(String(url).trim());
    return u.origin + u.pathname;
  } catch {
    return String(url).trim();
  }
}

// --- Helper: Parse dimensions from PropTx-style or common URL patterns ---
/**
 * Extracts width and height from URL (PropTx rs:fit:W:H, or w=, width=, h=, height=).
 * @param {string} url
 * @returns {{ w: number, h: number } | null}
 */
function parseDimensionsFromUrl(url) {
  const s = String(url);
  // PropTx: rs:fit:1920:1080 or rs:fit:400:300
  const rsFit = s.match(/rs:fit:(\d+):(\d+)/i);
  if (rsFit) return { w: parseInt(rsFit[1], 10) || 0, h: parseInt(rsFit[2], 10) || 0 };
  // Query/fragment: w=800, width=800, h=600, height=600
  const w = s.match(/[?&_]w(?:idth)?=(\d+)/i) || s.match(/width=(\d+)/i);
  const h = s.match(/[?&_]h(?:eight)?=(\d+)/i) || s.match(/height=(\d+)/i);
  if (w || h) return { w: w ? parseInt(w[1], 10) : 0, h: h ? parseInt(h[1], 10) : 0 };
  return null;
}

// --- Helper: Resolution score (prefer larger) ---
/**
 * Single numeric score for resolution: larger dimension sum = better.
 * Capped to avoid one giant image dominating; we care about relative order.
 * @param {string} url
 * @returns {number}
 */
function getResolutionScore(url) {
  const dims = parseDimensionsFromUrl(url);
  if (!dims || (!dims.w && !dims.h)) return 0;
  const maxSide = Math.max(dims.w || 0, dims.h || 0);
  const minSide = Math.min(dims.w || 0, dims.h || 0) || maxSide;
  return Math.min(maxSide + minSide, 4000);
}

// --- Helper: Orientation score (prefer landscape) ---
/**
 * Returns positive for landscape, negative for portrait, 0 for square.
 * Used for sorting so landscape images rank higher.
 * @param {string} url
 * @returns {number}
 */
function getOrientationScore(url) {
  const dims = parseDimensionsFromUrl(url);
  if (!dims || (!dims.w && !dims.h)) return 0;
  const w = dims.w || 1;
  const h = dims.h || 1;
  const ratio = w / h;
  if (ratio >= LANDSCAPE_RATIO_THRESHOLD) return 1;
  if (ratio <= PORTRAIT_RATIO_THRESHOLD) return -1;
  return 0;
}

// --- Helper: Hero score (front exterior / main living) ---
/**
 * Scores how likely this image is the "hero" (front exterior or main living).
 * Uses URL path and optional original index (MLS often puts hero first).
 * @param {string} url
 * @param {number} originalIndex - 0-based index in the original array
 * @returns {number} higher = more likely hero
 */
function getHeroScore(url, originalIndex = 0) {
  const path = (url || "").toLowerCase();
  let score = 0;
  for (let i = 0; i < HERO_KEYWORDS.length; i++) {
    if (path.includes(HERO_KEYWORDS[i])) score += 100 - i;
  }
  // MLS feeds often put the main exterior first
  if (originalIndex === 0) score += 50;
  if (originalIndex <= 2) score += 20;
  return score;
}

// --- Helper: Penalize thumbnail/small in URL ---
function isSmallOrThumb(url) {
  const s = String(url).toLowerCase();
  return /\b(thumb|thumbnail|small|tiny|mini|sm|_sm\b|_thumb)/.test(s);
}

// --- Step 1: Deduplicate by base image; pick highest resolution per base ---
/**
 * Deduplicate by base image (ignore URL parameters). For each base, keep the
 * single highest-resolution variant (resolution first, then avoid thumb/small, then landscape).
 * @param {string[]} urls
 * @returns {string[]}
 */
function pickBestVariantPerImage(urls) {
  const bySig = new Map();
  const order = [];

  for (const u of urls) {
    const s = String(u).trim();
    if (!s) continue;
    const sig = getUrlSignature(s);
    const existing = bySig.get(sig);

    const resScore = getResolutionScore(s);
    const orientScore = getOrientationScore(s);
    const smallPenalty = isSmallOrThumb(s) ? -500 : 0;
    const combined = resScore + orientScore * 50 + smallPenalty;

    if (!existing || combined > existing.score) {
      bySig.set(sig, { url: s, score: combined });
      if (!existing) order.push(sig);
    }
  }

  return order.map((sig) => bySig.get(sig).url);
}

// --- Step 2: Sort so hero is first, then by quality (resolution + landscape) ---
/**
 * Sorts deduped URLs: highest hero score first, then by resolution + orientation.
 * @param {string[]} urls - deduped list
 * @param {number[]} [originalIndices] - optional 0-based index per url in original array
 * @returns {string[]}
 */
function sortWithHeroFirst(urls, originalIndices = []) {
  return [...urls].sort((a, b) => {
    const idxA = urls.indexOf(a);
    const idxB = urls.indexOf(b);
    const origA = originalIndices[idxA] ?? idxA;
    const origB = originalIndices[idxB] ?? idxB;

    const heroA = getHeroScore(a, origA);
    const heroB = getHeroScore(b, origB);
    if (heroB !== heroA) return heroB - heroA;

    const resA = getResolutionScore(a);
    const resB = getResolutionScore(b);
    if (resB !== resA) return resB - resA;

    const orientB = getOrientationScore(b);
    const orientA = getOrientationScore(a);
    return orientB - orientA;
  });
}

// --- Step 3: Normalize PropTx URL to a target size (rs:fit:W:H) ---
function toPropTxSize(url, w, h) {
  const s = String(url).trim();
  if (/rs:fit:\d+:\d+/.test(s)) return s.replace(/rs:fit:\d+:\d+/, `rs:fit:${w}:${h}`);
  return s;
}

// --- Main export ---
/**
 * Process listing photos: dedupe, prefer high-res and landscape, put hero first,
 * return web (10–12) and mobile (6–8) arrays with hero first.
 *
 * @param {object} listing - listing object
 * @param {string} listing.listingNumber - listing id
 * @param {string[]} listing.photos - array of PropTx photo URLs (or use second arg)
 * @param {string[]} [photos] - optional override: use this array instead of listing.photos
 * @returns {{ webPhotos: string[], mobilePhotos: string[] }}
 */
function processListingPhotos(listing, photos = null) {
  const raw = photos ?? (listing && Array.isArray(listing.photos) ? listing.photos : []);
  const urlList = raw.filter((u) => typeof u === "string" && String(u).trim().length > 0);
  if (urlList.length === 0) return { webPhotos: [], mobilePhotos: [] };

  // 1) Deduplicate by base image (ignore URL params); pick highest resolution per base
  const deduped = pickBestVariantPerImage(urlList);
  if (deduped.length === 0) return { webPhotos: [], mobilePhotos: [] };

  // 2) Build original-index map (index in urlList for hero scoring)
  const sigToFirstIndex = new Map();
  urlList.forEach((u, i) => {
    const sig = getUrlSignature(u);
    if (!sigToFirstIndex.has(sig)) sigToFirstIndex.set(sig, i);
  });
  const originalIndices = deduped.map((u) => sigToFirstIndex.get(getUrlSignature(u)) ?? 0);

  // 3) Sort: hero first, then resolution, then landscape
  const sorted = sortWithHeroFirst(deduped, originalIndices);

  // 4) Cap counts: web 10–12, mobile 6–8 (use max for best coverage; caller can slice if needed)
  const webCount = Math.min(sorted.length, WEB_PHOTO_COUNT.max);
  const mobileCount = Math.min(sorted.length, MOBILE_PHOTO_COUNT.max);
  const webSlice = sorted.slice(0, webCount);
  const mobileSlice = sorted.slice(0, mobileCount);

  // 5) Highest-resolution URLs normalized to web (1920) and mobile (1080) sizes
  const webPhotos = webSlice.map((u) => toPropTxSize(u, WEB_SIZE.w, WEB_SIZE.h));
  const mobilePhotos = mobileSlice.map((u) => toPropTxSize(u, MOBILE_SIZE.w, MOBILE_SIZE.h));

  return { webPhotos, mobilePhotos };
}

export {
  processListingPhotos,
  getUrlSignature,
  parseDimensionsFromUrl,
  getResolutionScore,
  getOrientationScore,
  getHeroScore,
  pickBestVariantPerImage,
  sortWithHeroFirst,
  WEB_PHOTO_COUNT,
  MOBILE_PHOTO_COUNT,
};
