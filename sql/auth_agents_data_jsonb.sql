-- Add JSONB column to auth_agents_with_type for flexible agent-saved data (e.g. media, gallery).
-- Run in Supabase SQL Editor.

ALTER TABLE public.auth_agents_with_type
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';

COMMENT ON COLUMN public.auth_agents_with_type.data IS 'Flexible JSON: e.g. media URLs, gallery, or other agent-saved data.';

-- Optional: GIN index if you query inside the JSON (e.g. by key or value).
-- CREATE INDEX IF NOT EXISTS idx_auth_agents_data ON public.auth_agents_with_type USING GIN (data);
