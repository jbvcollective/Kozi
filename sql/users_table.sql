-- Table: public.users
-- All sign-up and profile content is stored in ONE column only: data (JSONB).
-- No other content columns: name, email, phone, user_type, brokerage, agent_code, profile_image_url, etc. all live inside data.
-- Password is handled by Supabase Auth only; do NOT store password or tokens in data.
-- (user_id is the key; created_at/updated_at are audit timestamps only.)
--
-- Security (bulletproof, no leak/hack):
--   - RLS + FORCE RLS: each user can only SELECT/INSERT/UPDATE their own row (auth.uid() = user_id).
--   - No DELETE grant: users cannot delete rows (only cascade from auth.users can remove).
--   - REVOKE ALL from PUBLIC/anon: unauthenticated clients cannot read or write.
--   - Trigger function: REVOKE EXECUTE from anon/authenticated so it cannot be called to fake rows.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.users (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data      JSONB NOT NULL DEFAULT '{}',  -- single column: all data (name, email, phone, user_type, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'All user content in one JSONB column (data). No other data columns. Do not store passwords in data.';
COMMENT ON COLUMN public.users.data IS 'Single JSONB for all data: name, email, phone, user_type; for agents: brokerage, profile_image_url. Chosen agent is in user_chosen_agent table. No passwords.';

-- ========== RLS: bulletproof isolation (no leak, no cross-user access) ==========
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Only the owning user can read their own row (no one else can see it).
DROP POLICY IF EXISTS "Users can read own row" ON public.users;
CREATE POLICY "Users can read own row"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only the owning user can insert a row for themselves (cannot set user_id to another user).
DROP POLICY IF EXISTS "Users can insert own row" ON public.users;
CREATE POLICY "Users can insert own row"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only the owning user can update their own row (cannot change user_id to escape isolation).
DROP POLICY IF EXISTS "Users can update own row" ON public.users;
CREATE POLICY "Users can update own row"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy: authenticated users cannot delete rows (reduces abuse; cascade from auth.users still drops rows).

-- ========== Grants: minimal permissions (anon cannot touch the table) ==========
REVOKE ALL ON public.users FROM PUBLIC;
REVOKE ALL ON public.users FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
-- No DELETE: users cannot delete their row (cascade from auth.users only). Reduces abuse.
-- Service role (backend/admin) keeps default; use only for admin tooling, never from frontend.

-- Optional: create users row when someone signs up (so data is saved even before email confirm).
-- Runs only from auth.users INSERT (trigger). SECURITY DEFINER with locked search_path to prevent injection.
CREATE OR REPLACE FUNCTION public.on_auth_user_created_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (user_id, data, updated_at)
    VALUES (
      NEW.id,
      jsonb_build_object('email', NEW.email) || COALESCE(to_jsonb(NEW.raw_user_meta_data), '{}'::jsonb),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      data = public.users.data || EXCLUDED.data,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_auth_user_created_users failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Only the trigger should run this; prevent direct calls that could fake user rows.
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_users ON auth.users;
CREATE TRIGGER on_auth_user_created_users
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_auth_user_created_users();
