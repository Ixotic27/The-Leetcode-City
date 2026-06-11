-- ============================================================
-- 050: Raid Atomic Guards
-- Fixes two failure modes in POST /api/raid/execute:
--
-- A) In-memory rate limiter bypassed across serverless instances
--    (rate-limit.ts uses a per-process Map with no shared state).
-- B) Read-then-insert race on daily cap and peace-shield:
--    pre-insert COUNT and last_raided_at reads are stale by the
--    time the INSERT lands under concurrent load.
--
-- Solution:
--   1. raid_cooldowns table — one row per attacker, enforces the
--      30-second cooldown atomically via a DB-level constraint.
--   2. execute_raid() RPC — performs ALL guard checks and the
--      INSERT atomically inside a single serializable transaction.
--      Returns a structured result instead of raising exceptions
--      so the application layer can map to HTTP status codes.
-- ============================================================

-- ─── 1. Per-attacker cooldown table ─────────────────────────
-- One row per developer; cooldown_until is set on each raid.
-- The INSERT ... ON CONFLICT DO UPDATE with a WHERE clause acts
-- as the atomic CAS: it only updates (and returns a row) when
-- now() >= cooldown_until, i.e. the cooldown has expired.
CREATE TABLE IF NOT EXISTS public.raid_cooldowns (
  developer_id  BIGINT      PRIMARY KEY REFERENCES public.developers(id) ON DELETE CASCADE,
  cooldown_until TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);

ALTER TABLE public.raid_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_raid_cooldowns"
  ON public.raid_cooldowns FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. execute_raid() RPC ───────────────────────────────────
-- All guard checks (cooldown, daily cap, peace shield, weekly
-- pair cooldown) execute inside this function alongside the
-- INSERT, preventing any read-before-write window.
--
-- Returns one row with:
--   ok            BOOLEAN  — false if any guard blocked the raid
--   error_code    TEXT     — 'cooldown' | 'daily_cap' |
--                            'peace_shield' | 'weekly_pair' | null
--   raid_id       UUID     — set only when ok = true
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
  ok            BOOLEAN,
  error_code    TEXT,
  raid_id       UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_raids_today      INT;
  v_last_raided_at   TIMESTAMPTZ;
  v_weekly_pair      INT;
  v_max_raids        INT  := 5;         -- matches MAX_RAIDS_PER_DAY in src/lib/raid.ts
  v_shield_hours     INT  := 2;
  v_cooldown_secs    INT  := 30;
  v_today_start      TIMESTAMPTZ;
  v_week_start       TIMESTAMPTZ;
  v_new_raid_id      UUID;
  v_cooldown_updated BOOLEAN := false;
BEGIN
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_week_start  := date_trunc('week', now() AT TIME ZONE 'UTC');

  -- ── Guard 1: 30-second cooldown (atomic CAS) ──────────────
  -- Insert a row if none exists, or update cooldown_until only
  -- if the existing cooldown has expired. If neither branch
  -- fires (ROW_COUNT = 0), the cooldown is still active.
  INSERT INTO public.raid_cooldowns (developer_id, cooldown_until)
  VALUES (p_attacker_id, now() + (v_cooldown_secs || ' seconds')::interval)
  ON CONFLICT (developer_id) DO UPDATE
    SET cooldown_until = now() + (v_cooldown_secs || ' seconds')::interval
    WHERE raid_cooldowns.cooldown_until <= now();

  GET DIAGNOSTICS v_cooldown_updated = ROW_COUNT;

  IF v_cooldown_updated = 0 THEN
    RETURN QUERY SELECT false, 'cooldown'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- ── Guard 2: Daily cap ────────────────────────────────────
  SELECT COUNT(*)::INT INTO v_raids_today
  FROM   public.raids
  WHERE  attacker_id = p_attacker_id
  AND    created_at  >= v_today_start;

  IF v_raids_today >= v_max_raids THEN
    -- Roll back cooldown so the user isn't penalised for a cap hit
    UPDATE public.raid_cooldowns
    SET    cooldown_until = '1970-01-01T00:00:00Z'
    WHERE  developer_id  = p_attacker_id;

    RETURN QUERY SELECT false, 'daily_cap'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- ── Guard 3: Peace shield ─────────────────────────────────
  SELECT last_raided_at INTO v_last_raided_at
  FROM   public.developers
  WHERE  id = p_defender_id
  FOR UPDATE;  -- lock the defender row for the duration of this txn

  IF v_last_raided_at IS NOT NULL
     AND v_last_raided_at + (v_shield_hours || ' hours')::interval > now() THEN
    UPDATE public.raid_cooldowns
    SET    cooldown_until = '1970-01-01T00:00:00Z'
    WHERE  developer_id  = p_attacker_id;

    RETURN QUERY SELECT false, 'peace_shield'::TEXT, NULL::UUID;
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

    RETURN QUERY SELECT false, 'weekly_pair'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- ── All guards passed: insert raid + update shield ────────
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

  -- Atomically set peace shield on defender
  UPDATE public.developers
  SET    last_raided_at = now(),
         active_defenses = '[]'::jsonb
  WHERE  id = p_defender_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_new_raid_id;
END;
$$;