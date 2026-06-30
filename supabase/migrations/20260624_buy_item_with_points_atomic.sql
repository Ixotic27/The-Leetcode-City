-- Create atomic buy-with-points RPC function to prevent race conditions and partial failures
CREATE OR REPLACE FUNCTION buy_item_with_points(
  p_user_id UUID,
  p_item_id UUID,
  p_cost INT
) RETURNS jsonb AS $$
DECLARE
  v_purchase_id UUID;
  v_result jsonb;
BEGIN
  -- Step 1: Deduct points atomically (check + deduct in single operation)
  UPDATE users 
  SET points = points - p_cost
  WHERE id = p_user_id AND points >= p_cost;

  IF NOT FOUND THEN
    -- Insufficient points - return error
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'code', 'INSUFFICIENT_POINTS');
  END IF;

  -- Step 2: Record purchase
  INSERT INTO purchases (user_id, item_id, paid_points, created_at)
  VALUES (p_user_id, p_item_id, p_cost, NOW())
  RETURNING id INTO v_purchase_id;

  -- Step 3: Grant item to user inventory (on conflict do nothing - user may already have item)
  INSERT INTO user_items (user_id, item_id, created_at)
  VALUES (p_user_id, p_item_id, NOW())
  ON CONFLICT (user_id, item_id) DO NOTHING;

  -- Return success with purchase ID
  v_result := jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'item_id', p_item_id,
    'points_deducted', p_cost
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Any error rolls back the entire transaction
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', 'TRANSACTION_FAILED');
END;
$$ LANGUAGE plpgsql;
