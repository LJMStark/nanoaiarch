'use server';

import { getDb } from '@/db';
import { creditTransaction } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { logger } from '@/lib/logger';
import { userActionClient } from '@/lib/safe-action';
import { and, eq, gt, gte, isNotNull, sql, sum } from 'drizzle-orm';

export const getCreditStatsAction = userActionClient.action(async ({ ctx }) => {
  try {
    const currentUser = (ctx as { user: User }).user;
    const userId = currentUser.id;

    const db = await getDb();
    const now = new Date();
    const expirationDay = sql<Date>`DATE(${creditTransaction.expirationDate})`;

    // All non-expired grants with remaining balance, grouped by expiration date.
    // Null expirationDate rows (never-expire grants) are excluded so the UI
    // only shows dates that are actually relevant to the user.
    const rows = await db
      .select({
        expirationDate: expirationDay,
        totalAmount: sum(creditTransaction.remainingAmount),
      })
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, userId),
          isNotNull(creditTransaction.expirationDate),
          isNotNull(creditTransaction.remainingAmount),
          gt(creditTransaction.remainingAmount, 0),
          gte(creditTransaction.expirationDate, now)
        )
      )
      .groupBy(expirationDay)
      .orderBy(expirationDay);

    const expiryBreakdown = rows
      .filter((r) => r.expirationDate != null && Number(r.totalAmount) > 0)
      .map((r) => ({
        date: (r.expirationDate as Date).toISOString().slice(0, 10),
        amount: Number(r.totalAmount),
      }));

    const totalExpiring = expiryBreakdown.reduce((s, r) => s + r.amount, 0);

    return {
      success: true,
      data: {
        expiringCredits: {
          amount: totalExpiring,
          breakdown: expiryBreakdown,
        },
      },
    };
  } catch (error) {
    logger.actions.error('get credit stats error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch credit statistics',
    };
  }
});
