-- ============================================================
-- Raise achievement thresholds (old values were too easy)
-- ============================================================

-- Item-unlock achievements
-- first_push stays at 1 (free Flag bait to get users into the shop)
update achievements set threshold = 1000  where id = 'committed';    -- was 100
update achievements set threshold = 2500  where id = 'grinder';      -- was 500
update achievements set threshold = 25    where id = 'builder';      -- was 5
update achievements set threshold = 75    where id = 'architect';    -- was 20
update achievements set threshold = 100   where id = 'rising_star';  -- was 10
update achievements set threshold = 10    where id = 'recruiter';    -- was 3

-- Badge-only achievements (keep progression feeling earned)
update achievements set threshold = 5000  where id = 'machine';      -- was 1,000
update achievements set threshold = 15000 where id = 'legend';       -- was 5,000
update achievements set threshold = 30000 where id = 'god_mode';     -- was 10,000
update achievements set threshold = 150   where id = 'factory';      -- was 50
update achievements set threshold = 500   where id = 'popular';      -- was 100
update achievements set threshold = 5000  where id = 'famous';       -- was 1,000
update achievements set threshold = 30    where id = 'influencer';   -- was 10
update achievements set threshold = 100   where id = 'mayor';        -- was 50

-- Also update descriptions to reflect new thresholds
update achievements set description = 'Reach 1,000 contributions'         where id = 'committed';
update achievements set description = 'Reach 2,500 contributions'         where id = 'grinder';
update achievements set description = 'Have 25 public repositories'       where id = 'builder';
update achievements set description = 'Have 75 public repositories'       where id = 'architect';
update achievements set description = 'Collect 100 stars across repos'    where id = 'rising_star';
update achievements set description = 'Refer 10 developers to Git City'  where id = 'recruiter';
update achievements set description = 'Reach 5,000 contributions'         where id = 'machine';
update achievements set description = 'Reach 15,000 contributions'        where id = 'legend';
update achievements set description = 'Reach 30,000 contributions'        where id = 'god_mode';
update achievements set description = 'Have 150 public repositories'      where id = 'factory';
update achievements set description = 'Collect 500 stars across repos'    where id = 'popular';
update achievements set description = 'Collect 5,000 stars across repos'  where id = 'famous';
update achievements set description = 'Refer 30 developers to Git City'  where id = 'influencer';
update achievements set description = 'Refer 100 developers to Git City' where id = 'mayor';
