import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCronUnauthorizedResponse,
  validateBasicCronAuth,
  validateBearerCronAuth,
  validateCronAuth,
} from '../cron-auth';

const originalEnv = process.env;

function makeRequest(authorization?: string): Request {
  return new Request('http://test.local/api/cron', {
    headers: authorization ? { authorization } : {},
  });
}

function makeBasicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('cron auth', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = 'cron-secret';
    process.env.CRON_JOBS_USERNAME = 'cron-user';
    process.env.CRON_JOBS_PASSWORD = 'cron-password:with-colon';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts a matching bearer token', () => {
    expect(validateBearerCronAuth(makeRequest('Bearer cron-secret'))).toBe(
      true
    );
    expect(validateCronAuth(makeRequest('Bearer cron-secret'))).toBe(true);
  });

  it('rejects a missing or mismatched bearer token', () => {
    expect(validateBearerCronAuth(makeRequest())).toBe(false);
    expect(validateBearerCronAuth(makeRequest('Bearer wrong-secret'))).toBe(
      false
    );
  });

  it('rejects bearer auth when CRON_SECRET is not configured', () => {
    process.env.CRON_SECRET = undefined;

    expect(validateCronAuth(makeRequest('Bearer cron-secret'))).toBe(false);
  });

  it('keeps basic auth as a legacy fallback', () => {
    const authorization = makeBasicAuth(
      'cron-user',
      'cron-password:with-colon'
    );

    expect(validateBasicCronAuth(makeRequest(authorization))).toBe(true);
    expect(validateCronAuth(makeRequest(authorization))).toBe(true);
  });

  it('rejects malformed or mismatched basic auth', () => {
    expect(validateBasicCronAuth(makeRequest('Basic not-base64'))).toBe(false);
    expect(
      validateBasicCronAuth(makeRequest(makeBasicAuth('cron-user', 'bad')))
    ).toBe(false);
  });

  it('advertises both supported auth schemes on 401', () => {
    const response = createCronUnauthorizedResponse();

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
    expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
  });
});
