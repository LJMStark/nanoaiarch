import { logger } from '@/lib/logger';
import { subscribe } from '@/newsletter';
import { scheduleNewsletterSubscribeJob } from './jobs';

export type EnsureNewsletterSignupSubscriptionResult = {
  delivered: boolean;
  queued: boolean;
};

export async function ensureNewsletterSignupSubscription(params: {
  userId: string;
  email: string;
}): Promise<EnsureNewsletterSignupSubscriptionResult> {
  try {
    const subscribed = await subscribe(params.email);
    if (subscribed) {
      return {
        delivered: true,
        queued: false,
      };
    }

    logger.newsletter.warn(
      'Immediate newsletter subscribe failed, queueing retry',
      {
        userId: params.userId,
        email: params.email,
      }
    );
  } catch (error) {
    logger.newsletter.error(
      'Immediate newsletter subscribe errored, queueing retry',
      error,
      {
        userId: params.userId,
        email: params.email,
      }
    );
  }

  try {
    await scheduleNewsletterSubscribeJob(params);
    return {
      delivered: false,
      queued: true,
    };
  } catch (error) {
    logger.newsletter.error(
      'Failed to queue newsletter subscribe retry job',
      error,
      {
        userId: params.userId,
        email: params.email,
      }
    );

    return {
      delivered: false,
      queued: false,
    };
  }
}
