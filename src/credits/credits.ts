import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { creditTransaction, userCredit } from '@/db/schema';
import { isAdminUser } from '@/lib/admin';
import { logger } from '@/lib/logger';
import { findPlanByPlanId, findPlanByPriceId } from '@/lib/price-plan';
import { addDays } from 'date-fns';
import { and, asc, eq, gt, inArray, isNull, not, or, sql } from 'drizzle-orm';
import { CREDIT_TRANSACTION_TYPE } from './types';

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

    return record[0]?.currentCredits || 0;
  } catch (error) {
    logger.credits.error('getUserCredits error', { error });
    // Return 0 on error to prevent UI from breaking
    return 0;
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
}: {
  userId: string;
  amount: number;
  type: string;
  description: string;
  paymentId?: string;
  expireDays?: number;
}) {
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

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
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
          updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Write credit transaction record within the same transaction
    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type,
      amount,
      remainingAmount: amount,
      description,
      paymentId,
      expirationDate: expireDays ? addDays(new Date(), expireDays) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
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
    // Check balance within transaction
    const currentRecord = await tx
      .select({ currentCredits: userCredit.currentCredits })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);

    const currentBalance = currentRecord[0]?.currentCredits || 0;
    if (currentBalance < amount) {
      logger.credits.error('consumeCredits insufficient credits', null, {
        userId,
        required: amount,
        available: currentBalance,
      });
      throw new Error('Insufficient credits');
    }

    // FIFO consumption: consume from the earliest unexpired credits first
    const transactions = await tx
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          // Exclude usage and expire records (these are consumption/expiration logs)
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.USAGE)),
          not(eq(creditTransaction.type, CREDIT_TRANSACTION_TYPE.EXPIRE)),
          // Only include transactions with remaining amount > 0
          gt(creditTransaction.remainingAmount, 0),
          // Only include unexpired credits (either no expiration date or not yet expired)
          or(
            isNull(creditTransaction.expirationDate),
            gt(creditTransaction.expirationDate, now)
          )
        )
      )
      .orderBy(
        asc(creditTransaction.expirationDate),
        asc(creditTransaction.createdAt)
      );

    // Consume credits
    let remainingToDeduct = amount;
    for (const transaction of transactions) {
      if (remainingToDeduct <= 0) break;
      const remainingAmount = transaction.remainingAmount || 0;
      if (remainingAmount <= 0) continue;
      // credits to consume at most in this transaction
      const deductFromThis = Math.min(remainingAmount, remainingToDeduct);
      await tx
        .update(creditTransaction)
        .set({
          remainingAmount: remainingAmount - deductFromThis,
          updatedAt: new Date(),
        })
        .where(eq(creditTransaction.id, transaction.id));
      remainingToDeduct -= deductFromThis;
    }

    // Update balance
    const newBalance = currentBalance - amount;
    await tx
      .update(userCredit)
      .set({ currentCredits: newBalance, updatedAt: new Date() })
      .where(eq(userCredit.userId, userId));

    // Write usage record
    await tx.insert(creditTransaction).values({
      id: randomUUID(),
      userId,
      type: CREDIT_TRANSACTION_TYPE.USAGE,
      amount: -amount,
      remainingAmount: null,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction type
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

  const canAdd = await canAddCreditsByType(
    userId,
    CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH
  );
  const now = new Date();

  // add credits if it's a new month
  if (canAdd) {
    const credits = pricePlan.credits?.amount || 0;
    const expireDays = pricePlan.credits?.expireDays || 0;
    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH,
      description: `Free monthly credits: ${credits} for ${now.getFullYear()}-${now.getMonth() + 1}`,
      expireDays,
    });

    logger.credits.info('addMonthlyFreeCredits completed', {
      userId,
      credits,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  } else {
    logger.credits.debug('addMonthlyFreeCredits skipped (already added)', {
      userId,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  }
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

  const canAdd = await canAddCreditsByType(
    userId,
    CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL
  );
  const now = new Date();

  // Add credits if it's a new month
  if (canAdd) {
    const credits = pricePlan.credits.amount;
    const expireDays = pricePlan.credits.expireDays;

    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.SUBSCRIPTION_RENEWAL,
      description: `Subscription renewal credits: ${credits} for ${now.getFullYear()}-${now.getMonth() + 1}`,
      expireDays,
    });

    logger.credits.info('addSubscriptionCredits completed', {
      userId,
      priceId,
      credits,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  } else {
    logger.credits.debug('addSubscriptionCredits skipped (already added)', {
      userId,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  }
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

  const canAdd = await canAddCreditsByType(
    userId,
    CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY
  );
  const now = new Date();

  // Add credits if it's a new month
  if (canAdd) {
    const credits = pricePlan.credits.amount;
    const expireDays = pricePlan.credits.expireDays;

    await addCredits({
      userId,
      amount: credits,
      type: CREDIT_TRANSACTION_TYPE.LIFETIME_MONTHLY,
      description: `Lifetime monthly credits: ${credits} for ${now.getFullYear()}-${now.getMonth() + 1}`,
      expireDays,
    });

    logger.credits.info('addLifetimeMonthlyCredits completed', {
      userId,
      credits,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  } else {
    logger.credits.debug('addLifetimeMonthlyCredits skipped (already added)', {
      userId,
      month: `${now.getFullYear()}-${now.getMonth() + 1}`,
    });
  }
}
