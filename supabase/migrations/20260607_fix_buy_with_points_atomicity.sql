CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id BIGINT,
  p_item_id UUID,
  p_price INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Deduct points ONLY IF they have enough
  UPDATE public.developers
  SET points = points - p_price
  WHERE id = p_user_id AND points >= p_price;

  -- 2. Check if the update happened (did they have enough points?)
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 3. Insert purchase record
  INSERT INTO public.purchases (user_id, item_id, price)
  VALUES (p_user_id, p_item_id, p_price);

  RETURN TRUE;
END;
$$;