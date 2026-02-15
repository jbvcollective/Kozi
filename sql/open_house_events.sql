-- Open house events: one row per scheduled open house, linked to a listing.
-- Populated from listings_unified idx/vow via runAnalyticsAndOpenHouse.js.
-- Core fields at top level; full OH details + location in data JSONB for a cleaner schema.

CREATE TABLE IF NOT EXISTS public.open_house_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key TEXT NOT NULL,
  start_ts    TIMESTAMPTZ NOT NULL,
  end_ts      TIMESTAMPTZ,
  remarks     TEXT,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_listing FOREIGN KEY (listing_key) REFERENCES public.listings_unified(listing_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_open_house_events_listing_key ON public.open_house_events(listing_key);
CREATE INDEX IF NOT EXISTS idx_open_house_events_start_ts ON public.open_house_events(start_ts);
CREATE INDEX IF NOT EXISTS idx_open_house_events_data_gin ON public.open_house_events USING GIN (data);

COMMENT ON TABLE public.open_house_events IS 'Scheduled open house times per listing. data JSONB: open_house_*, address, lat, lng from idx/vow.';
COMMENT ON COLUMN public.open_house_events.data IS 'Open house details: open_house_date, open_house_id, open_house_key, open_house_format, open_house_status, open_house_type, open_house_url, address, lat, lng.';

-- If you had the previous flat columns, migrate into data then drop (optional):
-- UPDATE public.open_house_events SET data = jsonb_build_object(
--   'open_house_date', open_house_date, 'open_house_id', open_house_id, 'open_house_key', open_house_key,
--   'open_house_format', open_house_format, 'open_house_status', open_house_status, 'open_house_type', open_house_type,
--   'open_house_url', open_house_url, 'address', address, 'lat', lat, 'lng', lng
-- ) WHERE data IS NULL OR data = '{}';
-- ALTER TABLE public.open_house_events DROP COLUMN IF EXISTS open_house_date, DROP COLUMN IF EXISTS open_house_id, ... etc.

-- RLS: allow read for anon (adjust if you need auth)
ALTER TABLE public.open_house_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.open_house_events
  FOR SELECT USING (true);
