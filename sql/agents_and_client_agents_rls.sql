-- RLS for agents, agent_customizations, client_agents.
-- Run after creating the tables (agents, agent_customizations, client_agents).
-- Storage: Create bucket "agent-assets" (Supabase Dashboard → Storage) and allow authenticated uploads;
-- use a policy so agents can upload to their own folder (e.g. path like {user_id}/*) and public read for viewing.
-- Agents: read/update own row by user_id. Agent_customizations: read/update by own agent_id. Client_agents: read/insert own by client_user_id.

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_agents ENABLE ROW LEVEL SECURITY;

-- Agents: users can read/update only their own row (where user_id = auth.uid())
DROP POLICY IF EXISTS "Agents read own" ON public.agents;
CREATE POLICY "Agents read own" ON public.agents FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Agents insert own" ON public.agents;
CREATE POLICY "Agents insert own" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Agents update own" ON public.agents;
CREATE POLICY "Agents update own" ON public.agents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agent_customizations: agents can read/update customizations for their own agent row
DROP POLICY IF EXISTS "Agent customizations read own" ON public.agent_customizations;
CREATE POLICY "Agent customizations read own" ON public.agent_customizations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "Agent customizations insert own" ON public.agent_customizations;
CREATE POLICY "Agent customizations insert own" ON public.agent_customizations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "Agent customizations update own" ON public.agent_customizations;
CREATE POLICY "Agent customizations update own" ON public.agent_customizations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));

-- Client_agents: clients can read/insert/update their own link (client_user_id = auth.uid())
DROP POLICY IF EXISTS "Client agents read own" ON public.client_agents;
CREATE POLICY "Client agents read own" ON public.client_agents FOR SELECT USING (auth.uid() = client_user_id);
DROP POLICY IF EXISTS "Client agents insert own" ON public.client_agents;
CREATE POLICY "Client agents insert own" ON public.client_agents FOR INSERT WITH CHECK (auth.uid() = client_user_id);
DROP POLICY IF EXISTS "Client agents update own" ON public.client_agents;
CREATE POLICY "Client agents update own" ON public.client_agents FOR UPDATE USING (auth.uid() = client_user_id);

-- Clients need to read agents + agent_customizations for their linked agent (for theme/branding)
-- Allow authenticated users to read agents by id when they have a client_agents link to that agent
DROP POLICY IF EXISTS "Agents read by linked client" ON public.agents;
CREATE POLICY "Agents read by linked client" ON public.agents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.client_agents ca WHERE ca.agent_id = agents.id AND ca.client_user_id = auth.uid()));

DROP POLICY IF EXISTS "Agent customizations read by linked client" ON public.agent_customizations;
CREATE POLICY "Agent customizations read by linked client" ON public.agent_customizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_agents ca
    JOIN public.agents a ON a.id = ca.agent_id
    WHERE a.id = agent_customizations.agent_id AND ca.client_user_id = auth.uid()
  ));
