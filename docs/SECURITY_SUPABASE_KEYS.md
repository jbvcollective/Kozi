# Supabase keys & data protection

## Secret key never exposed

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`):
  - **Backend:** Root `.env` (Node scripts and Express server). Never committed.
  - **Frontend (optional):** Only in `frontend/.env.local` for **server-only** use (e.g. recording Agent Pro payment on success page). That file is **gitignored** (`.env*` in `frontend/.gitignore`). The key is **never** in any `NEXT_PUBLIC_*` variable, never in Vercel public env, and **never** in client-side code or the browser bundle — only in API routes and Server Components.
- The frontend **client** uses only the **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). That key is safe to expose; access is restricted by RLS and grants.
- If the service role key is ever committed, pushed, or exposed in a build/log, **rotate it immediately** in Supabase (Project Settings → API → service_role → Regenerate).

## Anon key cannot be used to change data

Even if someone has the anon key (e.g. from the built JS), they **cannot** insert, update, or delete data on protected tables:

1. **RLS** – Row Level Security is enabled and enforced on all relevant tables. Policies limit what each role can see and do.
2. **Grants** – On read-only tables (listings, analytics, sold_listings, schools, open_house_events):
   - `REVOKE ALL FROM PUBLIC` then `GRANT SELECT TO authenticated` only.
   - `REVOKE INSERT, UPDATE, DELETE FROM anon` and `FROM authenticated` (explicit).
   - So **anon** has no access; **authenticated** can only **SELECT** (view). No one can write via anon/authenticated on those tables.
3. **Writable by users (by design)**:
   - **user_chosen_agent** – Users can only SELECT/INSERT/UPDATE/DELETE **their own** row (`owner_id = auth.uid()`). They cannot touch other users’ rows or any other table.
   - **agents** – Everyone (authenticated) can read (to pick an agent). Only the agent can INSERT/UPDATE **their own** row (`user_id = auth.uid()`).

So: **anon key + RLS + grants** ensure users can only view shared data and change their own chosen agent (and agents their own profile). They cannot hack or change Supabase data on listings, analytics, or any other read-only table.

## Checklist

- [ ] No real keys in repo: `.env` and `.env.local` are in `.gitignore`; `frontend/.env*` is in `frontend/.gitignore`.
- [ ] Frontend **client** env: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No `NEXT_PUBLIC_*` variable ever holds the service role key.
- [ ] Backend `.env` contains `SUPABASE_SERVICE_ROLE_KEY` and is not committed (use `.env.example` without real keys).
- [ ] If you use `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local` (server-only flows), that file is gitignored and never committed.
- [ ] RLS migration applied: `sql/rls_authenticated_read_only.sql` (read-only for authenticated; explicit revokes for anon/authenticated on writes).
