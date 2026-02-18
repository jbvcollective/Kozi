-- auth_users_with_type (view), auth_agents_with_type, user_chosen_agent + owner-only RLS.
-- Run in Supabase SQL Editor. Idempotent.

-- ---------------------------------------------------------------------------
-- Tables & view
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_chosen_agent (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  user_name       TEXT,
  agent_code      TEXT,
  agent_name      TEXT NOT NULL,
  brokerage       TEXT,
  agent_phone     TEXT,
  agent_email     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_chosen_agent_user_id ON public.user_chosen_agent (user_id);
CREATE INDEX IF NOT EXISTS idx_user_chosen_agent_owner_id ON public.user_chosen_agent (owner_id);

CREATE TABLE IF NOT EXISTS public.auth_agents_with_type (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  agent_code    TEXT UNIQUE,
  display_name  TEXT NOT NULL,
  brokerage     TEXT,
  email         TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_agents_agent_code ON public.auth_agents_with_type (agent_code);
CREATE INDEX IF NOT EXISTS idx_auth_agents_display_name ON public.auth_agents_with_type (display_name);
CREATE INDEX IF NOT EXISTS idx_auth_agents_owner_id ON public.auth_agents_with_type (owner_id);

CREATE OR REPLACE VIEW public.auth_users_with_type
WITH (security_invoker = false)
AS
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name'    AS full_name,
  'User'::text                        AS account_type,
  raw_user_meta_data->>'phone'        AS phone,
  created_at,
  raw_user_meta_data->>'chosen_agent_code'     AS chosen_agent_code,
  raw_user_meta_data->>'chosen_agent_name'     AS chosen_agent_name,
  raw_user_meta_data->>'chosen_agent_brokerage' AS chosen_agent_brokerage,
  raw_user_meta_data->>'chosen_agent_updated_at' AS chosen_agent_updated_at
FROM auth.users
WHERE (raw_user_meta_data->>'user_type') IS DISTINCT FROM 'agent';

-- Backfill owner_id for existing rows (no-op if already set)
UPDATE public.user_chosen_agent SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;
UPDATE public.auth_agents_with_type SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: user_chosen_agent — owner-only
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.user_chosen_agent ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chosen_agent FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_owner_only_user_chosen_agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "Users can read own chosen agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "Users can insert own chosen agent" ON public.user_chosen_agent;
DROP POLICY IF EXISTS "Users can update own chosen agent" ON public.user_chosen_agent;

CREATE POLICY "rls_owner_only_user_chosen_agent"
  ON public.user_chosen_agent FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.user_chosen_agent FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chosen_agent TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: auth_agents_with_type — owner-only
-- ---------------------------------------------------------------------------

ALTER TABLE public.auth_agents_with_type ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.auth_agents_with_type ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.auth_agents_with_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_agents_with_type FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_owner_only_auth_agents_with_type" ON public.auth_agents_with_type;
DROP POLICY IF EXISTS "Authenticated can read agents" ON public.auth_agents_with_type;
DROP POLICY IF EXISTS "Agents can update own row" ON public.auth_agents_with_type;
DROP POLICY IF EXISTS "Agents can insert own row" ON public.auth_agents_with_type;

CREATE POLICY "rls_owner_only_auth_agents_with_type"
  ON public.auth_agents_with_type FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.auth_agents_with_type FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_agents_with_type TO authenticated;

-- ---------------------------------------------------------------------------
-- auth_users_with_type (view): no RLS — revoke from anon/authenticated
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.auth_users_with_type FROM PUBLIC;
REVOKE ALL ON public.auth_users_with_type FROM anon;
REVOKE ALL ON public.auth_users_with_type FROM authenticated;
GRANT SELECT ON public.auth_users_with_type TO service_role;
