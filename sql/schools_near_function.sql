-- Accurate "schools near a point" using Haversine, for table school_locations.
-- Run in Supabase SQL Editor. Backend/frontend call via RPC: schools_near(center_lat, center_lng, radius_km, max_count).
--
-- View normalizes school_locations to (lat, lng, name, ...). Pick the view block that matches your columns:
-- • If your table has "lat" and "lng" → use the first view (default below).
-- • If your table has "latitude" and "longitude" only → comment out the first view and run the alternative at the end of this file.

DROP VIEW IF EXISTS public.school_locations_geo;
-- Default: table has lat, lng (and optional name, type, address, city, province, id).
CREATE VIEW public.school_locations_geo AS
SELECT
  COALESCE(s.id::text, s.school_id::text, s.OBJECTID::text, s.GEO_ID::text, '') AS id,
  COALESCE(s.name, s.school_name, s.NAME, s.schoolname, 'School') AS name,
  COALESCE(s.type, s.school_type, s.SCHOOL_TYPE, s.SCHOOL_LEVEL) AS type,
  COALESCE(s.address, s.ADDRESS_FULL, s.SOURCE_ADDRESS, s.street) AS address,
  COALESCE(s.city, s.CITY, s.MUNICIPALITY, s.PLACE_NAME) AS city,
  COALESCE(s.province, s.state) AS province,
  s.lat::double precision AS lat,
  s.lng::double precision AS lng
FROM public.school_locations s
WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL;

-- Alternative if your table has latitude/longitude instead of lat/lng (run this and drop the view above first):
-- DROP VIEW IF EXISTS public.school_locations_geo;
-- CREATE VIEW public.school_locations_geo AS
-- SELECT COALESCE(s.id::text, '') AS id, COALESCE(s.name, s.school_name, 'School') AS name,
--        s.type, s.address, s.city, s.province,
--        s.latitude::double precision AS lat, s.longitude::double precision AS lng
-- FROM public.school_locations s WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.schools_near(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision DEFAULT 10,
  max_count int DEFAULT 20
)
RETURNS TABLE (
  id text,
  name text,
  type text,
  address text,
  city text,
  province text,
  lat double precision,
  lng double precision,
  distance_km numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH dist AS (
    SELECT
      g.id,
      g.name,
      g.type,
      g.address,
      g.city,
      g.province,
      g.lat,
      g.lng,
      (6371 * acos(least(1, greatest(-1,
        sin(radians(g.lat)) * sin(radians(center_lat)) +
        cos(radians(g.lat)) * cos(radians(center_lat)) * cos(radians(g.lng - center_lng))
      ))))::numeric(10,2) AS d
    FROM public.school_locations_geo g
    WHERE g.lat IS NOT NULL AND g.lng IS NOT NULL
  )
  SELECT d.id, d.name, d.type, d.address, d.city, d.province, d.lat, d.lng, d.d
  FROM dist d
  WHERE d.d <= radius_km
  ORDER BY d.d
  LIMIT max_count;
$$;

COMMENT ON FUNCTION public.schools_near(double precision, double precision, double precision, int) IS
  'Returns school_locations within radius_km of (center_lat, center_lng), sorted by distance, up to max_count. Uses Haversine.';
