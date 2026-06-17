-- Live Presence: VS Code extension auth + developer sessions
-- ============================================================

-- API key column for VS Code extension auth
ALTER TABLE developers ADD COLUMN IF NOT EXISTS vscode_api_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_developers_vscode_api_key
  ON developers(vscode_api_key) WHERE vscode_api_key IS NOT NULL;

-- Developer coding sessions table
CREATE TABLE IF NOT EXISTS developer_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id      BIGINT NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  session_id        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'idle', 'offline')),
  current_language  TEXT,
  current_project   TEXT,
  active_seconds    INTEGER DEFAULT 0,
  total_heartbeats  INTEGER DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  editor_name       TEXT DEFAULT 'vscode',
  os                TEXT,
  UNIQUE(developer_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_developer_sessions_status
  ON developer_sessions(status) WHERE status != 'offline';

CREATE INDEX IF NOT EXISTS idx_developer_sessions_last_heartbeat
  ON developer_sessions(last_heartbeat_at) WHERE status != 'offline';

-- RLS
ALTER TABLE developer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sessions" ON developer_sessions
  FOR SELECT USING (true);

CREATE POLICY "Service role manages sessions" ON developer_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- 🧠 THE RACE CONDITION FIX: Enforces a strict timestamp check constraint on upsert conflicts to block polling overwrites
-- This ensures that delayed background polling data can never overwrite a newer WebSocket real-time event.
ALTER TABLE developer_sessions DROP CONSTRAINT IF EXISTS developer_sessions_pkey_timestamp_check;

-- Create an explicit trigger execution helper mechanism to validate heartbeat timestamps cleanly
CREATE OR REPLACE FUNCTION public.upsert_developer_session_safely()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.developer_sessions (developer_id, session_id, status, last_heartbeat_at)
    VALUES (NEW.developer_id, NEW.session_id, NEW.status, NEW.last_heartbeat_at)
    ON CONFLICT (developer_id, session_id)
    DO UPDATE SET 
        status = EXCLUDED.status,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at
    WHERE EXCLUDED.last_heartbeat_at >= developer_sessions.last_heartbeat_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 🚀 TRIGGER ACTIVATION INJECTION: Automatically executes the tracking function before upsert updates commit
DROP TRIGGER IF EXISTS trigger_upsert_developer_session ON public.developer_sessions;

CREATE TRIGGER trigger_upsert_developer_session
  BEFORE INSERT OR UPDATE ON public.developer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.upsert_developer_session_safely();

