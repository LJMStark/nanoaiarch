import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findHoldByIdempotencyKey } from '../credits';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: { credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() } },
}));

function createDbMock(rows: Array<{ id: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit,
        }),
      }),
    }),
  };
}

describe('findHoldByIdempotencyKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for empty inputs (defensive guard)', async () => {
    expect(await findHoldByIdempotencyKey('', 'u1')).toBeNull();
    expect(await findHoldByIdempotencyKey('key', '')).toBeNull();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('returns the holdId when a pending hold exists for the user', async () => {
    mocks.getDb.mockResolvedValue(createDbMock([{ id: 'hold-abc' }]));
    const result = await findHoldByIdempotencyKey('gen-hold:msg-1', 'u1');
    expect(result).toBe('hold-abc');
  });

  it('returns null when no hold matches (already released or terminal)', async () => {
    mocks.getDb.mockResolvedValue(createDbMock([]));
    const result = await findHoldByIdempotencyKey('gen-hold:nonexistent', 'u1');
    expect(result).toBeNull();
  });
});
