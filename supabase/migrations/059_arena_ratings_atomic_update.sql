-- ============================================================
-- 059: Atomic arena_ratings update
-- Fixes the read-then-JS-compute-then-upsert race in
-- POST /api/arena/submit (lines 204–255) where two concurrent
-- accepted submissions read the same arena_ratings snapshot,
-- compute deltas independently, and the last writer silently
-- discards the other's increments.
--
-- Changes:
--   1. update_arena_ratings_atomic() RPC — performs the entire
--      read + compute + write inside a single SQL function with
--      a FOR UPDATE row lock so concurrent calls are serialised
--      at the DB level. No application-level read is needed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_arena_ratings_atomic(
  p_user_id        BIGINT,
  p_is_accepted    BOOLEAN,
  p_is_first_solve BOOLEAN,
  p_difficulty     TEXT     -- 'easy' | 'medium' | 'hard'
)
RETURNS TABLE(
  new_rating           INT,
  new_problems_solved  INT,
  new_problems_attempted INT,
  new_current_streak   INT,
  new_best_streak      INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rating             INT         := 1200;
  v_problems_solved    INT         := 0;
  v_problems_attempted INT         := 0;
  v_current_streak     INT         := 0;
  v_best_streak        INT         := 0;
  v_last_solved_at     TIMESTAMPTZ := NULL;
  v_today              TEXT;
  v_yesterday          TEXT;
  v_last_solved_date   TEXT;
  v_now                TIMESTAMPTZ := now();
BEGIN
  v_today     := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_yesterday := to_char((v_now - INTERVAL '1 day') AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  -- Lock the row (or the gap) so concurrent calls queue up here.
  -- FOR UPDATE on a maybeSingle-style select; if no row exists yet
  -- the INSERT below is also safe because UPSERT is atomic.
  SELECT
    COALESCE(rating, 1200),
    COALESCE(problems_solved, 0),
    COALESCE(problems_attempted, 0),
    COALESCE(current_streak, 0),
    COALESCE(best_streak, 0),
    last_solved_at
  INTO
    v_rating,
    v_problems_solved,
    v_problems_attempted,
    v_current_streak,
    v_best_streak,
    v_last_solved_at
  FROM public.arena_ratings
  WHERE user_id = p_user_id
  FOR UPDATE;            -- ← serialises concurrent writers

  -- Always count the attempt
  v_problems_attempted := v_problems_attempted + 1;

  -- Only apply solve-level deltas when this is the first accepted solve
  IF p_is_accepted AND p_is_first_solve THEN
    v_problems_solved := v_problems_solved + 1;

    -- Rating delta by difficulty
    IF    p_difficulty = 'easy'   THEN v_rating := v_rating + 10;
    ELSIF p_difficulty = 'medium' THEN v_rating := v_rating + 20;
    ELSIF p_difficulty = 'hard'   THEN v_rating := v_rating + 40;
    END IF;

    -- Streak logic (UTC date comparison, mirrors the TS logic)
    v_last_solved_date := CASE
      WHEN v_last_solved_at IS NOT NULL
        THEN to_char(v_last_solved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ELSE NULL
    END;

    IF v_last_solved_date IS DISTINCT FROM v_today THEN
      IF v_last_solved_date = v_yesterday THEN
        v_current_streak := v_current_streak + 1;
      ELSE
        v_current_streak := 1;
      END IF;
      IF v_current_streak > v_best_streak THEN
        v_best_streak := v_current_streak;
      END IF;
    END IF;
  END IF;

  -- Atomic upsert — safe even when the row did not previously exist
  INSERT INTO public.arena_ratings (
    user_id,
    rating,
    problems_solved,
    problems_attempted,
    current_streak,
    best_streak,
    last_solved_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_rating,
    v_problems_solved,
    v_problems_attempted,
    v_current_streak,
    v_best_streak,
    CASE WHEN p_is_accepted AND p_is_first_solve THEN v_now ELSE v_last_solved_at END,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    rating             = EXCLUDED.rating,
    problems_solved    = EXCLUDED.problems_solved,
    problems_attempted = EXCLUDED.problems_attempted,
    current_streak     = EXCLUDED.current_streak,
    best_streak        = EXCLUDED.best_streak,
    last_solved_at     = EXCLUDED.last_solved_at,
    updated_at         = EXCLUDED.updated_at;

  RETURN QUERY SELECT
    v_rating,
    v_problems_solved,
    v_problems_attempted,
    v_current_streak,
    v_best_streak;
END;
$$;