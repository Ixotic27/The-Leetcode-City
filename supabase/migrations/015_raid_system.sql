-- ============================================================
-- 015: Raid System
-- Adds raid PvP system with attacks, defense scores, graffiti
-- tags, raid XP/titles, vehicles, boosters, and achievements.
-- ============================================================

-- 1. New columns on developers
ALTER TABLE developers
  ADD COLUMN IF NOT EXISTS raid_xp                      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_week_contributions   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_week_kudos_given     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_week_kudos_received  int NOT NULL DEFAULT 0;

-- 2. raids table
CREATE TABLE IF NOT EXISTS raids (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id       BIGINT      NOT NULL REFERENCES developers(id),
  defender_id       BIGINT      NOT NULL REFERENCES developers(id),
  attack_score      INT         NOT NULL,
  defense_score     INT         NOT NULL,
  success           BOOLEAN     NOT NULL,
  attack_breakdown  JSONB       NOT NULL DEFAULT '{}',
  defense_breakdown JSONB       NOT NULL DEFAULT '{}',
  attacker_vehicle  TEXT        NOT NULL DEFAULT 'airplane',
  attacker_tag_style TEXT       NOT NULL DEFAULT 'default',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT raids_no_self CHECK (attacker_id != defender_id)
);

CREATE INDEX IF NOT EXISTS idx_raids_attacker         ON raids (attacker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raids_defender         ON raids (defender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raids_pair_week        ON raids (attacker_id, defender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raids_success_created  ON raids (success, created_at DESC) WHERE success = true;

ALTER TABLE raids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raids_public_read" ON raids;
CREATE POLICY "raids_public_read" ON raids FOR SELECT USING (true);

-- 3. raid_tags table
CREATE TABLE IF NOT EXISTS raid_tags (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id       UUID        NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  building_id   BIGINT      NOT NULL REFERENCES developers(id),
  attacker_id   BIGINT      NOT NULL REFERENCES developers(id),
  attacker_login TEXT       NOT NULL,
  tag_style     TEXT        NOT NULL DEFAULT 'default',
  active        BOOLEAN     NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only 1 active tag per building
CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_tags_building_active
  ON raid_tags (building_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_raid_tags_expires
  ON raid_tags (expires_at);

ALTER TABLE raid_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raid_tags_public_read" ON raid_tags;
CREATE POLICY "raid_tags_public_read" ON raid_tags FOR SELECT USING (true);

-- 4. Raid achievements
INSERT INTO achievements (id, category, name, description, threshold, tier, reward_type, sort_order)
VALUES
  ('pickpocket',   'raid', 'Pickpocket',   'Earn 100 Raid XP',   100,   'bronze',  'exclusive_badge', 170),
  ('burglar',      'raid', 'Burglar',      'Earn 500 Raid XP',   500,   'silver',  'exclusive_badge', 171),
  ('heist_master', 'raid', 'Heist Master', 'Earn 2000 Raid XP',  2000,  'gold',    'exclusive_badge', 172),
  ('kingpin',      'raid', 'Kingpin',      'Earn 10000 Raid XP', 10000, 'diamond', 'exclusive_badge', 173)
ON CONFLICT (id) DO NOTHING;

-- 5. Raid items (vehicles, tags, consumable boosters)
INSERT INTO items (id, category, name, description, price_usd_cents, price_brl_cents, is_active, zone, metadata)
VALUES
  -- Vehicles (cosmetic only)
  ('raid_helicopter',   'effect',      'Helicopter',    'Raid vehicle: helicopter',   299, 1490, true, NULL, '{"type":"raid_vehicle"}'),
  ('raid_drone',        'effect',      'Stealth Drone', 'Raid vehicle: drone',        199, 990,  true, NULL, '{"type":"raid_vehicle"}'),
  ('raid_rocket',       'effect',      'Rocket',        'Raid vehicle: rocket',       399, 1990, true, NULL, '{"type":"raid_vehicle"}'),
  -- Custom tags (cosmetic)
  ('tag_neon',          'effect',      'Neon Tag',      'Neon-colored raid graffiti',  149, 790,  true, NULL, '{"type":"raid_tag"}'),
  ('tag_fire',          'effect',      'Fire Tag',      'Fire-animated raid graffiti', 199, 990,  true, NULL, '{"type":"raid_tag"}'),
  ('tag_gold',          'effect',      'Gold Tag',      'Golden raid graffiti',        249, 1290, true, NULL, '{"type":"raid_tag"}'),
  -- Consumable attack boosters (1-use each)
  ('raid_boost_small',  'consumable',  'War Paint',     '+5 attack for 1 raid',        99, 490,  true, NULL, '{"type":"raid_boost","bonus":5}'),
  ('raid_boost_medium', 'consumable',  'Battle Armor',  '+10 attack for 1 raid',      179, 890,  true, NULL, '{"type":"raid_boost","bonus":10}'),
  ('raid_boost_large',  'consumable',  'EMP Device',    '+20 attack for 1 raid',      299, 1490, true, NULL, '{"type":"raid_boost","bonus":20}')
ON CONFLICT (id) DO NOTHING;

-- 6. Increment weekly kudos counters RPC (called from kudos route)
CREATE OR REPLACE FUNCTION increment_kudos_week(p_giver_id bigint, p_receiver_id bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE developers SET current_week_kudos_given = current_week_kudos_given + 1
  WHERE id = p_giver_id;
  UPDATE developers SET current_week_kudos_received = current_week_kudos_received + 1
  WHERE id = p_receiver_id;
END;
$$;

-- 7. Weekly stats refresh RPC
CREATE OR REPLACE FUNCTION refresh_weekly_kudos()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  week_start DATE := date_trunc('week', now())::date;
BEGIN
  -- Kudos given this week
  UPDATE developers d SET current_week_kudos_given = COALESCE(sub.cnt, 0)
  FROM (
    SELECT giver_id, COUNT(*) as cnt
    FROM developer_kudos
    WHERE given_date >= week_start
    GROUP BY giver_id
  ) sub
  WHERE d.id = sub.giver_id;

  -- Kudos received this week
  UPDATE developers d SET current_week_kudos_received = COALESCE(sub.cnt, 0)
  FROM (
    SELECT receiver_id, COUNT(*) as cnt
    FROM developer_kudos
    WHERE given_date >= week_start
    GROUP BY receiver_id
  ) sub
  WHERE d.id = sub.receiver_id;

  -- Reset devs with 0 this week
  UPDATE developers SET current_week_kudos_given = 0
  WHERE current_week_kudos_given > 0
  AND id NOT IN (
    SELECT giver_id FROM developer_kudos WHERE given_date >= week_start
  );
  UPDATE developers SET current_week_kudos_received = 0
  WHERE current_week_kudos_received > 0
  AND id NOT IN (
    SELECT receiver_id FROM developer_kudos WHERE given_date >= week_start
  );
END;
$$;
