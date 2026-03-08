-- 1. Add missing columns (dev & first citizen status)
ALTER TABLE developers ADD COLUMN IF NOT EXISTS is_dev boolean not null default false;
ALTER TABLE developers ADD COLUMN IF NOT EXISTS is_first_citizen boolean not null default false;

-- 2. Add contest_rank column for LeetCode rankings
ALTER TABLE developers ADD COLUMN IF NOT EXISTS contest_rank int;

-- 3. Promote Ishant_27 to Dev and First Citizen
UPDATE developers 
SET is_dev = true, is_first_citizen = true 
WHERE LOWER(github_login) = 'ishant_27';
