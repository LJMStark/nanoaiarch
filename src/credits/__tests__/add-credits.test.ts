import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCredits } from '../credits';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isAdminUser: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/admin', () => ({
  isAdminUser: mocks.isAdminUser,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

function createMockTx() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const insertReturning = vi.fn();
  const insertOnConflict = vi.fn().mockReturnValue({
    returning: insertReturning,
  });

  const insertValues = vi.fn().mockReturnValue({
    onConflictDoNothing: insertOnConflict,
  });

  const insertChain = {
    values: insertValues,
  };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    insert: vi.fn().mockReturnValue(insertChain),
    __selectChain: selectChain,
    __updateChain: updateChain,
    __insertValues: insertValues,
    __insertReturning: insertReturning,
  };
}

describe('addCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false and skips balance mutation when idempotency key already exists', async () => {
    const tx = createMockTx();
    tx.__insertReturning.mockResolvedValue([]);

    mocks.getDb.mockResolvedValue({
      transaction: async (callback: (value: typeof tx) => Promise<void>) =>
        callback(tx),
    });

    const result = await addCredits({
      userId: 'user-1',
      amount: 10,
      type: 'monthly_refresh',
      description: 'Monthly refresh credits',
      idempotencyKey: 'credit-grant:monthly_refresh:user-1:2026-3',
    });

    expect(result).toBe(false);
    expect(tx.select).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('updates existing credit balance when the idempotency key is new', async () => {
    const tx = createMockTx();
    tx.__insertReturning.mockResolvedValue([{ id: 'txn-1' }]);
    tx.__selectChain.limit.mockResolvedValue([{ id: 'credit-row-1' }]);

    mocks.getDb.mockResolvedValue({
      transaction: async (callback: (value: typeof tx) => Promise<void>) =>
        callback(tx),
    });

    const result = await addCredits({
      userId: 'user-1',
      amount: 10,
      type: 'monthly_refresh',
      description: 'Monthly refresh credits',
      idempotencyKey: 'credit-grant:monthly_refresh:user-1:2026-3',
    });

    expect(result).toBe(true);
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.__updateChain.where).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
