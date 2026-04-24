import { beforeEach, describe, expect, it, vi } from 'vitest';

const returningMock = vi.fn();
const onConflictDoUpdateMock = vi.fn(() => ({ returning: returningMock }));
const valuesMock = vi.fn(() => ({
  onConflictDoUpdate: onConflictDoUpdateMock,
}));
const insertMock = vi.fn(() => ({ values: valuesMock }));
const getDbMock = vi.fn(async () => ({
  insert: insertMock,
}));

vi.mock('@/db', () => ({
  getDb: getDbMock,
}));

describe('applyRateLimit', () => {
  beforeEach(() => {
    returningMock.mockReset();
    onConflictDoUpdateMock.mockClear();
    valuesMock.mockClear();
    insertMock.mockClear();
    getDbMock.mockClear();
  });

  it('uses the shared database store and returns remaining quota', async () => {
    returningMock.mockResolvedValueOnce([
      {
        count: 1,
        resetAt: new Date('2026-04-23T16:30:00.000Z'),
      },
    ]);

    const { applyRateLimit } = await import('../rate-limit');
    const result = await applyRateLimit({
      key: 'generate-images:user-1',
      limit: 3,
      windowMs: 60_000,
    });

    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(returningMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      limit: 3,
      remaining: 2,
      resetAt: new Date('2026-04-23T16:30:00.000Z').getTime(),
    });
  });

  it('blocks requests once the shared counter reaches the limit', async () => {
    returningMock.mockResolvedValueOnce([
      {
        count: 5,
        resetAt: new Date('2026-04-23T16:31:00.000Z'),
      },
    ]);

    const { applyRateLimit } = await import('../rate-limit');
    const result = await applyRateLimit({
      key: 'generate-images:user-1',
      limit: 4,
      windowMs: 60_000,
    });

    expect(result).toEqual({
      success: false,
      limit: 4,
      remaining: 0,
      resetAt: new Date('2026-04-23T16:31:00.000Z').getTime(),
    });
  });

  it('falls back to memory when the database rejects the query', async () => {
    returningMock.mockRejectedValueOnce(new Error('db down'));

    const { applyRateLimit } = await import('../rate-limit');
    const result = await applyRateLimit({
      key: 'generate-images:user-fallback',
      limit: 2,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.limit).toBe(2);
    expect(result.remaining).toBe(1);
  });
});
