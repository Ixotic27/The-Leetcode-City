-- ============================================================
-- 051: Add Loadout and Raid Loadout Items
-- Inserts identity configuration rows so users can equip loadout items.
-- ============================================================

INSERT INTO public.items (id, category, name, description, price_usd_cents, price_brl_cents, is_active)
VALUES 
  ('loadout', 'identity', 'Building Loadout', 'Configuration for equipped building items', 0, 0, false),
  ('raid_loadout', 'identity', 'Raid Loadout', 'Configuration for equipped raid items', 0, 0, false)
ON CONFLICT (id) DO NOTHING;
