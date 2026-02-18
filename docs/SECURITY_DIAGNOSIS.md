# Security diagnosis – possible leaks and hardening

This document summarizes a security review of the VestaHome backend and frontend: issues found, risk level, and fixes applied or recommended.

---

## Critical (fixed in code)

_(Stripe has been removed from this project. Previous Stripe-related items are obsolete.)_

### (removed) Create-portal-session

- **Issue (obsolete):** `POST /api/create-portal-session` accepts any `customerId` in the body and does **not** require authentication or validate that the Stripe customer belongs to the caller. An attacker could obtain another user’s Stripe Customer ID (e.g. from a receipt or metadata) and get a billing portal URL for that customer, potentially viewing or changing their billing.
- **Fix:** Require authentication and validate that the Stripe customer belongs to the authenticated user (e.g. fetch the customer from Stripe and ensure `customer.email` matches the authenticated user’s email, or that customer metadata ties to `auth.uid()`).

---

## High (recommendations)

### 1. `NEXT_PUBLIC_API_KEY` exposes the key in the client bundle

- **Issue:** The frontend uses `process.env.NEXT_PUBLIC_API_KEY` and sends it as `X-Api-Key`. Any `NEXT_PUBLIC_*` value is bundled into client-side JavaScript and is visible to anyone who inspects the app. If the same value as the backend `API_KEY` is used, the “secret” is no longer secret.
- **Recommendation:**
  - **Option A:** Do not use an API key from the frontend. Rely on Supabase auth (Bearer token) only; use `API_KEY` only for server-to-server or internal services that don’t run in the browser.
  - **Option B:** If you want an optional “frontend” key for the Express API, use a **different** key (e.g. a long random string used only for browser clients and rate-limited) and never put the **backend** `API_KEY` in any `NEXT_PUBLIC_*` variable. Document that `NEXT_PUBLIC_API_KEY` is not a secret.

---

## Medium / informational

### 2. Analytics and schools endpoints without auth

- **Current behavior:** `/api/analytics` and `/api/schools` do not require authentication when using the Express backend. Listings and sold listings do require auth (VOW/compliance).
- **Risk:** Market analytics and school data are exposed to unauthenticated callers. This may be intentional (public market stats and school info). If you want these to be authenticated-only, add `isAuthenticated(req)` checks similar to the listings routes.

### 3. Service role key and `.env`

- **Current state:** Backend uses `SUPABASE_SERVICE_ROLE_KEY` from root `.env`; frontend uses only anon key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env` and `.env.local` are in `.gitignore`. This is correct.
- **Reminder:** Never add the service role key to the frontend or any `NEXT_PUBLIC_*` variable. See `docs/SECURITY_SUPABASE_KEYS.md` and `docs/RLS_AND_SECURITY.md`.

### 4. RLS and Supabase

- RLS and grants are documented in `sql/rls_authenticated_read_only.sql` and `docs/RLS_AND_SECURITY.md`. Ensure all recommended scripts (e.g. `rls_lockdown_auth_users_view.sql`) have been run so `auth_users_with_type` and other sensitive objects are not readable by anon/authenticated where not intended.

### 5. `dangerouslySetInnerHTML` in frontend

- **Location:** `frontend/components/PropertyMap.js` uses `dangerouslySetInnerHTML` for a **static** CSS string (map popup styles). No user or external input is injected.
- **Verdict:** Safe as-is. If you ever inject dynamic content there, switch to a safe approach (e.g. CSS-in-JS or sanitized/escaped content).

---

## Summary

| Item | Severity | Status |
|------|----------|--------|
| NEXT_PUBLIC_API_KEY exposure | High | Recommendation only |
| Analytics/schools no auth | Medium | Informational |
| .env / service role | OK | Documented |
| RLS | OK | Documented |
| PropertyMap CSS | OK | Static content only |
