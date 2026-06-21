-- Migration: Atomic heartbeat accumulation
-- Issue #625
--
-- /api/heartbeats accumulated total_heartbeats / active_seconds with a
-- read-modify-write at the app layer: SELECT the current counters, add the
-- batch, UPSERT back. Two concurrent flushes for the same session both read
-- the same base value and the second overwrites the first, losing increments.
--
-- record_heartbeat() folds a (pre-aggregated) batch for one session into a
-- single atomic INSERT ... ON CONFLICT DO UPDATE. Postgres row-level locking
-- on the UPDATE serializes concurrent calls for the same (developer, session),
-- so increments can no longer be lost, and the route no longer needs a SELECT
-- per heartbeat.
CREATE OR REPLACE FUNCTION record_heartbeat(
  p_developer_id   BIGINT,
  p_session_id     TEXT,
  p_heartbeats     INTEGER,
  p_active_seconds INTEGER,
  p_language       TEXT,
  p_project        TEXT,
  p_editor_name    TEXT,
  p_os             TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO developer_sessions (
    developer_id, session_id, status, current_language, current_project,
    last_heartbeat_at, editor_name, os, total_heartbeats, active_seconds
  )
  VALUES (
    p_developer_id, p_session_id, 'active', p_language, p_project,
    NOW(), COALESCE(p_editor_name, 'vscode'), p_os,
    GREATEST(p_heartbeats, 0), GREATEST(p_active_seconds, 0)
  )
  ON CONFLICT (developer_id, session_id) DO UPDATE SET
    status            = 'active',
    current_language  = EXCLUDED.current_language,
    current_project   = EXCLUDED.current_project,
    last_heartbeat_at = NOW(),
    editor_name       = EXCLUDED.editor_name,
    os                = EXCLUDED.os,
    total_heartbeats  = developer_sessions.total_heartbeats + EXCLUDED.total_heartbeats,
    active_seconds    = developer_sessions.active_seconds + EXCLUDED.active_seconds;
END;
$$;
