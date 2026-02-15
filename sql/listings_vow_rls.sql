-- Require login to see any listing data (IDX + VOW). No anonymous access.
-- Run in Supabase SQL Editor after listings_unified and related tables exist.
--
-- Summary:
-- - Anonymous users: cannot read listings_unified, sold_listings, or open_house_events. No RPC access.
-- - Authenticated (logged-in) users: can read full data from all these tables.

-- ========== listings_unified: VOW protected ==========
ALTER TABLE public.listings_unified ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read listings_unified" ON public.listings_unified;
-- Only authenticated (registered) users may read full rows (including vow).
CREATE POLICY "Allow authenticated read listings_unified"
  ON public.listings_unified FOR SELECT
  TO authenticated
  USING (true);

-- ========== listings_unified_clean: same as above ==========
ALTER TABLE public.listings_unified_clean ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read listings_unified_clean" ON public.listings_unified_clean;
CREATE POLICY "Allow authenticated read listings_unified_clean"
  ON public.listings_unified_clean FOR SELECT
  TO authenticated
  USING (true);

-- ========== sold_listings: VOW data, registered users only ==========
ALTER TABLE public.sold_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read sold_listings" ON public.sold_listings;
CREATE POLICY "Allow authenticated read sold_listings"
  ON public.sold_listings FOR SELECT
  TO authenticated
  USING (true);

-- ========== open_house_events: derived from idx/vow; restrict to authenticated ==========
ALTER TABLE public.open_house_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read open_house_events" ON public.open_house_events;
CREATE POLICY "Allow authenticated read open_house_events"
  ON public.open_house_events FOR SELECT
  TO authenticated
  USING (true);

-- ========== Optional: IDX-only RPCs for authenticated users (e.g. if you need them later) ==========
-- Anonymous has no access; only authenticated can call these.
CREATE OR REPLACE FUNCTION public.get_listings_idx_only(p_limit int DEFAULT 500, p_offset int DEFAULT 0)
RETURNS TABLE (listing_key text, idx jsonb, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT listing_key, idx, updated_at
  FROM public.listings_unified
  ORDER BY updated_at DESC NULLS LAST
  LIMIT GREATEST(0, LEAST(COALESCE(p_limit, 500), 2000))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;

COMMENT ON FUNCTION public.get_listings_idx_only(int, int) IS 'Returns IDX-only rows. Authenticated only (no anon access).';

REVOKE EXECUTE ON FUNCTION public.get_listings_idx_only(int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_listings_idx_only(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_listing_by_id_idx_only(p_listing_key text)
RETURNS TABLE (listing_key text, idx jsonb, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.listing_key, l.idx, l.updated_at
  FROM public.listings_unified l
  WHERE l.listing_key = p_listing_key
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_listing_by_id_idx_only(text) IS 'Returns one row IDX-only. Authenticated only (no anon access).';

REVOKE EXECUTE ON FUNCTION public.get_listing_by_id_idx_only(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_listing_by_id_idx_only(text) TO authenticated;
