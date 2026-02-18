-- Superseded by sql/user_chosen_agent_one_jsonb.sql (run that for table with single JSONB column + RLS).
-- user_chosen_agent: store all chosen-agent fields in a single JSONB column "data".
-- Run in Supabase SQL Editor. Safe to run on existing table (adds data, migrates, then drops old columns).
-- data keys: user_name, agent_id (auth user uuid), agent_code, agent_name, brokerage, agent_phone, agent_email, theme.

-- Add data column if missing
ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';

-- Migrate existing columns into data (only when agent_name column still exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_chosen_agent' AND column_name = 'agent_name') THEN
    UPDATE public.user_chosen_agent
    SET data = jsonb_build_object(
      'user_name', user_name,
      'agent_id', agent_id,
      'agent_code', agent_code,
      'agent_name', COALESCE(agent_name, ''),
      'brokerage', brokerage,
      'agent_phone', agent_phone,
      'agent_email', agent_email,
      'theme', 'teal'
    )
    WHERE (data = '{}' OR data IS NULL);
  END IF;
END $$;

-- Drop old columns (one by one for safety)
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS user_name;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_id;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_code;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_name;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS brokerage;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_phone;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS agent_email;
ALTER TABLE public.user_chosen_agent DROP COLUMN IF EXISTS theme;

COMMENT ON COLUMN public.user_chosen_agent.data IS 'Chosen agent and preferences: user_name, agent_id (uuid), agent_code, agent_name, brokerage, agent_phone, agent_email, theme.';

-- vip_deals policy: chosen agent is now in data->agent_id (uuid as text)
DROP POLICY IF EXISTS "vip_deals_user_chosen_agent" ON public.vip_deals;
CREATE POLICY "vip_deals_user_chosen_agent"
  ON public.vip_deals FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT (uca.data->>'agent_id')::uuid FROM public.user_chosen_agent uca WHERE uca.user_id = auth.uid() LIMIT 1)
  );
