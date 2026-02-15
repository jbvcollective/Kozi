-- Unified listings: one row per listing, data sorted and separated into two JSONB columns.
-- idx = IDX property + photos (from IDX token). Use {} when that listing has no IDX data.
-- vow = VOW property + photos sold (from VOW token). Use null when that listing has no VOW data.
-- Run in Supabase SQL Editor. Use fetchAllListingsUnified.js to populate (fetch everything; both columns always written per row).

CREATE TABLE IF NOT EXISTS public.listings_unified (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN public.listings_unified.idx IS 'IDX property + photos[]. Empty {} when no IDX data for this listing (from IDX token).';
COMMENT ON COLUMN public.listings_unified.vow IS 'VOW property + photos[] (sold). NULL when no VOW data for this listing (from VOW token).';
COMMENT ON TABLE public.listings_unified IS 'One row per listing. idx and vow are separate; fetch everything—use {} or null when a source has nothing.';

-- Optional: GIN indexes for querying
-- CREATE INDEX IF NOT EXISTS idx_listings_unified_idx_gin ON public.listings_unified USING GIN (idx);
-- CREATE INDEX IF NOT EXISTS idx_listings_unified_vow_gin ON public.listings_unified USING GIN (vow);

-- If you already had the table with a single "data" column, migrate with:
-- ALTER TABLE public.listings_unified ADD COLUMN IF NOT EXISTS idx JSONB, ADD COLUMN IF NOT EXISTS vow JSONB;
-- UPDATE public.listings_unified SET idx = data->'idx', vow = data->'vow' WHERE data IS NOT NULL;
-- ALTER TABLE public.listings_unified DROP COLUMN IF EXISTS data;
-- ALTER TABLE public.listings_unified ALTER COLUMN idx SET NOT NULL;
-- ALTER TABLE public.listings_unified ALTER COLUMN idx SET DEFAULT '{}';
