'use server';

import { getDb } from '@/db';
import { payment } from '@/db/schema';
import { logger } from '@/lib/logger';
import { userActionClient } from '@/lib/safe-action';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const checkPaymentCompletionSchema = z.object({
  sessionId: z.string(),
});

/**
 * Check if a payment is completed for the given session ID
 * Only returns payment status for payments belonging to the current user
 */
export const checkPaymentCompletionAction = userActionClient
  .schema(checkPaymentCompletionSchema)
  .action(async ({ parsedInput: { sessionId }, ctx }) => {
    try {
      const currentUser = (ctx as { user: { id: string } }).user;
      const db = await getDb();
      const paymentRecord = await db
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.sessionId, sessionId),
            eq(payment.userId, currentUser.id)
          )
        )
        .limit(1);

      const paymentData = paymentRecord[0] || null;
      const isPaid = paymentData ? paymentData.paid : false;
      logger.actions.debug('Check payment completion, isPaid:', { isPaid });

      return {
        success: true,
        isPaid,
      };
    } catch (error) {
      logger.actions.error('Check payment completion error:', error);
      return {
        success: false,
        error: 'Failed to check payment completion',
      };
    }
  });
