-- Migration: Concurrency Race Condition in grantFreeClaimItem API
-- Issue #669
--
-- Adds a partial unique index on purchases(developer_id, item_id) where provider = 'free'
-- to prevent duplicate free item claims and enforce atomicity under concurrency.

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_unique_free
  ON purchases (developer_id, item_id)
  WHERE provider = 'free';
