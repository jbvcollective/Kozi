-- Regular users only (no brokers/agents). Agents are in auth_agents_with_type.
-- Chosen agent is stored on the user in auth metadata; view exposes chosen_agent_* columns.
-- Then in Table Editor → public → auth_users_with_type you’ll see all users with account_type.

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

-- One-off query to list only users (no agents):
-- SELECT id, email, full_name, account_type, phone, created_at
-- FROM public.auth_users_with_type ORDER BY created_at DESC;
