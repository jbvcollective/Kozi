# Data security: anti-leak, anti-hack

This describes how user and agent data is locked down so it stays bulletproof and hackers cannot access or leak it.

## Rules enforced

- **No anonymous access**  
  Tables `users`, `agents`, `user_chosen_agent` have `REVOKE ALL FROM anon`. Unauthenticated users cannot read or write any row.

- **Row-level isolation**  
  - **users**: Each user can only `SELECT` / `INSERT` / `UPDATE` the row where `user_id = auth.uid()`. No one can see or change another user’s row.
  - **agents**: Each agent can only `INSERT` / `UPDATE` the row where `user_id = auth.uid()`. `SELECT` is allowed for all agents so the app can show the “choose agent” list; only the owner can change an agent row.
  - **user_chosen_agent**: Each user can only read/insert/update their own row (`user_id = auth.uid()`).

- **RLS is forced**  
  `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is set so even table owners are subject to RLS. No bypass from the frontend.

- **No DELETE for clients**  
  Authenticated users are only granted `SELECT`, `INSERT`, `UPDATE`. They cannot `DELETE` rows. Rows are removed only by cascade when the auth user is deleted (Supabase Auth).

- **Trigger functions are not callable by users**  
  `on_auth_user_created_users`, `on_agent_signup`, and `generate_agent_code` have `REVOKE EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. Only the database trigger (running with `SECURITY DEFINER`) can run them. This prevents:
  - Forging user or agent rows by calling these functions directly.
  - Guessing or enumerating agent codes via `generate_agent_code`.

- **Trigger code uses a fixed search_path**  
  All trigger/helper functions use `SET search_path = public` so they do not depend on the caller’s search path and are not vulnerable to search_path-based injection.

- **Passwords and tokens are not stored in app tables**  
  Passwords and auth tokens live only in Supabase Auth. The `users` and `agents` tables store only profile/business data (e.g. name, email, phone, brokerage) in the `data` JSONB column.

## What to run in Supabase

1. **Initial setup**  
   Run in the Supabase SQL Editor, in order:
   - `sql/users_table.sql`
   - `sql/agents_table.sql`
   - `sql/user_chosen_agent_one_jsonb.sql` (if you use chosen-agent)

2. **Hardening (recommended)**  
   Run `sql/SECURITY_HARDENING.sql` after the above. It re-applies revokes and ensures RLS is enabled and forced. Safe to run multiple times.

## Frontend and API

- The frontend uses the **Supabase client with the anon key** and relies on RLS. It never sees the service role key.
- Server-side code that must bypass RLS (e.g. recording Stripe payment) uses the **service role key** only in API routes or server components, never in client bundles.
- See `frontend/docs/API_KEYS_SECURITY.md` for which keys are public vs secret and how to avoid leaking them.

## Storage (agent-assets)

- Uploads are restricted by RLS so authenticated users can only write under their own folder (`auth.uid()/...`).
- If you use anon upload during sign-up, the policy should be as strict as possible (e.g. only allow INSERT when the first path segment is a UUID and matches the new user). Review `sql/storage_agent_assets_rls.sql` and tighten if needed.
