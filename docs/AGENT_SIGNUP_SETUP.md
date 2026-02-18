# Broker/Agent sign-up setup

If you see **"Account could not be saved. The database may need the sign-up tables and triggers set up (see docs or contact support)."** when creating a broker/agent account, the database is missing the sign-up tables and triggers. Fix it by running the setup script once in Supabase.

## Fix in 3 steps

1. Open your **Supabase** project: [Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file **`sql/RUN_THIS_FOR_SIGNUP.sql`** from this repo, copy its **entire** contents, paste into the query box, and click **Run**.

After it runs successfully, try creating a broker/agent account again. Sign-up should complete and the error should go away.

---

## What the script does

- **`public.users`** – Table and RLS; trigger on `auth.users` so every new sign-up gets a row (email + metadata in `data`).
- **`public.agents`** – Table and RLS; trigger so sign-ups with `user_type = 'agent'` get an agent row with a generated agent code and profile data.

No manual table creation or separate scripts are required; one run is enough.

---

## Alternative: run the scripts separately

If you prefer to run the original scripts in order:

1. **`sql/users_table.sql`** – creates `public.users` and its trigger.
2. **`sql/agents_table.sql`** – creates `public.agents`, `generate_agent_code`, and the agent sign-up trigger (and optional migration from `auth_agents_with_type`).

Then try creating an agent account again.

---

## Optional: client_agents

If users can "link" to an agent by code, create the `client_agents` table and RLS (e.g. from `sql/agents_and_client_agents_rls.sql` or your existing setup). **`RUN_THIS_FOR_SIGNUP.sql`** already adds the "Agents read by linked client" policy if that table exists; otherwise you can re-run **`sql/agents_table.sql`** after creating `client_agents` to add that policy.
