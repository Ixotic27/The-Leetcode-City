-- ============================================================
-- Git City v2 — Item Catalog Update: Zones + New Items
-- ============================================================

-- 1. Add zone column to items
alter table items add column if not exists zone text;

-- 2. Set zones on existing items
update items set zone = 'crown' where id in ('flag', 'helipad', 'spire');
update items set zone = 'roof'  where id in ('antenna_array', 'rooftop_garden', 'rooftop_fire');
update items set zone = 'aura'  where id in ('neon_outline', 'particle_aura', 'spotlight');
update items set zone = 'faces' where id in ('custom_color', 'billboard');

-- 3. Retire neon_outline and particle_aura (keep purchase data intact)
update items set is_active = false where id in ('neon_outline', 'particle_aura');

-- 4. Insert new items

-- Crown zone
insert into items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata) values
  ('satellite_dish', 'structure', 'Satellite Dish', 'Large dish with iconic silhouette',                          150, 790, 'crown', '{}'),
  ('crown_item',     'structure', 'Crown',          'Pixelated gold crown with strong glow',                      300, 1490, 'crown', '{}')
on conflict (id) do nothing;

-- Roof zone
insert into items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata) values
  ('pool_party',     'structure', 'Pool Party',     'Bright blue pool with pixelated lounge chairs',              200, 990, 'roof', '{}')
on conflict (id) do nothing;

-- Aura zone — neon_trim replaces neon_outline
insert into items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata) values
  ('neon_trim',      'effect',    'Neon Trim',      'Thick neon bars on building edges, pulses gently',           100, 490, 'aura', '{}'),
  ('hologram_ring',  'effect',    'Hologram Ring',   'Translucent ring rotating slowly around building',          200, 990, 'aura', '{}'),
  ('lightning_aura', 'effect',    'Lightning Aura',  'Electric bolts crackling with intermittent flash',          300, 1490, 'aura', '{}')
on conflict (id) do nothing;

-- Faces zone
insert into items (id, category, name, description, price_usd_cents, price_brl_cents, zone, metadata) values
  ('led_banner',     'identity',  'LED Banner',     'Scrolling text marquee on building facade',                  250, 1290, 'faces', '{}')
on conflict (id) do nothing;

-- 5. Update existing item descriptions and prices to match v2 catalog
update items set price_usd_cents = 100, price_brl_cents = 490, zone = 'aura'
  where id = 'spotlight';
update items set price_usd_cents = 100, price_brl_cents = 490, zone = 'faces'
  where id = 'custom_color';
update items set price_usd_cents = 100, price_brl_cents = 490, zone = 'roof'
  where id = 'rooftop_fire';
update items set price_usd_cents = 100, price_brl_cents = 490, zone = 'roof'
  where id = 'rooftop_garden';
update items set price_usd_cents = 75,  price_brl_cents = 390, zone = 'crown'
  where id = 'helipad';
update items set price_usd_cents = 75,  price_brl_cents = 390, zone = 'roof'
  where id = 'antenna_array';
update items set price_usd_cents = 100, price_brl_cents = 490, zone = 'crown'
  where id = 'spire';
update items set price_usd_cents = 200, price_brl_cents = 990, zone = 'faces'
  where id = 'billboard';

-- 6. Update achievement references for neon_trim (replacing neon_outline)
update achievements set reward_item_id = 'neon_trim' where id = 'grinder';
