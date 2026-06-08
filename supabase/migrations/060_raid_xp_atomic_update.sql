-- ============================================================
-- 060: Move raid_xp updates into execute_raid() RPC
-- Fixes race condition where raid_xp was updated in Node.js
-- using stale in-memory values read before the RPC call.
--
-- Problem:
--   The route handler read attacker/defender raid_xp at request
--   start, then wrote it back after execute_raid() returned.
--   Any concurrent XP changes between the read and write were
--   silently overwritten (lost update anomaly).
--
-- Solution:
--   1. Lock both attacker and defender rows with FOR UPDATE
--   2. Read current raid_xp inside the transaction
--   3. UPDATE raid_xp atomically within the same row lock
--   4. Return new raid_xp values in the RPC result
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_raid(
  p_attacker_id       BIGINT,
  p_defender_id       BIGINT,
  p_attack_score      INT,
  p_defense_score     INT,
  p_success           BOOLEAN,
  p_attack_breakdown  JSONB,
  p_defense_breakdown JSONB,
  p_vehicle           TEXT,
  p_tag_style         TEXT
)
RETURNS TABLE(
  ok                 BOOLEAN,
  error_code         TEXT,
  raid_id            UUID,
  attacker_raid_xp   INT,
  defender_raid_xp   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_raids_today      INT;
  v_last_raided_at   TIMESTAMPTZ;
  v_weekly_pair      INT;
  v_max_raids        INT  := 5;
  v_shield_hours     INT  := 2;
  v_cooldown_secs    INT  := 30;
  v_today_start      TIMESTAMPTZ;
  v_week_start       TIMESTAMPTZ;
  v_new_raid_id      UUID;
  v_cooldown_updated BOOLEAN := false;
  v_attacker_xp      INT;
  v_defender_xp      INT;
  v_xp_win_attacker  INT  := 50;
  v_xp_win_defender  INT  := 30;
  v_xp_lose_defender INT  := 30;
BEGIN
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_week_start  := date_trunc('week', now() AT TIME ZONE 'UTC');

  -- ── Guard 1: 30-second cooldown (atomic CAS) ──────────────
  INSERT INTO public.raid_cooldowns (developer_id, cooldown_until)
  VALUES (p_attacker_id, now() + (v_cooldown_secs || ' seconds')::interval)
  ON CONFLICT (developer_id) DO UPDATE
    SET cooldown_until = now() + (v_cooldown_secs || ' seconds')::interval
    WHERE raid_cooldowns.cooldown_until <= now();

  GET DIAGNOSTICS v_cooldown_updated = ROW_COUNT;

  IF v_cooldown_updated = 0 THEN
    RETURN QUERY SELECT false, 'cooldown'::TEXT, NULL::UUID, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  -- ── Guard 2: Daily cap ────────────────────────────────────
  SELECT COUNT(*)::INT INTO v_raids_today
  FROM   public.raids
  WHERE  attacker_id = p_attacker_id
  AND    created_at  >= v_today_start;

  IF v_raids_today >= v_max_raids THEN
    UPDATE public.raid_cooldowns
    SET    cooldown_until = '1970-01-01T00:00:00Z'
    WHERE  developer_id  = p_attacker_id;

    RETURN QUERY SELECT false, 'daily_cap'::TEXT, NULL::UUID, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  -- ── Lock both developer rows in deterministic ID order ───
  -- Locking by LEAST/GREATEST ID prevents ABBA deadlocks when
  -- two users raid each other concurrently (cross-raids).
  IF p_attacker_id < p_defender_id THEN
    SELECT raid_xp INTO v_attacker_xp
    FROM   public.developers WHERE id = p_attacker_id FOR UPDATE;

    SELECT last_raided_at, raid_xp
    INTO   v_last_raided_at, v_defender_xp
    FROM   public.developers WHERE id = p_defender_id FOR UPDATE;
  ELSE
    SELECT last_raided_at, raid_xp
    INTO   v_last_raided_at, v_defender_xp
    FROM   public.developers WHERE id = p_defender_id FOR UPDATE;

    SELECT raid_xp INTO v_attacker_xp
    FROM   public.developers WHERE id = p_attacker_id FOR UPDATE;
  END IF;

  -- ── Guard 3: Peace shield ─────────────────────────────────
  IF v_last_raided_at IS NOT NULL
     AND v_last_raided_at + (v_shield_hours || ' hours')::interval > now() THEN
    UPDATE public.raid_cooldowns
    SET    cooldown_until = '1970-01-01T00:00:00Z'
    WHERE  developer_id  = p_attacker_id;

    RETURN QUERY SELECT false, 'peace_shield'::TEXT, NULL::UUID, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  -- ── Guard 4: Weekly per-pair cooldown ─────────────────────
  SELECT COUNT(*)::INT INTO v_weekly_pair
  FROM   public.raids
  WHERE  attacker_id = p_attacker_id
  AND    defender_id = p_defender_id
  AND    created_at  >= v_week_start;

  IF v_weekly_pair > 0 THEN
    UPDATE public.raid_cooldowns
    SET    cooldown_until = '1970-01-01T00:00:00Z'
    WHERE  developer_id  = p_attacker_id;

    RETURN QUERY SELECT false, 'weekly_pair'::TEXT, NULL::UUID, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  -- ── All guards passed: insert raid + update shield + XP ───
  INSERT INTO public.raids (
    attacker_id, defender_id,
    attack_score, defense_score,
    success,
    attack_breakdown, defense_breakdown,
    attacker_vehicle, attacker_tag_style
  )
  VALUES (
    p_attacker_id, p_defender_id,
    p_attack_score, p_defense_score,
    p_success,
    p_attack_breakdown, p_defense_breakdown,
    p_vehicle, p_tag_style
  )
  RETURNING id INTO v_new_raid_id;

  -- Atomically update peace shield on defender
  UPDATE public.developers
  SET    last_raided_at = now(),
         active_defenses = '[]'::jsonb
  WHERE  id = p_defender_id;

  -- Atomically update raid_xp on both parties
  IF p_success THEN
    -- Attacker wins: +50 attacker, +30 defender
    UPDATE public.developers
    SET    raid_xp = v_attacker_xp + v_xp_win_attacker
    WHERE  id = p_attacker_id;

    UPDATE public.developers
    SET    raid_xp = v_defender_xp + v_xp_win_defender
    WHERE  id = p_defender_id;

    v_attacker_xp := v_attacker_xp + v_xp_win_attacker;
    v_defender_xp := v_defender_xp + v_xp_win_defender;
  ELSE
    -- Attacker loses: +30 defender only
    UPDATE public.developers
    SET    raid_xp = v_defender_xp + v_xp_lose_defender
    WHERE  id = p_defender_id;

    v_defender_xp := v_defender_xp + v_xp_lose_defender;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, v_new_raid_id, v_attacker_xp, v_defender_xp;
END;
$$;
