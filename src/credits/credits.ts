import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { creditTransaction, userCredit } from '@/db/schema';
import { isAdminUser } from '@/lib/admin';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { findPlanByPlanId, findPlanByPriceId } from '@/lib/price-plan';
import { addDays } from 'date-fns';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  like,
  not,
  or,
  sql,
} from 'drizzle-orm';
import {
  allocateCreditLedgerEntries,
  reserveUserCreditBalance,
  serializeAdminBypassMetadata,
} from './credits-internal';
import {
  CREDIT_TRANSACTION_TYPE,
  CreditBalanceReadError,
  CreditBalanceUpdateError,
  HOLD_STATUS,
} from './types';

// Hold lifecycle (holdCredits/confirmHold/releaseHold + finders) lives in
// credits-hold.ts since the 2026-05 split. Re-export keeps every existing
// `import { ... } from '@/credits/credits'` path working unchanged.
export {
  confirmHold,
  findHoldByIdempotencyKey,
  findHoldRecordByIdempotencyKey,
  findLatestHoldRecordByIdempotencyKeyPrefix,
  holdCredits,
  releaseHold,
} from './credits-hold';

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

  const db = await getDb();
  const now = new Date();

  // Admin users do not lose balance, but we still record an audit transaction
  // so every operation has a paper trail. Skips the balance/ledger mutations
  // (no need to reserve or allocate when nothing is actually consumed).
  if (await isAdminUser(userId)) {
    await db.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.USAGE,
      amount: -amount,
      remainingAmount: null,
      description,
      metadata: serializeAdminBypassMetadata(),
      createdAt: now,
      updatedAt: now,
    });
    logger.credits.info('consumeCredits: admin audit-only', {
      userId,
      amount,
      description,
    });
    await recordAudit({
      userId,
      actorId: userId, // self-action: admin consuming on their own account
      action: AUDIT_ACTIONS.CREDIT_ADMIN_BYPASS,
      entityType: 'credit_transaction',
      metadata: { kind: 'consume', amount, description },
    });
    return;
  }

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
 * Add lifetime monthly credits (cron-driven recurring grant).
 *
 * Uses a month-scoped idempotency key combined with canAddCreditsByType to
 * ensure each user receives at most one LIFETIME_MONTHLY grant per month from
 * the cron pipeline.
 *
 * For first-purchase grants triggered by the payment webhook, use
 * {@link addLifetimeInitialCredits} instead — it keys on the invoice id so
 * the user always receives their purchase-month credits even in edge cases
 * (e.g. refund + rebuy within the same month).
 *
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

/**
 * Build the invoice-scoped idempotency key for lifetime first-purchase grants.
 * Exposed for tests; internal callers should rely on addLifetimeInitialCredits.
 */
export function buildLifetimeInitialIdempotencyKey(invoiceId: string): string {
  return `lifetime-init:${invoiceId}`;
}

/**
 * Add lifetime credits triggered by a successful payment webhook.
 *
 * Unlike {@link addLifetimeMonthlyCredits}, this function:
 *   1. Bypasses the month-scoped canAddCreditsByType gate, so a refund+rebuy
 *      in the same month still grants the purchase-month credits.
 *   2. Uses an invoice-scoped idempotency key so webhook replays are safe.
 *
 * The cron monthly grant is still gated by canAddCreditsByType, so it will
 * naturally skip the current month if this function has already granted.
 *
 * @param userId - User ID
 * @param priceId - Price ID
 * @param invoiceId - Payment invoice id (forms the idempotency key scope)
 * @returns true if credits were applied, false if a duplicate webhook
 */
export async function addLifetimeInitialCredits(
  userId: string,
  priceId: string,
  invoiceId: string
): Promise<boolean> {
  if (!invoiceId) {
    throw new Error('addLifetimeInitialCredits: invoiceId required');
  }

  const pricePlan = findPlanByPriceId(priceId);
  if (
    !pricePlan ||
    !pricePlan.isLifetime ||
    pricePlan.disabled ||
    !pricePlan.credits ||
    !pricePlan.credits.enable
  ) {
    logger.credits.debug('addLifetimeInitialCredits no credits configured', {
      priceId,
      invoiceId,
    });
    return false;
  }

  const credits = pricePlan.credits.amount;
  // Lifetime plans use expireDays: 0 to mean "never expires"; addCredits
  // treats undefined as "no expiry" but rejects 0 outright. Normalize here
  // so the invoice grant survives the validation gate.
  const rawExpireDays = pricePlan.credits.expireDays;
  const expireDays =
    rawExpireDays && rawExpireDays > 0 ? rawExpireDays : undefined;
  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const applied = await addCredits({
    userId,
    amount: credits,
    type: CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY,
    description: `Lifetime monthly credits: ${credits} for ${month}`,
    expireDays,
    idempotencyKey: buildLifetimeInitialIdempotencyKey(invoiceId),
  });

  if (applied) {
    logger.credits.info('addLifetimeInitialCredits completed', {
      userId,
      credits,
      invoiceId,
      month,
    });
  } else {
    logger.credits.debug(
      'addLifetimeInitialCredits skipped (duplicate webhook)',
      {
        userId,
        invoiceId,
        month,
      }
    );
  }

  return applied;
}
