CREATE OR REPLACE FUNCTION public.process_purchase(
    p_user_id BIGINT,
    p_item_id TEXT,
    p_price INTEGER,
    p_status TEXT DEFAULT 'completed'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_points INTEGER;
BEGIN
    -- Atomically deduct points only if the user has enough balance
    UPDATE public.developers
    SET points = points - p_price
    WHERE id = p_user_id
      AND points >= p_price
    RETURNING points INTO v_new_points;

    -- Purchase failed (insufficient points or user not found)
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Record the purchase
    INSERT INTO public.purchases (
        developer_id,
        item_id,
        provider,
        amount_cents,
        currency,
        status
    )
    VALUES (
        p_user_id,
        p_item_id,
        'points',
        0,
        'usd',
        p_status
    );

    RETURN v_new_points;

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;