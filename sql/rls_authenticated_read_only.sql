-- RLS: Authenticated users can SELECT (view) only. No INSERT/UPDATE/DELETE on listings/analytics/schools.
-- Anon: no access. Secret (service_role) key never in frontend; only in backend .env.
-- user_chosen_agent: users can full CRUD their own row (change agent). agents: all can read; agents can write own row.
-- Run in Supabase SQL Editor after rls_hardening_migration or create_auth_and_user_tables_with_rls.

-- ---------------------------------------------------------------------------
-- READ-ONLY TABLES: Anon = no access. Authenticated = SELECT only (no write)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  read_only_tables TEXT[] := ARRAY[
    'analytics_area_market_health', 'analytics_avg_dom', 'analytics_avg_dom_by_price',
    'analytics_list_to_sale', 'analytics_monthly',
    'listings_unified', 'listings_unified_clean', 'open_house_events',
    'school_locations', 'sold_listings'
  ];
BEGIN
  FOREACH t IN ARRAY read_only_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('CREATE POLICY "rls_authenticated_select_%s" ON public.%I FOR SELECT TO authenticated USING (true)', replace(t, '.', '_'), t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- agents: All authenticated can read (pick agent). Only agent can insert/update own row (user_id = auth.uid()).
-- ---------------------------------------------------------------------------

DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
    ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.agents FORCE ROW LEVEL SECURITY;
    FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agents')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.agents', pol.policyname);
    END LOOP;
    CREATE POLICY "rls_agents_select_all"
      ON public.agents FOR SELECT TO authenticated USING (true);
    CREATE POLICY "rls_agents_owner_write"
      ON public.agents FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    REVOKE ALL ON public.agents FROM PUBLIC;
    REVOKE ALL ON public.agents FROM anon;
    GRANT SELECT ON public.agents TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.agents TO authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- user_chosen_agent: Owner-only full CRUD. Anon = no access.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_chosen_agent') THEN
    REVOKE ALL ON public.user_chosen_agent FROM anon;
  END IF;
END $$;
-- If you have not run create_auth_and_user_tables_with_rls.sql, ensure:
-- ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_chosen_agent FORCE ROW LEVEL SECURITY;
-- Policy: FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chosen_agent TO authenticated;

-- ---------------------------------------------------------------------------
-- View v_listings_sold_terminated: allow authenticated to SELECT (fallback for sold_listings)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_listings_sold_terminated') THEN
    REVOKE ALL ON public.v_listings_sold_terminated FROM PUBLIC;
    GRANT SELECT ON public.v_listings_sold_terminated TO authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- auth_users_with_type (view): Keep admin-only — no change
-- ---------------------------------------------------------------------------
-- REVOKE from anon/authenticated; GRANT SELECT to service_role only. (Already done in create_auth_and_user_tables_with_rls.sql)
