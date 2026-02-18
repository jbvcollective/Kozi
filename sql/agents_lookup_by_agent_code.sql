-- Look up an agent by code (table: agents, column: code).
-- Run in Supabase SQL Editor. Replace 'BIBO2026' with the code you need.

SELECT id, user_id, code, data, created_at, updated_at
FROM public.agents
WHERE code = 'BIBO2026';

-- Case-insensitive (if codes might be stored in different case):
-- SELECT id, user_id, code, data FROM public.agents WHERE UPPER(code) = UPPER('BIBO2026');
