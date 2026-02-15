-- Registered agents: one row per agent (auth user who signed up as Broker/Agent).
-- Populated when agents sign up (trigger below or client insert). Users choose from this list in "Choose your agent".
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.auth_agents_with_type (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE public.auth_agents_with_type ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all agents (to choose one).
DROP POLICY IF EXISTS "Authenticated can read agents" ON public.auth_agents_with_type;
CREATE POLICY "Authenticated can read agents"
  ON public.auth_agents_with_type FOR SELECT
  TO authenticated
  USING (true);

-- Agents can update their own row (e.g. profile page).
DROP POLICY IF EXISTS "Agents can update own row" ON public.auth_agents_with_type;
CREATE POLICY "Agents can update own row"
  ON public.auth_agents_with_type FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Agents can insert their own row (when signing up from client if trigger is not used).
DROP POLICY IF EXISTS "Agents can insert own row" ON public.auth_agents_with_type;
CREATE POLICY "Agents can insert own row"
  ON public.auth_agents_with_type FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.auth_agents_with_type IS 'Registered agents; users pick from this list in Choose your agent. Populated on agent signup.';

-- Optional: auto-insert when a new user signs up as agent (from auth metadata).
-- Requires permission to create trigger on auth.users. If this fails, rely on client-side insert in AuthModal.
CREATE OR REPLACE FUNCTION public.on_agent_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'user_type') = 'agent' THEN
    INSERT INTO public.auth_agents_with_type (user_id, agent_code, display_name, brokerage, email, phone)
    VALUES (
      NEW.id,
      NULLIF(TRIM(NEW.raw_user_meta_data->>'agent_code'), ''),
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'brokerage'), ''),
      NEW.email,
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      brokerage = EXCLUDED.brokerage,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_agents ON auth.users;
CREATE TRIGGER on_auth_user_created_agents
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_agent_signup();
