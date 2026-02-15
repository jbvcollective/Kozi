-- Analyze which keys in sold_listings.idx (or listings_unified.idx) have non-null values.
-- Run in Supabase SQL Editor. Use table name: sold_listings or listings_unified.

-- 1) List every key that appears in idx and how many rows have that key non-null
WITH keys AS (
  SELECT DISTINCT jsonb_object_keys(idx) AS key_name
  FROM public.sold_listings
  WHERE idx IS NOT NULL AND idx != '{}'
  LIMIT 500
),
counts AS (
  SELECT
    k.key_name,
    COUNT(*) FILTER (WHERE (sl.idx -> k.key_name) IS NOT NULL) AS total_rows,
    COUNT(*) FILTER (WHERE (sl.idx -> k.key_name) IS NOT NULL
                     AND (sl.idx -> k.key_name) != 'null'::jsonb) AS non_null_count,
    COUNT(*) FILTER (WHERE jsonb_typeof(sl.idx -> k.key_name) = 'array'
                     AND jsonb_array_length(sl.idx -> k.key_name) > 0) AS non_empty_array_count
  FROM keys k
  CROSS JOIN public.sold_listings sl
  WHERE sl.idx IS NOT NULL AND sl.idx != '{}'
  GROUP BY k.key_name
),
totals AS (
  SELECT COUNT(*) AS n FROM public.sold_listings WHERE idx IS NOT NULL AND idx != '{}'
)
SELECT
  c.key_name,
  c.non_null_count,
  t.n AS total_listings,
  ROUND(100.0 * c.non_null_count / NULLIF(t.n, 0), 1) AS pct_non_null,
  c.non_empty_array_count
FROM counts c
CROSS JOIN totals t
ORDER BY c.non_null_count DESC, c.key_name;
