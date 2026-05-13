-- One-time backfill: for every user whose `user_credit.current_credits`
-- exceeds the sum of their non-expired, non-spent `credit_transaction`
-- ledger rows, insert a BALANCE_RECONCILIATION row that absorbs the delta.
--
-- After this migration runs, allocateCreditLedgerEntries can rely on the
-- ledger being authoritative. The runtime fallback that previously fabricated
-- BALANCE_RECONCILIATION rows on the fly will throw instead.
--
-- The predicate must stay in sync with src/credits/credits-internal.ts
-- (allocateCreditLedgerEntries) and scripts/credit-ledger-legacy-audit.sql.
--
-- Idempotency: re-running this migration is a no-op because the WHERE clause
-- excludes users whose ledger already covers their balance.

INSERT INTO credit_transaction (
  id,
  user_id,
  type,
  amount,
  remaining_amount,
  description,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  uc.user_id,
  'BALANCE_RECONCILIATION',
  (uc.current_credits - COALESCE(l.ledger_total, 0))::integer,
  (uc.current_credits - COALESCE(l.ledger_total, 0))::integer,
  'Reconciled legacy credit balance: ' || (uc.current_credits - COALESCE(l.ledger_total, 0))::text,
  jsonb_build_object('reason', 'one_time_legacy_migration', 'migration', '0026')::text,
  NOW(),
  NOW()
FROM user_credit uc
LEFT JOIN (
  SELECT
    user_id,
    COALESCE(SUM(remaining_amount), 0) AS ledger_total
  FROM credit_transaction
  WHERE type NOT IN ('USAGE', 'EXPIRE')
    AND remaining_amount > 0
    AND (expiration_date IS NULL OR expiration_date > NOW())
  GROUP BY user_id
) l ON l.user_id = uc.user_id
WHERE uc.current_credits > COALESCE(l.ledger_total, 0);
