-- Temporarily make custom building color free for verification/testing
update items set price_usd_cents = 0, price_brl_cents = 0 where id = 'custom_color';
