# RLS and backend security

This doc explains **Row Level Security (RLS)** in Supabase and which policies to use so your backend and data stay locked down.

---

## What is RLS?

**Row Level Security** is a Postgres feature that restricts which **rows** a user can see or change. When RLS is enabled on a table:

- Every `SELECT` / `INSERT` / `UPDATE` / `DELETE` is filtered by **policies**.
- Policies use expressions like `auth.uid() = user_id` so users only see their own data, or `TO authenticated` so only logged-in users can read.

Without RLS (or with “allow all” policies), anyone with your **anon key** could read or write all rows in that table—so sensitive tables must have RLS and tight policies.

---

## What was “UNRESTRICTED” on `auth_users_with_type`?

In the Supabase Table Editor, **auth_users_with_type** was labeled **UNRESTRICTED**. That view reads from `auth.users` and exposes:

- `id`, `email`, `full_name`, `account_type`, `phone`, `created_at`, chosen agent fields.

If the **anon** or **authenticated** role can `SELECT` from it, any client using your anon key could dump all user emails and names. So it must be locked down.

**Fix:** Run the script that revokes access from anon and authenticated so only the service role (backend/dashboard) can read it:

| Script | Purpose |
|--------|--------|
| **`sql/rls_lockdown_auth_users_view.sql`** | Revokes `SELECT` on `auth_users_with_type` from `anon` and `authenticated`. Only service role / dashboard can read. **Run this first.** |

Run it in Supabase: **SQL Editor → New query → paste script → Run.**

---

## Summary: which objects and which scripts

| Object | Purpose | RLS / access | Script to run (if needed) |
|--------|--------|--------------|----------------------------|
| **auth_users_with_type** (view) | Exposes regular users (no agents) for admin only. App does **not** use it. | Was unrestricted → must revoke anon/authenticated | **`sql/rls_lockdown_auth_users_view.sql`** |
| **agents** (table) | Agents list + profile data; users pick one. | RLS: authenticated can read all; agents can update/insert own row. | `sql/agents_table.sql` |
| **user_chosen_agent** (table) | Per-user chosen agent. | RLS: users can only read/insert/update their own row. | Already in `sql/user_chosen_agent.sql` |
| **listings_unified** / **listings_unified_clean** | Listing data (IDX + VOW). | Choose one: public read vs authenticated-only (VOW). | `sql/listings_unified_rls.sql` (public) or **`sql/listings_vow_rls.sql`** (stricter) |
| **sold_listings** / **open_house_events** | Sold listings and open houses. | Same as above: public or authenticated-only. | Same as listings (in the same scripts). |
| **analytics_*** (tables) | Market heat / charts. Backend writes; frontend reads. | RLS with “public read” or “authenticated read”. | `sql/analytics_rls_allow_read.sql` (public); for stricter use authenticated-only policies. |

---

## Recommended order for a “bulletproof” setup

1. **Lock down user data**  
   Run **`sql/rls_lockdown_auth_users_view.sql`** so `auth_users_with_type` is no longer readable by anon/authenticated.

2. **Listing data (VOW compliance)**  
   If you want only logged-in users to see full listing data, run **`sql/listings_vow_rls.sql`** (and remove the “allow public” policies if you had run `listings_unified_rls.sql` before).  
   If you prefer public read for listings, keep using `sql/listings_unified_rls.sql`.

3. **Ensure RLS on user/agent tables**  
   Make sure **`sql/agents_table.sql`** and **`sql/user_chosen_agent.sql`** have been run so RLS is enabled and policies are in place (users only see their own chosen agent; agents only edit their own row).

4. **Analytics**  
   Run **`sql/analytics_rls_allow_read.sql`** so the Market page can load. For a stricter setup, add policies that allow only `authenticated` to `SELECT` from the analytics tables instead of `public`.

---

## Quick reference: run in Supabase SQL Editor

```text
1. sql/rls_lockdown_auth_users_view.sql   ← fixes UNRESTRICTED on auth_users_with_type
2. sql/listings_vow_rls.sql               ← optional: require login for listings/sold/open_house
3. sql/agents_table.sql                   ← agents table + trigger
4. sql/user_chosen_agent.sql              ← if not already applied
5. sql/analytics_rls_allow_read.sql       ← so Market page can read analytics tables
```

After step 1, the **auth_users_with_type** view will no longer be usable by the frontend or by logged-in users; only the service role (e.g. backend, Supabase dashboard) can read it. That removes the main user-data exposure and makes your backend more bulletproof against casual abuse.
