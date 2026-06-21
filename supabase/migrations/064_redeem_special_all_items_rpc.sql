-- Redeem special "all_items" code inside a single atomic transaction.
-- Prevents the "usage consumed, items only partially granted" bug where
-- a partial failure between usage-insert and purchase-insert permanently
-- blocks the user (unique constraint on special_code_usages).
--
-- Usage:
--   select redeem_special_all_items(42, 123, '{item1,item2,item3}', 5);
--   Returns jsonb: {"success": true} or raises an exception on any failure.

create or replace function redeem_special_all_items(
  p_code_id       bigint,
  p_dev_id        bigint,
  p_item_ids      text[],
  p_expected_used_count int
) returns jsonb
language plpgsql
as $$
declare
  v_usage_id bigint;
  v_updated  int;
  v_tx_id    text;
begin
  -- 1. Insert usage record (unique constraint will catch duplicates)
  insert into special_code_usages (code_id, developer_id)
  values (p_code_id, p_dev_id)
  returning id into v_usage_id;

  -- 2. Insert purchase records for each item
  for i in 1 .. array_length(p_item_ids, 1) loop
    v_tx_id := 'special_code_' || p_code_id || '_' || p_dev_id || '_' || p_item_ids[i];
    insert into purchases (developer_id, item_id, provider, provider_tx_id, amount_cents, currency, status)
    values (p_dev_id, p_item_ids[i], 'free', v_tx_id, 0, 'usd', 'completed')
    on conflict on constraint purchases_provider_tx_id_key do nothing;
  end loop;

  -- 3. Optimistic-lock increment of used_count
  update special_codes
  set used_count = used_count + 1
  where id = p_code_id
    and used_count = p_expected_used_count;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'redeem_special_optimistic_lock_failed'
      using hint = 'used_count changed since read';
  end if;

  return jsonb_build_object('success', true);
end;
$$;
