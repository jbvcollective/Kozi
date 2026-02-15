-- Allow frontend (anon key) to read analytics tables.
-- Run this in Supabase: SQL Editor → New query → paste → Run.
-- After this, the Market page can load analytics_area_market_health and analytics_monthly for the charts.

-- analytics_area_market_health
ALTER TABLE public.analytics_area_market_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read analytics_area_market_health" ON public.analytics_area_market_health;
CREATE POLICY "Allow public read analytics_area_market_health"
  ON public.analytics_area_market_health FOR SELECT TO public USING (true);

-- analytics_monthly (for combined Activity score & Sold count chart)
ALTER TABLE public.analytics_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read analytics_monthly" ON public.analytics_monthly;
CREATE POLICY "Allow public read analytics_monthly"
  ON public.analytics_monthly FOR SELECT TO public USING (true);
