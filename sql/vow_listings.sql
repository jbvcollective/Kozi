-- VOW listings: full PropTx VOW Property payload in data JSONB. Do not mix with IDX.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.vow_listings (
  listing_key  TEXT PRIMARY KEY,
  data         JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.vow_listings IS 'VOW-only: full PropTx VOW Property payload in data (all property fields + photos).';

-- Optional: GIN index for querying inside data (e.g. filters, search)
-- CREATE INDEX IF NOT EXISTS idx_vow_listings_data_gin ON public.vow_listings USING GIN (data);

-- Optional: index on sold date for "recent sold" queries
-- CREATE INDEX IF NOT EXISTS idx_vow_listings_sold ON public.vow_listings ((data->>'SoldEntryTimestamp'));

-- Optional: RLS for frontend read (adjust policy to your needs)
-- ALTER TABLE public.vow_listings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read vow_listings" ON public.vow_listings FOR SELECT USING (true);
