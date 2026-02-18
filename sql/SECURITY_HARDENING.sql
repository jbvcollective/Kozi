-- Security hardening: anti-leak, anti-hack. Run after users_table.sql and agents_table.sql.
-- Re-applies revokes and ensures RLS so data is bulletproof. Run in Supabase SQL Editor.
-- Idempotent: safe to run multiple times.

-- ========== 1. users: RLS forced, anon has no access, no DELETE ==========
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC;
REVOKE ALL ON public.users FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- ========== 2. agents: RLS forced, anon has no access, no DELETE ==========
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.agents FROM PUBLIC;
REVOKE ALL ON public.agents FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;

-- ========== 3. user_chosen_agent: RLS forced, anon has no access (if table exists) ==========
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_chosen_agent') THEN
    EXECUTE 'ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_chosen_agent FORCE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.user_chosen_agent FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON public.user_chosen_agent FROM anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.user_chosen_agent TO authenticated';
  END IF;
END $$;

-- ========== 4. Trigger/helper functions: only trigger can run (no direct call) ==========
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_auth_user_created_users() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_agent_code(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_agent_signup() FROM authenticated;
