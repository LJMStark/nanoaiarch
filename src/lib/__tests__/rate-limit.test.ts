import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
const getDbMock = vi.fn(async () => ({
  execute: executeMock,
}));

vi.mock('@/db', () => ({
  getDb: getDbMock,
}));

describe('applyRateLimit', () => {
  beforeEach(() => {
    executeMock.mockReset();
    getDbMock.mockClear();
  });

  it('uses the shared database store and returns remaining quota', async () => {
    executeMock.mockResolvedValueOnce([
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
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      limit: 3,
      remaining: 2,
      resetAt: new Date('2026-04-23T16:30:00.000Z').getTime(),
    });
  });

  it('blocks requests once the shared counter reaches the limit', async () => {
    executeMock.mockResolvedValueOnce([
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
});
