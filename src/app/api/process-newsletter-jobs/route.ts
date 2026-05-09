import {
  createCronUnauthorizedResponse,
  validateCronAuth,
} from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { processNewsletterSubscribeJobs } from '@/newsletter/jobs';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  if (!validateCronAuth(request)) {
    logger.api.error('process newsletter jobs unauthorized');
    return createCronUnauthorizedResponse();
  }

  const result = await processNewsletterSubscribeJobs();
  logger.api.info('process newsletter jobs finished', result);

  return NextResponse.json({
    message: `process newsletter jobs finished, claimed: ${result.claimed}, processed: ${result.processed}, succeeded: ${result.succeeded}, failed: ${result.failed}`,
    ...result,
  });
}
