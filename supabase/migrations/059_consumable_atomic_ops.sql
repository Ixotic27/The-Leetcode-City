-- 059: Atomic consumable grants and consumption
-- Prevents race conditions in quantity updates for battle consumables.

-- 1. grant_consumable RPC
CREATE OR REPLACE FUNCTION public.grant_consumable(p_developer_id BIGINT, p_item_id TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.developer_consumables (developer_id, item_id, quantity, updated_at)
  VALUES (p_developer_id, p_item_id, 1, now())
  ON CONFLICT (developer_id, item_id)
  DO UPDATE SET 
    quantity = developer_consumables.quantity + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. consume_consumable RPC
-- Handles quantity decrement, weekly use tracking, and reset logic atomically.
CREATE OR REPLACE FUNCTION public.consume_consumable(p_developer_id BIGINT, p_item_id TEXT, p_week_start DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_inv_id UUID;
  v_quantity INT;
  v_weekly_uses INT;
  v_last_reset_week DATE;
BEGIN
  SELECT id, quantity, weekly_uses, last_reset_week 
  INTO v_inv_id, v_quantity, v_weekly_uses, v_last_reset_week
  FROM public.developer_consumables
  WHERE developer_id = p_developer_id AND item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Reset weekly uses if it's a new week
  IF v_last_reset_week != p_week_start THEN
    v_weekly_uses := 0;
    v_last_reset_week := p_week_start;
  END IF;

  -- Enforce the 3-uses-per-week limit and ensure quantity > 0
  IF v_weekly_uses >= 3 OR v_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.developer_consumables
  SET 
    quantity = v_quantity - 1,
    weekly_uses = v_weekly_uses + 1,
    last_reset_week = v_last_reset_week,
    updated_at = now()
  WHERE id = v_inv_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
