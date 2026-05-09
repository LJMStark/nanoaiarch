import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLifetimeInitialCredits,
  buildLifetimeInitialIdempotencyKey,
} from '../credits';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isAdminUser: vi.fn(),
  findPlanByPriceId: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/admin', () => ({
  isAdminUser: mocks.isAdminUser,
}));

vi.mock('@/lib/price-plan', () => ({
  findPlanByPriceId: mocks.findPlanByPriceId,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

// Mirrors the addCredits transaction shape used in add-credits.test.ts so
// addLifetimeInitialCredits can drive its delegated addCredits call through
// real code without touching a database.
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
  const insertOnConflict = vi
    .fn()
    .mockReturnValue({ returning: insertReturning });
  const insertValues = vi
    .fn()
    .mockReturnValue({ onConflictDoNothing: insertOnConflict });
  const insertChain = { values: insertValues };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    insert: vi.fn().mockReturnValue(insertChain),
    __selectChain: selectChain,
    __insertValues: insertValues,
    __insertReturning: insertReturning,
  };
}

describe('addLifetimeInitialCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdminUser.mockResolvedValue(false);
  });

  it('throws when invoiceId is empty', async () => {
    await expect(
      addLifetimeInitialCredits('user-1', 'price-lifetime', '')
    ).rejects.toThrow('invoiceId required');
  });

  it('returns false when plan is not lifetime', async () => {
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: false,
      credits: { enable: true, amount: 100 },
    });

    const result = await addLifetimeInitialCredits(
      'user-1',
      'price-not-lifetime',
      'invoice-1'
    );

    expect(result).toBe(false);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('returns false when lifetime plan is disabled', async () => {
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: true,
      disabled: true,
      credits: { enable: true, amount: 1000 },
    });

    const result = await addLifetimeInitialCredits(
      'user-1',
      'price-lifetime',
      'invoice-1'
    );

    expect(result).toBe(false);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it('grants credits with invoice-scoped idempotency key on first webhook', async () => {
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: true,
      disabled: false,
      credits: { enable: true, amount: 1000, expireDays: 0 },
    });

    const tx = createMockTx();
    tx.__insertReturning.mockResolvedValue([{ id: 'txn-lifetime-1' }]);
    tx.__selectChain.limit.mockResolvedValue([{ id: 'credit-row-1' }]);
    mocks.getDb.mockResolvedValue({
      transaction: async (cb: (value: typeof tx) => Promise<void>) => cb(tx),
    });

    const result = await addLifetimeInitialCredits(
      'user-1',
      'price-lifetime',
      'invoice-abc'
    );

    expect(result).toBe(true);
    // Verify the insert payload used the invoice-scoped idempotency key.
    expect(tx.__insertValues).toHaveBeenCalledTimes(1);
    const insertedRow = tx.__insertValues.mock.calls[0][0];
    expect(insertedRow.idempotencyKey).toBe('lifetime-init:invoice-abc');
    expect(insertedRow.userId).toBe('user-1');
    expect(insertedRow.amount).toBe(1000);
    expect(insertedRow.type).toBe('LIFETIME_MONTHLY');
    // Lifetime expireDays: 0 normalizes to undefined ("never expires"),
    // which addCredits in turn translates to expirationDate: undefined.
    expect(insertedRow.expirationDate).toBeUndefined();
  });

  it('honors finite expireDays when configured (e.g. 365 days)', async () => {
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: true,
      credits: { enable: true, amount: 1000, expireDays: 365 },
    });

    const tx = createMockTx();
    tx.__insertReturning.mockResolvedValue([{ id: 'txn-2' }]);
    tx.__selectChain.limit.mockResolvedValue([{ id: 'credit-row-2' }]);
    mocks.getDb.mockResolvedValue({
      transaction: async (cb: (value: typeof tx) => Promise<void>) => cb(tx),
    });

    await addLifetimeInitialCredits(
      'user-1',
      'price-lifetime',
      'invoice-finite'
    );

    const insertedRow = tx.__insertValues.mock.calls[0][0];
    expect(insertedRow.expirationDate).toBeInstanceOf(Date);
  });

  it('returns false when webhook is replayed (idempotency conflict)', async () => {
    // Webhook replay safety: same invoiceId arriving twice must not double-grant.
    mocks.findPlanByPriceId.mockReturnValue({
      isLifetime: true,
      credits: { enable: true, amount: 1000 },
    });

    const tx = createMockTx();
    // Empty returning indicates onConflictDoNothing absorbed the duplicate.
    tx.__insertReturning.mockResolvedValue([]);
    mocks.getDb.mockResolvedValue({
      transaction: async (cb: (value: typeof tx) => Promise<void>) => cb(tx),
    });

    const result = await addLifetimeInitialCredits(
      'user-1',
      'price-lifetime',
      'invoice-abc'
    );

    expect(result).toBe(false);
  });

  it('produces a stable idempotency key for the same invoice', () => {
    expect(buildLifetimeInitialIdempotencyKey('inv-1')).toBe(
      'lifetime-init:inv-1'
    );
    expect(buildLifetimeInitialIdempotencyKey('inv-2')).toBe(
      'lifetime-init:inv-2'
    );
  });
});
