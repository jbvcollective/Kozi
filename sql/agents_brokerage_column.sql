-- Add brokerage (broker name) to agents table. Run in Supabase SQL Editor.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS brokerage TEXT;

COMMENT ON COLUMN public.agents.brokerage IS 'Broker name (not company name).';
