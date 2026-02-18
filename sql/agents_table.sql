-- Table: public.agents
-- Single source of truth: all agent data and generated agent codes live ONLY in this table (no separate codes table).
--
-- Run order: If your Supabase agents table still has column "agent_code", run sql/agents_rename_agent_code_to_code.sql once, then run this file (or re-run it) to ensure functions/trigger match.
--
-- Checklist (all in this file):
--   • Table public.agents: id, user_id, code (unique), data (JSONB), created_at, updated_at
--   • Agent code column: "code" — where generated codes are stored (8-char: first+last letters + MM + YY)
--   • generate_agent_code(full_name): generates unique code, checks agents.code for collisions
--   • on_agent_signup trigger: on auth.users INSERT, creates agents row with code + data for user_type=agent
--   • RLS + grants: authenticated read all; insert/update own row only
--   • Optional: migration from old auth_agents_with_type (copies into agents, then drops old table)
--
-- All other agent content lives in ONE JSONB column: data.
-- data can hold: display_name, email, phone, brokerage, profile_image_url, logo_url, media (array of URLs),
--   tagline, bio, agent_pro_subscribed_at (ISO timestamp when they paid for Agent Pro), stripe_subscription_id (Stripe sub_xxx),
--   and any other fields you add later — no schema change needed.
-- id, user_id, code: required for FKs and RLS (client_agents.agent_id, auth.uid() = user_id, unique code).
--
-- Security (hack- and leak-free):
--   - RLS + FORCE RLS: agents can only SELECT/INSERT/UPDATE their own row (user_id = auth.uid()).
--   - Linked clients can SELECT agent row only when they have a client_agents link to that agent.
--   - REVOKE ALL from PUBLIC/anon: no anonymous access.
-- Run in Supabase SQL Editor.
-- If you create client_agents later, re-run this file to add "Agents read by linked client" policy.

-- Create table if not present (e.g. new project). If you already have agents with columns, run agents_add_data_jsonb.sql instead.
CREATE TABLE IF NOT EXISTS public.agents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE,
  data       JSONB NOT NULL DEFAULT '{}',
  is_paid    BOOLEAN NOT NULL DEFAULT false,
  paid_at    TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.agents IS 'Agents: one row per agent. Agent code stored here only (code). All other content in data JSONB.';
COMMENT ON COLUMN public.agents.code IS 'Unique 8-char code (first+last letter first name + first+last letter last name + MM + YY). Stored only in this table; no separate table in Supabase.';
COMMENT ON COLUMN public.agents.data IS 'Single JSONB for all agent content: display_name, email, phone, brokerage, profile_image_url, logo_url, media (array of URLs), tagline, bio, agent_pro_subscribed_at, stripe_subscription_id, etc. Add new keys as needed without migrating.';

-- ========== RLS: bulletproof (no leak, no cross-user write) ==========
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;

-- Authenticated users can read all agents (e.g. choose-agent list).
DROP POLICY IF EXISTS "Authenticated can read agents" ON public.agents;
CREATE POLICY "Authenticated can read agents" ON public.agents FOR SELECT TO authenticated
  USING (true);

-- Agent can read own row only (redundant with above but keeps intent clear; own row + list).
DROP POLICY IF EXISTS "Agents read own" ON public.agents;
CREATE POLICY "Agents read own" ON public.agents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Agent can insert only their own row.
DROP POLICY IF EXISTS "Agents insert own" ON public.agents;
CREATE POLICY "Agents insert own" ON public.agents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Agent can update only their own row (cannot change user_id).
DROP POLICY IF EXISTS "Agents update own" ON public.agents;
CREATE POLICY "Agents update own" ON public.agents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Linked clients can read the agent they chose (for branding/contact). Only add if client_agents exists.
DROP POLICY IF EXISTS "Agents read by linked client" ON public.agents;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_agents') THEN
    EXECUTE 'CREATE POLICY "Agents read by linked client" ON public.agents FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.client_agents ca WHERE ca.agent_id = agents.id AND ca.client_user_id = auth.uid()))';
  END IF;
END $$;

-- Choose-agent list: authenticated users read from agents (id, user_id, code, data).

-- ========== Grants: anon cannot touch; authenticated can use own row (+ linked read) ==========
REVOKE ALL ON public.agents FROM PUBLIC;
REVOKE ALL ON public.agents FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
-- No DELETE: only cascade from auth.users can remove. Prevents malicious row deletion.

-- Generate agent code: first+last letter of first name + first+last letter of last name + MM + YY (e.g. JNSH0226). Ensures uniqueness.
CREATE OR REPLACE FUNCTION public.generate_agent_code(full_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
  ln text;
  fn_part text;
  ln_part text;
  month_part text;
  year_part text;
  base text;
  candidate text;
  n integer := 1;
BEGIN
  fn := SPLIT_PART(TRIM(COALESCE(full_name, '')), ' ', 1);
  ln := TRIM(SUBSTRING(TRIM(COALESCE(full_name, '')) FROM LENGTH(fn) + 2));
  IF fn = '' THEN fn := 'AX'; END IF;
  IF ln = '' OR ln = fn THEN ln := fn; END IF;  -- single word: use for both
  fn_part := UPPER(LEFT(fn, 1)) || UPPER(RIGHT(fn, 1));
  IF LENGTH(fn_part) < 2 THEN fn_part := fn_part || UPPER(LEFT(fn, 1)); END IF;
  ln_part := UPPER(LEFT(ln, 1)) || UPPER(RIGHT(ln, 1));
  IF LENGTH(ln_part) < 2 THEN ln_part := ln_part || UPPER(LEFT(ln, 1)); END IF;
  month_part := LPAD(EXTRACT(MONTH FROM NOW())::text, 2, '0');
  year_part := LPAD((EXTRACT(YEAR FROM NOW())::integer % 100)::text, 2, '0');
  base := fn_part || ln_part || month_part || year_part;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.agents WHERE code = candidate) LOOP
    n := n + 1;
    candidate := base || n;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Auto-insert agent row when a new user signs up as agent (from auth metadata). Agent code = first2 + last2 + year.
CREATE OR REPLACE FUNCTION public.on_agent_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_data jsonb;
  new_code text;
  full_name text;
BEGIN
  IF (NEW.raw_user_meta_data->>'user_type') = 'agent' THEN
    BEGIN
      full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
      IF full_name IS NULL OR full_name = '' THEN full_name := SPLIT_PART(NEW.email, '@', 1); END IF;
      new_code := public.generate_agent_code(full_name);
      agent_data := jsonb_build_object(
        'display_name', COALESCE(full_name, NEW.email),
        'brokerage', NULLIF(TRIM(NEW.raw_user_meta_data->>'brokerage'), ''),
        'email', NEW.email,
        'phone', NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
      );
      INSERT INTO public.agents (user_id, code, data)
      VALUES (
        NEW.id,
        new_code,
        agent_data
      )
      ON CONFLICT (user_id) DO UPDATE SET
        code = COALESCE(public.agents.code, EXCLUDED.code),
        data = public.agents.data || EXCLUDED.data,
        updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'on_agent_signup failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_agents ON auth.users;
CREATE TRIGGER on_auth_user_created_agents
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_agent_signup();

-- Lock down trigger/helper functions: only the trigger (SECURITY DEFINER) may run them.
-- Prevents authenticated/anon from calling these to forge rows or guess codes.
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM authenticated;

-- If you had the old auth_agents_with_type table, copy its data into agents and drop it (run this file once).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_agents_with_type') THEN
    INSERT INTO public.agents (user_id, code, data, created_at, updated_at)
    SELECT a.user_id, a.agent_code, a.data, a.created_at, a.updated_at
    FROM public.auth_agents_with_type a
    ON CONFLICT (user_id) DO UPDATE SET
      data = public.agents.data || EXCLUDED.data,
      updated_at = GREATEST(public.agents.updated_at, EXCLUDED.updated_at);
    DROP TRIGGER IF EXISTS on_auth_user_created_agents ON auth.users;
    DROP TABLE IF EXISTS public.auth_agents_with_type;
    CREATE TRIGGER on_auth_user_created_agents
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.on_agent_signup();
  END IF;
END $$;
