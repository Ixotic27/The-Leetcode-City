-- Migration: Atomic kudos_streak update
-- Issue #497
--
-- The streak increment was previously computed in application code from
-- a snapshot of (kudos_streak, last_kudos_given_date) read at the start
-- of the request, then written back with an unconditional .update() —
-- no WHERE guard against a stale write. Two concurrent kudos requests
-- from the same giver (e.g. rapidly giving kudos to two different
-- receivers) both read the same snapshot and could race on the final
-- write, and the unconditional write could stomp a streak value that a
-- different (slower) concurrent request had already correctly advanced.
--
-- update_kudos_streak() makes this a single atomic UPDATE. Postgres'
-- row-level lock on UPDATE serializes concurrent calls for the same
-- giver: whichever call's UPDATE commits first advances the streak and
-- sets last_kudos_given_date to p_given_date; any other concurrent call
-- for the *same day* then finds last_kudos_given_date already equal to
-- p_given_date once it acquires the lock, so its WHERE clause excludes
-- the row (no double-increment), and it simply re-reads the now-current
-- streak value instead of overwriting it. This mirrors the same
-- single-statement, WHERE-guarded-update approach used elsewhere in this
-- codebase for atomic counters (e.g. grant_xp_atomic, perform_checkin).
CREATE OR REPLACE FUNCTION update_kudos_streak(
  p_giver_id    BIGINT,
  p_given_date  DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_yesterday  DATE := p_given_date - 1;
  v_new_streak INTEGER;
BEGIN
  UPDATE developers
  SET kudos_streak = CASE
        WHEN last_kudos_given_date = v_yesterday THEN kudos_streak + 1
        ELSE 1
      END,
      last_kudos_given_date = p_given_date
  WHERE id = p_giver_id
    AND last_kudos_given_date IS DISTINCT FROM p_given_date
  RETURNING kudos_streak INTO v_new_streak;

  IF NOT FOUND THEN
    -- Either kudos were already given today (legitimate same-day no-op,
    -- preserved from the original behavior) or a concurrent call for the
    -- same day already applied the increment — either way, return the
    -- current value rather than overwriting it.
    SELECT kudos_streak INTO v_new_streak
    FROM developers
    WHERE id = p_giver_id;
  END IF;

  RETURN jsonb_build_object('kudos_streak', v_new_streak);
END;
$$;