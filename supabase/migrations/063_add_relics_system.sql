-- ============================================================
-- LeetCode City — Relics System
-- ============================================================

-- 1. relics table
CREATE TABLE IF NOT EXISTS public.relics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  era TEXT NOT NULL CHECK (era IN ('Lith', 'Meso', 'Neo', 'Axi', 'Requiem')),
  description TEXT, -- How it is achieved
  abilities TEXT,   -- Abilities / Effects
  target_x DOUBLE PRECISION NOT NULL,
  target_y DOUBLE PRECISION NOT NULL,
  target_z DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. developer_relics table (stores which relics each user has unlocked/equipped)
CREATE TABLE IF NOT EXISTS public.developer_relics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id BIGINT NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  relic_id TEXT NOT NULL REFERENCES public.relics(id) ON DELETE CASCADE,
  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (developer_id, relic_id)
);

-- Index to enforce a maximum of 1 equipped relic per developer
CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_equipped_relic 
  ON public.developer_relics(developer_id) 
  WHERE (is_equipped = TRUE);

-- 3. Row Level Security (RLS)
ALTER TABLE public.relics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_relics ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Public read relics" ON public.relics;
CREATE POLICY "Public read relics" ON public.relics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read developer_relics" ON public.developer_relics;
CREATE POLICY "Public read developer_relics" ON public.developer_relics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Developers manage own relics" ON public.developer_relics;
CREATE POLICY "Developers manage own relics" ON public.developer_relics
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Seed 10 original circular relics
INSERT INTO public.relics (id, name, era, description, abilities, target_x, target_y, target_z) VALUES
  ('relic_lith_dawnstone', 'Lith Dawnstone', 'Lith', 'Achieved by maintaining a 7-day coding streak.', 'Transits camera to the Central Spire Plaza.', 0.0, 10.0, 50.0),
  ('relic_lith_harbor_key', 'Lith Harbor Key', 'Lith', 'Achieved by visiting the South Harbor Docks 5 times.', 'Transits camera to the South Harbor Docks.', 120.0, 5.0, 150.0),
  ('relic_meso_core_oscillator', 'Meso Core Oscillator', 'Meso', 'Achieved by completing 5 medium-difficulty problems.', 'Transits camera to the Central Transit Loop.', -80.0, 15.0, -100.0),
  ('relic_meso_steam_turbine', 'Meso Steam Turbine', 'Meso', 'Achieved by contributing to the open-source community.', 'Transits camera to the North Industrial Sector.', 200.0, 8.0, -250.0),
  ('relic_neo_cyber_sigil', 'Neo Cyber-Sigil', 'Neo', 'Achieved by unlocking a legendary profile effect.', 'Transits camera to the Neon Boulevard Crossroads.', -150.0, 20.0, 50.0),
  ('relic_neo_holo_visor', 'Neo Holo-Visor', 'Neo', 'Achieved by submitting 20 correct solutions in the Virtual Arena.', 'Transits camera to the Virtual Arena Grandstand.', 50.0, 30.0, -180.0),
  ('relic_axi_astral_prism', 'Axi Astral Prism', 'Axi', 'Achieved by reaching Level 30 in LeetCode City.', 'Transits camera to the Upper Sky Gardens.', -40.0, 60.0, 120.0),
  ('relic_axi_chronometer', 'Axi Chronometer', 'Axi', 'Achieved by claiming your building and customizing it.', 'Transits camera to the Legendary Spire Observatory.', 0.0, 120.0, 0.0),
  ('relic_requiem_void_core', 'Requiem Void Core', 'Requiem', 'Achieved by defeating a Raid boss in the Battle Zone.', 'Transits camera to the Void Obelisk.', 300.0, 50.0, 300.0),
  ('relic_new_world', 'New World', 'Requiem', 'Achieved by traveling over the horizon via plane.', 'Allows to travel over the horizon via plane.', -300.0, 40.0, -300.0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  era = EXCLUDED.era,
  description = EXCLUDED.description,
  abilities = EXCLUDED.abilities,
  target_x = EXCLUDED.target_x,
  target_y = EXCLUDED.target_y,
  target_z = EXCLUDED.target_z;
