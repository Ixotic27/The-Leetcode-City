-- Migration: aggregate city solve totals in the database
-- Issue #1660
--
-- GET /api/stats previously selected easy_solved/medium_solved/hard_solved for
-- every developer row into the Node process and reduced in memory (O(n) memory
-- + latency per cache miss). This RPC computes the totals with SQL aggregation.

CREATE OR REPLACE FUNCTION public.get_city_solve_totals()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_solves', COALESCE(SUM(COALESCE(easy_solved, 0) + COALESCE(medium_solved, 0) + COALESCE(hard_solved, 0)), 0),
    'total_developers', COUNT(*)
  )::text::json
  FROM developers;
$$;