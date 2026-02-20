import { z } from "zod";

const MAX_QUERY_LEN = 500;
const MAX_LOCATION_LEN = 100;
const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 200;
const MAX_PHONE_LEN = 50;
const MAX_SESSION_ID_LEN = 500;
const MAX_USER_ID_LEN = 128;
const MAX_ORIGINAL_QUERY_LEN = 300;
const MAX_PRICE = 1e10;
const MIN_PRICE = 0;
const MAX_BEDS_BATHS = 20;
const ALLOWED_TYPES = ["condo", "house", "townhouse", "commercial", "land", "multi-family"];
const MAX_AMENITY_ITEM_LEN = 50;
const MAX_AMENITIES = 20;

/** Parse-search: body with optional q or query (one required for valid request). */
export const parseSearchBodySchema = z.object({
  q: z.string().max(MAX_QUERY_LEN).optional(),
  query: z.string().max(MAX_QUERY_LEN).optional(),
}).strict().refine((d) => (d.q ?? d.query ?? "").trim().length > 0, { message: "Missing or invalid query." });

/** Listings search: body with filters object. type can be normalized (condo, house, ...) or raw MLS type (Detached, Condo Apartment, etc.). */
const voiceSearchFiltersSchema = z.object({
  location: z.string().max(MAX_LOCATION_LEN).optional(),
  minPrice: z.coerce.number().min(MIN_PRICE).max(MAX_PRICE).optional(),
  maxPrice: z.coerce.number().min(MIN_PRICE).max(MAX_PRICE).optional(),
  beds: z.coerce.number().int().min(0).max(MAX_BEDS_BATHS).optional(),
  baths: z.coerce.number().int().min(0).max(MAX_BEDS_BATHS).optional(),
  type: z.union([z.enum(ALLOWED_TYPES), z.string().max(MAX_LOCATION_LEN)]).optional(),
  amenities: z.array(z.string().max(MAX_AMENITY_ITEM_LEN)).max(MAX_AMENITIES).optional(),
  forSaleOnly: z.boolean().optional(),
}).strict();

export const listingsSearchBodySchema = z.object({
  filters: voiceSearchFiltersSchema.optional(),
}).strict();

/** Suggest-search: body with originalFilters/filters and optional originalQuery. */
const suggestFiltersSchema = z.object({
  location: z.string().max(MAX_LOCATION_LEN).optional(),
  minPrice: z.coerce.number().min(MIN_PRICE).max(MAX_PRICE).optional(),
  maxPrice: z.coerce.number().min(MIN_PRICE).max(MAX_PRICE).optional(),
  beds: z.coerce.number().int().min(0).max(MAX_BEDS_BATHS).optional(),
  baths: z.coerce.number().int().min(0).max(MAX_BEDS_BATHS).optional(),
  type: z.enum(ALLOWED_TYPES).optional(),
}).strict();

export const suggestSearchBodySchema = z.object({
  originalFilters: suggestFiltersSchema.optional(),
  filters: suggestFiltersSchema.optional(),
  originalQuery: z.string().max(MAX_ORIGINAL_QUERY_LEN).optional(),
}).strict();

/** Verify-agent-pro: body with optional session_id, email, user_id. */
export const verifyAgentProBodySchema = z.object({
  session_id: z.string().max(MAX_SESSION_ID_LEN).optional(),
  email: z.string().email().max(MAX_EMAIL_LEN).optional(),
  user_id: z.string().max(MAX_USER_ID_LEN).optional(),
}).strict();

/** Checkout sessions: body with optional email, name, phone. */
export const checkoutSessionsBodySchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LEN).optional(),
  name: z.string().max(MAX_NAME_LEN).optional(),
  phone: z.string().max(MAX_PHONE_LEN).optional(),
}).strict();

/** GET query params: lat, lng, limit (for transit/near and schools/near). */
export const latLngLimitQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
