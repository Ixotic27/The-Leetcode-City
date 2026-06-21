-- Fix RLS: the existing "Owner reads own purchases" policy only allows the
-- buyer (developer_id) to see a purchase.  Gift recipients (gifted_to) cannot
-- see the gift record, which breaks gift-display in the frontend and leaks
-- privacy expectations.
--
-- Also ensure developer_customizations remains restricted to the owner (no
-- gifted_to column exists on that table, so the existing policy is correct).
--
-- Impact:
--   Before:  developer_id  → can read
--            gifted_to     → CANNOT read
--   After:   developer_id  → can read
--            gifted_to     → CAN read  (NEW)

drop policy if exists "Owner reads own purchases" on purchases;

create policy "Owner reads own purchases" on purchases
  for select using (
    auth.uid() is not null
    and (
      developer_id in (
        select id from developers where claimed_by = auth.uid()
      )
      or gifted_to in (
        select id from developers where claimed_by = auth.uid()
      )
    )
  );
