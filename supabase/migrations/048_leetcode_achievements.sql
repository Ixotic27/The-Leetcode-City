-- ─── LeetCode Transition: Achievements Update ───

-- 1. Delete old GitHub achievements that are no longer used (rising_star, popular, famous)
DELETE FROM public.developer_achievements WHERE achievement_id IN ('rising_star', 'popular', 'famous');
DELETE FROM public.achievements WHERE id IN ('rising_star', 'popular', 'famous');

-- 2. Update LeetCode Problems Solved achievements (replaces GitHub commits)
UPDATE public.achievements 
SET name = 'First Blood', 
    description = 'Solve 1 LeetCode problem', 
    category = 'commits', 
    threshold = 1 
WHERE id = 'first_push';

UPDATE public.achievements 
SET name = 'Problem Solver', 
    description = 'Solve 100 LeetCode problems', 
    category = 'commits', 
    threshold = 100 
WHERE id = 'committed';

UPDATE public.achievements 
SET name = 'Grinder', 
    description = 'Solve 500 LeetCode problems', 
    category = 'commits', 
    threshold = 500 
WHERE id = 'grinder';

UPDATE public.achievements 
SET name = 'Algorithmist', 
    description = 'Solve 1,000 LeetCode problems', 
    category = 'commits', 
    threshold = 1000 
WHERE id = 'machine';

UPDATE public.achievements 
SET name = 'Grandmaster', 
    description = 'Solve 2,500 LeetCode problems', 
    category = 'commits', 
    threshold = 2500 
WHERE id = 'legend';

-- 3. Update Difficulty Mastery achievements (replaces GitHub repos/stars)
UPDATE public.achievements 
SET name = 'Easy Breezy', 
    description = 'Solve 100 Easy LeetCode problems', 
    category = 'easy_solved', 
    threshold = 100 
WHERE id = 'builder';

UPDATE public.achievements 
SET name = 'Medium Master', 
    description = 'Solve 250 Medium LeetCode problems', 
    category = 'medium_solved', 
    threshold = 250 
WHERE id = 'architect';

UPDATE public.achievements 
SET name = 'Hardcore', 
    description = 'Solve 100 Hard LeetCode problems', 
    category = 'hard_solved', 
    threshold = 100 
WHERE id = 'factory';

UPDATE public.achievements 
SET name = 'God Mode', 
    description = 'Solve 500 Hard LeetCode problems', 
    category = 'hard_solved', 
    threshold = 500 
WHERE id = 'god_mode';

-- 4. Insert Platform Contributor achievements
INSERT INTO public.achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order)
VALUES
  ('contrib_planner',   'contributors', 'City Planner',    'Merge 1 Pull Request into the platform', 1,  'silver',  'exclusive_badge', NULL, 150),
  ('contrib_architect', 'contributors', 'Architect',       'Merge 10 Pull Requests',                 10, 'gold',    'exclusive_badge', NULL, 151),
  ('contrib_founder',   'contributors', 'Founding Father', 'Core Team Member / Major Feature Contributor', 1, 'diamond', 'exclusive_badge', NULL, 152)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  threshold = EXCLUDED.threshold,
  tier = EXCLUDED.tier,
  reward_type = EXCLUDED.reward_type,
  reward_item_id = EXCLUDED.reward_item_id,
  sort_order = EXCLUDED.sort_order;
