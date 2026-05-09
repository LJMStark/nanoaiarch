import {
  findExpiredGeneratingMessages,
  updateAssistantMessageDirect,
} from '@/actions/project-message';
import { findHoldByIdempotencyKey, releaseHold } from '@/credits/credits';
import {
  createCronUnauthorizedResponse,
  validateBasicCronAuth,
} from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

/**
 * Lease sweep cron — Week 5.1.
 *
 * Runs every 2.5 minutes via Vercel Cron (vercel.json). For each
 * project_message row with status='generating' and an elapsed
 * generationLeaseExpiresAt:
 *   1. Locate the associated credit hold (idempotencyKey = gen-hold:<messageId>)
 *   2. Release the hold (refund credits to balance)
 *   3. Mark the message status='failed' so the user can retry
 *
 * Why a sweep instead of a per-client retry: the client may have crashed,
 * closed the tab, or lost network entirely. Server-authoritative cleanup
 * is the only way to guarantee credits get refunded — see the lease
 * design in Week 4.1 (src/ai/image/config/generation-recovery.ts).
 *
 * The route returns a summary so cron logs surface the sweep activity:
 * `{ scanned, swept, errors }`. A genuinely-stuck row that the sweeper
 * can't resolve (e.g. update failed) goes to errors and is logged.
 *
 * Auth: same Basic auth as other crons (CRON_JOBS_USERNAME/PASSWORD env).
 */
export async function GET(request: Request) {
  if (!validateBasicCronAuth(request)) {
    logger.api.error('lease-sweep unauthorized');
    return createCronUnauthorizedResponse();
  }

  const startedAt = Date.now();
  logger.api.info('lease-sweep: scan starting');

  const expired = await findExpiredGeneratingMessages({ limit: 200 });
  if (expired.length === 0) {
    logger.api.info('lease-sweep: no expired rows');
    return NextResponse.json({
      scanned: 0,
      swept: 0,
      errors: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  let swept = 0;
  let errors = 0;

  for (const row of expired) {
    try {
      // 1. Locate and release the hold (best-effort).
      //
      // The hold may already be in a terminal state (CONFIRMED / RELEASED)
      // if the client managed to finish *just* before the sweep — the
      // releaseHold helper is idempotent in that case (see Week 1.2 fix).
      const holdId = await findHoldByIdempotencyKey(
        `gen-hold:${row.id}`,
        row.userId
      );
      if (holdId) {
        try {
          await releaseHold(holdId);
        } catch (releaseError) {
          // Don't abort the sweep on one bad release — log and continue
          // marking the message failed, otherwise we leak the row.
          logger.api.error(
            `lease-sweep: releaseHold failed [messageId=${row.id}, holdId=${holdId}]`,
            releaseError
          );
        }
      }

      // 2. Mark the message failed so the UI surfaces a retry path.
      // updateAssistantMessageDirect bypasses the per-user auth check
      // since the sweeper acts on behalf of the system.
      await updateAssistantMessageDirect(row.id, row.userId, {
        status: 'failed',
        content: '生成超时，请重试',
        errorMessage: 'Generation timed out (lease expired)',
      });

      swept += 1;
    } catch (err) {
      errors += 1;
      logger.api.error(
        `lease-sweep: row failed [messageId=${row.id}, projectId=${row.projectId}]`,
        err
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.api.info(
    `lease-sweep: done scanned=${expired.length} swept=${swept} errors=${errors} durationMs=${durationMs}`
  );

  return NextResponse.json({
    scanned: expired.length,
    swept,
    errors,
    durationMs,
  });
}
