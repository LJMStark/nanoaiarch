import { timingSafeEqual } from 'crypto';
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

export function validateBasicCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.split(' ')[1];
  let credentials: string;

  try {
    credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch {
    return false;
  }

  const [username, password] = credentials.split(':');
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

export function createCronUnauthorizedResponse(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
