-- user_chosen_agent: all chosen-agent data in ONE column (data JSONB).
-- When a user picks an agent or enters an agent code, the app saves one row per user with data = { user_name, agent_id, agent_code, agent_name, brokerage, agent_phone, agent_email, theme }.
-- Run in Supabase SQL Editor (once).

-- Create table if not present (minimal: user_id + data only)
CREATE TABLE IF NOT EXISTS public.user_chosen_agent (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add data/updated_at if table already existed with old columns
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate existing columns into data (only reference columns that exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_chosen_agent' AND column_name = 'agent_name') THEN
    UPDATE public.user_chosen_agent
    SET data = jsonb_build_object(
      'user_name', COALESCE(user_name, ''),
      'agent_id', agent_id,
      'agent_code', agent_code,
      'agent_name', COALESCE(agent_name, ''),
      'brokerage', COALESCE(brokerage, ''),
      'agent_phone', COALESCE(agent_phone, ''),
      'agent_email', COALESCE(agent_email, ''),
      'theme', 'teal'
    )
    WHERE (data = '{}' OR data IS NULL);
  END IF;
END $$;

-- Drop old columns so only user_id + data + updated_at remain
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS user_name;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_id;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_code;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_name;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS brokerage;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_phone;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_email;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS theme;

COMMENT ON TABLE public.user_chosen_agent IS 'One row per user: chosen agent and preferences. All content in data (JSONB): user_name, agent_id, agent_code, agent_name, brokerage, agent_phone, agent_email, theme.';
COMMENT ON COLUMN public.user_chosen_agent.data IS 'JSONB: user_name, agent_id (uuid as text), agent_code, agent_name, brokerage, agent_phone, agent_email, theme.';

-- RLS: user can only read/insert/update their own row
ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chosen_agent FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own chosen agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "Users can insert own chosen agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "Users can update own chosen agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "rls_owner_only_user_chosen_agent" ON public.user_chosen_agent;

CREATE POLICY "Users can read own chosen agent"
  ON public.user_chosen_agent FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chosen agent"
  ON public.user_chosen_agent FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chosen agent"
  ON public.user_chosen_agent FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.user_chosen_agent FROM PUBLIC;
REVOKE ALL ON public.user_chosen_agent FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_chosen_agent TO authenticated;

-- VIP deals: users see deals from their chosen agent (agent_id from user_chosen_agent.data)
DROP POLICY IF EXISTS "vip_deals_user_chosen_agent" ON public.vip_deals;
DROP POLICY IF EXISTS "user_chosen_agent" ON public.vip_deals;
CREATE POLICY "user_chosen_agent"
  ON public.vip_deals FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT (uca.data->>'agent_id')::uuid FROM public.user_chosen_agent uca WHERE uca.user_id = auth.uid() LIMIT 1)
  );
