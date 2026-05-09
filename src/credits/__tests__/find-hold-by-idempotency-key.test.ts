import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findHoldByIdempotencyKey } from '../credits';
import { HOLD_STATUS } from '../types';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: { credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() } },
}));

function createDbMock(rows: Array<{ id: string; holdStatus: string | null }>) {
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
    mocks.getDb.mockResolvedValue(
      createDbMock([{ id: 'hold-abc', holdStatus: HOLD_STATUS.PENDING }])
    );
    const result = await findHoldByIdempotencyKey('gen-hold:msg-1', 'u1');
    expect(result).toBe('hold-abc');
  });

  it('returns null when no hold matches', async () => {
    mocks.getDb.mockResolvedValue(createDbMock([]));
    const result = await findHoldByIdempotencyKey('gen-hold:nonexistent', 'u1');
    expect(result).toBeNull();
  });

  it('returns null when the hold is already terminal', async () => {
    mocks.getDb.mockResolvedValue(
      createDbMock([{ id: 'hold-abc', holdStatus: HOLD_STATUS.CONFIRMED }])
    );
    const result = await findHoldByIdempotencyKey('gen-hold:msg-1', 'u1');
    expect(result).toBeNull();
  });
});
