-- ============================================================
-- Git City — pg_cron: recalculate ranks every 30 minutes
-- ============================================================
-- Requires pg_cron extension (enabled by default on Supabase)

-- Enable pg_cron if not already
create extension if not exists pg_cron with schema pg_catalog;

-- Schedule rank recalculation every 30 minutes
select cron.schedule(
  'recalculate-ranks',
  '*/30 * * * *',
  'select recalculate_ranks()'
);
