-- Reprice all items: lower entry barrier, clearer tier structure
-- Tier 1 (Entry  $0.75 / R$3.90): simple structures
-- Tier 2 (Core   $1.00 / R$4.90): effects + identity
-- Tier 3 (Premium$1.50 / R$7.90): top-tier effect
-- Tier 4 (Stack  $2.00 / R$9.90): billboard (multi-buy)

-- Entry tier: $0.75 / R$3.90
update items set price_usd_cents = 75,  price_brl_cents = 390 where id = 'helipad';
update items set price_usd_cents = 75,  price_brl_cents = 390 where id = 'antenna_array';
update items set price_usd_cents = 75,  price_brl_cents = 390 where id = 'rooftop_garden';

-- Core tier: $1.00 / R$4.90
update items set price_usd_cents = 100, price_brl_cents = 490 where id = 'spotlight';
update items set price_usd_cents = 100, price_brl_cents = 490 where id = 'custom_color';
update items set price_usd_cents = 100, price_brl_cents = 490 where id = 'neon_outline';
update items set price_usd_cents = 100, price_brl_cents = 490 where id = 'rooftop_fire';
update items set price_usd_cents = 100, price_brl_cents = 490 where id = 'spire';

-- Premium tier: $1.50 / R$7.90
update items set price_usd_cents = 150, price_brl_cents = 790 where id = 'particle_aura';

-- Stackable tier: $2.00 / R$9.90
update items set price_usd_cents = 200, price_brl_cents = 990 where id = 'billboard';
