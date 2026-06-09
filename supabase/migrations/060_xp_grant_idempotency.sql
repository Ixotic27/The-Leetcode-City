-- Migration: XP Grant Atomicity & Idempotency
-- Issue #343
--
-- Provides:
--   1. xp_grant_log table — idempotency anchor for every XP grant
--   2. grant_xp_atomic() RPC — atomically increments XP, caps daily
--      engagement sources, logs each grant, and returns null for
--      duplicate calls

-- ─── 1. XP Grant Log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_grant_log (
  developer_id  BIGINT       NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  source        TEXT         NOT NULL,
  source_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  amount        INTEGER      NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (developer_id, source, source_date)
);

-- ─── 2. grant_xp_atomic() RPC ────────────────────────────────
CREATE OR REPLACE FUNCTION grant_xp_atomic(
  p_developer_id BIGINT,
  p_source       TEXT,
  p_amount       INTEGER,
  p_source_date  DATE DEFAULT CURRENT_DATE
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual    INTEGER;
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_daily     INTEGER;
  v_today     DATE := CURRENT_DATE;
BEGIN
  -- Idempotency: if this exact grant was already logged, return null
  -- The caller should treat null as "already granted, skip"
  INSERT INTO xp_grant_log (developer_id, source, source_date, amount)
  VALUES (p_developer_id, p_source, p_source_date, p_amount)
  ON CONFLICT (developer_id, source, source_date) DO NOTHING;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Reset daily counter if new day
  UPDATE developers
  SET xp_daily = 0, xp_daily_date = v_today
  WHERE id = p_developer_id AND (xp_daily_date IS NULL OR xp_daily_date < v_today);

  SELECT xp_daily INTO v_daily FROM developers WHERE id = p_developer_id;

  -- Daily cap only for engagement sources
  IF p_source IN ('checkin', 'dailies', 'kudos_given', 'visit', 'fly') THEN
    v_actual := LEAST(p_amount, GREATEST(0, 150 - COALESCE(v_daily, 0)));
  ELSE
    v_actual := p_amount;
  END IF;

  IF v_actual <= 0 THEN
    DELETE FROM xp_grant_log
    WHERE developer_id = p_developer_id
      AND source = p_source
      AND source_date = p_source_date;
    RETURN json_build_object('granted', 0, 'reason', 'daily_cap');
  END IF;

  -- Atomic increment
  UPDATE developers
  SET xp_total = xp_total + v_actual,
      xp_daily = COALESCE(xp_daily, 0) +
        CASE WHEN p_source IN ('checkin','dailies','kudos_given','visit','fly')
        THEN v_actual ELSE 0 END,
      xp_daily_date = v_today
  WHERE id = p_developer_id
  RETURNING xp_total INTO v_new_total;

  -- Calculate level (25 * level^2.2)
  v_new_level := 1;
  WHILE v_new_total >= (25 * POWER(v_new_level + 1, 2.2))::integer LOOP
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE developers SET xp_level = GREATEST(xp_level, v_new_level)
  WHERE id = p_developer_id;

  -- Update the log row with the actual amount granted
  UPDATE xp_grant_log SET amount = v_actual
  WHERE developer_id = p_developer_id
    AND source = p_source
    AND source_date = p_source_date;

  -- Also log to the existing audit trail
  INSERT INTO xp_log (developer_id, source, amount)
  VALUES (p_developer_id, p_source, v_actual);

  RETURN json_build_object('granted', v_actual, 'new_total', v_new_total, 'new_level', v_new_level);
END;
$$;
