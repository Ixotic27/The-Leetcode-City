-- ============================================================
-- 047: Add Selected Title Item
-- Inserts a configuration item so users can select their active title.
-- ============================================================

INSERT INTO public.items (id, category, name, description, price_usd_cents, price_brl_cents, is_active)
VALUES ('selected_title', 'identity', 'Selected Title', 'Active profile title configuration', 0, 0, false)
ON CONFLICT (id) DO NOTHING;
