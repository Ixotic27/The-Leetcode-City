-- ============================================================
-- 058: Atomic streak freeze cap in grant_streak_freeze RPC
-- Fixes the read-then-write race in POST /api/dailies/claim/route.ts
-- (lines 97–112) where two concurrent requests both read
-- streak_freezes_available = 1, both pass the JS-level < 2 check,
-- and both call grant_streak_freeze, pushing the value to 3.
--
-- The existing RPC already used LEAST(..., 2) which prevents values
-- above 2 from a single call, but does NOT prevent two concurrent
-- calls from both incrementing from 1 → 2 independently (net: 3).
--
-- Fix:
--   1. Replace LEAST() with a conditional WHERE streak_freezes_available < 2.
--      Only one of two concurrent callers satisfies the WHERE clause;
--      the other updates 0 rows → ROW_COUNT = 0 → returns granted = false.
--   2. Return BOOLEAN granted so the application layer skips the log insert
--      when the cap was already hit (no-op grant).
--   3. Add granted_date column + UNIQUE(developer_id, action, granted_date)
--      to streak_freeze_log for the 'granted_dailies' action, preventing
--      duplicate log rows from concurrent grants on the same day.
--      (granted_date column already added by migration 057 — this migration
--      is idempotent and guards with IF NOT EXISTS / DO $$ blocks.)
-- ============================================================

-- ─── 1. Patch grant_streak_freeze to return granted BOOLEAN ─
-- Returns true  if the increment happened (was under cap).
-- Returns false if already at cap — caller must skip log insert.
CREATE OR REPLACE FUNCTION public.grant_streak_freeze(p_developer_id BIGINT)
RETURNS TABLE(granted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  -- Atomic conditional increment:
  -- The WHERE streak_freezes_available < 2 guard ensures only one of
  -- two concurrent callers succeeds. LEAST() alone does NOT prevent
  -- two concurrent calls from each reading 1 and both writing 2 (net 3).
  UPDATE public.developers
  SET    streak_freezes_available = streak_freezes_available + 1
  WHERE  id = p_developer_id
  AND    streak_freezes_available < 2;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY SELECT v_rows_updated > 0;
END;
$$;

-- ─── 2. Ensure granted_date column exists on streak_freeze_log ─
-- Migration 057 may have already added this; guard with IF NOT EXISTS.
ALTER TABLE public.streak_freeze_log
  ADD COLUMN IF NOT EXISTS granted_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- ─── 3. UNIQUE constraint on (developer_id, action, granted_date) ─
-- Prevents two concurrent granted_dailies log rows on the same day.
-- The DO $$ block is idempotent — safe to run if constraint exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname = 'streak_freeze_log_dev_action_date_key'
    AND    conrelid = 'public.streak_freeze_log'::regclass
  ) THEN
    ALTER TABLE public.streak_freeze_log
      ADD CONSTRAINT streak_freeze_log_dev_action_date_key
      UNIQUE (developer_id, action, granted_date);
  END IF;
END $$;