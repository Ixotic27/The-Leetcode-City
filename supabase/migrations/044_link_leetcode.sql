-- Migration 044: Link LeetCode Account
-- Adds lc_username column for explicit LeetCode username linking
-- (separate from github_login which auto-matches GitHub OAuth)

ALTER TABLE developers ADD COLUMN IF NOT EXISTS lc_username text;

-- Index for looking up by LeetCode username
CREATE INDEX IF NOT EXISTS idx_developers_lc_username ON developers (lc_username) WHERE lc_username IS NOT NULL;

-- Allow RLS policy to check lc_username (public read already covers all columns)