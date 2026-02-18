-- Truncate all listing tables. Use when Supabase is breaking or you want a clean slate.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query). Then re-run your sync:
--   npm run fetch-unified   (or full sync)
--   npm run sync-sold-listings
--   npm run analytics-and-open-house
--   npm run backfill-clean
--
-- Order: derived tables first, then main table.

TRUNCATE TABLE public.listings_unified_clean;
TRUNCATE TABLE public.sold_listings;
TRUNCATE TABLE public.listings_unified;

-- Optional: if you have a view that depends on these, it will show empty until repopulated.
-- v_listings_sold_terminated is a view over sold_listings; no need to truncate views.
