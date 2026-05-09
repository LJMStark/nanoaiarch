import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

const CRON_REALM = 'Cron';

function safeCompareStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function parseBasicCredentials(authHeader: string): {
  username: string;
  password: string;
} | null {
  const base64Credentials = authHeader.slice('Basic '.length);
  let credentials: string;

  try {
    credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch {
    return null;
  }

  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: credentials.slice(0, separatorIndex),
    password: credentials.slice(separatorIndex + 1),
  };
}

export function validateBasicCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Basic ')) {
    return false;
  }

  const credentials = parseBasicCredentials(authHeader);
  const expectedUsername = process.env.CRON_JOBS_USERNAME;
  const expectedPassword = process.env.CRON_JOBS_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    logger.api.error(
      'Basic auth credentials not configured in environment variables'
    );
    return false;
  }

  if (!credentials) {
    return false;
  }

  return (
    safeCompareStrings(credentials.username, expectedUsername) &&
    safeCompareStrings(credentials.password, expectedPassword)
  );
}

export function validateBearerCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret) {
    logger.api.error('Bearer cron secret not configured in environment');
    return false;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return safeCompareStrings(token, expectedSecret);
}

export function validateCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return validateBearerCronAuth(request);
  }

  return validateBasicCronAuth(request);
}

export function createCronUnauthorizedResponse(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer realm="${CRON_REALM}", Basic realm="${CRON_REALM}"`,
    },
  });
}
