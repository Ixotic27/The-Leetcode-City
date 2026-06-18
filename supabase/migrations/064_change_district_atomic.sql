CREATE OR REPLACE FUNCTION public.change_district_atomic(
  p_developer_id        BIGINT,
  p_old_district        TEXT,
  p_new_district        TEXT,
  p_is_actual_change    BOOLEAN,
  p_changes_count       INT,
  p_changed_at          TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE public.developers
  SET
    district            = p_new_district,
    district_chosen     = true,
    district_changes_count = CASE WHEN p_is_actual_change
                               THEN p_changes_count + 1
                               ELSE p_changes_count
                            END,
    district_changed_at = CASE WHEN p_is_actual_change
                            THEN COALESCE(p_changed_at, now())
                            ELSE district_changed_at
                         END
  WHERE id = p_developer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Developer not found');
  END IF;

  INSERT INTO public.district_changes (developer_id, from_district, to_district, reason)
  VALUES (p_developer_id, p_old_district, p_new_district, 'user_choice');

  IF p_old_district IS NOT NULL AND p_old_district != p_new_district THEN
    UPDATE public.districts
    SET population = GREATEST(0, population - 1)
    WHERE id = p_old_district;
  END IF;

  UPDATE public.districts
  SET population = population + 1
  WHERE id = p_new_district;

  RETURN jsonb_build_object('ok', true, 'district', p_new_district);
END;
$$;
