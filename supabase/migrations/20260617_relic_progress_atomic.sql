-- Migration: Atomic relic progress increment
-- Issue #571
--
-- Both arena/submit and raid/execute tracked relic progress with a
-- read-modify-write at the app layer: SELECT config, mutate in memory,
-- UPSERT back. Two concurrent accepted submissions could both read the
-- same counter value and write back the same incremented value, leaving
-- the counter one step behind. Users could get stuck below an unlock
-- threshold they legitimately crossed.
--
-- increment_relic_progress() replaces this with a single atomic UPDATE
-- using jsonb_set on the config JSONB column. Postgres row-level locking
-- on UPDATE serializes concurrent calls for the same developer, so no
-- two calls can read-then-write the same value.
CREATE OR REPLACE FUNCTION increment_relic_progress(
  p_developer_id BIGINT,
  p_field        TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_value INTEGER;
BEGIN
  -- Allowlist p_field to prevent arbitrary JSON key injection.
  -- This function is called via the service-role client (server-side only),
  -- but defence-in-depth: reject any field not in the known relic counter set.
  IF p_field NOT IN ('arena_solves', 'raid_wins', 'docks_visits') THEN
    RAISE EXCEPTION 'increment_relic_progress: invalid field %', p_field;
  END IF;

  INSERT INTO developer_customizations (developer_id, item_id, config, updated_at)
  VALUES (
    p_developer_id,
    'relic_progress',
    jsonb_build_object(p_field, 1),
    NOW()
  )
  ON CONFLICT (developer_id, item_id) DO UPDATE
    SET config = jsonb_set(
          developer_customizations.config,
          ARRAY[p_field],
          to_jsonb(
            COALESCE((developer_customizations.config ->> p_field)::int, 0) + 1
          )
        ),
        updated_at = NOW()
  RETURNING (config ->> p_field)::int INTO v_new_value;

  RETURN v_new_value;
END;
$$;
