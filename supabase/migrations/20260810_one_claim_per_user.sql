-- Migration: enforce one claimed building per auth user
-- Issue #1657
--
-- POST /api/claim's already-claimed guard was dead code (loadDeveloper: false
-- always returned developer: null). Fixing the route makes the application
-- reject a second claim, but a DB-level guarantee is the durable fix:
-- one auth user may own at most one claimed building.

-- Clean up any pre-existing duplicate claims (keep the earliest claimed row).
WITH dupes AS (
  SELECT claimed_by
  FROM developers
  WHERE claimed_by IS NOT NULL
  GROUP BY claimed_by
  HAVING COUNT(*) > 1
),
keep AS (
  SELECT DISTINCT ON (claimed_by) id, claimed_by
  FROM developers
  WHERE claimed_by IN (SELECT claimed_by FROM dupes)
  ORDER BY claimed_by, claimed_at ASC NULLS LAST, id ASC
)
UPDATE developers d
SET claimed = false, claimed_by = NULL
FROM dupes
WHERE d.claimed_by = dupes.claimed_by
  AND d.id NOT IN (SELECT id FROM keep);

CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_one_claim_per_user
  ON developers (claimed_by)
  WHERE claimed_by IS NOT NULL;
