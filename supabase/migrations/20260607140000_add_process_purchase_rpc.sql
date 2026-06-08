CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id BIGINT,
  p_item_id UUID,
  p_price INT,
  p_status TEXT DEFAULT 'completed' -- Allow dynamic status
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_points INT;
BEGIN
  -- Deduct points
  UPDATE public.developers
  SET points = points - p_price
  WHERE id = p_user_id AND points >= p_price
  RETURNING points INTO v_new_points;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Insert purchase record with dynamic status
  INSERT INTO public.purchases (developer_id, item_id, provider, amount_cents, currency, status)
  VALUES (p_user_id, p_item_id, 'points', 0, 'usd', p_status);

  RETURN v_new_points;
END;
$$;