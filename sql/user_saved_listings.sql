-- Saved listings per user/agent. Persists across login/logout.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.user_saved_listings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_key)
);
CREATE INDEX IF NOT EXISTS idx_user_saved_listings_user_id ON public.user_saved_listings (user_id);

-- RLS: users can only read/insert/delete their own saved listings.
ALTER TABLE public.user_saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_listings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_saved_listings_own" ON public.user_saved_listings;
CREATE POLICY "user_saved_listings_own"
  ON public.user_saved_listings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.user_saved_listings FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.user_saved_listings TO authenticated;

COMMENT ON TABLE public.user_saved_listings IS 'Saved listing keys per user. Users and agents see only their own; add/remove persists in Supabase.';
