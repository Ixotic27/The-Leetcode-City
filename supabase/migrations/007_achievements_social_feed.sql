-- ============================================================
-- Git City v2 — Achievements, Social Interactions, Activity Feed
-- ============================================================

-- 1. Extend developers table
alter table developers add column if not exists kudos_count int not null default 0;
alter table developers add column if not exists visit_count int not null default 0;
alter table developers add column if not exists referred_by text;
alter table developers add column if not exists referral_count int not null default 0;

-- 2. Extend purchases table for gifts
alter table purchases add column if not exists gifted_to bigint references developers(id);

-- Drop the old unique index and recreate to allow gifts
-- Old: unique on (developer_id, item_id) where status = 'completed'
-- New: unique on (developer_id, item_id, coalesce(gifted_to, 0)) where status = 'completed'
drop index if exists idx_purchases_unique_completed;
create unique index idx_purchases_unique_completed
  on purchases(developer_id, item_id, coalesce(gifted_to, 0)) where status = 'completed';

-- 3. Achievements catalog (static)
create table if not exists achievements (
  id              text primary key,
  category        text not null,          -- 'commits' | 'repos' | 'stars' | 'social' | 'kudos' | 'gifts_sent' | 'gifts_received'
  name            text not null,
  description     text not null,
  threshold       int not null,
  tier            text not null,          -- 'bronze' | 'silver' | 'gold' | 'diamond'
  reward_type     text not null,          -- 'unlock_item' | 'exclusive_badge'
  reward_item_id  text references items(id),
  sort_order      int not null
);

alter table achievements enable row level security;
drop policy if exists "Public read achievements" on achievements;
create policy "Public read achievements" on achievements for select using (true);

-- 4. Developer achievements (per-dev unlocks)
create table if not exists developer_achievements (
  developer_id    bigint not null references developers(id),
  achievement_id  text not null references achievements(id),
  unlocked_at     timestamptz not null default now(),
  seen            boolean not null default false,
  primary key (developer_id, achievement_id)
);

create index if not exists idx_dev_achievements_dev on developer_achievements(developer_id);

alter table developer_achievements enable row level security;
drop policy if exists "Public read developer_achievements" on developer_achievements;
create policy "Public read developer_achievements" on developer_achievements for select using (true);

-- 5. Developer kudos (daily, one per pair per day)
create table if not exists developer_kudos (
  giver_id      bigint not null references developers(id),
  receiver_id   bigint not null references developers(id),
  given_date    date not null default current_date,
  created_at    timestamptz not null default now(),
  primary key (giver_id, receiver_id, given_date)
);

create index if not exists idx_kudos_giver_date on developer_kudos(giver_id, given_date);
create index if not exists idx_kudos_receiver on developer_kudos(receiver_id);

alter table developer_kudos enable row level security;
-- Public read for kudos (to show "you already gave kudos today")
drop policy if exists "Public read kudos" on developer_kudos;
create policy "Public read kudos" on developer_kudos for select using (true);

-- 6. Building visits (daily, one per visitor per building per day)
create table if not exists building_visits (
  visitor_id    bigint not null references developers(id),
  building_id   bigint not null references developers(id),
  visit_date    date not null default current_date,
  created_at    timestamptz not null default now(),
  primary key (visitor_id, building_id, visit_date)
);

create index if not exists idx_visits_building on building_visits(building_id);
create index if not exists idx_visits_visitor_date on building_visits(visitor_id, visit_date);

alter table building_visits enable row level security;
drop policy if exists "Public read visits" on building_visits;
create policy "Public read visits" on building_visits for select using (true);

-- 7. Activity feed (event log)
create table if not exists activity_feed (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  actor_id    bigint references developers(id),
  target_id   bigint references developers(id),
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_feed_created on activity_feed(created_at desc);
create index if not exists idx_feed_actor on activity_feed(actor_id, created_at desc);

alter table activity_feed enable row level security;
drop policy if exists "Public read feed" on activity_feed;
create policy "Public read feed" on activity_feed for select using (true);

-- 8. SQL functions for atomic counter increments

create or replace function increment_kudos_count(target_dev_id bigint)
returns void
language plpgsql
security definer
as $$
begin
  update developers
  set kudos_count = kudos_count + 1
  where id = target_dev_id;
end;
$$;

create or replace function increment_visit_count(target_dev_id bigint)
returns void
language plpgsql
security definer
as $$
begin
  update developers
  set visit_count = visit_count + 1
  where id = target_dev_id;
end;
$$;

create or replace function increment_referral_count(referrer_dev_id bigint)
returns void
language plpgsql
security definer
as $$
begin
  update developers
  set referral_count = referral_count + 1
  where id = referrer_dev_id;
end;
$$;

-- 9. Seed achievements catalog (22 milestones)
-- Note: grinder uses reward_item_id = null here because neon_trim is created in migration 008.
-- Migration 008 updates grinder's reward_item_id to 'neon_trim' after inserting the item.

-- Commits (contributions)
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('first_push',  'commits', 'First Push',  'Make your first contribution',              1,     'bronze',  'unlock_item',     'flag',            1),
  ('committed',   'commits', 'Committed',   'Reach 100 contributions',                   100,   'bronze',  'unlock_item',     'custom_color',    2),
  ('grinder',     'commits', 'Grinder',     'Reach 500 contributions',                   500,   'silver',  'unlock_item',     null,              3),
  ('machine',     'commits', 'Machine',     'Reach 1,000 contributions',                 1000,  'gold',    'exclusive_badge',  null,              4),
  ('legend',      'commits', 'Legend',      'Reach 5,000 contributions',                 5000,  'diamond', 'exclusive_badge',  null,              5),
  ('god_mode',    'commits', 'God Mode',    'Reach 10,000 contributions',                10000, 'diamond', 'exclusive_badge',  null,              6)
on conflict (id) do nothing;

-- Repos (public_repos)
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('builder',     'repos',   'Builder',     'Have 5 public repositories',                5,     'bronze',  'unlock_item',     'antenna_array',   7),
  ('architect',   'repos',   'Architect',   'Have 20 public repositories',               20,    'silver',  'unlock_item',     'rooftop_garden',  8),
  ('factory',     'repos',   'Factory',     'Have 50 public repositories',               50,    'gold',    'exclusive_badge',  null,              9)
on conflict (id) do nothing;

-- Stars (total_stars)
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('rising_star', 'stars',   'Rising Star', 'Collect 10 stars across repos',             10,    'bronze',  'unlock_item',     'spotlight',       10),
  ('popular',     'stars',   'Popular',     'Collect 100 stars across repos',            100,   'gold',    'exclusive_badge',  null,              11),
  ('famous',      'stars',   'Famous',      'Collect 1,000 stars across repos',          1000,  'diamond', 'exclusive_badge',  null,              12)
on conflict (id) do nothing;

-- Social (referrals)
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('recruiter',   'social',  'Recruiter',   'Refer 3 developers to Git City',            3,     'bronze',  'unlock_item',     'helipad',         13),
  ('influencer',  'social',  'Influencer',  'Refer 10 developers to Git City',           10,    'gold',    'exclusive_badge',  null,              14),
  ('mayor',       'social',  'Mayor',       'Refer 50 developers to Git City',           50,    'diamond', 'exclusive_badge',  null,              15)
on conflict (id) do nothing;

-- Gifts sent
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('generous',       'gifts_sent',     'Generous',       'Send your first gift',          1,     'bronze',  'exclusive_badge',  null,             16),
  ('patron',         'gifts_sent',     'Patron',         'Send 5 gifts',                  5,     'silver',  'exclusive_badge',  null,             17),
  ('philanthropist', 'gifts_sent',     'Philanthropist', 'Send 10 gifts',                 10,    'gold',    'exclusive_badge',  null,             18)
on conflict (id) do nothing;

-- Gifts received
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('gifted',   'gifts_received', 'Gifted',   'Receive your first gift',                   1,     'bronze',  'exclusive_badge',  null,             19),
  ('beloved',  'gifts_received', 'Beloved',  'Receive 5 gifts',                           5,     'silver',  'exclusive_badge',  null,             20),
  ('icon',     'gifts_received', 'Icon',     'Receive 10 gifts',                          10,    'gold',    'exclusive_badge',  null,             21)
on conflict (id) do nothing;

-- Kudos received
insert into achievements (id, category, name, description, threshold, tier, reward_type, reward_item_id, sort_order) values
  ('appreciated', 'kudos',  'Appreciated', 'Receive 50 kudos',                            50,    'bronze',  'exclusive_badge',  null,             22),
  ('admired',     'kudos',  'Admired',     'Receive 500 kudos',                            500,   'silver',  'exclusive_badge',  null,             23),
  ('legendary',   'kudos',  'Legendary',   'Receive 5,000 kudos',                          5000,  'gold',    'exclusive_badge',  null,             24)
on conflict (id) do nothing;
