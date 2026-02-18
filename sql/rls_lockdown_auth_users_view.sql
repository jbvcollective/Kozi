-- Lock down auth_users_with_type so the frontend and logged-in users cannot read it.
-- The view exposes id, email, full_name, phone, etc. from auth.users (regular users only).
-- Your app does NOT query this view; it's for Supabase Table Editor / admin use only.
--
-- Run this in Supabase: SQL Editor → New query → paste → Run.
-- After this, only the service role (backend scripts, dashboard) can SELECT from auth_users_with_type.
-- The "UNRESTRICTED" label in Table Editor will go away once RLS/grants are applied; this view
-- has no RLS (views inherit from underlying auth.users), so we use REVOKE instead.

REVOKE SELECT ON public.auth_users_with_type FROM anon;
REVOKE SELECT ON public.auth_users_with_type FROM authenticated;

-- Optional: grant explicitly to service_role so it's clear who can read (usually already has it).
-- GRANT SELECT ON public.auth_users_with_type TO service_role;

COMMENT ON VIEW public.auth_users_with_type IS 'Regular users only (no agents). For admin/Table Editor only. anon/authenticated cannot SELECT.';
