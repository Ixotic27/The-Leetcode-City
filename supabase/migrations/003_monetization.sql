-- Items catalog
create table items (
  id              text primary key,
  category        text not null,           -- 'effect' | 'structure' | 'identity'
  name            text not null,
  description     text,
  price_usd_cents int not null,
  price_brl_cents int not null,
  is_active       boolean default true,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

-- Purchases (one-time, permanent)
create table purchases (
  id              uuid primary key default gen_random_uuid(),
  developer_id    bigint not null references developers(id),
  item_id         text not null references items(id),
  provider        text not null,           -- 'stripe' | 'abacatepay'
  provider_tx_id  text unique,
  amount_cents    int not null,
  currency        text not null,           -- 'usd' | 'brl'
  status          text not null default 'pending',
  created_at      timestamptz default now()
);

create index idx_purchases_dev on purchases(developer_id, status);
create index idx_purchases_provider on purchases(provider_tx_id);
-- Prevent duplicate completed purchases for same item
create unique index idx_purchases_unique_completed
  on purchases(developer_id, item_id) where status = 'completed';

-- Developer customizations (config per item, e.g. color choice)
create table developer_customizations (
  id            uuid primary key default gen_random_uuid(),
  developer_id  bigint not null references developers(id),
  item_id       text not null references items(id),
  config        jsonb not null default '{}',
  updated_at    timestamptz default now(),
  unique (developer_id, item_id)
);

-- RLS
alter table items enable row level security;
alter table purchases enable row level security;
alter table developer_customizations enable row level security;

create policy "Public read items" on items for select using (true);
create policy "Public read purchases" on purchases for select using (true);
create policy "Public read customizations" on developer_customizations for select using (true);

-- Seed: item catalog
insert into items (id, category, name, description, price_usd_cents, price_brl_cents, metadata) values
  ('neon_outline',    'effect',    'Neon Outline',    'Glowing outline on building edges',         200, 990, '{}'),
  ('particle_aura',   'effect',    'Particle Aura',   'Floating particles around the building',    300, 1490, '{}'),
  ('spotlight',       'effect',    'Spotlight',        'Spotlight beam pointing to the sky',        150, 790, '{}'),
  ('rooftop_fire',    'effect',    'Rooftop Fire',    'Stylized flames on the rooftop',            200, 990, '{}'),
  ('helipad',         'structure', 'Helipad',         'Helicopter landing pad on top',             100, 490, '{}'),
  ('antenna_array',   'structure', 'Antenna Array',   'Multiple antennas on the rooftop',          100, 490, '{}'),
  ('rooftop_garden',  'structure', 'Rooftop Garden',  'Green rooftop with trees',                  150, 790, '{}'),
  ('spire',           'structure', 'Spire',           'Empire State-style spire on top',           200, 990, '{}'),
  ('custom_color',    'identity',  'Custom Color',    'Choose your building color',                150, 790, '{"default_color": "#c8e64a"}'),
  ('billboard',       'identity',  'Billboard',       'Logo or image on the building side',        300, 1490, '{}'),
  ('flag',            'identity',  'Flag',            'Custom flag on the rooftop',                100, 490, '{}');
