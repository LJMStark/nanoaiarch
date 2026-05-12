'use server';

import { logger } from '@/lib/logger';
import { userActionClient } from '@/lib/safe-action';
import { unsubscribe } from '@/newsletter';
import { z } from 'zod';

// Newsletter schema for validation
const newsletterSchema = z.object({
  email: z.email({ error: '请输入有效的邮箱地址' }),
});

// Create a safe action for newsletter unsubscription
export const unsubscribeNewsletterAction = userActionClient
  .schema(newsletterSchema)
  .action(async ({ parsedInput: { email } }) => {
    try {
      const unsubscribed = await unsubscribe(email);

      if (!unsubscribed) {
        logger.actions.error('unsubscribe newsletter error:', null, { email });
        return {
          success: false,
          error: '退订失败',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.actions.error('unsubscribe newsletter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
