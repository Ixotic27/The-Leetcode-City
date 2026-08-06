-- Migration: Redeem shop codes inside a single atomic transaction.
-- Fixes Issue #1276: Concurrent requests could double-insert purchases
-- even if they lost the optimistic lock race on used_count increment.

CREATE OR REPLACE FUNCTION public.redeem_shop_code(
  p_code           TEXT,
  p_developer_id   BIGINT
)
RETURNS TABLE(
  ok          BOOLEAN,
  error_code  TEXT,
  item_id     TEXT,
  item_name   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code_id          BIGINT;
  v_item_id          TEXT;
  v_max_uses         INT;
  v_used_count       INT;
  v_expires_at       TIMESTAMPTZ;
  v_item_name        TEXT;
  v_is_active        BOOLEAN;
  v_owns_item        BOOLEAN;
  v_updated_rows     INT;
BEGIN
  -- 1. Fetch code details
  SELECT id, item_id, max_uses, used_count, expires_at
  INTO v_code_id, v_item_id, v_max_uses, v_used_count, v_expires_at
  FROM public.redeem_codes
  WHERE UPPER(code) = UPPER(TRIM(p_code));

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid_code'::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 2. Check expiration
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    -- Clean up expired code
    DELETE FROM public.redeem_codes WHERE id = v_code_id;
    RETURN QUERY SELECT false, 'expired_code'::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 3. Check usage limit
  IF v_max_uses != -1 AND v_used_count >= v_max_uses THEN
    -- Clean up exhausted code
    DELETE FROM public.redeem_codes WHERE id = v_code_id;
    RETURN QUERY SELECT false, 'fully_used_code'::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 4. Fetch item details and check if active
  SELECT name, is_active
  INTO v_item_name, v_is_active
  FROM public.items
  WHERE id = v_item_id;

  IF NOT FOUND OR v_is_active IS NOT TRUE THEN
    RETURN QUERY SELECT false, 'item_not_available'::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 5. Check if user already owns it
  SELECT EXISTS(
    SELECT 1 FROM public.purchases
    WHERE developer_id = p_developer_id
      AND item_id = v_item_id
      AND status = 'completed'
  ) INTO v_owns_item;

  IF v_owns_item THEN
    RETURN QUERY SELECT false, 'already_owned'::TEXT, v_item_id, v_item_name;
    RETURN;
  END IF;

  -- 6. Insert purchase record (unique constraint is checked here)
  BEGIN
    INSERT INTO public.purchases (
      developer_id,
      item_id,
      provider,
      amount_cents,
      currency,
      status,
      provider_tx_id
    ) VALUES (
      p_developer_id,
      v_item_id,
      'redeem_code',
      0,
      'usd',
      'completed',
      UPPER(TRIM(p_code)) || ':' || p_developer_id
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'already_owned'::TEXT, v_item_id, v_item_name;
    RETURN;
  END;

  -- 7. Update used_count with optimistic lock
  UPDATE public.redeem_codes
  SET used_count = used_count + 1
  WHERE id = v_code_id
    AND used_count = v_used_count;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    -- If optimistic lock fails, raise an exception to abort and rollback the purchase insert
    RAISE EXCEPTION 'redeem_optimistic_lock_failed';
  END IF;

  -- 8. Clean up if now fully used
  IF v_max_uses != -1 AND (v_used_count + 1) >= v_max_uses THEN
    DELETE FROM public.redeem_codes WHERE id = v_code_id;
  END IF;

  -- 9. Success return
  RETURN QUERY SELECT true, NULL::TEXT, v_item_id, v_item_name;
END;
$$;
