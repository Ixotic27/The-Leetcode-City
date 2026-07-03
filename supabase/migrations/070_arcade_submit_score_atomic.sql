-- Atomic submit arcade score RPC
-- Creates arcade_milestones table if missing and an RPC to atomically upsert scores,
-- compute rank, award milestones, and credit PX via `credit_pixels`.

CREATE TABLE IF NOT EXISTS public.arcade_milestones (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game       text NOT NULL,
  milestone  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game, milestone)
);

CREATE OR REPLACE FUNCTION public.submit_arcade_score(
  p_developer_id bigint DEFAULT NULL,
  p_user_id uuid,
  p_game text,
  p_diff_ms integer,
  p_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_best integer;
  v_attempts integer := 0;
  v_is_new boolean := false;
  v_best integer := p_diff_ms;
  v_rank integer := NULL;
  v_px integer := 0;
  v_milestones text[] := ARRAY[]::text[];
  v_count integer := 0;
BEGIN
  -- Serialize per-user to avoid races without relying on nullable developer IDs
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Upsert arcade_scores atomically
  SELECT best_ms, attempts INTO v_prev_best, v_attempts
  FROM public.arcade_scores
  WHERE user_id = p_user_id AND game = p_game;

  IF FOUND THEN
    v_attempts := v_attempts + 1;
    IF p_diff_ms < v_prev_best THEN
      v_is_new := true;
      v_best := p_diff_ms;
      UPDATE public.arcade_scores
      SET best_ms = p_diff_ms, attempts = v_attempts, updated_at = now()
      WHERE user_id = p_user_id AND game = p_game;
    ELSE
      UPDATE public.arcade_scores
      SET attempts = v_attempts, updated_at = now()
      WHERE user_id = p_user_id AND game = p_game;
    END IF;
  ELSE
    INSERT INTO public.arcade_scores (user_id, game, best_ms, attempts)
    VALUES (p_user_id, p_game, p_diff_ms, 1);
    v_attempts := 1;
    v_is_new := true;
    v_best := p_diff_ms;
  END IF;

  -- Compute rank (1-based)
  SELECT COUNT(*) INTO v_count FROM public.arcade_scores WHERE game = p_game AND best_ms < v_best;
  v_rank := v_count + 1;

  -- Award simple milestone set (mirror server-side JS definitions)
  -- first_try
  IF NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'first_try') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'first_try');
    v_milestones := array_append(v_milestones, 'first_try');
    v_px := v_px + 5;
  END IF;

  -- close_enough (<=500ms)
  IF p_diff_ms <= 500 AND NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'close_enough') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'close_enough');
    v_milestones := array_append(v_milestones, 'close_enough');
    v_px := v_px + 10;
  END IF;

  -- sharp (<=100ms)
  IF p_diff_ms <= 100 AND NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'sharp') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'sharp');
    v_milestones := array_append(v_milestones, 'sharp');
    v_px := v_px + 25;
  END IF;

  -- sniper (<=50ms)
  IF p_diff_ms <= 50 AND NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'sniper') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'sniper');
    v_milestones := array_append(v_milestones, 'sniper');
    v_px := v_px + 50;
  END IF;

  -- inhuman (<=10ms)
  IF p_diff_ms <= 10 AND NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'inhuman') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'inhuman');
    v_milestones := array_append(v_milestones, 'inhuman');
    v_px := v_px + 100;
  END IF;

  -- perfection (<=5ms)
  IF p_diff_ms <= 5 AND NOT EXISTS (SELECT 1 FROM public.arcade_milestones WHERE user_id = p_user_id AND game = p_game AND milestone = 'perfection') THEN
    INSERT INTO public.arcade_milestones (user_id, game, milestone) VALUES (p_user_id, p_game, 'perfection');
    v_milestones := array_append(v_milestones, 'perfection');
    v_px := v_px + 250;
  END IF;

  -- Credit pixels if any and developer id present
  IF v_px > 0 AND p_developer_id IS NOT NULL THEN
    -- credit_pixels expected to exist as an RPC; call it for atomic crediting
    PERFORM public.credit_pixels(
      p_developer_id := p_developer_id,
      p_amount := v_px,
      p_source := 'arcade_milestone',
      p_reference_id := p_game,
      p_reference_type := 'arcade',
      p_description := 'Arcade milestones: ' || array_to_string(v_milestones, ', '),
      p_idempotency_key := 'arcade_' || p_user_id || '_' || p_game || '_' || array_to_string(v_milestones, '_')
    );
  END IF;

  RETURN jsonb_build_object(
    'best_ms', v_best,
    'attempts', v_attempts,
    'is_new_record', v_is_new,
    'rank', v_rank,
    'milestones', v_milestones,
    'px_earned', v_px
  );
END;
$$;
