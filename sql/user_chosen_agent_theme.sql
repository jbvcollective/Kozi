-- Add theme column for agent website color/theme preference.
-- Run in Supabase SQL Editor. RLS already on user_chosen_agent; no policy change needed.

ALTER TABLE public.user_chosen_agent
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'teal';

COMMENT ON COLUMN public.user_chosen_agent.theme IS 'Agent theme id: teal, navy, forest, burgundy. Used when user is viewing as their chosen agent.';
  