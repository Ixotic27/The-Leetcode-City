-- Atomic pending-purchase guard: prevent duplicate pending purchases
-- for the same developer+item, eliminating the TOCTOU race window
-- in the checkout flow.

-- Only one pending purchase per (developer_id, item_id) at a time.
-- Once the webhook processes it (status -> processing/completed),
-- a new pending row can be created.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_purchase
  ON purchases (developer_id, item_id)
  WHERE status = 'pending';
