-- Run this in Supabase SQL Editor if the agents table already exists.
-- Adds is_paid, paid_at, stripe_subscription_id columns.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
