-- Google Places: schools (all levels) and transportation. Populated by sync script using Google Places API.
-- Run in Supabase SQL Editor (once).

-- 1) Schools from Google Places (all levels: preschool, primary, secondary, university, etc.)
CREATE TABLE IF NOT EXISTS public.places_schools (
  place_id          TEXT PRIMARY KEY,   -- Google Place ID
  name              TEXT NOT NULL,
  level             TEXT,              -- preschool, primary_school, secondary_school, university, school, educational_institution
  address           TEXT,
  city              TEXT,
  province          TEXT,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  types_json        JSONB,             -- full list of place types from API
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_schools_lat_lng ON public.places_schools (lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_schools_city ON public.places_schools (city);
CREATE INDEX IF NOT EXISTS idx_places_schools_level ON public.places_schools (level);

COMMENT ON TABLE public.places_schools IS 'Schools from Google Places API (all levels). Synced by scripts/syncGooglePlaces.js.';

-- 2) Transportation from Google Places (transit, bus, train, subway, etc.)
CREATE TABLE IF NOT EXISTS public.places_transport (
  place_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  transport_type    TEXT,              -- transit_station, bus_station, train_station, subway_station, light_rail_station, etc.
  address           TEXT,
  city              TEXT,
  province          TEXT,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  types_json        JSONB,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_transport_lat_lng ON public.places_transport (lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_transport_type ON public.places_transport (transport_type);
CREATE INDEX IF NOT EXISTS idx_places_transport_city ON public.places_transport (city);

COMMENT ON TABLE public.places_transport IS 'Transportation from Google Places API. Synced by scripts/syncGooglePlaces.js.';

-- 3) RLS: allow read for app; sync script uses service role to insert/update
ALTER TABLE public.places_schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read places_schools" ON public.places_schools;
CREATE POLICY "Allow read places_schools"
  ON public.places_schools FOR SELECT TO public USING (true);

ALTER TABLE public.places_transport ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read places_transport" ON public.places_transport;
CREATE POLICY "Allow read places_transport"
  ON public.places_transport FOR SELECT TO public USING (true);

-- 4) RPCs: fetch schools and transport near a point (Haversine), for use in the app
CREATE OR REPLACE FUNCTION public.places_schools_near(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision DEFAULT 10,
  max_count int DEFAULT 20
)
RETURNS TABLE (
  place_id text,
  name text,
  level text,
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
      s.place_id,
      s.name,
      s.level,
      s.address,
      s.city,
      s.province,
      s.lat,
      s.lng,
      (6371 * acos(least(1, greatest(-1,
        sin(radians(s.lat)) * sin(radians(center_lat)) +
        cos(radians(s.lat)) * cos(radians(center_lat)) * cos(radians(s.lng - center_lng))
      ))))::numeric(10,2) AS d
    FROM public.places_schools s
  )
  SELECT d.place_id, d.name, d.level, d.address, d.city, d.province, d.lat, d.lng, d.d AS distance_km
  FROM dist d
  WHERE d.d <= radius_km
  ORDER BY d.d
  LIMIT max_count;
$$;

CREATE OR REPLACE FUNCTION public.places_transport_near(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision DEFAULT 10,
  max_count int DEFAULT 20
)
RETURNS TABLE (
  place_id text,
  name text,
  transport_type text,
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
      t.place_id,
      t.name,
      t.transport_type,
      t.address,
      t.city,
      t.province,
      t.lat,
      t.lng,
      (6371 * acos(least(1, greatest(-1,
        sin(radians(t.lat)) * sin(radians(center_lat)) +
        cos(radians(t.lat)) * cos(radians(center_lat)) * cos(radians(t.lng - center_lng))
      ))))::numeric(10,2) AS d
    FROM public.places_transport t
  )
  SELECT d.place_id, d.name, d.transport_type, d.address, d.city, d.province, d.lat, d.lng, d.d AS distance_km
  FROM dist d
  WHERE d.d <= radius_km
  ORDER BY d.d
  LIMIT max_count;
$$;
