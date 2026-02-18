-- Table: public.saved_listings
-- One row per user/agent. All saved listing data in ONE column: data (JSONB).
-- data shape: { "listing_keys": ["key1", "key2", ...], "updated_at": "ISO date" }
--
-- Security (bulletproof, hack-free; frontend can still see own data):
--   - RLS + FORCE RLS: each user/agent can only SELECT/INSERT/UPDATE their own row (auth.uid() = user_id).
--   - Anon cannot read or write: REVOKE ALL from PUBLIC/anon. Logged-in frontend uses authenticated role.
--   - Authenticated can see only their row: SELECT/INSERT/UPDATE granted to authenticated; policies restrict to own user_id.
--   - No DELETE grant: rows removed only by cascade when auth user is deleted.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.saved_listings (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data      JSONB NOT NULL DEFAULT '{"listing_keys":[]}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.saved_listings IS 'Saved listings per user/agent. All data in one JSONB column. RLS: frontend sees only own row.';
COMMENT ON COLUMN public.saved_listings.data IS 'Single JSONB: listing_keys (array of listing ids), updated_at.';

-- ========== RLS: bulletproof isolation (no leak, no cross-user access) ==========
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_listings FORCE ROW LEVEL SECURITY;

-- Frontend (authenticated): can read only their own saved list.
DROP POLICY IF EXISTS "saved_listings_select_own" ON public.saved_listings;
CREATE POLICY "saved_listings_select_own"
  ON public.saved_listings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Frontend (authenticated): can insert only a row for themselves (user_id = auth.uid()).
DROP POLICY IF EXISTS "saved_listings_insert_own" ON public.saved_listings;
CREATE POLICY "saved_listings_insert_own"
  ON public.saved_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Frontend (authenticated): can update only their own row (cannot change user_id).
DROP POLICY IF EXISTS "saved_listings_update_own" ON public.saved_listings;
CREATE POLICY "saved_listings_update_own"
  ON public.saved_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy: users cannot delete rows; cascade from auth.users only.

-- ========== Grants: anon cannot touch table; frontend (authenticated) can read/write own row ==========
REVOKE ALL ON public.saved_listings FROM PUBLIC;
REVOKE ALL ON public.saved_listings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.saved_listings TO authenticated;
