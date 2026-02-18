-- Add optional profile photo URL to auth_agents_with_type.
-- Agents can set it at signup (optional) or update later in the dashboard; stored in Supabase.
-- Run in Supabase SQL Editor.

ALTER TABLE public.auth_agents_with_type
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMENT ON COLUMN public.auth_agents_with_type.profile_image_url IS 'Optional profile photo URL; can be set at signup or updated later in dashboard.';
