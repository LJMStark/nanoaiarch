// Credit hold lifecycle (reserve → confirm/release) extracted from
// credits.ts so neither file exceeds the 800-line cap. Public hold APIs
// are re-exported from credits.ts to preserve every existing import.

import { randomUUID } from 'crypto';
import { getDb } from '@/db';
import { creditTransaction, userCredit } from '@/db/schema';
import { isAdminUser } from '@/lib/admin';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { and, desc, eq, gt, isNull, like, or, sql } from 'drizzle-orm';
import {
  type HoldAllocation,
  allocateCreditLedgerEntries,
  reserveUserCreditBalance,
  serializeAdminBypassMetadata,
} from './credits-internal';
import {
  CREDIT_TRANSACTION_TYPE,
  type CreditHoldResult,
  HOLD_STATUS,
} from './types';

type RestoredHoldAllocations = {
  restoredAmount: number;
  expiredAmount: number;
};

function serializeHoldMetadata(allocations: HoldAllocation[]): string {
  return JSON.stringify({ allocations });
}

function isAdminBypassMetadata(metadata: string | null | undefined): boolean {
  if (!metadata) return false;
  try {
    const parsed = JSON.parse(metadata) as { adminBypass?: unknown };
    return parsed.adminBypass === true;
  } catch {
    return false;
  }
}

function parseHoldAllocations(metadata?: string | null): HoldAllocation[] {
  if (!metadata) {
    return [];
  }

  try {
    const parsed = JSON.parse(metadata) as {
      allocations?: Array<{ transactionId?: unknown; amount?: unknown }>;
    };

    if (!Array.isArray(parsed.allocations)) {
      return [];
    }

    return parsed.allocations.flatMap((allocation) => {
      if (
        typeof allocation.transactionId !== 'string' ||
        typeof allocation.amount !== 'number' ||
        !Number.isFinite(allocation.amount) ||
        allocation.amount <= 0
      ) {
        return [];
      }

      return [
        {
          transactionId: allocation.transactionId,
          amount: allocation.amount,
        },
      ];
    });
  } catch (error) {
    logger.credits.error('Failed to parse hold metadata', error);
    return [];
  }
}

async function restoreCreditLedgerAllocations({
  tx,
  allocations,
  now,
}: {
  tx: any;
  allocations: HoldAllocation[];
  now: Date;
}): Promise<RestoredHoldAllocations> {
  let restoredAmount = 0;
  let expiredAmount = 0;

  for (const allocation of allocations) {
    const updatedRows = await tx
      .update(creditTransaction)
      .set({
        remainingAmount: sql`${creditTransaction.remainingAmount} + ${allocation.amount}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(creditTransaction.id, allocation.transactionId),
          isNull(creditTransaction.expirationDateProcessedAt),
          or(
            isNull(creditTransaction.expirationDate),
            gt(creditTransaction.expirationDate, now)
          )
        )
      )
      .returning({ id: creditTransaction.id });

    if (updatedRows.length > 0) {
      restoredAmount += allocation.amount;
      continue;
    }

    expiredAmount += allocation.amount;
  }

  return { restoredAmount, expiredAmount };
}

async function recordExpiredHeldCredits({
  tx,
  userId,
  amount,
  holdId,
  now,
}: {
  tx: any;
  userId: string;
  amount: number;
  holdId: string;
  now: Date;
}): Promise<void> {
  if (amount <= 0) {
    return;
  }

  await tx.insert(creditTransaction).values({
    id: randomUUID(),
    userId,
    type: CREDIT_TRANSACTION_TYPE.EXPIRE,
    amount: -amount,
    remainingAmount: null,
    description: `Expire held credits: ${amount}`,
    metadata: JSON.stringify({ holdId }),
    createdAt: now,
    updatedAt: now,
  });
}

export async function holdCredits({
  userId,
  amount,
  idempotencyKey,
  description,
}: {
  userId: string;
  amount: number;
  idempotencyKey: string;
  description: string;
}): Promise<CreditHoldResult> {
  if (!userId || !idempotencyKey || !description) {
    throw new Error('holdCredits: invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('holdCredits: invalid amount');
  }

  const db = await getDb();

  // Admin users: persist a PENDING hold tagged with adminBypass metadata so
  // confirmHold/releaseHold can find it (and become no-ops). No balance or
  // ledger mutation occurs; the record exists purely for audit.
  if (await isAdminUser(userId)) {
    const holdId = randomUUID();
    const now = new Date();
    await db.insert(creditTransaction).values({
      id: holdId,
      userId,
      type: CREDIT_TRANSACTION_TYPE.HOLD,
      amount: -amount,
      remainingAmount: null,
      description,
      metadata: serializeAdminBypassMetadata(),
      holdStatus: HOLD_STATUS.PENDING,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    logger.credits.info('holdCredits: admin audit-only', {
      holdId,
      userId,
      amount,
    });
    await recordAudit({
      userId,
      actorId: userId,
      action: AUDIT_ACTIONS.CREDIT_ADMIN_BYPASS,
      entityType: 'credit_transaction',
      entityId: holdId,
      metadata: { kind: 'hold', amount, description, idempotencyKey },
    });
    return { holdId, userId, amount };
  }

  // Fast path: idempotency key already exists (non-racing duplicate request).
  // Avoids the overhead of reserving balance + allocating ledger only to roll back.
  const existing = await db
    .select({
      id: creditTransaction.id,
      holdStatus: creditTransaction.holdStatus,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.holdStatus === HOLD_STATUS.PENDING) {
      logger.credits.debug('holdCredits: returning existing pending hold', {
        holdId: record.id,
        idempotencyKey,
      });
      return { holdId: record.id, userId, amount };
    }
    throw new Error(
      `holdCredits: idempotency key already used (status=${record.holdStatus})`
    );
  }

  const holdId = randomUUID();
  // Concurrency guard: if two callers reach here with the same idempotencyKey,
  // only one's INSERT will succeed (unique constraint on idempotency_key).
  // The loser sets this flag, throws to rollback its reserve+allocate, then
  // re-fetches the winner outside the transaction.
  let raceLost = false;

  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      await reserveUserCreditBalance({ tx, userId, amount, now });
      const allocations = await allocateCreditLedgerEntries({
        tx,
        userId,
        amount,
        now,
      });

      const inserted = await tx
        .insert(creditTransaction)
        .values({
          id: holdId,
          userId,
          type: CREDIT_TRANSACTION_TYPE.HOLD,
          amount: -amount,
          remainingAmount: null,
          description,
          metadata: serializeHoldMetadata(allocations),
          holdStatus: HOLD_STATUS.PENDING,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: creditTransaction.idempotencyKey })
        .returning({ id: creditTransaction.id });

      if (inserted.length === 0) {
        raceLost = true;
        // Throw to rollback the transaction (undo reserve + allocate).
        throw new Error('__HOLD_IDEMPOTENCY_RACE_LOST__');
      }
    });
  } catch (err) {
    if (!raceLost) {
      throw err;
    }
    // raceLost: transaction rolled back; fetch winner's hold and return it.
  }

  if (raceLost) {
    const winner = await db
      .select({
        id: creditTransaction.id,
        holdStatus: creditTransaction.holdStatus,
      })
      .from(creditTransaction)
      .where(eq(creditTransaction.idempotencyKey, idempotencyKey))
      .limit(1);

    if (winner.length === 0) {
      throw new Error(
        'holdCredits: idempotency race lost but winning record not found'
      );
    }

    const record = winner[0];
    if (record.holdStatus === HOLD_STATUS.PENDING) {
      logger.credits.info(
        'holdCredits: lost idempotency race, returning winner hold',
        {
          holdId: record.id,
          idempotencyKey,
        }
      );
      return { holdId: record.id, userId, amount };
    }

    throw new Error(
      `holdCredits: idempotency key already used (status=${record.holdStatus})`
    );
  }

  logger.credits.info('holdCredits: hold created', {
    holdId,
    userId,
    amount,
    idempotencyKey,
  });
  return { holdId, userId, amount };
}

/**
 * Find an existing hold by its idempotency key.
 *
 * Filters by userId for defense-in-depth: a stale or malicious key from one
 * user must not surface a hold for another.
 */
export async function findHoldRecordByIdempotencyKey(
  idempotencyKey: string,
  userId: string
): Promise<{ id: string; holdStatus: string | null } | null> {
  if (!idempotencyKey || !userId) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: creditTransaction.id,
      holdStatus: creditTransaction.holdStatus,
    })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.idempotencyKey, idempotencyKey),
        eq(creditTransaction.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findLatestHoldRecordByIdempotencyKeyPrefix(
  idempotencyKeyPrefix: string,
  userId: string
): Promise<{ id: string; holdStatus: string | null } | null> {
  if (!idempotencyKeyPrefix || !userId) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: creditTransaction.id,
      holdStatus: creditTransaction.holdStatus,
    })
    .from(creditTransaction)
    .where(
      and(
        like(creditTransaction.idempotencyKey, `${idempotencyKeyPrefix}%`),
        eq(creditTransaction.userId, userId)
      )
    )
    .orderBy(desc(creditTransaction.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find an existing PENDING hold by its idempotency key.
 *
 * Used by recovery to locate the credit hold associated with an
 * orphaned generating message. Filters by userId for defense-in-depth: a
 * stale or malicious key from one user must not surface a hold for another.
 *
 * Returns the holdId if a matching pending hold exists; null otherwise
 * (already terminal, never created, or owned by a different user).
 */
export async function findHoldByIdempotencyKey(
  idempotencyKey: string,
  userId: string
): Promise<string | null> {
  const record = await findHoldRecordByIdempotencyKey(idempotencyKey, userId);
  return record?.holdStatus === HOLD_STATUS.PENDING ? record.id : null;
}

/**
 * Confirm a pending hold - credits are permanently consumed.
 * Transitions hold status from pending to confirmed and converts to USAGE type.
 */
export async function confirmHold(holdId: string): Promise<void> {
  if (!holdId) {
    throw new Error('confirmHold: holdId required');
  }

  const db = await getDb();

  const hold = await db
    .select({
      id: creditTransaction.id,
      userId: creditTransaction.userId,
      holdStatus: creditTransaction.holdStatus,
      amount: creditTransaction.amount,
      metadata: creditTransaction.metadata,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.id, holdId))
    .limit(1);

  if (hold.length === 0) {
    // Defensive: pre-2026-05 admin holds were not persisted, so a missing
    // record may legitimately appear. Treat as no-op for back-compat.
    logger.credits.debug('confirmHold: hold not found', { holdId });
    return;
  }

  const record = hold[0];

  if (record.holdStatus === HOLD_STATUS.CONFIRMED) {
    logger.credits.debug('confirmHold: already confirmed', { holdId });
    return;
  }

  if (record.holdStatus !== HOLD_STATUS.PENDING) {
    throw new Error(`confirmHold: invalid hold status (${record.holdStatus})`);
  }

  // Admin audit holds: flip to CONFIRMED and convert to USAGE for the audit
  // log, but skip any balance or ledger work (there was none to begin with).
  if (isAdminBypassMetadata(record.metadata)) {
    await db
      .update(creditTransaction)
      .set({
        holdStatus: HOLD_STATUS.CONFIRMED,
        type: CREDIT_TRANSACTION_TYPE.USAGE,
        updatedAt: new Date(),
      })
      .where(eq(creditTransaction.id, holdId));
    logger.credits.info('confirmHold: admin audit-only', {
      holdId,
      userId: record.userId,
      amount: record.amount,
    });
    return;
  }

  await db
    .update(creditTransaction)
    .set({
      holdStatus: HOLD_STATUS.CONFIRMED,
      type: CREDIT_TRANSACTION_TYPE.USAGE,
      updatedAt: new Date(),
    })
    .where(eq(creditTransaction.id, holdId));

  logger.credits.info('confirmHold: hold confirmed', {
    holdId,
    userId: record.userId,
    amount: record.amount,
  });
}

/**
 * Release a pending hold - credits are returned to the user.
 * Transitions hold status from pending to released and refunds the balance.
 */
export async function releaseHold(holdId: string): Promise<void> {
  if (!holdId) {
    throw new Error('releaseHold: holdId required');
  }

  const db = await getDb();

  await db.transaction(async (tx) => {
    const hold = await tx
      .select({
        id: creditTransaction.id,
        userId: creditTransaction.userId,
        holdStatus: creditTransaction.holdStatus,
        amount: creditTransaction.amount,
        metadata: creditTransaction.metadata,
      })
      .from(creditTransaction)
      .where(eq(creditTransaction.id, holdId))
      .limit(1);

    if (hold.length === 0) {
      // Defensive: pre-2026-05 admin holds were not persisted, so a missing
      // record may legitimately appear. Treat as no-op for back-compat.
      logger.credits.debug('releaseHold: hold not found', { holdId });
      return;
    }

    const record = hold[0];

    if (record.holdStatus === HOLD_STATUS.RELEASED) {
      logger.credits.debug('releaseHold: already released', { holdId });
      return;
    }

    if (record.holdStatus !== HOLD_STATUS.PENDING) {
      throw new Error(
        `releaseHold: invalid hold status (${record.holdStatus})`
      );
    }

    const now = new Date();

    // Admin audit holds: just flip status to RELEASED, no balance restoration
    // (no balance was reserved). The audit row remains for traceability.
    if (isAdminBypassMetadata(record.metadata)) {
      await tx
        .update(creditTransaction)
        .set({
          holdStatus: HOLD_STATUS.RELEASED,
          updatedAt: now,
        })
        .where(eq(creditTransaction.id, holdId));
      logger.credits.info('releaseHold: admin audit-only', {
        holdId,
        userId: record.userId,
      });
      return;
    }

    let refundAmount = Math.abs(record.amount);

    if (record.metadata) {
      const { restoredAmount, expiredAmount } =
        await restoreCreditLedgerAllocations({
          tx,
          allocations: parseHoldAllocations(record.metadata),
          now,
        });

      refundAmount = restoredAmount;
      await recordExpiredHeldCredits({
        tx,
        userId: record.userId,
        amount: expiredAmount,
        holdId,
        now,
      });
    }

    if (refundAmount > 0) {
      // Return only credits that are still usable to the user balance.
      await tx
        .update(userCredit)
        .set({
          currentCredits: sql`${userCredit.currentCredits} + ${refundAmount}`,
          updatedAt: now,
        })
        .where(eq(userCredit.userId, record.userId));
    }

    // Mark hold as released
    await tx
      .update(creditTransaction)
      .set({
        holdStatus: HOLD_STATUS.RELEASED,
        updatedAt: now,
      })
      .where(eq(creditTransaction.id, holdId));
  });

  logger.credits.info('releaseHold: hold released', { holdId });
}
