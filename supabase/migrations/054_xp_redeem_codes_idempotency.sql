-- ============================================================
-- 051: XP Redeem Codes Idempotency
-- Fixes three bugs in POST /api/shop/redeem-xp/route.ts:
--
-- Bug 1 — Per-user double-redemption race:
--   SELECT then INSERT on xp_code_usages with no DB-level guard
--   allows two concurrent requests to both pass the SELECT check
--   and both insert, granting double XP.
--   Fix: UNIQUE(code_id, developer_id) on xp_code_usages makes
--   INSERT ... ON CONFLICT DO NOTHING the atomic guard.
--
-- Bug 2 — Stale-snapshot used_count increment:
--   used_count is read into JS, incremented (+1), written back.
--   Two concurrent users both read used_count = N, both write N+1,
--   silently bypassing max_uses limits.
--   Fix: UPDATE ... SET used_count = used_count + 1 WHERE
--   (max_uses = -1 OR used_count < max_uses) RETURNING used_count
--
-- Bug 3 — XP applied before usage recorded:
--   XP UPDATE fires before xp_code_usages INSERT. On INSERT
--   failure the user has XP with no usage record.
--   Fix: usage INSERT first, XP update only if INSERT won race.
-- ============================================================

-- ─── 1. Create xp_redeem_codes if it doesn't exist ──────────
-- (The table may have been created outside migrations)
CREATE TABLE IF NOT EXISTS public.xp_redeem_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        UNIQUE NOT NULL,
  xp_amount   INT         NOT NULL CHECK (xp_amount > 0),
  max_uses    INT         NOT NULL DEFAULT -1,   -- -1 = unlimited
  used_count  INT         NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);

ALTER TABLE public.xp_redeem_codes ENABLE ROW LEVEL SECURITY;
-- Only service role reads/writes
CREATE POLICY IF NOT EXISTS "service_role_all_xp_redeem_codes"
  ON public.xp_redeem_codes FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. Create xp_code_usages if it doesn't exist ───────────
CREATE TABLE IF NOT EXISTS public.xp_code_usages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       UUID        NOT NULL REFERENCES public.xp_redeem_codes(id) ON DELETE CASCADE,
  developer_id  BIGINT      NOT NULL REFERENCES public.developers(id) ON DELETE CASCADE,
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.xp_code_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all_xp_code_usages"
  ON public.xp_code_usages FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. UNIQUE constraint — the atomic guard ────────────────
-- This is what makes INSERT ... ON CONFLICT DO NOTHING work.
-- Without this, two concurrent inserts both succeed.
ALTER TABLE public.xp_code_usages
  ADD CONSTRAINT IF NOT EXISTS xp_code_usages_code_developer_uniq
  UNIQUE (code_id, developer_id);

CREATE INDEX IF NOT EXISTS idx_xp_code_usages_code_dev
  ON public.xp_code_usages (code_id, developer_id);

-- ─── 4. redeem_xp_code() RPC ────────────────────────────────
-- Performs all three steps atomically:
--   a) INSERT usage ON CONFLICT DO NOTHING (idempotency guard)
--   b) Conditional atomic used_count increment
--   c) Returns result so application applies XP only on success
--
-- Returns:
--   ok           BOOLEAN  — false if already redeemed or exhausted
--   error_code   TEXT     — 'already_redeemed' | 'exhausted' | null
--   xp_amount    INT      — XP to grant (set only when ok = true)
CREATE OR REPLACE FUNCTION public.redeem_xp_code(
  p_code_id       UUID,
  p_developer_id  BIGINT,
  p_xp_amount     INT,
  p_max_uses      INT
)
RETURNS TABLE(
  ok           BOOLEAN,
  error_code   TEXT,
  xp_amount    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted    BOOLEAN := false;
  v_rows_updated INT;
BEGIN
  -- ── Step 1: Atomic usage insert (idempotency CAS) ─────────
  INSERT INTO public.xp_code_usages (code_id, developer_id)
  VALUES (p_code_id, p_developer_id)
  ON CONFLICT (code_id, developer_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    -- This user already redeemed this code
    RETURN QUERY SELECT false, 'already_redeemed'::TEXT, 0;
    RETURN;
  END IF;

  -- ── Step 2: Atomic used_count increment with cap guard ────
  -- Only increments if max_uses = -1 (unlimited) OR
  -- current used_count is still under the limit.
  -- If the cap was hit concurrently, rolls back the usage insert.
  IF p_max_uses != -1 THEN
    UPDATE public.xp_redeem_codes
    SET    used_count = used_count + 1
    WHERE  id         = p_code_id
    AND    used_count < p_max_uses;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      -- Code just became exhausted (concurrent race hit the cap)
      -- Roll back the usage insert so the user can retry if a slot opens
      DELETE FROM public.xp_code_usages
      WHERE  code_id      = p_code_id
      AND    developer_id = p_developer_id;

      RETURN QUERY SELECT false, 'exhausted'::TEXT, 0;
      RETURN;
    END IF;
  ELSE
    -- Unlimited code — just increment without a cap guard
    UPDATE public.xp_redeem_codes
    SET    used_count = used_count + 1
    WHERE  id = p_code_id;
  END IF;

  -- ── Step 3: Both guards passed — grant XP ─────────────────
  RETURN QUERY SELECT true, NULL::TEXT, p_xp_amount;
END;
$$;