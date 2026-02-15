-- Run this in Supabase SQL Editor if listings_unified already has a "data" column
-- and you want two columns: idx (IDX + media), vow (VOW + media).

-- 1) Add new columns
ALTER TABLE public.listings_unified
  ADD COLUMN IF NOT EXISTS idx JSONB,
  ADD COLUMN IF NOT EXISTS vow JSONB;

-- 2) Copy from data->'idx' and data->'vow' (if data column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings_unified' AND column_name = 'data'
  ) THEN
    UPDATE public.listings_unified
    SET idx = COALESCE(data->'idx', '{}'::jsonb),
        vow = data->'vow'
    WHERE data IS NOT NULL;
    ALTER TABLE public.listings_unified DROP COLUMN data;
  END IF;
END $$;

-- 3) Set idx NOT NULL and default for new rows
ALTER TABLE public.listings_unified
  ALTER COLUMN idx SET DEFAULT '{}';
UPDATE public.listings_unified SET idx = '{}' WHERE idx IS NULL;
ALTER TABLE public.listings_unified
  ALTER COLUMN idx SET NOT NULL;
