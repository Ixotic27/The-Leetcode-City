-- Migration: checkin side-effect idempotency guards
-- Issue #259

-- 1. XP grant log: prevents duplicate grant_xp calls for the same dev on the same day
CREATE TABLE IF NOT EXISTS checkin_xp_log (
  id            BIGSERIAL PRIMARY KEY,
  developer_id  BIGINT      NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  granted_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (developer_id, granted_date)
);

CREATE INDEX IF NOT EXISTS checkin_xp_log_dev_date
  ON checkin_xp_log (developer_id, granted_date);

-- 2. Activity feed deduplication: add unique constraint on (actor_id, event_type, event_date)
--    Only adds the constraint if it doesn't already exist (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_feed_actor_event_date_key'
  ) THEN
    ALTER TABLE activity_feed
      ADD COLUMN IF NOT EXISTS event_date DATE NOT NULL DEFAULT CURRENT_DATE,
      ADD CONSTRAINT activity_feed_actor_event_date_key
        UNIQUE (actor_id, event_type, event_date);
  END IF;
END $$;

-- 3. Streak freeze log deduplication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'streak_freeze_log_dev_action_date_key'
  ) THEN
    ALTER TABLE streak_freeze_log
      ADD COLUMN IF NOT EXISTS granted_date DATE NOT NULL DEFAULT CURRENT_DATE,
      ADD CONSTRAINT streak_freeze_log_dev_action_date_key
        UNIQUE (developer_id, action, granted_date);
  END IF;
END $$;