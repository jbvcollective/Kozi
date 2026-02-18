-- Schools / school_locations: "Schools near this listing" on property pages.
-- Run in Supabase SQL Editor (once). Uses table school_locations with columns: lat, lng, name (optional: type, address, city, province).
-- Backend and frontend try RPC schools_near first, then query this table directly.

-- 1) Table: one row per school
CREATE TABLE IF NOT EXISTS public.school_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT,           -- e.g. 'elementary', 'secondary', 'private'
  address       TEXT,
  city          TEXT,
  province      TEXT,           -- e.g. 'ON', 'BC'
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_locations_lat_lng ON public.school_locations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_school_locations_city ON public.school_locations (city);

COMMENT ON TABLE public.school_locations IS 'School locations for "Schools near this location" on listing pages. Columns: lat, lng, name; optional: type, address, city, province.';

-- 2) View for RPC: normalizes columns to lat, lng, name, type, address, city, province
DROP VIEW IF EXISTS public.school_locations_geo;
CREATE VIEW public.school_locations_geo AS
SELECT
  COALESCE(s.id::text, '') AS id,
  COALESCE(s.name, 'School') AS name,
  s.type,
  s.address,
  s.city,
  s.province,
  s.lat::double precision AS lat,
  s.lng::double precision AS lng
FROM public.school_locations s
WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL;

-- 3) RPC: schools near a point (Haversine distance, sorted by distance)
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
  'Returns school_locations within radius_km of (center_lat, center_lng), sorted by distance, up to max_count.';

-- 4) RLS: allow public read (so backend and frontend can query schools)
ALTER TABLE public.school_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read school_locations" ON public.school_locations;
CREATE POLICY "Allow public read school_locations"
  ON public.school_locations FOR SELECT TO public USING (true);

-- 5) Sample data (Ontario – Lanark area and nearby). Add your own or import from open data.
-- Only insert when table is empty so re-running this file doesn't duplicate.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.school_locations) = 0 THEN
    INSERT INTO public.school_locations (name, type, address, city, province, lat, lng)
    VALUES
      ('Lanark Public School', 'elementary', 'George St', 'Lanark', 'ON', 45.018, -76.366),
      ('Carleton Place High School', 'secondary', '170 McNeely Ave', 'Carleton Place', 'ON', 45.137, -76.141),
      ('Smiths Falls District Collegiate Institute', 'secondary', '77 Abbott St', 'Smiths Falls', 'ON', 44.897, -76.023),
      ('Almonte District High School', 'secondary', '313 Martin St S', 'Almonte', 'ON', 45.227, -76.195),
      ('R. Tait McKenzie Public School', 'elementary', '567 Riddell St', 'Almonte', 'ON', 45.224, -76.198);
  END IF;
END $$;
