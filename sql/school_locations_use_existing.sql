-- Use your EXISTING school_locations table for "Schools near this listing".
-- Run in Supabase SQL Editor. No table creation or sample data.
-- Your table must have coordinates (lat/lng or latitude/longitude) and a name column.

-- 1) View: reads from school_locations. Columns: name, board_name, school_address, school_type_desc, postal_code, municipality, city, latitude, longitude, geometry (supports lowercase or UPPERCASE names).
DROP VIEW IF EXISTS public.school_locations_geo;
CREATE VIEW public.school_locations_geo AS
SELECT
  COALESCE(s._id::text, (COALESCE(s.name, s.NAME, '') || '-' || COALESCE(s.latitude, s.LATITUDE, ST_Y(s.geometry))::text || '-' || COALESCE(s.longitude, s.LONGITUDE, ST_X(s.geometry))::text), '') AS id,
  COALESCE(s.name, s.NAME, 'School') AS name,
  COALESCE(s.school_type_desc, s.SCHOOL_TYPE_DESC, s.board_name, s.BOARD_NAME, '') AS type,
  COALESCE(s.school_address, s.SCHOOL_ADDRESS, '') AS address,
  COALESCE(s.city, s.CITY, s.municipality, s.MUNICIPALITY, '') AS city,
  COALESCE(s.postal_code, s.POSTAL_CODE, '') AS province,
  (COALESCE(s.latitude, s.LATITUDE, ST_Y(s.geometry))::double precision) AS lat,
  (COALESCE(s.longitude, s.LONGITUDE, ST_X(s.geometry))::double precision) AS lng
FROM public.school_locations s
WHERE (COALESCE(s.latitude, s.LATITUDE) IS NOT NULL AND COALESCE(s.longitude, s.LONGITUDE) IS NOT NULL) OR s.geometry IS NOT NULL;

-- 2) RPC: schools near a point (Haversine), sorted by distance
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
  'Returns school_locations within radius_km of (center_lat, center_lng), sorted by distance.';

-- 3) RLS: allow read so backend/frontend can query schools (skip if you don't use RLS on this table)
ALTER TABLE public.school_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read school_locations" ON public.school_locations;
CREATE POLICY "Allow public read school_locations"
  ON public.school_locations FOR SELECT TO public USING (true);

-- If the view fails (e.g. "column latitude does not exist"), your table may use different names.
-- Option A: If you have latitude/longitude instead of lat/lng, run this instead of the view above:
-- DROP VIEW IF EXISTS public.school_locations_geo;
-- CREATE VIEW public.school_locations_geo AS
-- SELECT
--   COALESCE(s.id::text, '') AS id,
--   COALESCE(s.name, s.school_name, 'School') AS name,
--   s.type, s.address, s.city, s.province,
--   s.latitude::double precision AS lat,
--   s.longitude::double precision AS lng
-- FROM public.school_locations s
-- WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL;
