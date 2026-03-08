-- 1. Add dedicated columns for LeetCode official rankings
ALTER TABLE developers ADD COLUMN IF NOT EXISTS lc_global_rank int;
ALTER TABLE developers ADD COLUMN IF NOT EXISTS contest_rank int;

-- 2. Add dev and first citizen flags if missing
ALTER TABLE developers ADD COLUMN IF NOT EXISTS is_dev boolean not null default false;
ALTER TABLE developers ADD COLUMN IF NOT EXISTS is_first_citizen boolean not null default false;

-- 3. Backfill data
UPDATE developers SET lc_global_rank = rank WHERE easy_solved IS NOT NULL AND lc_global_rank IS NULL;

-- 4. Promote Ishant_27
UPDATE developers 
SET is_dev = true, is_first_citizen = true 
WHERE LOWER(github_login) = 'ishant_27';
