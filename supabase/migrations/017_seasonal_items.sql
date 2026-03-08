-- A11: Seasonal/limited items system
-- Adds scarcity columns to items table for FOMO mechanics

-- Temporal scarcity: item available until this date (NULL = always available)
alter table items add column if not exists available_until timestamptz default null;

-- Quantity scarcity: max copies that can be sold (NULL = unlimited)
alter table items add column if not exists max_quantity int default null;

-- Exclusive flag: item will never return after expiring (collector's item)
alter table items add column if not exists is_exclusive boolean default false;

-- Computed: current purchase count per item (for remaining calculation)
-- We already have the purchases table, so remaining = max_quantity - count(purchases where item_id = X)

-- Index for quick availability checks
create index if not exists idx_items_available_until on items (available_until) where available_until is not null;
