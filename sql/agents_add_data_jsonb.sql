-- Add single JSONB column to existing public.agents and backfill from current columns.
-- Run once on DBs that already have agents with scalar columns. Keeps id, user_id, and code (or agent_code) for references.
-- After this, app writes all new/updated agent content into data; read from data with fallback to scalars.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';

-- Backfill data from existing columns (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'name') THEN
    UPDATE public.agents
    SET data = COALESCE(data, '{}') || jsonb_build_object(
      'display_name', name,
      'email', email,
      'phone', phone,
      'brokerage', brokerage,
      'profile_image_url', profile_image_url,
      'logo_url', logo_url
    )
    WHERE data IS NULL OR data = '{}' OR data = '{}'::jsonb;
  END IF;
END $$;

UPDATE public.agents SET data = '{}' WHERE data IS NULL;
ALTER TABLE public.agents ALTER COLUMN data SET NOT NULL;
ALTER TABLE public.agents ALTER COLUMN data SET DEFAULT '{}';

COMMENT ON COLUMN public.agents.data IS 'Single JSONB: display_name, email, phone, brokerage, profile_image_url, logo_url, media, etc.';
