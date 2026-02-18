-- Allow public read on school_locations for "Schools near this location".
-- RLS is already set up in sql/schools.sql. Run this file only if you created school_locations separately and need the policy.
-- Table should have: lat, lng, name (optional: type, address, city, province).

ALTER TABLE public.school_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read school_locations" ON public.school_locations;
CREATE POLICY "Allow public read school_locations"
  ON public.school_locations FOR SELECT TO public USING (true);
