-- Migrate auth_agents_with_type to a single JSONB column "data".
-- Run once in Supabase SQL Editor on existing DBs that still have scalar columns.

-- 1. Ensure data column exists
ALTER TABLE public.auth_agents_with_type
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';

-- 2. Backfill data from existing columns (only if display_name exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auth_agents_with_type' AND column_name = 'display_name'
  ) THEN
    UPDATE public.auth_agents_with_type
    SET data = COALESCE(data, '{}') || jsonb_build_object(
      'display_name', COALESCE(display_name, ''),
      'brokerage', brokerage,
      'email', email,
      'phone', phone,
      'profile_image_url', profile_image_url
    );
  END IF;
END $$;

-- 3. Drop old columns if they exist
ALTER TABLE public.auth_agents_with_type DROP COLUMN IF EXISTS display_name;
ALTER TABLE public.auth_agents_with_type DROP COLUMN IF EXISTS brokerage;
ALTER TABLE public.auth_agents_with_type DROP COLUMN IF EXISTS email;
ALTER TABLE public.auth_agents_with_type DROP COLUMN IF EXISTS phone;
ALTER TABLE public.auth_agents_with_type DROP COLUMN IF EXISTS profile_image_url;

-- 4. Ensure data is NOT NULL for new rows (existing rows may have null from before backfill)
UPDATE public.auth_agents_with_type SET data = '{}' WHERE data IS NULL;
ALTER TABLE public.auth_agents_with_type ALTER COLUMN data SET DEFAULT '{}';

COMMENT ON COLUMN public.auth_agents_with_type.data IS 'Single JSONB for all agent-saved data: display_name, brokerage, email, phone, profile_image_url, logo_url, media, etc.';
