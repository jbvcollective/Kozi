-- Allow frontend (anon key) to read school_locations for "Schools near this location".
-- Run in Supabase SQL Editor if your app reads school_locations directly from the client.
-- Table school_locations should have at least: lat (or latitude), lng (or longitude), and a name column (name, school_name, etc.).

ALTER TABLE public.school_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read school_locations" ON public.school_locations;
CREATE POLICY "Allow public read school_locations"
  ON public.school_locations FOR SELECT TO public USING (true);
