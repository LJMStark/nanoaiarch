import { distributeCreditsToAllUsers } from '@/credits/distribute';
import {
  createCronUnauthorizedResponse,
  validateCronAuth,
} from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

/**
 * distribute credits to all users daily
 */
export async function GET(request: Request) {
  if (!validateCronAuth(request)) {
    logger.api.error('distribute credits unauthorized');
    return createCronUnauthorizedResponse();
  }

  logger.api.info('route: distribute credits start');
  const { usersCount, processedCount, errorCount } =
    await distributeCreditsToAllUsers();
  logger.api.info(
    `route: distribute credits end, users: ${usersCount}, processed: ${processedCount}, errors: ${errorCount}`
  );
  return NextResponse.json({
    message: `distribute credits success, users: ${usersCount}, processed: ${processedCount}, errors: ${errorCount}`,
    usersCount,
    processedCount,
    errorCount,
  });
}
