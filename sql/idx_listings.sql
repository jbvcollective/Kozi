-- IDX listings: full PropTx IDX payload (property + media) in data JSONB. Do not mix with VOW.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.idx_listings (
  listing_key  TEXT PRIMARY KEY,
  data         JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.idx_listings IS 'IDX-only: full PropTx IDX Property + Media payload in data (property fields + photos).';

-- Optional: GIN index for querying inside data
-- CREATE INDEX IF NOT EXISTS idx_listings_data_gin ON public.idx_listings USING GIN (data);

-- Optional: indexes for common filters
-- CREATE INDEX IF NOT EXISTS idx_listings_city ON public.idx_listings ((data->>'City'));
-- CREATE INDEX IF NOT EXISTS idx_listings_list_price ON public.idx_listings ((data->>'ListPrice'));
