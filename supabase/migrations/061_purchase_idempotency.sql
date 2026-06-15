-- Migration: Purchase & Points Data Integrity
-- Issue #344
--
-- Provides:
--   1. idempotency_key column on purchases for webhook dedup
--   2. deduct_points_atomic() RPC for atomic points deduction
--   3. deduct_xp_atomic() RPC for atomic XP deduction (redeem routes)

-- ─── 1. Purchase Idempotency Key ──────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_idempotency_key
  ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ─── 2. Atomic Points Deduction ─────────────────────────────
CREATE OR REPLACE FUNCTION deduct_points_atomic(
  p_developer_id BIGINT,
  p_price_points INTEGER
) RETURNS TABLE(success BOOLEAN, remaining_points INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE developers
  SET points = points - p_price_points
  WHERE id = p_developer_id AND points >= p_price_points
  RETURNING points INTO v_remaining;

  IF FOUND THEN
    success := true;
    remaining_points := v_remaining;
  ELSE
    success := false;
    remaining_points := 0;
  END IF;

  RETURN NEXT;
END;
$$;

-- ─── 3. Atomic XP Deduction ─────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_xp_atomic(
  p_developer_id BIGINT,
  p_amount INTEGER
) RETURNS TABLE(success BOOLEAN, remaining_xp INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE developers
  SET xp_total = xp_total - p_amount
  WHERE id = p_developer_id AND xp_total >= p_amount
  RETURNING xp_total INTO v_remaining;

  IF FOUND THEN
    success := true;
    remaining_xp := v_remaining;
  ELSE
    success := false;
    remaining_xp := 0;
  END IF;

  RETURN NEXT;
END;
$$;

-- ─── 4. Atomic Points Add (rollback) ──────────────────────────
CREATE OR REPLACE FUNCTION add_points_atomic(
  p_developer_id BIGINT,
  p_price_points INTEGER
) RETURNS TABLE(success BOOLEAN, remaining_points INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE developers
  SET points = points + p_price_points
  WHERE id = p_developer_id
  RETURNING points INTO v_remaining;

  IF FOUND THEN
    success := true;
    remaining_points := v_remaining;
  ELSE
    success := false;
    remaining_points := 0;
  END IF;

  RETURN NEXT;
END;
$$;
