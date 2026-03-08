-- Add dedicated columns for LeetCode official rankings
ALTER TABLE developers ADD COLUMN IF NOT EXISTS lc_global_rank int;
ALTER TABLE developers ADD COLUMN IF NOT EXISTS contest_rank int;

-- Copy current rank values to lc_global_rank for existing users (temporary migration)
UPDATE developers SET lc_global_rank = rank WHERE easy_solved IS NOT NULL;
