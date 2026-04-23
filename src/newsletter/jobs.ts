import { getDb } from '@/db';
import { newsletterJob } from '@/db/schema';
import { logger } from '@/lib/logger';
import { subscribe } from '@/newsletter';
import { sql } from 'drizzle-orm';

type NewsletterSubscribeJobRow = {
  id: string;
  email: string;
  attempts: number;
};

export type ProcessNewsletterJobsResult = {
  claimed: number;
  processed: number;
  succeeded: number;
  failed: number;
};

const NEWSLETTER_JOB_LEASE_MS = 10 * 60 * 1000;

export async function scheduleNewsletterSubscribeJob(params: {
  userId: string;
  email: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date();

  await db
    .insert(newsletterJob)
    .values({
      id: crypto.randomUUID(),
      userId: params.userId,
      email: params.email,
      type: 'subscribe',
      status: 'pending',
      idempotencyKey: `newsletter:subscribe:${params.userId}`,
      attempts: 0,
      nextAttemptAt: now,
      leaseExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: newsletterJob.idempotencyKey,
    });
}

function getNewsletterRetryDelayMs(attempts: number): number {
  const baseDelayMs = 5 * 60 * 1000;
  const maxDelayMs = 6 * 60 * 60 * 1000;
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempts - 1));
}

export function buildClaimNewsletterSubscribeJobsSql(params: {
  limit: number;
  now: Date;
  leaseExpiresAt: Date;
}) {
  return sql<NewsletterSubscribeJobRow>`
    WITH queued AS (
      SELECT ${newsletterJob.id}
      FROM ${newsletterJob}
      WHERE ${newsletterJob.type} = 'subscribe'
        AND ${newsletterJob.nextAttemptAt} <= ${params.now}
        AND (
          ${newsletterJob.status} = 'pending'
          OR ${newsletterJob.status} = 'failed'
          OR (
            ${newsletterJob.status} = 'processing'
            AND ${newsletterJob.leaseExpiresAt} <= ${params.now}
          )
        )
      ORDER BY ${newsletterJob.nextAttemptAt}, ${newsletterJob.createdAt}
      LIMIT ${params.limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${newsletterJob}
    SET
      ${newsletterJob.status} = 'processing',
      ${newsletterJob.attempts} = ${newsletterJob.attempts} + 1,
      ${newsletterJob.lastError} = NULL,
      ${newsletterJob.leaseExpiresAt} = ${params.leaseExpiresAt},
      ${newsletterJob.updatedAt} = ${params.now}
    WHERE ${newsletterJob.id} IN (SELECT ${newsletterJob.id} FROM queued)
    RETURNING
      ${newsletterJob.id} AS "id",
      ${newsletterJob.email} AS "email",
      ${newsletterJob.attempts} AS "attempts"
  `;
}

async function claimNewsletterSubscribeJobs(
  limit: number
): Promise<NewsletterSubscribeJobRow[]> {
  const db = await getDb();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + NEWSLETTER_JOB_LEASE_MS);

  return (await db.execute(
    buildClaimNewsletterSubscribeJobsSql({
      limit,
      now,
      leaseExpiresAt,
    })
  )) as NewsletterSubscribeJobRow[];
}

async function markNewsletterJobCompleted(jobId: string): Promise<void> {
  const db = await getDb();

  await db.execute(sql`
    UPDATE ${newsletterJob}
    SET
      ${newsletterJob.status} = 'completed',
      ${newsletterJob.completedAt} = NOW(),
      ${newsletterJob.updatedAt} = NOW(),
      ${newsletterJob.lastError} = NULL,
      ${newsletterJob.leaseExpiresAt} = NULL
    WHERE ${newsletterJob.id} = ${jobId}
  `);
}

async function markNewsletterJobFailed(params: {
  jobId: string;
  attempts: number;
  errorMessage: string;
}): Promise<void> {
  const db = await getDb();
  const nextAttemptAt = new Date(
    Date.now() + getNewsletterRetryDelayMs(params.attempts)
  );

  await db.execute(sql`
    UPDATE ${newsletterJob}
    SET
      ${newsletterJob.status} = 'failed',
      ${newsletterJob.lastError} = ${params.errorMessage},
      ${newsletterJob.nextAttemptAt} = ${nextAttemptAt},
      ${newsletterJob.updatedAt} = NOW(),
      ${newsletterJob.leaseExpiresAt} = NULL
    WHERE ${newsletterJob.id} = ${params.jobId}
  `);
}

export async function processNewsletterSubscribeJobs({
  limit = 50,
}: {
  limit?: number;
} = {}): Promise<ProcessNewsletterJobsResult> {
  const jobs = await claimNewsletterSubscribeJobs(limit);
  const result: ProcessNewsletterJobsResult = {
    claimed: jobs.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  for (const job of jobs) {
    result.processed += 1;

    try {
      const subscribed = await subscribe(job.email);
      if (!subscribed) {
        throw new Error('newsletter provider returned false');
      }

      await markNewsletterJobCompleted(job.id);
      result.succeeded += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'newsletter job failed';
      logger.newsletter.error(
        'Failed to process newsletter subscribe job',
        error,
        {
          jobId: job.id,
          email: job.email,
          attempts: job.attempts,
        }
      );
      await markNewsletterJobFailed({
        jobId: job.id,
        attempts: job.attempts,
        errorMessage,
      });
      result.failed += 1;
    }
  }

  return result;
}
