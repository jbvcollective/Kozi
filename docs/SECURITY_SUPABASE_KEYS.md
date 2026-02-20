# Keys, API keys & data protection

## API keys and Express (OWASP)

- **No API keys in client-side code.** The frontend never sends `X-Api-Key`; it authenticates to the Express backend with **Bearer token only** (session). Do not add `NEXT_PUBLIC_API_KEY` or any secret to the client bundle.
- **Server-to-server:** When `API_KEY` is set in the backend `.env`, callers may use either `X-Api-Key: <API_KEY>` or `Authorization: Bearer <token>`. Use `API_KEY` only from server-side env (e.g. cron or other services); never from the browser.
- **All secrets** (API_KEY, GEMINI_API_KEY, STRIPE_*, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY, etc.) are loaded from environment variables only. Never hard-code or commit them. See `.env.example` and `frontend/.env.example` for lists.

## Key rotation

If any secret is committed, pushed, or exposed in logs/builds:

1. **Rotate immediately** in the provider (Supabase, Stripe, Google Cloud, etc.).
2. Update `.env` / `.env.local` and redeploy. Restart the Express server if it uses the key.
3. For **API_KEY**: generate a new value, set it in backend `.env`, and update any server-to-server callers.
4. For **STRIPE_WEBHOOK_SECRET**: create a new webhook endpoint in Stripe if needed, then set the new signing secret in env.
5. Document the incident if required by policy.

## Supabase: secret key never exposed

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
- [ ] Frontend **client** env: only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`. No `NEXT_PUBLIC_*` variable ever holds API keys, service role key, or Stripe/Google/Gemini secrets.
- [ ] Backend `.env` contains `SUPABASE_SERVICE_ROLE_KEY` and is not committed (use `.env.example` without real keys).
- [ ] If you use `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local` (server-only flows), that file is gitignored and never committed.
- [ ] RLS migration applied: `sql/rls_authenticated_read_only.sql` (read-only for authenticated; explicit revokes for anon/authenticated on writes).
- [ ] Key rotation: if any secret is exposed, rotate it in the provider and update env/deployments (see Key rotation above).
