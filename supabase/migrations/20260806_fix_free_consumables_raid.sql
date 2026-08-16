-- Migration: Fix free and level-unlocked consumables in raids
-- Allows users to use quest/level unlocked consumables (e.g. scouting_satellite) for free
-- even if they do not have a developer_consumables row or own 0 quantity of it.

CREATE OR REPLACE FUNCTION public.execute_raid(
  p_attacker_id       BIGINT,
  p_defender_id       BIGINT,
  p_attack_score      INT,
  p_defense_score     INT,
  p_success           BOOLEAN,
  p_attack_breakdown  JSONB,
  p_defense_breakdown JSONB,
  p_vehicle           TEXT,
  p_tag_style         TEXT,
  p_consumable_item_id TEXT,
  p_week_start        DATE
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
  v_inv_id           UUID;
  v_quantity         INT;
  v_weekly_uses      INT;
  v_last_reset_week  DATE;
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
    RETURN QUERY SELECT false, 'cooldown'::TEXT, NULL::UUID;
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

    RETURN QUERY SELECT false, 'daily_cap'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- ── Guard 3: Peace shield ─────────────────────────────────
  SELECT last_raided_at INTO v_last_raided_at
  FROM   public.developers
  WHERE  id = p_defender_id
  FOR UPDATE;

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

  -- ── Guard 5: Consumable check and usage tracking ──────────
  IF p_consumable_item_id IS NOT NULL THEN
    SELECT id, quantity, weekly_uses, last_reset_week
    INTO v_inv_id, v_quantity, v_weekly_uses, v_last_reset_week
    FROM public.developer_consumables
    WHERE developer_id = p_attacker_id AND item_id = p_consumable_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Insert a tracking row with 0 quantity so we can track weekly uses
      INSERT INTO public.developer_consumables (developer_id, item_id, quantity, weekly_uses, last_reset_week, updated_at)
      VALUES (p_attacker_id, p_consumable_item_id, 0, 0, p_week_start, now())
      RETURNING id, quantity, weekly_uses, last_reset_week
      INTO v_inv_id, v_quantity, v_weekly_uses, v_last_reset_week;
    END IF;

    IF v_last_reset_week != p_week_start THEN
      v_weekly_uses := 0;
      v_last_reset_week := p_week_start;
    END IF;

    IF v_weekly_uses >= 3 THEN
      UPDATE public.raid_cooldowns
      SET cooldown_until = '1970-01-01T00:00:00Z'
      WHERE developer_id = p_attacker_id;

      RETURN QUERY SELECT false, 'consumable'::TEXT, NULL::UUID;
      RETURN;
    END IF;

    -- Update inventory: only decrement quantity if the user actually owns some (quantity > 0)
    UPDATE public.developer_consumables
    SET quantity = CASE WHEN v_quantity > 0 THEN v_quantity - 1 ELSE 0 END,
        weekly_uses = v_weekly_uses + 1,
        last_reset_week = v_last_reset_week,
        updated_at = now()
    WHERE id = v_inv_id;
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
