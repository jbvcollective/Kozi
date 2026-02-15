-- Table used when a user saves their chosen agent. Stores user_id + agent details.
-- Run this in Supabase SQL Editor if the table does not exist. RLS: users can only read/upsert their own row.

CREATE TABLE IF NOT EXISTS public.user_chosen_agent (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name       TEXT,
  agent_code      TEXT,
  agent_name      TEXT NOT NULL,
  brokerage       TEXT,
  agent_phone     TEXT,
  agent_email     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_chosen_agent_user_id ON public.user_chosen_agent (user_id);

-- If table already existed, add missing columns:
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS agent_phone TEXT;
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS agent_email TEXT;

ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own chosen agent" ON public.user_chosen_agent;
CREATE POLICY "Users can read own chosen agent"
  ON public.user_chosen_agent FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chosen agent" ON public.user_chosen_agent;
CREATE POLICY "Users can insert own chosen agent"
  ON public.user_chosen_agent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chosen agent" ON public.user_chosen_agent;
CREATE POLICY "Users can update own chosen agent"
  ON public.user_chosen_agent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_chosen_agent IS 'Per-user chosen agent; one row per user. user_name = logged-in user who saved; agent_* = chosen agent. Overwrites on new save; no duplicate rows.';
