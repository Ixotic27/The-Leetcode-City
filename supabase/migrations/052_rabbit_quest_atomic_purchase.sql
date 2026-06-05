-- ============================================================
-- 051: Rabbit Quest Atomic Purchase Guard
-- Fixes the read-then-write race in POST /api/rabbit/route.ts
-- that allowed concurrent sighting-5 requests to both pass the
-- existingPurchase = null guard and double-grant the white_rabbit
-- item.
--
-- Root cause:
--   Line 78-96 of route.ts does a SELECT then a conditional INSERT.
--   Two concurrent requests both read existingPurchase = null before
--   either inserts, so both proceed to INSERT — duplicate item grant.
--
-- The partial unique index idx_purchases_unique_completed already
-- exists on (developer_id, item_id, coalesce(gifted_to, 0)) WHERE
-- status = 'completed'. INSERT ... ON CONFLICT DO NOTHING against
-- that index is the atomic guard — no migration required for the
-- constraint itself.
--
-- Bonus hardening:
--   Add a WHERE rabbit_progress < 5 OR rabbit_completed = false
--   guard to the sighting-5 UPDATE so that, if two concurrent
--   requests both reach the UPDATE, only the first writer proceeds.
--   The second sees rowCount = 0 and returns early, never touching
--   purchases at all.
-- ============================================================

-- No schema changes needed:
-- idx_purchases_unique_completed already covers (developer_id, item_id)
-- for completed purchases (migration 007).
-- The fix is purely in route.ts — this migration is a no-op marker
-- so the change is documented in the migration log.

-- Verify the guard index still exists (will error on deploy if missing,
-- which is the correct fail-fast behaviour).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_purchases_unique_completed'
  ) THEN
    RAISE EXCEPTION
      'idx_purchases_unique_completed not found — re-add it before deploying route.ts fix';
  END IF;
END;
$$;