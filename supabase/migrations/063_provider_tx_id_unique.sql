-- Enforce uniqueness on provider_tx_id so concurrent webhook invocations
-- cannot create duplicate purchase records for the same transaction.

ALTER TABLE purchases ADD CONSTRAINT purchases_provider_tx_id_unique UNIQUE (provider_tx_id);
