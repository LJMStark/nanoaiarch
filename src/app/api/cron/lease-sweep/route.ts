import { recoverExpiredGeneratingMessages } from '@/actions/project-message';
import {
  createCronUnauthorizedResponse,
  validateCronAuth,
} from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

/**
 * Optional lease recovery endpoint.
 *
 * Normal user-facing recovery is request-triggered: opening a project,
 * polling a generation, or starting a new generation will release expired
 * holds for that user. This endpoint remains as a protected maintenance
 * backstop for operators who want a global sweep.
 *
 * For each project_message row with status='generating' and an elapsed
 * generationLeaseExpiresAt, recovery will:
 *   1. Locate the associated credit hold (idempotencyKey = gen-hold:<messageId>)
 *   2. Release the hold (refund credits to balance)
 *   3. Mark the message status='failed' so the user can retry
 *
 * Auth: optional Bearer CRON_SECRET or legacy Basic auth.
 */
export async function GET(request: Request) {
  if (!validateCronAuth(request)) {
    logger.api.error('lease-sweep unauthorized');
    return createCronUnauthorizedResponse();
  }

  const startedAt = Date.now();
  logger.api.info('lease-sweep: scan starting');

  const result = await recoverExpiredGeneratingMessages({
    limit: 200,
    trigger: 'cron',
  });
  if (result.scanned === 0) {
    logger.api.info('lease-sweep: no expired rows');
    return NextResponse.json({
      scanned: 0,
      swept: 0,
      errors: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  const durationMs = Date.now() - startedAt;
  logger.api.info(
    `lease-sweep: done scanned=${result.scanned} swept=${result.recovered} errors=${result.errors} durationMs=${durationMs}`
  );

  return NextResponse.json({
    scanned: result.scanned,
    swept: result.recovered,
    errors: result.errors,
    durationMs,
  });
}
