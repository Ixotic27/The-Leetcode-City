-- ============================================================
-- Cleanup stale arcade_active_players records (stale presence)
-- ============================================================
-- Removes entries where last_heartbeat is older than 1 minute
-- (players who closed tab / lost network / browser sleep)

create or replace function public.cleanup_stale_arcade_players()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.arcade_active_players
  where last_heartbeat < now() - interval '1 minute';
end;
$$;

-- Schedule every minute via pg_cron (enabled by default on Supabase)
select cron.schedule(
  'cleanup-stale-arcade-players',
  '* * * * *',
  'select public.cleanup_stale_arcade_players()'
);
