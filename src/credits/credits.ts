import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { creditTransaction, userCredit } from '@/db/schema';
import { isAdminUser } from '@/lib/admin';
import { logger } from '@/lib/logger';
import { findPlanByPlanId, findPlanByPriceId } from '@/lib/price-plan';
import { addDays } from 'date-fns';
import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  not,
  or,
  sql,
} from 'drizzle-orm';
import {
  CREDIT_TRANSACTION_TYPE,
  CreditBalanceReadError,
  CreditBalanceUpdateError,
  type CreditHoldResult,
  HOLD_STATUS,
} from './types';

function buildOneTimeCreditGrantIdempotencyKey(
  userId: string,
  creditType: string
): string {
  return `credit-grant:${creditType}:${userId}`;
}

export function buildMonthlyCreditGrantIdempotencyKey(
  userId: string,
  creditType: string,
  date: Date
): string {
  return `credit-grant:${creditType}:${userId}:${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

function buildCreditTransactionPayload({
  userId,
  type,
  amount,
  description,
  paymentId,
  expirationDate,
  now,
}: {
  userId: string;
  type: string;
  amount: number;
  description: string;
  paymentId?: string;
  expirationDate?: Date;
  now: Date;
}) {
  return {
    id: randomUUID(),
    userId,
    type,
    amount,
    remainingAmount: amount,
    description,
    paymentId,
    expirationDate,
    createdAt: now,
    updatedAt: now,
  };
}

type HoldAllocation = {
  transactionId: string;
  amount: number;
};

type RestoredHoldAllocations = {
  restoredAmount: number;
  expiredAmount: number;
};

function serializeHoldMetadata(allocations: HoldAllocation[]): string {
  return JSON.stringify({ allocations });
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

async function reserveUserCreditBalance({
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

async function allocateCreditLedgerEntries({
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
    logger.credits.error('allocateCreditLedgerEntries ledger mismatch', null, {
      userId,
      amount,
      remainingToDeduct,
      availableTransactions: transactions.length,
    });
    throw new Error('Credit ledger is inconsistent');
  }

  return allocations;
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

async function grantMonthlyCreditsIfEligible({
  userId,
  type,
  credits,
  expireDays,
  descriptionPrefix,
  logLabel,
  logContext,
}: {
  userId: string;
  type: string;
  credits: number;
  expireDays?: number;
  descriptionPrefix: string;
  logLabel: string;
  logContext?: Record<string, string | number | boolean>;
}): Promise<void> {
  const canAdd = await canAddCreditsByType(userId, type);
  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth() + 1}`;

  if (!canAdd) {
    logger.credits.debug(`${logLabel} skipped (already added)`, {
      userId,
      month,
      ...logContext,
    });
    return;
  }

  const added = await addCredits({
    userId,
    amount: credits,
    type,
    description: `${descriptionPrefix}: ${credits} for ${month}`,
    expireDays,
    idempotencyKey: buildMonthlyCreditGrantIdempotencyKey(userId, type, now),
  });

  if (added) {
    logger.credits.info(`${logLabel} completed`, {
      userId,
      credits,
      month,
      ...logContext,
    });
    return;
  }

  logger.credits.debug(`${logLabel} skipped (duplicate idempotency key)`, {
    userId,
    month,
    ...logContext,
  });
}

/**
 * Get user's current credit balance
 * @param userId - User ID
 * @returns User's current credit balance
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const db = await getDb();

    // Optimized query: only select the needed field
    // This can benefit from covering index if we add one later
    const record = await db
      .select({ currentCredits: userCredit.currentCredits })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);

    return record[0]?.currentCredits ?? 0;
  } catch (error) {
    logger.credits.error('getUserCredits error', { error });
    throw new CreditBalanceReadError('Failed to load credit balance');
  }
}

/**
 * Update user's current credit balance
 * @param userId - User ID
 * @param credits - New credit balance
 */
export async function updateUserCredits(userId: string, credits: number) {
  try {
    const db = await getDb();
    await db
      .update(userCredit)
      .set({ currentCredits: credits, updatedAt: new Date() })
      .where(eq(userCredit.userId, userId));
  } catch (error) {
    logger.credits.error('updateUserCredits error', error);
    throw new CreditBalanceUpdateError('Failed to update credit balance');
  }
}

/**
 * Write a credit transaction record
 * @param params - Credit transaction parameters
 */
export async function saveCreditTransaction({
  userId,
  type,
  amount,
  description,
  paymentId,
  expirationDate,
}: {
  userId: string;
  type: string;
  amount: number;
  description: string;
  paymentId?: string;
  expirationDate?: Date;
}) {
  if (!userId || !type || !description) {
    logger.credits.error('saveCreditTransaction invalid params', null, {
      userId,
      type,
      description,
    });
    throw new Error('saveCreditTransaction, invalid params');
  }
  if (!Number.isFinite(amount) || amount === 0) {
    logger.credits.error('saveCreditTransaction invalid amount', null, {
      userId,
      amount,
    });
    throw new Error('saveCreditTransaction, invalid amount');
  }
  const db = await getDb();
  await db.insert(creditTransaction).values({
    id: randomUUID(),
    userId,
    type,
    amount,
    // remaining amount is the same as amount for earn transactions
    // remaining amount is null for spend transactions
    remainingAmount: amount > 0 ? amount : null,
    description,
    paymentId,
    expirationDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * Add credits (registration, monthly, purchase, etc.)
 * Uses atomic update to prevent race conditions
 * @param params - Credit creation parameters
 */
export async function addCredits({
  userId,
  amount,
  type,
  description,
  paymentId,
  expireDays,
  idempotencyKey,
}: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  paymentId?: string;
  expireDays?: number;
  idempotencyKey?: string;
}): Promise<boolean> {
  if (!userId || !type || !description) {
    logger.credits.error('addCredits invalid params', null, {
      userId,
      type,
      description,
    });
    throw new Error('Invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    logger.credits.error('addCredits invalid amount', null, { userId, amount });
    throw new Error('Invalid amount');
  }
  if (
    expireDays !== undefined &&
    (!Number.isFinite(expireDays) || expireDays <= 0)
  ) {
    logger.credits.error('addCredits invalid expire days', null, {
      userId,
      expireDays,
    });
    throw new Error('Invalid expire days');
  }

  const db = await getDb();
  let applied = true;

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
    const now = new Date();
    const expirationDate = expireDays ? addDays(now, expireDays) : undefined;
    const transactionPayload = buildCreditTransactionPayload({
      userId,
      type,
      amount,
      description,
      paymentId,
      expirationDate,
      now,
    });

    if (idempotencyKey) {
      const insertedTransactions = await tx
        .insert(creditTransaction)
        .values({
          ...transactionPayload,
          idempotencyKey,
        })
        .onConflictDoNothing({
          target: creditTransaction.idempotencyKey,
        })
        .returning({ id: creditTransaction.id });

      if (insertedTransactions.length === 0) {
        logger.credits.debug('addCredits skipped duplicate idempotency key', {
          userId,
          type,
          idempotencyKey,
        });
        applied = false;
        return;
      }
    }

    // Check if user credit record exists
    const current = await tx
      .select({ id: userCredit.id })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);

    if (current.length > 0) {
      // Use atomic increment to prevent race conditions
      logger.credits.debug('addCredits atomic update user credit', {
        userId,
        amount,
      });
      await tx
        .update(userCredit)
        .set({
          currentCredits: sql`${userCredit.currentCredits} + ${amount}`,
          updatedAt: now,
        })
        .where(eq(userCredit.userId, userId));
    } else {
      logger.credits.debug('addCredits insert user credit', {
        userId,
        amount,
      });
      await tx.insert(userCredit).values({
        id: randomUUID(),
        userId,
        currentCredits: amount,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!idempotencyKey) {
      // Write credit transaction record within the same transaction
      await tx.insert(creditTransaction).values(transactionPayload);
    }
  });

  return applied;
}

/**
 * Check if user has enough credits
 * Admin users always have enough credits
 * @param userId - User ID
 * @param requiredCredits - Required credits
 */
export async function hasEnoughCredits({
  userId,
  requiredCredits,
}: {
  userId: string;
  requiredCredits: number;
}) {
  // Admin users bypass credit checks
  if (await isAdminUser(userId)) {
    logger.credits.debug('hasEnoughCredits: admin user bypassed', { userId });
    return true;
  }

  const balance = await getUserCredits(userId);
  return balance >= requiredCredits;
}

/**
 * Consume credits (FIFO, by expiration)
 * Admin users skip credit consumption entirely
 * Uses database transaction to prevent race conditions
 * @param params - Credit consumption parameters
 */
export async function consumeCredits({
  userId,
  amount,
  description,
}: {
  userId: string;
  amount: number;
  description: string;
}) {
  if (!userId || !description) {
    logger.credits.error('consumeCredits invalid params', null, {
      userId,
      description,
    });
    throw new Error('Invalid params');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    logger.credits.error('consumeCredits invalid amount', null, {
      userId,
      amount,
    });
    throw new Error('Invalid amount');
  }

  // Admin users skip credit consumption entirely
  if (await isAdminUser(userId)) {
    logger.credits.debug('consumeCredits: admin user bypassed', {
      userId,
      amount,
      description,
    });
    return;
  }

  const db = await getDb();
  const now = new Date();

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
    await reserveUserCreditBalance({ tx, userId, amount, now });
    await allocateCreditLedgerEntries({ tx, userId, amount, now });

    // Write usage record
    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.USAGE,
      amount: -amount,
      remainingAmount: null,
      description,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Check if specific type of credits can be added for a user based on transaction history
 * @param userId - User ID
 * @param creditType - Type of credit transaction to check
 */
export async function canAddCreditsByType(userId: string, creditType: string) {
  const db = await getDb();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Check if user has already received this type of credits this month
  const existingTransaction = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, creditType),
        // Check if transaction was created in the current month and year
        sql`EXTRACT(MONTH FROM ${creditTransaction.createdAt}) = ${currentMonth + 1}`,
        sql`EXTRACT(YEAR FROM ${creditTransaction.createdAt}) = ${currentYear}`
      )
    )
    .limit(1);

  return existingTransaction.length === 0;
}

/**
 * Batch check if specific type of credits can be added for multiple users
 * Returns a Set of user IDs that are eligible to receive credits
 * @param userIds - Array of user IDs to check
 * @param creditType - Type of credit transaction to check
 * @param tx - Optional database transaction
 */
export async function batchCanAddCreditsByType(
  userIds: string[],
  creditType: string,
  tx?: any
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }

  const db = tx || (await getDb());
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Single query to find all users who already received this type of credits this month
  const existingTransactions = await db
    .select({ userId: creditTransaction.userId })
    .from(creditTransaction)
    .where(
      and(
        inArray(creditTransaction.userId, userIds),
        eq(creditTransaction.type, creditType),
        sql`EXTRACT(MONTH FROM ${creditTransaction.createdAt}) = ${currentMonth + 1}`,
        sql`EXTRACT(YEAR FROM ${creditTransaction.createdAt}) = ${currentYear}`
      )
    );

  // Create set of users who already have credits
  const usersWithCredits = new Set(
    existingTransactions.map((t: { userId: string }) => t.userId)
  );

  // Return users who don't have credits yet (eligible users)
  return new Set(userIds.filter((userId) => !usersWithCredits.has(userId)));
}

/**
 * Check if subscription credits can be added for a user based on last refresh time
 * @param userId - User ID
 */

/**
 * Add register gift credits
 * @param userId - User ID
 */
export async function addRegisterGiftCredits(userId: string) {
  // Check if user has already received register gift credits
  const db = await getDb();
  const record = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.REGISTER_GIFT)
      )
    )
    .limit(1);

  // add register gift credits if user has not received them yet
  if (record.length === 0) {
    const credits = websiteConfig.credits.registerGiftCredits.amount;
    const expireDays = websiteConfig.credits.registerGiftCredits.expireDays;
    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.REGISTER_GIFT,
      description: `Register gift credits: ${credits}`,
      expireDays,
      idempotencyKey: buildOneTimeCreditGrantIdempotencyKey(
        userId,
        CREDIT_TRANSACTION_TYPE.REGISTER_GIFT
      ),
    });

    logger.credits.info('addRegisterGiftCredits completed', {
      userId,
      credits,
    });
  }
}

/**
 * Add free monthly credits
 * @param userId - User ID
 * @param planId - Plan ID
 */
export async function addMonthlyFreeCredits(userId: string, planId: string) {
  // NOTICE: make sure the free plan is not disabled and has credits enabled
  const pricePlan = findPlanByPlanId(planId);
  if (
    !pricePlan ||
    pricePlan.disabled ||
    !pricePlan.isFree ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    logger.credits.debug('addMonthlyFreeCredits no credits configured', {
      planId,
    });
    return;
  }

  const credits = pricePlan.credits?.amount || 0;
  const expireDays = pricePlan.credits?.expireDays || 0;
  await grantMonthlyCreditsIfEligible({
    userId,
    type: CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH,
    credits,
    expireDays,
    descriptionPrefix: 'Free monthly credits',
    logLabel: 'addMonthlyFreeCredits',
  });
}

/**
 * Add subscription credits
 * @param userId - User ID
 * @param priceId - Price ID
 */
export async function addSubscriptionCredits(userId: string, priceId: string) {
  // NOTICE: the price plan maybe disabled, but we still need to add credits for existing users
  const pricePlan = findPlanByPriceId(priceId);
  if (
    !pricePlan ||
    // pricePlan.disabled ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    logger.credits.debug('addSubscriptionCredits no credits configured', {
      priceId,
    });
    return;
  }

  await grantMonthlyCreditsIfEligible({
    userId,
    type: CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL,
    credits: pricePlan.credits.amount,
    expireDays: pricePlan.credits.expireDays,
    descriptionPrefix: 'Subscription renewal credits',
    logLabel: 'addSubscriptionCredits',
    logContext: {
      priceId,
    },
  });
}

/**
 * Add lifetime monthly credits
 * @param userId - User ID
 * @param priceId - Price ID
 */
export async function addLifetimeMonthlyCredits(
  userId: string,
  priceId: string
) {
  // NOTICE: make sure the lifetime plan is not disabled and has credits enabled
  const pricePlan = findPlanByPriceId(priceId);
  if (
    !pricePlan ||
    !pricePlan.isLifetime ||
    pricePlan.disabled ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    logger.credits.debug('addLifetimeMonthlyCredits no credits configured', {
      priceId,
    });
    return;
  }

  await grantMonthlyCreditsIfEligible({
    userId,
    type: CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY,
    credits: pricePlan.credits.amount,
    expireDays: pricePlan.credits.expireDays,
    descriptionPrefix: 'Lifetime monthly credits',
    logLabel: 'addLifetimeMonthlyCredits',
  });
}

// ============================================================================
// Credit Hold System (Pre-deduction)
// ============================================================================

/**
 * Hold credits before an operation begins.
 * Atomically deducts credits and creates a pending hold transaction.
 * If the same idempotencyKey already exists, returns the existing hold.
 */
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

  // Admin users bypass credit holds
  if (await isAdminUser(userId)) {
    logger.credits.debug('holdCredits: admin user bypassed', {
      userId,
      amount,
    });
    const holdId = randomUUID();
    return { holdId, userId, amount };
  }

  const db = await getDb();

  // Check for existing hold with same idempotency key
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

  await db.transaction(async (tx) => {
    const now = new Date();
    await reserveUserCreditBalance({ tx, userId, amount, now });
    const allocations = await allocateCreditLedgerEntries({
      tx,
      userId,
      amount,
      now,
    });

    // Create hold transaction record
    await tx.insert(creditTransaction).values({
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
    });
  });

  logger.credits.info('holdCredits: hold created', {
    holdId,
    userId,
    amount,
    idempotencyKey,
  });
  return { holdId, userId, amount };
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
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.id, holdId))
    .limit(1);

  if (hold.length === 0) {
    // Admin users don't create real holds
    logger.credits.debug('confirmHold: hold not found (likely admin)', {
      holdId,
    });
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
      logger.credits.debug('releaseHold: hold not found (likely admin)', {
        holdId,
      });
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
