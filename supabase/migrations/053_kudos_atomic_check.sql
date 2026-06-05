CREATE OR REPLACE FUNCTION insert_kudos_atomic(
  p_giver_id bigint,
  p_receiver_id bigint,
  p_given_date date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(p_giver_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please retry');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM developer_kudos
  WHERE giver_id = p_giver_id AND given_date = p_given_date;

  IF v_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily kudos limit reached (5/day)');
  END IF;

  INSERT INTO developer_kudos (giver_id, receiver_id, given_date)
  VALUES (p_giver_id, p_receiver_id, p_given_date);

  RETURN jsonb_build_object('success', true, 'error', null);
END;
$$;