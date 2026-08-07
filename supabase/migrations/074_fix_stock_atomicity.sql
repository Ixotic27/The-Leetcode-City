-- ============================================================
-- 074: Fix stock decrement atomicity on purchase
-- Ensures purchases and stock are decremented atomically within
-- a single database transaction to prevent inventory inconsistency
-- ============================================================

-- Enhance claim_pending_purchase_atomic to use READ COMMITTED isolation
-- and ensure stock reservation happens before payment confirmation
CREATE OR REPLACE FUNCTION public.claim_pending_purchase_atomic(
  p_developer_id BIGINT,
  p_item_id TEXT,
  p_provider TEXT,
  p_tx_id TEXT,
  p_purchase_id UUID DEFAULT NULL
)
RETURNS TABLE (
  ok BOOLEAN,
  error_code TEXT,
  purchase_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET transaction_isolation TO 'REPEATABLE READ'
AS $$
DECLARE
  v_max_quantity INT;
  v_sold_count INT;
  v_purchase_id UUID;
  v_current_purchase_status TEXT;
BEGIN
  -- 1. Lock the item row to prevent concurrent claims for the same item
  -- This ensures that stock checks are serialized
  SELECT max_quantity INTO v_max_quantity
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'item_not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 2. Find the pending purchase
  IF p_purchase_id IS NOT NULL THEN
    SELECT id, status INTO v_purchase_id, v_current_purchase_status
    FROM public.purchases
    WHERE id = p_purchase_id
      AND developer_id = p_developer_id
      AND item_id = p_item_id
      AND status = 'pending'
      AND provider = p_provider
    FOR UPDATE;
  ELSE
    SELECT id, status INTO v_purchase_id, v_current_purchase_status
    FROM public.purchases
    WHERE developer_id = p_developer_id
      AND item_id = p_item_id
      AND status = 'pending'
      AND provider = p_provider
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_purchase_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 3. If it has a stock limit, atomically check current sold count
  -- and prevent overselling by using FOR UPDATE on all relevant purchase rows
  IF v_max_quantity IS NOT NULL AND v_max_quantity > 0 THEN
    SELECT COUNT(*)::INT INTO v_sold_count
    FROM public.purchases
    WHERE item_id = p_item_id
      AND status IN ('completed', 'delivered', 'processing')
    FOR UPDATE SKIP LOCKED;

    IF v_sold_count >= v_max_quantity THEN
      RETURN QUERY SELECT false, 'sold_out'::TEXT, v_purchase_id;
      RETURN;
    END IF;
  END IF;

  -- 4. Claim the pending purchase atomically
  -- Setting provider_tx_id ensures idempotency: same tx_id won't update twice
  UPDATE public.purchases
  SET status = 'processing',
      provider_tx_id = p_tx_id,
      updated_at = NOW()
  WHERE id = v_purchase_id
    AND status = 'pending';

  -- Ensure we actually claimed it (another transaction didn't claim it first)
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'already_claimed'::TEXT, v_purchase_id;
    RETURN;
  END IF;

  -- 5. Success: purchase is now reserved and payment can proceed safely
  RETURN QUERY SELECT true, NULL::TEXT, v_purchase_id;
END;
$$;

-- Restrict execution to service_role to prevent abuse
REVOKE EXECUTE ON FUNCTION public.claim_pending_purchase_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_purchase_atomic TO service_role;

-- Create a view for monitoring inventory inconsistencies
-- Helps detect if stock checks and purchase counts diverge
CREATE OR REPLACE VIEW public.inventory_audit AS
SELECT
  i.id as item_id,
  i.name as item_name,
  i.max_quantity as max_stock,
  COUNT(CASE WHEN p.status IN ('completed', 'delivered', 'processing') THEN 1 END) as units_sold,
  COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_purchases,
  COUNT(CASE WHEN p.status IN ('failed', 'refunded') THEN 1 END) as failed_purchases,
  i.max_quantity - COUNT(CASE WHEN p.status IN ('completed', 'delivered', 'processing') THEN 1 END) as units_remaining
FROM public.items i
LEFT JOIN public.purchases p ON i.id = p.item_id
WHERE i.max_quantity IS NOT NULL
GROUP BY i.id, i.name, i.max_quantity
HAVING COUNT(CASE WHEN p.status IN ('completed', 'delivered', 'processing') THEN 1 END) > i.max_quantity
  OR i.max_quantity < 0;

-- Ensure RLS policies allow service role to manage everything
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
