-- Market heat analytics: list-to-sale ratio by area, and average DOM by PropertySubType + CityRegion.
-- Run in Supabase SQL Editor. Populate with: npm run analytics (or node computeMarketHeatAnalytics.js).
-- Frontend: GET /api/analytics returns both tables as JSON for the Market Heat section.

-- List-to-sale price ratio by area (how close to asking are things selling).
-- ratio = avg(ClosePrice/ListPrice); 0.98 means sold at 98% of list price.
CREATE TABLE IF NOT EXISTS public.analytics_list_to_sale (
  area_type   TEXT NOT NULL,
  area_value  TEXT NOT NULL,
  list_to_sale_ratio NUMERIC(10,4) NOT NULL,
  sale_count  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value)
);

COMMENT ON TABLE public.analytics_list_to_sale IS 'Market heat: list-to-sale price ratio by area (CityRegion or City). Ratio = avg(ClosePrice/ListPrice).';

-- Average Days on Market by PropertySubType and CityRegion.
CREATE TABLE IF NOT EXISTS public.analytics_avg_dom (
  city_region      TEXT NOT NULL,
  property_sub_type TEXT NOT NULL,
  avg_dom          NUMERIC(10,2) NOT NULL,
  listing_count    INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (city_region, property_sub_type)
);

COMMENT ON TABLE public.analytics_avg_dom IS 'Market heat: average DOM for same PropertySubType in CityRegion.';

-- Average Days on Market by price bracket in area (same area = CityRegion or City).
CREATE TABLE IF NOT EXISTS public.analytics_avg_dom_by_price (
  area_type   TEXT NOT NULL,
  area_value  TEXT NOT NULL,
  price_bracket TEXT NOT NULL,
  avg_dom     NUMERIC(10,2) NOT NULL,
  listing_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value, price_bracket)
);

COMMENT ON TABLE public.analytics_avg_dom_by_price IS 'Market heat: average DOM for same price bracket in area.';

-- Monthly time-series: Sold, New Listings, Active (proxy), Median Sold Price, Avg DOM.
-- Frontend uses this for "Sold, Active & New Listings" and "Median Sold Price & Average DOM" charts.
CREATE TABLE IF NOT EXISTS public.analytics_monthly (
  year_month        TEXT NOT NULL PRIMARY KEY,
  sold_count        INTEGER NOT NULL DEFAULT 0,
  new_listings_count INTEGER NOT NULL DEFAULT 0,
  active_count      INTEGER NOT NULL DEFAULT 0,
  median_sold_price NUMERIC(12,2),
  avg_dom           NUMERIC(10,2),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.analytics_monthly IS 'Market heat time-series by month. Populate with npm run analytics.';

-- Area Market Health: one row per (area_type, area_value). area_type = CityRegion or PostalCode.
CREATE TABLE IF NOT EXISTS public.analytics_area_market_health (
  area_type                  TEXT NOT NULL,
  area_value                 TEXT NOT NULL,
  total_active               INTEGER NOT NULL DEFAULT 0,
  new_this_month            INTEGER NOT NULL DEFAULT 0,
  sold_this_month            INTEGER NOT NULL DEFAULT 0,
  expired_this_month         INTEGER NOT NULL DEFAULT 0,
  avg_list_price             NUMERIC(14,2),
  median_list_price          NUMERIC(14,2),
  avg_sold_price_last_90_days NUMERIC(14,2),
  price_trend_direction      TEXT,
  price_trend_pct_change     NUMERIC(8,2),
  avg_price_per_sqft         NUMERIC(12,2),
  months_of_supply           NUMERIC(10,2),
  absorption_rate            NUMERIC(10,4),
  market_indicator           TEXT,
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (area_type, area_value)
);

COMMENT ON TABLE public.analytics_area_market_health IS 'Area market health: active/new/sold/expired counts, prices, trend, absorption, seller/buyer indicator. Populate with npm run analytics.';
