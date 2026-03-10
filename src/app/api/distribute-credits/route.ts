import { timingSafeEqual } from 'crypto';
import { distributeCreditsToAllUsers } from '@/credits/distribute';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

function safeCompareStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

// Basic authentication middleware
function validateBasicAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  // Extract credentials from Authorization header
  const base64Credentials = authHeader.split(' ')[1];
  let credentials: string;

  try {
    credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch {
    return false;
  }

  const [username, password] = credentials.split(':');

  // Validate against environment variables
  const expectedUsername = process.env.CRON_JOBS_USERNAME;
  const expectedPassword = process.env.CRON_JOBS_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    logger.api.error(
      'Basic auth credentials not configured in environment variables'
    );
    return false;
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }

  return (
    safeCompareStrings(username, expectedUsername) &&
    safeCompareStrings(password, expectedPassword)
  );
}

/**
 * distribute credits to all users daily
 */
export async function GET(request: Request) {
  // Validate basic authentication
  if (!validateBasicAuth(request)) {
    logger.api.error('distribute credits unauthorized');
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
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
