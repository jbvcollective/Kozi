-- Legacy: public read for listings. For VOW compliance (registered users only for VOW data),
-- use sql/listings_vow_rls.sql instead. That file restricts full data to authenticated users
-- and provides get_listings_idx_only / get_listing_by_id_idx_only for anonymous IDX-only access.
--
-- Allow frontend (anon key) to read listings and related tables for Explore, Sold, Open Houses.
-- Run this in Supabase: SQL Editor → New query → paste → Run.
-- Without this, RLS blocks anon and the Explore page cannot load listings_unified.

-- listings_unified (backend sync; optional if frontend uses listings_unified_clean)
ALTER TABLE public.listings_unified ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read listings_unified" ON public.listings_unified;
CREATE POLICY "Allow public read listings_unified"
  ON public.listings_unified FOR SELECT TO public USING (true);

-- listings_unified_clean (Explore uses this; same shape, null/[] stripped)
ALTER TABLE public.listings_unified_clean ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read listings_unified_clean" ON public.listings_unified_clean;
CREATE POLICY "Allow public read listings_unified_clean"
  ON public.listings_unified_clean FOR SELECT TO public USING (true);

-- sold_listings (Sold / history)
ALTER TABLE public.sold_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read sold_listings" ON public.sold_listings;
CREATE POLICY "Allow public read sold_listings"
  ON public.sold_listings FOR SELECT TO public USING (true);

-- open_house_events (Open Houses page)
ALTER TABLE public.open_house_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read open_house_events" ON public.open_house_events;
CREATE POLICY "Allow public read open_house_events"
  ON public.open_house_events FOR SELECT TO public USING (true);
