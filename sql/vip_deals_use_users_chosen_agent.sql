-- VIP deals: users see deals from their chosen agent (user_chosen_agent.data). Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "vip_deals_user_chosen_agent" ON public.vip_deals;
DROP POLICY IF EXISTS "user_chosen_agent" ON public.vip_deals;
CREATE POLICY "user_chosen_agent"
  ON public.vip_deals FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT (uca.data->>'agent_id')::uuid FROM public.user_chosen_agent uca WHERE uca.user_id = auth.uid() LIMIT 1)
  );
