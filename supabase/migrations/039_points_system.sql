-- 1. Add points column to developers
ALTER TABLE developers ADD COLUMN IF NOT EXISTS points int DEFAULT 0;

-- 2. Add price_points column to items
ALTER TABLE developers ADD COLUMN IF NOT EXISTS points int DEFAULT 0; -- Already added above but just in case
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_points int;

-- 3. Update items with point prices
UPDATE items SET price_points = 50 WHERE id = 'streak_freeze';
UPDATE items SET price_points = 25 WHERE id = 'flag';
UPDATE items SET price_points = 40 WHERE id = 'spire';
UPDATE items SET price_points = 100 WHERE id = 'ac_badge';
UPDATE items SET price_points = 150 WHERE id = 'binary_tree';

-- 4. Update perform_checkin RPC to grant 5 points
CREATE OR REPLACE FUNCTION perform_checkin(p_developer_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_date    date;
  v_streak       int;
  v_longest      int;
  v_freezes      int;
  v_points       int;
  v_today        date := current_date;
  v_was_frozen   boolean := false;
BEGIN
  -- Lock the developer row to prevent race conditions
  SELECT last_checkin_date, app_streak, app_longest_streak, streak_freezes_available, points
    INTO v_last_date, v_streak, v_longest, v_freezes, v_points
    FROM developers
   WHERE id = p_developer_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'checked_in', false,
      'error', 'developer_not_found'
    );
  END IF;

  -- Already checked in today: idempotent return
  IF v_last_date = v_today THEN
    RETURN jsonb_build_object(
      'checked_in', false,
      'already_today', true,
      'streak', v_streak,
      'longest', v_longest
    );
  END IF;

  -- Consecutive day: streak + 1
  IF v_last_date = v_today - 1 THEN
    v_streak := v_streak + 1;

  -- Missed exactly 1 day AND has freeze available
  ELSIF v_last_date = v_today - 2 AND v_freezes > 0 THEN
    v_freezes := v_freezes - 1;
    v_streak := v_streak + 1;
    v_was_frozen := true;

    -- Insert the frozen day check-in (yesterday)
    INSERT INTO streak_checkins (developer_id, checkin_date, type)
    VALUES (p_developer_id, v_today - 1, 'frozen')
    ON CONFLICT DO NOTHING;

    -- Log the freeze consumption
    INSERT INTO streak_freeze_log (developer_id, action, frozen_date)
    VALUES (p_developer_id, 'consumed', v_today - 1);

  -- Any other gap: reset
  ELSE
    v_streak := 1;
  END IF;

  -- Update longest
  IF v_streak > v_longest THEN
    v_longest := v_streak;
  END IF;

  -- Grant 5 points for daily login
  v_points := COALESCE(v_points, 0) + 5;

  -- Update developer row
  UPDATE developers
     SET app_streak = v_streak,
         app_longest_streak = v_longest,
         last_checkin_date = v_today,
         streak_freezes_available = v_freezes,
         points = v_points
   WHERE id = p_developer_id;

  -- Insert today's check-in
  INSERT INTO streak_checkins (developer_id, checkin_date, type)
  VALUES (p_developer_id, v_today, 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'checked_in', true,
    'already_today', false,
    'streak', v_streak,
    'longest', v_longest,
    'was_frozen', v_was_frozen,
    'points_granted', 5
  );
END;
$$;

-- 5. Update complete_all_dailies RPC to grant 15 points
CREATE OR REPLACE FUNCTION complete_all_dailies(p_developer_id bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_today       date := current_date;
  v_last_date   date;
  v_old_streak  int;
  v_new_streak  int;
  v_total       int;
  v_points      int;
BEGIN
  -- Lock the developer row
  SELECT last_dailies_date, dailies_streak, dailies_completed, points
  INTO v_last_date, v_old_streak, v_total, v_points
  FROM developers
  WHERE id = p_developer_id
  FOR UPDATE;

  -- Already completed today
  IF v_last_date = v_today THEN
    RETURN jsonb_build_object('already_completed', true, 'streak', v_old_streak, 'total', v_total);
  END IF;

  -- Calculate streak
  IF v_last_date = v_today - 1 THEN
    v_new_streak := v_old_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_total := v_total + 1;
  v_points := COALESCE(v_points, 0) + 15;

  UPDATE developers
  SET dailies_completed = v_total,
      dailies_streak = v_new_streak,
      last_dailies_date = v_today,
      points = v_points
  WHERE id = p_developer_id;

  RETURN jsonb_build_object(
    'already_completed', false,
    'streak', v_new_streak,
    'total', v_total,
    'points_granted', 15
  );
END;
$$;
