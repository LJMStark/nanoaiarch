import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findHoldByIdempotencyKey,
  findLatestHoldRecordByIdempotencyKeyPrefix,
} from '../credits';
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
  const orderBy = vi.fn().mockReturnValue({ limit });
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit,
          orderBy,
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

describe('findLatestHoldRecordByIdempotencyKeyPrefix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the latest hold matching a message-scoped prefix for recovery', async () => {
    mocks.getDb.mockResolvedValue(
      createDbMock([{ id: 'hold-latest', holdStatus: HOLD_STATUS.PENDING }])
    );

    const result = await findLatestHoldRecordByIdempotencyKeyPrefix(
      'gen-hold:msg-1:',
      'u1'
    );

    expect(result).toEqual({
      id: 'hold-latest',
      holdStatus: HOLD_STATUS.PENDING,
    });
  });

  it('returns null for empty inputs', async () => {
    expect(
      await findLatestHoldRecordByIdempotencyKeyPrefix('', 'u1')
    ).toBeNull();
    expect(
      await findLatestHoldRecordByIdempotencyKeyPrefix('gen-hold:msg-1:', '')
    ).toBeNull();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
