-- ============================================================
-- 061: XP Redeem Code Atomic Grant
-- Issue #863
--
-- Fixes: redeem_xp_code RPC consumed the code but XP grant was
-- a separate DB round-trip (grant_xp_atomic). If the second RPC
-- failed (crash, timeout), the code was permanently consumed
-- but the developer received no XP.
--
-- Fix: redeem_xp_code now calls grant_xp_atomic internally
-- within the same PL/pgSQL transaction. If the XP grant fails,
-- the entire transaction rolls back, including code consumption.
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
  xp_amount    INT,
  new_total    INT,
  new_level    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted      BOOLEAN := false;
  v_rows_updated  INT;
  v_grant_result  JSON;
BEGIN
  INSERT INTO public.xp_code_usages (code_id, developer_id)
  VALUES (p_code_id, p_developer_id)
  ON CONFLICT (code_id, developer_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN QUERY SELECT false, 'already_redeemed'::TEXT, 0, NULL::INT, NULL::INT;
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

      RETURN QUERY SELECT false, 'exhausted'::TEXT, 0, NULL::INT, NULL::INT;
      RETURN;
    END IF;
  ELSE
    UPDATE public.xp_redeem_codes
    SET    used_count = used_count + 1
    WHERE  id = p_code_id;
  END IF;

  -- Grant XP atomically within the same transaction.
  -- If grant_xp_atomic fails or the XP grant is rejected,
  -- the entire transaction rolls back (code usage + increment).
  SELECT public.grant_xp_atomic(
    p_developer_id,
    'xp_code:' || p_code_id::TEXT,
    p_xp_amount
  ) INTO v_grant_result;

  IF v_grant_result IS NULL OR (v_grant_result->>'granted')::INT = 0 THEN
    -- XP grant was idempotent or capped at zero — roll back
    DELETE FROM public.xp_code_usages
    WHERE  code_id      = p_code_id
    AND    developer_id = p_developer_id;

    UPDATE public.xp_redeem_codes
    SET    used_count = used_count - 1
    WHERE  id = p_code_id;

    RETURN QUERY SELECT false, 'grant_failed'::TEXT, 0, NULL::INT, NULL::INT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    p_xp_amount,
    (v_grant_result->>'new_total')::INT,
    (v_grant_result->>'new_level')::INT;
END;
$$;