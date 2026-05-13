-- Credit ledger / user balance reconciliation audit.
--
-- Purpose: identify users whose `user_credit.current_credits` exceeds the sum
-- of their non-expired, non-spent `credit_transaction.remaining_amount` rows.
-- These are the rows where `allocateCreditLedgerEntries` would have created an
-- ad-hoc BALANCE_RECONCILIATION row at runtime ("reconciled legacy balance"
-- warning in logs).
--
-- The matching predicate mirrors the runtime query in
-- src/credits/credits-internal.ts:81-113. Keep them in sync.
--
-- This query is read-only. To remediate, run migration
-- 0026_backfill_legacy_credit_ledger.sql.

WITH ledger AS (
  SELECT
    user_id,
    COALESCE(SUM(remaining_amount), 0) AS ledger_total
  FROM credit_transaction
  WHERE type NOT IN ('USAGE', 'EXPIRE')
    AND remaining_amount > 0
    AND (expiration_date IS NULL OR expiration_date > NOW())
  GROUP BY user_id
)
SELECT
  uc.user_id,
  uc.current_credits,
  COALESCE(l.ledger_total, 0)                  AS ledger_total,
  uc.current_credits - COALESCE(l.ledger_total, 0) AS delta,
  uc.updated_at                                AS user_credit_updated_at
FROM user_credit uc
LEFT JOIN ledger l ON l.user_id = uc.user_id
WHERE uc.current_credits > COALESCE(l.ledger_total, 0)
ORDER BY delta DESC;

-- Aggregate summary: how many users, total delta to backfill.
WITH ledger AS (
  SELECT
    user_id,
    COALESCE(SUM(remaining_amount), 0) AS ledger_total
  FROM credit_transaction
  WHERE type NOT IN ('USAGE', 'EXPIRE')
    AND remaining_amount > 0
    AND (expiration_date IS NULL OR expiration_date > NOW())
  GROUP BY user_id
)
SELECT
  COUNT(*) AS affected_users,
  SUM(uc.current_credits - COALESCE(l.ledger_total, 0)) AS total_delta
FROM user_credit uc
LEFT JOIN ledger l ON l.user_id = uc.user_id
WHERE uc.current_credits > COALESCE(l.ledger_total, 0);
