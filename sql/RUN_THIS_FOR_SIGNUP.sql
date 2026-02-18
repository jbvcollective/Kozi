-- =============================================================================
-- FIX: "Account could not be saved. The database may need the sign-up tables..."
-- Run this ENTIRE file once in Supabase: Dashboard → SQL Editor → New query →
-- paste this file → Run. Then try creating an agent account again.
--
-- These triggers are FAULT-TOLERANT: if they fail for any reason, the auth.users
-- row is still created (the user still signs up). The app will retry saving to
-- public.users / public.agents from the client side as a fallback.
-- =============================================================================
-- Part 1: users table + trigger
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data      JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own row" ON public.users;
CREATE POLICY "Users can read own row" ON public.users FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own row" ON public.users;
CREATE POLICY "Users can insert own row" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own row" ON public.users;
CREATE POLICY "Users can update own row" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.users FROM PUBLIC;
REVOKE ALL ON public.users FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.on_auth_user_created_users()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (user_id, data, updated_at)
    VALUES (NEW.id, jsonb_build_object('email', NEW.email) || COALESCE(to_jsonb(NEW.raw_user_meta_data), '{}'::jsonb), NOW())
    ON CONFLICT (user_id) DO UPDATE SET data = public.users.data || EXCLUDED.data, updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_auth_user_created_users failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_users ON auth.users;
CREATE TRIGGER on_auth_user_created_users AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created_users();

-- =============================================================================
-- Part 2: agents table + trigger + helper
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT UNIQUE,
  data       JSONB NOT NULL DEFAULT '{}',
  is_paid    BOOLEAN NOT NULL DEFAULT false,
  paid_at    TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read agents" ON public.agents;
CREATE POLICY "Authenticated can read agents" ON public.agents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Agents read own" ON public.agents;
CREATE POLICY "Agents read own" ON public.agents FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Agents insert own" ON public.agents;
CREATE POLICY "Agents insert own" ON public.agents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Agents update own" ON public.agents;
CREATE POLICY "Agents update own" ON public.agents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.agents FROM PUBLIC;
REVOKE ALL ON public.agents FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_agent_code(full_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE fn text; ln text; fn_part text; ln_part text; month_part text; year_part text; base text; candidate text; n integer := 1;
BEGIN
  fn := SPLIT_PART(TRIM(COALESCE(full_name, '')), ' ', 1);
  ln := TRIM(SUBSTRING(TRIM(COALESCE(full_name, '')) FROM LENGTH(fn) + 2));
  IF fn = '' THEN fn := 'AX'; END IF;
  IF ln = '' OR ln = fn THEN ln := fn; END IF;
  fn_part := UPPER(LEFT(fn, 1)) || UPPER(RIGHT(fn, 1));
  IF LENGTH(fn_part) < 2 THEN fn_part := fn_part || UPPER(LEFT(fn, 1)); END IF;
  ln_part := UPPER(LEFT(ln, 1)) || UPPER(RIGHT(ln, 1));
  IF LENGTH(ln_part) < 2 THEN ln_part := ln_part || UPPER(LEFT(ln, 1)); END IF;
  month_part := LPAD(EXTRACT(MONTH FROM NOW())::text, 2, '0');
  year_part := LPAD((EXTRACT(YEAR FROM NOW())::integer % 100)::text, 2, '0');
  base := fn_part || ln_part || month_part || year_part;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.agents WHERE code = candidate) LOOP n := n + 1; candidate := base || n; END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_agent_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE agent_data jsonb; new_code text; full_name text;
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
      INSERT INTO public.agents (user_id, code, data) VALUES (NEW.id, new_code, agent_data)
      ON CONFLICT (user_id) DO UPDATE SET code = COALESCE(public.agents.code, EXCLUDED.code), data = public.agents.data || EXCLUDED.data, updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'on_agent_signup failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_agents ON auth.users;
CREATE TRIGGER on_auth_user_created_agents AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.on_agent_signup();
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM PUBLIC, anon, authenticated;

-- Optional: if you have client_agents table, allow linked clients to read their chosen agent.
DROP POLICY IF EXISTS "Agents read by linked client" ON public.agents;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_agents') THEN
    EXECUTE 'CREATE POLICY "Agents read by linked client" ON public.agents FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.client_agents ca WHERE ca.agent_id = agents.id AND ca.client_user_id = auth.uid()))';
  END IF;
END $$;
