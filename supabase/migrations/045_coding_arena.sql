-- ============================================================
-- 045: Coding Arena
-- Creates tables for the Arena: problems, challenges,
-- submissions, ratings, items, inventory, and active buffs.
-- Enables RLS and seeds the 52 items from the catalog.
-- ============================================================

-- 1. Arena Problems Bank (populated by cron)
CREATE TABLE IF NOT EXISTS public.arena_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,              -- 'codeforces', 'custom'
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,          -- markdown
  difficulty TEXT NOT NULL,           -- 'easy', 'medium', 'hard'
  difficulty_rating INT,              -- numeric (800-3500 for CF)
  tags TEXT[] DEFAULT '{}',           -- ['dp', 'greedy', 'graphs']
  time_limit_ms INT DEFAULT 2000,     -- per-test execution limit
  memory_limit_mb INT DEFAULT 256,
  sample_tests JSONB NOT NULL,        -- [{input, output}]
  hidden_tests JSONB NOT NULL,        -- [{input, output}]
  hints TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  times_solved INT DEFAULT 0,
  times_attempted INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_arena_problems_difficulty ON public.arena_problems (difficulty);
CREATE INDEX IF NOT EXISTS idx_arena_problems_source_id ON public.arena_problems (source, source_id);

-- 2. Daily Challenges
CREATE TABLE IF NOT EXISTS public.arena_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'daily',
  problem_id UUID NOT NULL REFERENCES public.arena_problems(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL,           -- which slot: 'easy', 'medium', 'hard'
  challenge_date DATE NOT NULL,       -- the day this challenge is for
  time_limit_override_ms INT,         -- event-based override
  reward_points INT DEFAULT 0,
  reward_xp INT DEFAULT 0,
  reward_item_pool TEXT[],            -- item rarities that can drop
  event_id UUID,                      -- link to event if applicable
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_challenges_date ON public.arena_challenges (challenge_date);

-- 3. Arena Items Static Catalog
CREATE TABLE IF NOT EXISTS public.arena_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL,           -- 'consumable', 'gear', 'cosmetic', 'legendary', 'material', 'companion'
  rarity TEXT NOT NULL,              -- 'common', 'rare', 'epic', 'legendary'
  effect_type TEXT,                  -- 'xp_boost', 'streak_freeze', 'raid_shield', etc.
  effect_value JSONB,                -- {multiplier: 1.25, duration_hours: 48}
  icon_path TEXT NOT NULL,           -- path to pixel art sprite
  max_stack INT DEFAULT 99,
  is_tradeable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_items_slug ON public.arena_items (slug);

-- 4. User Inventory
CREATE TABLE IF NOT EXISTS public.arena_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.arena_items(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  is_equipped BOOLEAN DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,           -- for timed items
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_arena_inventory_user ON public.arena_inventory (user_id);

-- 5. Active Buffs
CREATE TABLE IF NOT EXISTS public.arena_active_buffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.arena_items(id) ON DELETE SET NULL,
  buff_type TEXT NOT NULL,           -- 'xp_boost', 'point_multiplier', 'raid_shield'
  buff_value FLOAT NOT NULL,         -- 1.25 = 25% boost
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arena_active_buffs_user ON public.arena_active_buffs (user_id);

-- 6. User Submissions
CREATE TABLE IF NOT EXISTS public.arena_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.arena_problems(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES public.arena_challenges(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code TEXT,
  status TEXT NOT NULL,               -- 'accepted', 'wrong_answer', 'tle', 'rte'
  tests_passed INT DEFAULT 0,
  tests_total INT DEFAULT 0,
  execution_time_ms INT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_verified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_arena_submissions_user ON public.arena_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_arena_submissions_problem ON public.arena_submissions (problem_id);

-- 7. Arena Ratings (ELO-like)
CREATE TABLE IF NOT EXISTS public.arena_ratings (
  user_id BIGINT PRIMARY KEY REFERENCES public.developers(id) ON DELETE CASCADE,
  rating INT DEFAULT 1200,
  problems_solved INT DEFAULT 0,
  problems_attempted INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  last_solved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arena_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_active_buffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_ratings ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies
DROP POLICY IF EXISTS "Public read arena_problems" ON public.arena_problems;
CREATE POLICY "Public read arena_problems" ON public.arena_problems
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read arena_challenges" ON public.arena_challenges;
CREATE POLICY "Public read arena_challenges" ON public.arena_challenges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read arena_items" ON public.arena_items;
CREATE POLICY "Public read arena_items" ON public.arena_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can read own inventory" ON public.arena_inventory;
CREATE POLICY "Users can read own inventory" ON public.arena_inventory
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.developers WHERE claimed_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read own active buffs" ON public.arena_active_buffs;
CREATE POLICY "Users can read own active buffs" ON public.arena_active_buffs
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.developers WHERE claimed_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read own submissions" ON public.arena_submissions;
CREATE POLICY "Users can read own submissions" ON public.arena_submissions
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.developers WHERE claimed_by = auth.uid())
  );

DROP POLICY IF EXISTS "Public read arena_ratings" ON public.arena_ratings;
CREATE POLICY "Public read arena_ratings" ON public.arena_ratings
  FOR SELECT USING (true);


-- 8. Seed the 52 items from the catalog
INSERT INTO public.arena_items (name, slug, description, item_type, rarity, effect_type, effect_value, icon_path, max_stack, is_tradeable) VALUES
-- Potions
('Health Elixir', 'health_elixir', 'A bubbling red vial with a heart seal. One sip and your streak lives another day.', 'consumable', 'common', 'streak_freeze', '{"amount": 1}'::jsonb, '/assets/items/health_elixir.png', 99, false),
('Mana Surge', 'mana_surge', 'Swirling cyan energy trapped in angular glass. Your mind accelerates.', 'consumable', 'rare', 'xp_boost', '{"multiplier": 1.5, "solves": 3}'::jsonb, '/assets/items/mana_surge.png', 99, false),
('Speed Tonic', 'speed_tonic', 'Green lightning in a bottle. Time bends, giving you room to think.', 'consumable', 'rare', 'time_bonus', '{"multiplier": 1.3, "duration_hours": 2}'::jsonb, '/assets/items/speed_tonic.png', 99, false),
('Focus Draught', 'focus_draught', 'Golden amber with floating sparkles. The world sharpens into focus.', 'consumable', 'epic', 'xp_boost', '{"multiplier": 1.25, "duration_hours": 24}'::jsonb, '/assets/items/focus_draught.png', 99, false),
('Shadow Brew', 'shadow_brew', 'Purple skull-shaped bottle leaking violet mist. Your building vanishes from enemy radar.', 'consumable', 'rare', 'raid_shield', '{"duration_hours": 6}'::jsonb, '/assets/items/shadow_brew.png', 99, false),
('XP Nectar', 'xp_nectar', 'Rainbow iridescent liquid in a star-shaped crystal. Liquid starlight.', 'consumable', 'epic', 'xp_boost', '{"multiplier": 2.0, "solves": 1}'::jsonb, '/assets/items/xp_nectar.png', 99, false),

-- Orbs
('Orb of Insight', 'orb_of_insight', 'A glass sphere with a swirling galaxy inside. See the shape of the problem before reading a single word.', 'gear', 'epic', 'reveal_category', '{}'::jsonb, '/assets/items/orb_of_insight.png', 1, false),
('Flame Core', 'flame_core', 'A crystalline orb pulsing with molten fire. Embers float upward from its cracked surface. Unleash it on your enemies.', 'consumable', 'rare', 'raid_attack', '{"multiplier": 1.15, "duration_hours": 24}'::jsonb, '/assets/items/flame_core.png', 99, false),
('Frost Shard', 'frost_shard', 'An angular ice crystal radiating frozen energy. Time stops for your enemies.', 'consumable', 'rare', 'reset_raid_cooldown', '{}'::jsonb, '/assets/items/frost_shard.png', 99, false),
('Void Pearl', 'void_pearl', 'A smooth dark sphere pulling void energy inward. Your mistakes are consumed by the void.', 'gear', 'epic', 'absorb_fail', '{"amount": 1}'::jsonb, '/assets/items/void_pearl.png', 1, false),
('Logic Prism', 'logic_prism', 'A geometric prism with flowing green code inside. Refract the problem into its components.', 'gear', 'rare', 'reveal_hidden_tests', '{"amount": 1}'::jsonb, '/assets/items/logic_prism.png', 1, false),
('Soul Gem', 'soul_gem', 'A cut diamond pulsing with warm magenta light. It resonates with your coding heartbeat.', 'gear', 'legendary', 'reward_multiplier', '{"multiplier": 1.2}'::jsonb, '/assets/items/soul_gem.png', 1, false),

-- Weapons
('Syntax Blade', 'syntax_blade', 'A longsword etched with circuit traces. Its blue edge hums with compiled logic.', 'gear', 'rare', 'xp_boost', '{"multiplier": 1.1}'::jsonb, '/assets/items/syntax_blade.png', 1, false),
('Debug Staff', 'debug_staff', 'A wizard''s staff crowned with a scanning green eye. It sees what your code does not.', 'gear', 'epic', 'reveal_hidden_tests', '{"amount": 2}'::jsonb, '/assets/items/debug_staff.png', 1, false),
('Algo Bow', 'algo_bow', 'An elegant bow of intertwined gold and silver. Its string is pure light. Arrows fly true.', 'gear', 'rare', 'raid_attack', '{"multiplier": 1.1}'::jsonb, '/assets/items/algo_bow.png', 1, false),
('Firewall Shield', 'firewall_shield', 'A tech-shield with layered orange-red energy panels. Data streams deflect harmlessly.', 'gear', 'epic', 'raid_shield', '{"multiplier": 0.5, "duration_hours": 48}'::jsonb, '/assets/items/firewall_shield.png', 1, false),
('Runtime Armor', 'runtime_armor', 'A sleek chest plate with glowing cyan circuit traces. Form and function, optimized.', 'gear', 'rare', 'raid_defense', '{"multiplier": 1.05}'::jsonb, '/assets/items/runtime_armor.png', 1, false),
('Recursion Gauntlets', 'recursion_gauntlets', 'Armored gloves with infinity loops on each hand. If at first you don''t succeed... the loop continues.', 'gear', 'epic', 'auto_retry', '{"amount": 1}'::jsonb, '/assets/items/recursion_gauntlets.png', 1, false),

-- Accessories
('Streak Amulet', 'streak_amulet', 'A golden pendant shaped like a flame with an embedded counter. Your streak burns eternal.', 'gear', 'epic', 'streak_protect', '{"amount": 1}'::jsonb, '/assets/items/streak_amulet.png', 1, false),
('Compiler Ring', 'compiler_ring', 'A silver ring with a spinning gear. Your code compiles a fraction faster.', 'gear', 'rare', 'tle_reduction', '{"multiplier": 0.8}'::jsonb, '/assets/items/compiler_ring.png', 1, false),
('Memory Scroll', 'memory_scroll', 'An ancient scroll with flowing green matrix text. Some knowledge is worth preserving.', 'consumable', 'common', 'bookmark', '{}'::jsonb, '/assets/items/memory_scroll.png', 99, false),
('Phoenix Token', 'phoenix_token', 'A golden medallion with a phoenix rising from flame. From the ashes, you code again.', 'consumable', 'epic', 'reset_daily_challenge', '{}'::jsonb, '/assets/items/phoenix_token.png', 99, false),
('Chrono Hourglass', 'chrono_hourglass', 'An ornate hourglass where green sand flows upward. Time itself bends to your will.', 'gear', 'legendary', 'time_bonus', '{"multiplier": 1.5}'::jsonb, '/assets/items/chrono_hourglass.png', 1, false),
('Binary Cape', 'binary_cape', 'A cloak woven from cascading binary code. The bottom edge dissolves into digital particles.', 'gear', 'rare', 'xp_boost', '{"multiplier": 1.05}'::jsonb, '/assets/items/binary_cape.png', 1, false),

-- Legendary
('Vorpal Syntax', 'vorpal_syntax', 'A legendary katana with circuit board etchings. Blue and gold energy crackle along its edge. The code itself bows before its wielder.', 'legendary', 'legendary', 'xp_boost', '{"multiplier": 1.3}'::jsonb, '/assets/items/vorpal_syntax.png', 1, false),
('Crown of Code', 'crown_of_code', 'A royal crown with 5 spires. The central gem projects holographic data streams into the sky. All the city can see your reign.', 'legendary', 'legendary', 'title_crown', '{"title": "Code King/Queen"}'::jsonb, '/assets/items/crown_of_code.png', 1, false),
('Aegis of Abstraction', 'aegis_of_abstraction', 'Full raid immunity 1x per day, triple-layered hex-shield visual on building. Impenetrable.', 'legendary', 'legendary', 'full_raid_immunity', '{"amount_per_day": 1}'::jsonb, '/assets/items/aegis_of_abstraction.png', 1, false),
('Celestial Orb', 'celestial_orb', 'A perfect sphere containing a miniature cosmos. Planets orbit a bright core. The universe in your hands.', 'legendary', 'legendary', 'reward_multiplier', '{"multiplier": 1.25}'::jsonb, '/assets/items/celestial_orb.png', 1, false),

-- Tomes
('Tome of Algorithms', 'tome_of_algorithms', 'A thick, heavy book bound in blue leather. It hums with raw mathematical power.', 'gear', 'rare', 'optimal_approach_path', '{}'::jsonb, '/assets/items/tome_of_algorithms.png', 1, false),
('Script Scroll', 'script_scroll', 'Partially unrolled parchment. Instantly gives you the starting structure for a problem.', 'consumable', 'common', 'boilerplate_skip', '{}'::jsonb, '/assets/items/script_scroll.png', 99, false),
('Grimoire of Bugs', 'grimoire_of_bugs', 'A dark, tattered book wrapped in chains. Send edge cases to your enemies.', 'consumable', 'epic', 'fake_raid', '{}'::jsonb, '/assets/items/grimoire_of_bugs.png', 99, false),
('Ledger of Commits', 'ledger_of_commits', 'Futuristic datapad showing endless code streams. You will never make the same error twice.', 'gear', 'rare', 'past_mistakes_tracker', '{}'::jsonb, '/assets/items/ledger_of_commits.png', 1, false),
('Map of the DOM', 'map_of_the_dom', 'Ancient treasure map that glows. Helps visualize nested graphs and trees in challenges.', 'gear', 'epic', 'tree_visualizer', '{}'::jsonb, '/assets/items/map_of_the_dom.png', 1, false),
('Book of Answers', 'book_of_answers', 'Radiant white book bursting with golden light. The ultimate cheat code, use wisely.', 'consumable', 'legendary', 'instant_solve', '{}'::jsonb, '/assets/items/book_of_answers.png', 99, false),

-- Materials
('Glitched Fragment', 'glitched_fragment', 'A jagged piece of digital static. It hurts to look directly at it.', 'material', 'common', 'crafting_ingredient', '{}'::jsonb, '/assets/items/glitched_fragment.png', 99, false),
('Data Crystal', 'data_crystal', 'Glowing cyan crystal cluster humming with raw binary.', 'material', 'rare', 'crafting_ingredient', '{}'::jsonb, '/assets/items/data_crystal.png', 99, false),
('Null Pointer', 'null_pointer', 'A floating arrow dripping with purple shadows. It points to nowhere.', 'material', 'epic', 'crafting_ingredient', '{}'::jsonb, '/assets/items/null_pointer.png', 99, false),
('Syntax Thread', 'syntax_thread', 'Golden silk that glows in the dark. Incredibly strong.', 'material', 'rare', 'crafting_ingredient', '{}'::jsonb, '/assets/items/syntax_thread.png', 99, false),
('Compile Core', 'compile_core', 'A glowing orange engine part throwing off sparks. It processes data at light speed.', 'material', 'epic', 'crafting_ingredient', '{}'::jsonb, '/assets/items/compile_core.png', 99, false),
('Star Fragment', 'star_fragment', 'A piece of a fallen star, radiating cosmic dust. Extremely rare drop from boss challenges.', 'material', 'legendary', 'crafting_ingredient', '{}'::jsonb, '/assets/items/star_fragment.png', 99, false),

-- Companions
('Byte Slime', 'byte_slime', 'A cute, translucent green slime filled with floating 1s and 0s.', 'companion', 'common', 'xp_boost', '{"multiplier": 1.02}'::jsonb, '/assets/items/byte_slime.png', 1, false),
('Drone Sprite', 'drone_sprite', 'A tiny futuristic robot orb that patrols your building''s perimeter.', 'companion', 'rare', 'raid_defense', '{"multiplier": 1.05}'::jsonb, '/assets/items/drone_sprite.png', 1, false),
('Mini Dragon', 'mini_dragon', 'A small fiery red baby dragon. Don''t let its size fool you.', 'companion', 'epic', 'raid_attack', '{"multiplier": 1.1}'::jsonb, '/assets/items/mini_dragon.png', 1, false),
('Ghost Phantom', 'ghost_phantom', 'A floating ghost with cyan eyes. It spooks the system into saving you.', 'companion', 'rare', 'streak_protection_passive', '{"probability": 0.05}'::jsonb, '/assets/items/ghost_phantom.png', 1, false),
('Cyber Owl', 'cyber_owl', 'A mechanical owl with glowing yellow eyes. Wise in the ways of logic.', 'companion', 'epic', 'extra_hints', '{"amount": 1}'::jsonb, '/assets/items/cyber_owl.png', 1, false),
('Mana Wisp', 'mana_wisp', 'Pure ball of swirling magical energy with starry eyes. Brings immense luck.', 'companion', 'legendary', 'resource_drop_multiplier', '{"multiplier": 1.15}'::jsonb, '/assets/items/mana_wisp.png', 1, false),

-- Rank Badges
('Bronze Coder', 'badge_bronze', 'A simple copper badge. Everyone starts somewhere.', 'cosmetic', 'common', 'title_unlocked', '{"title": "The Apprentice"}'::jsonb, '/assets/items/badge_bronze.png', 1, false),
('Silver Hacker', 'badge_silver', 'A polished silver shield. You know your way around an array.', 'cosmetic', 'rare', 'title_unlocked', '{"title": "The Script Kiddie"}'::jsonb, '/assets/items/badge_silver.png', 1, false),
('Gold Developer', 'badge_gold', 'A shining gold badge with wings. Your code is starting to soar.', 'cosmetic', 'rare', 'title_unlocked', '{"title": "The Builder"}'::jsonb, '/assets/items/badge_gold.png', 1, false),
('Platinum Architect', 'badge_platinum', 'Cyan and platinum badge. You see the matrix now.', 'cosmetic', 'epic', 'title_unlocked', '{"title": "The Architect"}'::jsonb, '/assets/items/badge_platinum.png', 1, false),
('Diamond Grandmaster', 'badge_diamond', 'Crystalline diamond badge reflecting rainbow colors. Pure mastery.', 'cosmetic', 'epic', 'title_unlocked', '{"title": "The Grandmaster"}'::jsonb, '/assets/items/badge_diamond.png', 1, false),
('Legendary Sentinel', 'badge_legendary', 'Glowing gold and purple with a floating crown. You are a god of the Arena.', 'cosmetic', 'legendary', 'title_unlocked', '{"title": "The Sentinel"}'::jsonb, '/assets/items/badge_legendary.png', 1, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  item_type = EXCLUDED.item_type,
  rarity = EXCLUDED.rarity,
  effect_type = EXCLUDED.effect_type,
  effect_value = EXCLUDED.effect_value,
  icon_path = EXCLUDED.icon_path,
  max_stack = EXCLUDED.max_stack,
  is_tradeable = EXCLUDED.is_tradeable;
