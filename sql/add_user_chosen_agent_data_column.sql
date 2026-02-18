-- Superseded by sql/user_chosen_agent_one_jsonb.sql (run that for table with single JSONB column).
-- Add the "data" JSONB column to user_chosen_agent so the app can save/load chosen agent.
-- Run this in Supabase SQL Editor if you see: Could not find the 'data' column of 'user_chosen_agent'.
-- After this, run user_chosen_agent_data_jsonb.sql to migrate old columns into data and drop them (optional).

ALTER TABLE public.user_chosen_agent
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_chosen_agent.data IS 'Chosen agent and preferences: user_name, agent_id, agent_code, agent_name, brokerage, agent_phone, agent_email, theme.';
