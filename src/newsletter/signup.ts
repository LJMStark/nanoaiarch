import { logger } from '@/lib/logger';
import { isNewsletterConfigured, subscribe } from '@/newsletter';
import { scheduleNewsletterSubscribeJob } from './jobs';

export type EnsureNewsletterSignupSubscriptionResult = {
  delivered: boolean;
  queued: boolean;
  skipped: boolean;
};

export async function ensureNewsletterSignupSubscription(params: {
  userId: string;
  email: string;
}): Promise<EnsureNewsletterSignupSubscriptionResult> {
  if (!isNewsletterConfigured()) {
    logger.newsletter.warn(
      'Newsletter provider not configured, skipping signup subscribe',
      {
        userId: params.userId,
        email: params.email,
      }
    );
    return {
      delivered: false,
      queued: false,
      skipped: true,
    };
  }

  try {
    const subscribed = await subscribe(params.email);
    if (subscribed) {
      return {
        delivered: true,
        queued: false,
        skipped: false,
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
      skipped: false,
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
      skipped: false,
    };
  }
}
