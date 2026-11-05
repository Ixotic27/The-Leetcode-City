-- /api/search uses ilike '%q%', which the btree on github_login can't serve:
-- it seq-scans every developer and hits the statement timeout (57014).
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_developers_login_trgm
  on developers using gin (github_login extensions.gin_trgm_ops);
