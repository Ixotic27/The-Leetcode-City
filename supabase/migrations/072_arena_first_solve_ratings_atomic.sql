-- ============================================================
-- 072: Atomic arena first-solve claim + rating update + XP grant
--
-- Combines the first-solve guard, arena ratings update, and
-- XP grant into a single Postgres transaction. This prevents
-- partial reward application when downstream reward operations
-- fail after the submission has already been persisted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_first_solve_and_update_arena_ratings_atomic(
  p_user_id       BIGINT,
  p_is_accepted   BOOLEAN,
  p_challenge_id  UUID    DEFAULT NULL,
  p_problem_id    TEXT    DEFAULT NULL,
  p_points        INT     DEFAULT 0,
  p_xp            INT     DEFAULT 0,
  p_source        TEXT,
  p_difficulty    TEXT,
  p_timezone      TEXT    DEFAULT 'UTC'
)
RETURNS TABLE(won_race BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_won_race BOOLEAN := false;
BEGIN
  IF p_is_accepted THEN
    SELECT won_race
    INTO v_won_race
    FROM public.claim_first_solve(
      p_user_id,
      p_challenge_id,
      p_problem_id,
      p_points,
      p_xp
    );
  END IF;

  PERFORM public.update_arena_ratings_atomic(
    p_user_id,
    p_is_accepted,
    v_won_race,
    p_difficulty,
    p_timezone
  );

  IF p_is_accepted AND v_won_race THEN
    PERFORM public.grant_xp_atomic(
      p_user_id,
      p_source,
      p_xp
    );
  END IF;

  RETURN QUERY SELECT v_won_race;
END;
$$;
