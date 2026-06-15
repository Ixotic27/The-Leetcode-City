-- ============================================================
-- 063: Atomic XP Grant inside redeem_xp_code()
-- Moves the XP grant into the same transaction as usage
-- recording and the used_count increment so that a crash or
-- timeout between steps 2 and 3 can no longer consume the
-- code without granting XP.
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_xp_code(
  p_code_id       UUID,
  p_developer_id  BIGINT,
  p_xp_amount     INT,
  p_max_uses      INT
)
RETURNS TABLE(
  ok           BOOLEAN,
  error_code   TEXT,
  xp_amount    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted     BOOLEAN := false;
  v_rows_updated INT;
BEGIN
  INSERT INTO public.xp_code_usages (code_id, developer_id)
  VALUES (p_code_id, p_developer_id)
  ON CONFLICT (code_id, developer_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN QUERY SELECT false, 'already_redeemed'::TEXT, 0;
    RETURN;
  END IF;

  IF p_max_uses != -1 THEN
    UPDATE public.xp_redeem_codes
    SET    used_count = used_count + 1
    WHERE  id         = p_code_id
    AND    used_count < p_max_uses;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      DELETE FROM public.xp_code_usages
      WHERE  code_id      = p_code_id
      AND    developer_id = p_developer_id;

      RETURN QUERY SELECT false, 'exhausted'::TEXT, 0;
      RETURN;
    END IF;
  ELSE
    UPDATE public.xp_redeem_codes
    SET    used_count = used_count + 1
    WHERE  id = p_code_id;
  END IF;

  UPDATE public.developers
  SET    xp_total = xp_total + p_xp_amount
  WHERE  id = p_developer_id;

  RETURN QUERY SELECT true, NULL::TEXT, p_xp_amount;
END;
$$;
