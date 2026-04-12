'use server';

import { getUserCredits } from '@/credits/credits';
import { CreditBalanceReadError } from '@/credits/types';
import type { User } from '@/lib/auth-types';
import { logger } from '@/lib/logger';
import { userActionClient } from '@/lib/safe-action';

/**
 * Get current user's credits
 */
export const getCreditBalanceAction = userActionClient.action(
  async ({ ctx }) => {
    try {
      const currentUser = (ctx as { user: User }).user;
      const credits = await getUserCredits(currentUser.id);
      return { success: true, credits };
    } catch (error) {
      logger.actions.error('get credit balance error:', error);
      return {
        success: false,
        error:
          error instanceof CreditBalanceReadError
            ? error.message
            : 'Failed to fetch credit balance',
      };
    }
  }
);
