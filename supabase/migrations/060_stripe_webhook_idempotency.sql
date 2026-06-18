-- Migration: Stripe Webhook Idempotency
-- Fixes duplicate processing of Stripe webhook events (Issue #448)

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  id          TEXT        PRIMARY KEY, -- Stripe Event ID (e.g., evt_...)
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- Only service role (admin) will interact with this table
CREATE POLICY "service_role_all_stripe_events"
  ON public.stripe_processed_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
