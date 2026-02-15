-- School locations for "schools near this listing" on property pages.
-- Run in Supabase SQL Editor. Populate from your own data source (e.g. open data, CSV import).
-- Optional: enable RLS and add policies if you need row-level security.

CREATE TABLE IF NOT EXISTS public.schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT,           -- e.g. 'elementary', 'secondary', 'private', 'post_secondary'
  address       TEXT,
  city          TEXT,
  province      TEXT,           -- e.g. 'ON', 'BC'
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_lat_lng ON public.schools (lat, lng);
CREATE INDEX IF NOT EXISTS idx_schools_city ON public.schools (city);

COMMENT ON TABLE public.schools IS 'School locations for "Schools near this location" on listing pages. Backend compares listing lat/lng to school lat/lng via Haversine and returns schools within 10 km (residential listings only).';

-- Example insert (Canadian schools; add your own data):
-- INSERT INTO public.schools (name, type, address, city, province, lat, lng) VALUES
--   ('Example Elementary', 'elementary', '123 School St', 'Toronto', 'ON', 43.6532, -79.3832),
--   ('Example Secondary', 'secondary', '456 High St', 'Toronto', 'ON', 43.6550, -79.3850);
