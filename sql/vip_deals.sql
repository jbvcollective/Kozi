-- VIP deals: discounts, coupons, and perks agents share with their clients.
-- All deal content lives in ONE JSONB column: data.
-- Chosen agent is in user_chosen_agent table, one JSONB column (data). Run sql/user_chosen_agent_one_jsonb.sql for that table.
-- Run in Supabase SQL Editor.

-- Table: one row per deal; content in data JSONB.
DROP TABLE IF EXISTS public.vip_deals;
CREATE TABLE public.vip_deals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vip_deals_agent_id ON public.vip_deals (agent_id);

COMMENT ON TABLE public.vip_deals IS 'Deals agents share with clients. All content in data: title, description, offer, image_url, link_url, coupon_code, etc.';
COMMENT ON COLUMN public.vip_deals.data IS 'JSONB: title (required), description, offer (required), image_url, link_url, coupon_code. Add keys as needed.';

-- RLS
ALTER TABLE public.vip_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_deals FORCE ROW LEVEL SECURITY;

-- Agents: full CRUD on their own rows.
CREATE POLICY "vip_deals_agent_own"
  ON public.vip_deals FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Users: see deals from their chosen agent (user_chosen_agent.data).
DROP POLICY IF EXISTS "vip_deals_user_chosen_agent" ON public.vip_deals;
DROP POLICY IF EXISTS "user_chosen_agent" ON public.vip_deals;
CREATE POLICY "user_chosen_agent"
  ON public.vip_deals FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT (uca.data->>'agent_id')::uuid FROM public.user_chosen_agent uca WHERE uca.user_id = auth.uid() LIMIT 1)
  );

REVOKE ALL ON public.vip_deals FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vip_deals TO authenticated;
