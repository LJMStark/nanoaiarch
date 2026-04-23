import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const getDbMock = vi.fn(async () => ({
  execute: executeMock,
}));
const subscribeMock = vi.fn();

vi.mock('@/db', () => ({
  getDb: getDbMock,
}));

vi.mock('@/newsletter', () => ({
  subscribe: subscribeMock,
}));

describe('processNewsletterSubscribeJobs', () => {
  beforeEach(() => {
    executeMock.mockReset();
    getDbMock.mockClear();
    subscribeMock.mockReset();
  });

  it('processes claimed jobs and marks them completed', async () => {
    executeMock
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          email: 'user@example.com',
          attempts: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    subscribeMock.mockResolvedValueOnce(true);

    const { processNewsletterSubscribeJobs } = await import('../jobs');
    const result = await processNewsletterSubscribeJobs({ limit: 10 });

    expect(subscribeMock).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
    });
  });

  it('schedules a retry when subscription fails', async () => {
    executeMock
      .mockResolvedValueOnce([
        {
          id: 'job-2',
          email: 'retry@example.com',
          attempts: 2,
        },
      ])
      .mockResolvedValueOnce([]);
    subscribeMock.mockRejectedValueOnce(new Error('boom'));

    const { processNewsletterSubscribeJobs } = await import('../jobs');
    const result = await processNewsletterSubscribeJobs({ limit: 10 });

    expect(result).toEqual({
      claimed: 1,
      processed: 1,
      succeeded: 0,
      failed: 1,
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('reclaims jobs whose processing lease has expired', async () => {
    const { buildClaimNewsletterSubscribeJobsSql } = await import('../jobs');
    const now = new Date('2026-04-23T16:30:00.000Z');
    const leaseExpiresAt = new Date('2026-04-23T16:40:00.000Z');
    const rendered = new PgDialect().sqlToQuery(
      buildClaimNewsletterSubscribeJobsSql({
        limit: 25,
        now,
        leaseExpiresAt,
      })
    );

    expect(rendered.sql).toContain(`"status" = 'processing'`);
    expect(rendered.sql).toContain(`"status" = 'failed'`);
    expect(rendered.sql).toContain('"lease_expires_at" <=');
    expect(rendered.params).toEqual(
      expect.arrayContaining([now, 25, leaseExpiresAt])
    );
  });
});
