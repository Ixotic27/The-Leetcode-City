-- Migration: Atomic raid_xp increment RPC
-- Fixes Issue #404: Concurrency Race Condition causes silent data loss in Raid XP
--
-- Problem: The Node.js route computed new XP values from application-memory reads
-- made before execute_raid() ran. Concurrent XP changes (other raids, missions) would
-- be silently overwritten because the update used a stale value.
--
-- Solution: A simple RPC that performs an atomic SQL increment inside a transaction,
-- using row-level locking so concurrent updates are serialised, not lost.

create or replace function increment_raid_xp(
  p_developer_id integer,
  p_amount       integer
)
returns void
language plpgsql
security definer
as $$
begin
  update developers
  set    raid_xp = coalesce(raid_xp, 0) + p_amount
  where  id = p_developer_id;
end;
$$;

-- Only the service-role key (used by getSupabaseAdmin) may call this function.
-- Authenticated end-users are not allowed to call it directly.
revoke execute on function increment_raid_xp(integer, integer) from anon, authenticated;
grant  execute on function increment_raid_xp(integer, integer) to service_role;
