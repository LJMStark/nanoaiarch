// Shared credit helpers used by both the main credits.ts module and the
// extracted credits-hold.ts. Lives in its own file so credits-hold.ts can
// import these without creating a circular dep with credits.ts.

import { creditTransaction, userCredit } from '@/db/schema';
import { logger } from '@/lib/logger';
import { and, asc, eq, gt, gte, isNull, not, or, sql } from 'drizzle-orm';
import { CREDIT_TRANSACTION_TYPE } from './types';

/**
 * One slice of a credit hold against an existing remaining-amount transaction.
 * The ledger entry's `remainingAmount` is decremented by `amount` and the
 * mapping is persisted on the hold row's metadata so releaseHold can restore
 * the exact slices.
 */
export type HoldAllocation = {
  transactionId: string;
  amount: number;
};

/**
 * Marker metadata for admin-only audit transactions. Admin users no longer
 * bypass the credit pipeline silently — instead we persist a transaction with
 * this flag and skip the balance/ledger mutations. confirmHold/releaseHold
 * detect the marker and treat the hold as a no-op.
 */
export function serializeAdminBypassMetadata(): string {
  return JSON.stringify({ adminBypass: true });
}

export async function reserveUserCreditBalance({
  tx,
  userId,
  amount,
  now,
}: {
  tx: any;
  userId: string;
  amount: number;
  now: Date;
}): Promise<void> {
  const updatedRows = await tx
    .update(userCredit)
    .set({
      currentCredits: sql`${userCredit.currentCredits} - ${amount}`,
      updatedAt: now,
    })
    .where(
      and(eq(userCredit.userId, userId), gte(userCredit.currentCredits, amount))
    )
    .returning({ id: userCredit.id });

  if (updatedRows.length === 0) {
    throw new Error('Insufficient credits');
  }
}

export async function allocateCreditLedgerEntries({
  tx,
  userId,
  amount,
  now,
}: {
  tx: any;
  userId: string;
  amount: number;
  now: Date;
}): Promise<HoldAllocation[]> {
  const transactions = await tx
    .select({
      id: creditTransaction.id,
      remainingAmount: creditTransaction.remainingAmount,
    })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)),
        not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.EXPIRE)),
        gt(creditTransaction.remainingAmount, 0),
        or(
          isNull(creditTransaction.expirationDate),
          gt(creditTransaction.expirationDate, now)
        )
      )
    )
    .orderBy(
      sql`${creditTransaction.expirationDate} asc nulls last`,
      asc(creditTransaction.createdAt)
    );

  let remainingToDeduct = amount;
  const allocations: HoldAllocation[] = [];

  for (const transaction of transactions) {
    if (remainingToDeduct <= 0) {
      break;
    }

    const remainingAmount = transaction.remainingAmount || 0;
    if (remainingAmount <= 0) {
      continue;
    }

    const deductFromThis = Math.min(remainingAmount, remainingToDeduct);
    const updatedRows = await tx
      .update(creditTransaction)
      .set({
        remainingAmount: sql`${creditTransaction.remainingAmount} - ${deductFromThis}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditTransaction.id, transaction.id),
          gte(creditTransaction.remainingAmount, deductFromThis)
        )
      )
      .returning({ id: creditTransaction.id });

    if (updatedRows.length === 0) {
      throw new Error('Credit ledger is inconsistent');
    }

    allocations.push({
      transactionId: transaction.id,
      amount: deductFromThis,
    });
    remainingToDeduct -= deductFromThis;
  }

  if (remainingToDeduct > 0) {
    // Historically we fabricated a BALANCE_RECONCILIATION row here to absorb
    // the difference between user_credit.current_credits and the ledger sum.
    // That path silently papered over data inconsistency.
    //
    // Migration 0026_backfill_legacy_credit_ledger backfilled every existing
    // pre-ledger user, so this branch should now be unreachable. If it fires,
    // a credit accrual path created balance without writing a ledger row —
    // that's the bug to investigate, not patch over.
    logger.credits.error(
      'allocateCreditLedgerEntries: credit ledger inconsistent with user balance',
      {
        userId,
        amount,
        remainingToDeduct,
        availableTransactions: transactions.length,
      }
    );
    throw new Error(
      `Credit ledger is inconsistent: balance and ledger out of sync for user ${userId}`
    );
  }

  return allocations;
}
