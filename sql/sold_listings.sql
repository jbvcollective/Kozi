-- Sold / expired / terminated listings for user display.
-- Full property info + media live in idx and vow JSONB (same shape as listings_unified).
-- Run in Supabase SQL Editor, then populate with: npm run sync-sold-listings

CREATE TABLE IF NOT EXISTS public.sold_listings (
  listing_key  TEXT PRIMARY KEY,
  idx         JSONB NOT NULL DEFAULT '{}',
  vow         JSONB,
  status      TEXT,
  closed_date DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.sold_listings IS 'Sold, expired, or terminated listings for display: full info + media in idx/vow. Populate with: npm run sync-sold-listings';
COMMENT ON COLUMN public.sold_listings.idx IS 'Full IDX property payload + media (photos).';
COMMENT ON COLUMN public.sold_listings.vow IS 'Full VOW property payload + media (photos).';
COMMENT ON COLUMN public.sold_listings.status IS 'Derived: Sold, Expired, Terminated, Canceled, or Closed.';
COMMENT ON COLUMN public.sold_listings.closed_date IS 'From vow.CloseDate or vow.SoldEntryTimestamp for sorting.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sold_listings_status ON public.sold_listings (status);
CREATE INDEX IF NOT EXISTS idx_sold_listings_closed_date ON public.sold_listings (closed_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sold_listings_updated_at ON public.sold_listings (updated_at DESC);
