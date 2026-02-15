-- Listings from listings_unified with null-valued and []-valued keys stripped from idx and vow.
-- Same shape as listings_unified; idx/vow only contain keys whose value is not null and not [].
-- (e.g. no "SpaYN": null, "LinkYN": null, "Town": null, "UFFI": null, "FarmType": [], "Sewer": []).
-- Kept in sync automatically by trigger on listings_unified. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.listings_unified_clean (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.listings_unified_clean IS 'Same as listings_unified but idx/vow have null- and []-valued keys stripped. For display/API to avoid null clutter.';
COMMENT ON COLUMN public.listings_unified_clean.idx IS 'IDX payload with only non-null, non-empty-array key-value pairs.';
COMMENT ON COLUMN public.listings_unified_clean.vow IS 'VOW payload with only non-null, non-empty-array key-value pairs.';

-- Optional: GIN indexes for querying
CREATE INDEX IF NOT EXISTS idx_listings_unified_clean_idx_gin ON public.listings_unified_clean USING GIN (idx);
CREATE INDEX IF NOT EXISTS idx_listings_unified_clean_vow_gin ON public.listings_unified_clean USING GIN (vow) WHERE vow IS NOT NULL;

-- Trigger: on INSERT/UPDATE/DELETE on listings_unified, sync listings_unified_clean automatically.
CREATE OR REPLACE FUNCTION public.sync_listings_unified_clean()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  clean_idx jsonb;
  clean_vow jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.listings_unified_clean WHERE listing_key = OLD.listing_key;
    RETURN OLD;
  END IF;

  clean_idx := (
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(jsonb_strip_nulls(COALESCE(NEW.idx, '{}'::jsonb))) AS e(key, value)
    WHERE e.value != '[]'::jsonb
  );

  IF NEW.vow IS NOT NULL THEN
    clean_vow := (
      SELECT jsonb_object_agg(e.key, e.value)
      FROM jsonb_each(jsonb_strip_nulls(NEW.vow)) AS e(key, value)
      WHERE e.value != '[]'::jsonb
    );
  ELSE
    clean_vow := NULL;
  END IF;

  INSERT INTO public.listings_unified_clean (listing_key, idx, vow, updated_at)
  VALUES (NEW.listing_key, clean_idx, clean_vow, COALESCE(NEW.updated_at, NOW()))
  ON CONFLICT (listing_key) DO UPDATE SET
    idx = EXCLUDED.idx,
    vow = EXCLUDED.vow,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listings_unified_clean ON public.listings_unified;
CREATE TRIGGER trg_sync_listings_unified_clean
  AFTER INSERT OR UPDATE OR DELETE ON public.listings_unified
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_listings_unified_clean();

-- One-time backfill: run this once to populate listings_unified_clean from existing listings_unified rows.
-- After this, the trigger above keeps the table in sync.
-- TRUNCATE public.listings_unified_clean;
-- INSERT INTO public.listings_unified_clean (listing_key, idx, vow, updated_at)
-- SELECT
--   listing_key,
--   COALESCE(
--     (SELECT jsonb_object_agg(e.key, e.value)
--      FROM jsonb_each(jsonb_strip_nulls(COALESCE(idx, '{}'::jsonb))) AS e(key, value)
--      WHERE e.value != '[]'::jsonb),
--     '{}'::jsonb
--   ) AS idx,
--   CASE
--     WHEN vow IS NOT NULL THEN
--       (SELECT jsonb_object_agg(e.key, e.value)
--        FROM jsonb_each(jsonb_strip_nulls(vow)) AS e(key, value)
--        WHERE e.value != '[]'::jsonb)
--     ELSE NULL
--   END AS vow,
--   updated_at
-- FROM public.listings_unified;
