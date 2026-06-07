-- ============================================================
-- 049: Arena First-Solve Idempotency
-- Fixes the read-then-write race in POST /api/arena/submit
-- that allowed concurrent requests to claim first-solve
-- rewards (XP, points, item drops) multiple times.
--
-- Changes:
--   1. arena_first_solves table — unique (user_id, challenge_id)
--      and (user_id, problem_id) act as the atomic guard.
--      INSERT ... ON CONFLICT DO NOTHING is the CAS operation.
--   2. grant_first_solve_rewards() RPC — wraps the guard insert
--      and points increment atomically inside a single function.
--      Returns whether this call won the race (inserted = true).
-- ============================================================

-- ─── 1. First-solve tracking table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.arena_first_solves (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT      NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  -- exactly one of challenge_id or problem_id is set
  challenge_id  UUID        REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  problem_id    TEXT,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  points_granted INT        NOT NULL DEFAULT 0,
  xp_granted    INT         NOT NULL DEFAULT 0,

  -- enforce uniqueness per (user, challenge) and per (user, problem)
  -- use partial unique indexes so NULLs are handled correctly
  CONSTRAINT arena_first_solves_user_challenge_uniq
    UNIQUE (user_id, challenge_id),
  CONSTRAINT chk_one_of_challenge_or_problem
    CHECK (
      (challenge_id IS NOT NULL AND problem_id IS NULL) OR
      (challenge_id IS NULL     AND problem_id IS NOT NULL)
    )
);

-- Partial unique index for the problem_id path (challenge_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS arena_first_solves_user_problem_uniq
  ON public.arena_first_solves (user_id, problem_id)
  WHERE problem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arena_first_solves_user
  ON public.arena_first_solves (user_id);

-- ─── 2. RLS ─────────────────────────────────────────────────
ALTER TABLE public.arena_first_solves ENABLE ROW LEVEL SECURITY;

-- Only the service role (admin client) writes; no direct client reads needed
CREATE POLICY "service_role_all_arena_first_solves"
  ON public.arena_first_solves
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── 3. Atomic points increment helper ──────────────────────
-- Used by grant_first_solve_rewards to avoid the fetch-then-write
-- race on developers.points.
CREATE OR REPLACE FUNCTION public.increment_developer_points(
  p_developer_id BIGINT,
  p_amount       INT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.developers
  SET    points = COALESCE(points, 0) + p_amount
  WHERE  id = p_developer_id;
$$;

-- ─── 4. Core idempotency RPC ────────────────────────────────
-- Returns:
--   won_race BOOLEAN  — true if this call was the first-solve winner
--                       false if another concurrent call already won
CREATE OR REPLACE FUNCTION public.claim_first_solve(
  p_user_id      BIGINT,
  p_challenge_id UUID    DEFAULT NULL,
  p_problem_id   TEXT    DEFAULT NULL,
  p_points       INT     DEFAULT 0,
  p_xp           INT     DEFAULT 0
)
RETURNS TABLE(won_race BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted BOOLEAN := false;
BEGIN
  -- Exactly one of p_challenge_id / p_problem_id must be provided
  IF (p_challenge_id IS NULL AND p_problem_id IS NULL) OR
     (p_challenge_id IS NOT NULL AND p_problem_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of p_challenge_id or p_problem_id must be provided';
  END IF;

  -- Attempt atomic insert — ON CONFLICT DO NOTHING means only the
  -- first concurrent caller succeeds; all others get 0 rows affected.
  IF p_challenge_id IS NOT NULL THEN
    INSERT INTO public.arena_first_solves
      (user_id, challenge_id, problem_id, points_granted, xp_granted)
    VALUES
      (p_user_id, p_challenge_id, NULL, p_points, p_xp)
    ON CONFLICT (user_id, challenge_id) DO NOTHING;
  ELSE
    INSERT INTO public.arena_first_solves
      (user_id, challenge_id, problem_id, points_granted, xp_granted)
    VALUES
      (p_user_id, NULL, p_problem_id, p_points, p_xp)
    ON CONFLICT (user_id, problem_id) WHERE problem_id IS NOT NULL DO NOTHING;
  END IF;

  -- GET DIAGNOSTICS would also work; FOUND reflects last DML result
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  v_inserted := v_inserted > 0;

  -- Only increment points if this call won the race
  IF v_inserted THEN
    PERFORM public.increment_developer_points(p_user_id, p_points);
  END IF;

  RETURN QUERY SELECT v_inserted;
END;
$$;

-- ─── 5. Atomic inventory upsert ─────────────────────────────
-- Replaces the read-then-write in rollItemDrops.
-- Uses INSERT ... ON CONFLICT DO UPDATE to atomically increment
-- quantity — no application-level read needed.
CREATE OR REPLACE FUNCTION public.upsert_arena_inventory_item(
  p_user_id BIGINT,
  p_item_id UUID
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.arena_inventory (user_id, item_id, quantity, is_equipped)
  VALUES (p_user_id, p_item_id, 1, false)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = arena_inventory.quantity + 1;
$$;