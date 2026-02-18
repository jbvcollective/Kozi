-- RLS hardening: owner-only for user tables, full lockdown for analytics/listings/system.
-- Creates missing tables/views then applies RLS. Service role retains full access.

-- ---------------------------------------------------------------------------
-- CREATE TABLES / VIEW IF NOT EXISTS (order respects FKs and triggers)
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

CREATE TABLE IF NOT EXISTS public.analytics_list_to_sale (
  area_type   TEXT NOT NULL,
  area_value  TEXT NOT NULL,
  list_to_sale_ratio NUMERIC(10,4) NOT NULL,
  sale_count  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value)
);

CREATE TABLE IF NOT EXISTS public.analytics_avg_dom (
  city_region      TEXT NOT NULL,
  property_sub_type TEXT NOT NULL,
  avg_dom          NUMERIC(10,2) NOT NULL,
  listing_count    INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (city_region, property_sub_type)
);

CREATE TABLE IF NOT EXISTS public.analytics_avg_dom_by_price (
  area_type   TEXT NOT NULL,
  area_value  TEXT NOT NULL,
  price_bracket TEXT NOT NULL,
  avg_dom     NUMERIC(10,2) NOT NULL,
  listing_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value, price_bracket)
);

CREATE TABLE IF NOT EXISTS public.analytics_monthly (
  year_month        TEXT NOT NULL PRIMARY KEY,
  sold_count        INTEGER NOT NULL DEFAULT 0,
  new_listings_count INTEGER NOT NULL DEFAULT 0,
  active_count      INTEGER NOT NULL DEFAULT 0,
  median_sold_price NUMERIC(12,2),
  avg_dom           NUMERIC(10,2),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_area_market_health (
  area_type                  TEXT NOT NULL,
  area_value                 TEXT NOT NULL,
  total_active               INTEGER NOT NULL DEFAULT 0,
  new_this_month            INTEGER NOT NULL DEFAULT 0,
  sold_this_month            INTEGER NOT NULL DEFAULT 0,
  expired_this_month         INTEGER NOT NULL DEFAULT 0,
  avg_list_price             NUMERIC(14,2),
  median_list_price          NUMERIC(14,2),
  avg_sold_price_last_90_days NUMERIC(14,2),
  price_trend_direction      TEXT,
  price_trend_pct_change     NUMERIC(8,2),
  avg_price_per_sqft         NUMERIC(12,2),
  months_of_supply           NUMERIC(10,2),
  absorption_rate            NUMERIC(10,4),
  market_indicator           TEXT,
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value)
);

CREATE TABLE IF NOT EXISTS public.listings_unified (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.listings_unified_clean (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_unified_clean_idx_gin ON public.listings_unified_clean USING GIN (idx);
CREATE INDEX IF NOT EXISTS idx_listings_unified_clean_vow_gin ON public.listings_unified_clean USING GIN (vow) WHERE vow IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.open_house_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_key TEXT NOT NULL,
  start_ts    TIMESTAMPTZ NOT NULL,
  end_ts      TIMESTAMPTZ,
  remarks     TEXT,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_listing_open_house FOREIGN KEY (listing_key) REFERENCES public.listings_unified(listing_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_open_house_events_listing_key ON public.open_house_events(listing_key);
CREATE INDEX IF NOT EXISTS idx_open_house_events_start_ts ON public.open_house_events(start_ts);
CREATE INDEX IF NOT EXISTS idx_open_house_events_data_gin ON public.open_house_events USING GIN (data);

CREATE TABLE IF NOT EXISTS public.school_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT,
  address       TEXT,
  city          TEXT,
  province      TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_locations_lat_lng ON public.school_locations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_school_locations_city ON public.school_locations (city);

CREATE TABLE IF NOT EXISTS public.sold_listings (
  listing_key  TEXT PRIMARY KEY,
  idx          JSONB NOT NULL DEFAULT '{}',
  vow          JSONB,
  status       TEXT,
  closed_date  DATE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sold_listings_status ON public.sold_listings (status);
CREATE INDEX IF NOT EXISTS idx_sold_listings_closed_date ON public.sold_listings (closed_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sold_listings_updated_at ON public.sold_listings (updated_at DESC);

-- ---------------------------------------------------------------------------
-- USER TABLES: owner_id + OWNER-ONLY RLS (user_chosen_agent, auth_agents_with_type)
-- auth_users_with_type is a VIEW → REVOKE only (see below)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_chosen_agent') THEN
    ALTER TABLE public.user_chosen_agent ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    UPDATE public.user_chosen_agent SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;
    ALTER TABLE public.user_chosen_agent ALTER COLUMN owner_id SET DEFAULT auth.uid();
    ALTER TABLE public.user_chosen_agent ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_chosen_agent FORCE ROW LEVEL SECURITY;
    FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_chosen_agent')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_chosen_agent', pol.policyname);
    END LOOP;
    CREATE POLICY "rls_owner_only_user_chosen_agent"
      ON public.user_chosen_agent FOR ALL TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
    REVOKE ALL ON public.user_chosen_agent FROM PUBLIC;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chosen_agent TO authenticated;
  END IF;
END $$;

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_agents_with_type') THEN
    ALTER TABLE public.auth_agents_with_type ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    UPDATE public.auth_agents_with_type SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL;
    ALTER TABLE public.auth_agents_with_type ALTER COLUMN owner_id SET DEFAULT auth.uid();
    ALTER TABLE public.auth_agents_with_type ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.auth_agents_with_type FORCE ROW LEVEL SECURITY;
    FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auth_agents_with_type')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.auth_agents_with_type', pol.policyname);
    END LOOP;
    CREATE POLICY "rls_owner_only_auth_agents_with_type"
      ON public.auth_agents_with_type FOR ALL TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
    REVOKE ALL ON public.auth_agents_with_type FROM PUBLIC;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_agents_with_type TO authenticated;
  END IF;
END $$;

-- View: no RLS; revoke from anon/authenticated so only service_role can read
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'auth_users_with_type') THEN
    REVOKE ALL ON public.auth_users_with_type FROM PUBLIC;
    REVOKE ALL ON public.auth_users_with_type FROM anon;
    REVOKE ALL ON public.auth_users_with_type FROM authenticated;
    GRANT SELECT ON public.auth_users_with_type TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- LOCKDOWN TABLES: RLS + single policy USING (false), revoke PUBLIC
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  lockdown_tables TEXT[] := ARRAY[
    'analytics_area_market_health', 'analytics_avg_dom', 'analytics_avg_dom_by_price',
    'analytics_list_to_sale', 'analytics_monthly',
    'listings_unified', 'listings_unified_clean', 'open_house_events',
    'school_locations', 'sold_listings'
  ];
BEGIN
  FOREACH t IN ARRAY lockdown_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('CREATE POLICY "rls_deny_all_%s" ON public.%I USING (false)', replace(t, '.', '_'), t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    END IF;
  END LOOP;
END $$;
