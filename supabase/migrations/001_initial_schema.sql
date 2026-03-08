-- ============================================================
-- Git City — Initial Schema
-- ============================================================

-- 1. developers — one row per GitHub user
create table if not exists developers (
  id            bigint generated always as identity primary key,
  github_login  text    not null unique,
  github_id     bigint,
  name          text,
  avatar_url    text,
  bio           text,
  contributions int     not null default 0,
  public_repos  int     not null default 0,
  total_stars   int     not null default 0,
  primary_language text,
  top_repos     jsonb   not null default '[]'::jsonb,
  rank          int,
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_developers_rank on developers (rank);
create index if not exists idx_developers_login on developers (github_login);
create index if not exists idx_developers_contributions on developers (contributions desc);
create index if not exists idx_developers_fetched_at on developers (fetched_at);

-- 2. add_requests — rate limiting table
create table if not exists add_requests (
  id          bigint generated always as identity primary key,
  ip_hash     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_add_requests_ip_created on add_requests (ip_hash, created_at);

-- 3. city_stats — singleton for global stats
create table if not exists city_stats (
  id                  int  primary key default 1 check (id = 1),
  total_developers    int  not null default 0,
  total_contributions bigint not null default 0,
  updated_at          timestamptz not null default now()
);

-- seed singleton
insert into city_stats (id) values (1) on conflict do nothing;

-- 4. RLS — public read for developers and city_stats
alter table developers   enable row level security;
alter table city_stats   enable row level security;
alter table add_requests enable row level security;

create policy "Public read developers"
  on developers for select
  using (true);

create policy "Public read city_stats"
  on city_stats for select
  using (true);

-- add_requests: no public access (server-side only via service role)

-- 5. recalculate_ranks() — reorders all devs by contributions DESC
create or replace function recalculate_ranks()
returns void
language plpgsql
security definer
as $$
begin
  with ranked as (
    select id, row_number() over (order by contributions desc, github_login asc) as new_rank
    from developers
  )
  update developers d
  set rank = r.new_rank
  from ranked r
  where d.id = r.id;

  update city_stats
  set total_developers    = (select count(*) from developers),
      total_contributions = (select coalesce(sum(contributions), 0) from developers),
      updated_at          = now()
  where id = 1;
end;
$$;
