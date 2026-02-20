-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to enable map viewport listing loading.
-- The backend calls this RPC via GET /api/listings/in-bounds.

CREATE OR REPLACE FUNCTION listings_in_bounds(
  min_lat double precision,
  max_lat double precision,
  min_lng double precision,
  max_lng double precision,
  max_count int DEFAULT 500
)
RETURNS TABLE (
  listing_key text,
  idx jsonb,
  vow jsonb,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.listing_key,
    l.idx,
    l.vow,
    l.updated_at
  FROM listings_unified_clean l
  WHERE (
    (COALESCE(
      (l.idx->>'Latitude')::double precision,
      (l.vow->>'Latitude')::double precision,
      (l.idx->>'latitude')::double precision,
      (l.vow->>'latitude')::double precision
    ) BETWEEN min_lat AND max_lat)
    AND (COALESCE(
      (l.idx->>'Longitude')::double precision,
      (l.vow->>'Longitude')::double precision,
      (l.idx->>'longitude')::double precision,
      (l.vow->>'longitude')::double precision
    ) BETWEEN min_lng AND max_lng)
  )
  ORDER BY l.updated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(max_count, 500), 1000));
$$;

COMMENT ON FUNCTION listings_in_bounds(double precision, double precision, double precision, double precision, int) IS
  'Returns listings whose lat/lng (from idx or vow JSONB) fall within the given bounds. Used by map viewport loading.';
