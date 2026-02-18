# Supabase access rules

There are only **two** ways this codebase is allowed to access Supabase:

| Path | Key | Where |
|------|-----|--------|
| **1. Frontend → Supabase** | Anon (public) key | Browser / Next.js. `frontend/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Client: `frontend/lib/supabase.js`. |
| **2. Backend → Supabase** | Service role key | Node (Express server + scripts). Root `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. |

## Rules

- **Frontend** must never use the service role key. It bypasses RLS and must not be in the browser or any frontend env.
- **Backend** must use only the service role key (one client). It uses that client for both data and for validating user JWTs (`auth.getUser(token)`).
- Backend scripts (e.g. `computeMarketHeatAnalytics.js`, `fetchAllListingsUnified.js`, `syncSoldListings.js`) run with `SUPABASE_SERVICE_ROLE_KEY` from `.env` at repo root.

## Env checklist

- **Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — no service role.
- **Backend** (`.env` at repo root): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — no anon key required for the server.
