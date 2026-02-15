-- Sold or terminated listings only.
-- Use this table to fetch only sold/terminated without scanning all of listings_unified.
-- Run in Supabase SQL Editor.
--
-- Option 1: Query the VIEW (no duplicate data; always in sync with listings_unified).
-- Option 2: Populate the TABLE with syncSoldTerminatedListings.js for a dedicated, indexed table.

-- Table: same shape as listings_unified, only sold/terminated rows (populated by sync script).
CREATE TABLE IF NOT EXISTS public.listings_sold_terminated (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.listings_sold_terminated IS 'Sold or terminated listings only. Populate by running: node syncSoldTerminatedListings.js';

-- View: sold/terminated from listings_unified (no copy; always current).
-- Only include rows where the listing is CURRENTLY off market. If current status is For Sale / Active,
-- do not include (listing is back on market even if history had sold/terminated).
-- Current status comes from idx (IDX = current listing feed); exclude when idx says on-market.
CREATE OR REPLACE VIEW public.v_listings_sold_terminated AS
SELECT listing_key, idx, vow, updated_at
FROM public.listings_unified
WHERE (
  (idx->>'StandardStatus') IN ('Sold', 'Terminated', 'Expired', 'Canceled', 'Closed')
  OR (idx->>'Status') IN ('Sold', 'Terminated', 'Expired', 'Canceled', 'Closed')
  OR (idx->>'MlsStatus') IN ('Sold', 'Terminated', 'Expired', 'Canceled', 'Closed')
  OR (
    (idx IS NULL OR idx = '{}' OR (idx->>'StandardStatus') IS NULL AND (idx->>'Status') IS NULL AND (idx->>'MlsStatus') IS NULL)
    AND vow IS NOT NULL
  )
)
AND ((idx->>'StandardStatus') IS NULL OR (idx->>'StandardStatus') NOT IN ('Active', 'For Sale', 'New', 'Coming Soon', 'Pending', 'Active Under Contract'))
AND ((idx->>'Status') IS NULL OR (idx->>'Status') NOT IN ('Active', 'For Sale', 'New', 'Coming Soon', 'Pending', 'Active Under Contract'))
AND ((idx->>'MlsStatus') IS NULL OR (idx->>'MlsStatus') NOT IN ('Active', 'For Sale', 'New', 'Coming Soon', 'Pending', 'Active Under Contract'));

COMMENT ON VIEW public.v_listings_sold_terminated IS 'Read-only: sold or terminated listings from listings_unified. Excludes listings currently on market (For Sale/Active).';

-- Optional: index the table for fast ordering
-- CREATE INDEX IF NOT EXISTS idx_listings_sold_terminated_updated_at ON public.listings_sold_terminated (updated_at DESC);
