import { creditTransaction, userCredit } from '@/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmHold, holdCredits, releaseHold } from '../credits';
import { CREDIT_TRANSACTION_TYPE, HOLD_STATUS } from '../types';

// Mock dependencies
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
    credits: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

// Helper to create a mock transaction/db
function createMockDb() {
  const mockResult: { rows: Record<string, unknown>[] } = { rows: [] };
  const returning = vi.fn().mockResolvedValue([{ id: 'updated-row' }]);
  const updateWhere = vi.fn().mockReturnValue({ returning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    returning,
    __updateSet: updateSet,
    __updateWhere: updateWhere,
    __updateReturning: returning,
  };
  return chainable;
}

function createMockTx() {
  const selectLimit = vi.fn();
  const selectOrderBy = vi.fn();
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: selectLimit,
    orderBy: selectOrderBy,
  };

  const updateReturning = vi.fn().mockResolvedValue([{ id: 'updated-row' }]);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update,
    insert,
    __selectLimit: selectLimit,
    __selectOrderBy: selectOrderBy,
    __updateSet: updateSet,
    __updateWhere: updateWhere,
    __updateReturning: updateReturning,
    __insertValues: insertValues,
  };
}

describe('holdCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdminUser.mockResolvedValue(false);
  });

  it('throws on invalid params', async () => {
    await expect(
      holdCredits({
        userId: '',
        amount: 1,
        idempotencyKey: 'key',
        description: 'test',
      })
    ).rejects.toThrow('invalid params');
  });

  it('throws on invalid amount', async () => {
    await expect(
      holdCredits({
        userId: 'user-1',
        amount: 0,
        idempotencyKey: 'key',
        description: 'test',
      })
    ).rejects.toThrow('invalid amount');
  });

  it('bypasses hold for admin users', async () => {
    mocks.isAdminUser.mockResolvedValue(true);

    const result = await holdCredits({
      userId: 'admin-1',
      amount: 5,
      idempotencyKey: 'key-1',
      description: 'test hold',
    });

    expect(result.userId).toBe('admin-1');
    expect(result.amount).toBe(5);
    expect(result.holdId).toBeDefined();
  });

  it('returns existing pending hold for duplicate idempotency key', async () => {
    const db = createMockDb();
    // First query: check idempotency key - return existing pending hold
    db.limit.mockResolvedValueOnce([
      { id: 'existing-hold', holdStatus: HOLD_STATUS.PENDING },
    ]);
    mocks.getDb.mockResolvedValue(db);

    const result = await holdCredits({
      userId: 'user-1',
      amount: 1,
      idempotencyKey: 'dup-key',
      description: 'test',
    });

    expect(result.holdId).toBe('existing-hold');
  });

  it('throws when idempotency key already confirmed', async () => {
    const db = createMockDb();
    db.limit.mockResolvedValueOnce([
      { id: 'old-hold', holdStatus: HOLD_STATUS.CONFIRMED },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(
      holdCredits({
        userId: 'user-1',
        amount: 1,
        idempotencyKey: 'used-key',
        description: 'test',
      })
    ).rejects.toThrow('idempotency key already used');
  });

  it('deducts credit ledger entries and stores allocations for release', async () => {
    const db = createMockDb();
    const tx = createMockTx();

    db.limit.mockResolvedValueOnce([]);
    db.transaction.mockImplementation(
      async (fn: (value: typeof tx) => unknown) => fn(tx)
    );
    tx.__updateReturning.mockResolvedValueOnce([{ id: 'credit-row-1' }]);
    tx.__selectOrderBy.mockResolvedValueOnce([
      {
        id: 'grant-1',
        remainingAmount: 3,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'grant-2',
        remainingAmount: 5,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    mocks.getDb.mockResolvedValue(db);

    await holdCredits({
      userId: 'user-1',
      amount: 5,
      idempotencyKey: 'hold-key-1',
      description: 'test hold',
    });

    expect(tx.update).toHaveBeenCalledWith(userCredit);
    expect(tx.update).toHaveBeenCalledWith(creditTransaction);
    expect(tx.update).toHaveBeenCalledTimes(3);

    const holdRecord = tx.__insertValues.mock.calls[0][0];
    expect(JSON.parse(holdRecord.metadata)).toEqual({
      allocations: [
        { transactionId: 'grant-1', amount: 3 },
        { transactionId: 'grant-2', amount: 2 },
      ],
    });
  });

  it('creates a reconciled ledger entry when legacy balance has no transactions', async () => {
    const db = createMockDb();
    const tx = createMockTx();

    db.limit.mockResolvedValueOnce([]);
    db.transaction.mockImplementation(
      async (fn: (value: typeof tx) => unknown) => fn(tx)
    );
    tx.__updateReturning.mockResolvedValueOnce([{ id: 'credit-row-1' }]);
    tx.__selectOrderBy.mockResolvedValueOnce([]);

    mocks.getDb.mockResolvedValue(db);

    await holdCredits({
      userId: 'user-1',
      amount: 1,
      idempotencyKey: 'legacy-balance-hold',
      description: 'test hold',
    });

    expect(tx.__insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: CREDIT_TRANSACTION_TYPE.BALANCE_RECONCILIATION,
        amount: 1,
        remainingAmount: 0,
      })
    );

    const holdRecord = tx.__insertValues.mock.calls.at(-1)?.[0];
    expect(JSON.parse(holdRecord.metadata)).toEqual({
      allocations: [
        {
          transactionId: expect.any(String),
          amount: 1,
        },
      ],
    });
  });

  it('throws when atomic balance reservation does not update a row', async () => {
    const db = createMockDb();
    const tx = createMockTx();

    db.limit.mockResolvedValueOnce([]);
    db.transaction.mockImplementation(
      async (fn: (value: typeof tx) => unknown) => fn(tx)
    );
    tx.__updateReturning.mockResolvedValueOnce([]);

    mocks.getDb.mockResolvedValue(db);

    await expect(
      holdCredits({
        userId: 'user-1',
        amount: 5,
        idempotencyKey: 'hold-key-2',
        description: 'test hold',
      })
    ).rejects.toThrow('Insufficient credits');
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

describe('confirmHold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on empty holdId', async () => {
    await expect(confirmHold('')).rejects.toThrow('holdId required');
  });

  it('silently succeeds when hold not found (admin case)', async () => {
    const db = createMockDb();
    db.limit.mockResolvedValueOnce([]);
    mocks.getDb.mockResolvedValue(db);

    await expect(confirmHold('nonexistent')).resolves.toBeUndefined();
  });

  it('is idempotent for already confirmed holds', async () => {
    const db = createMockDb();
    db.limit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.CONFIRMED,
        amount: -1,
      },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(confirmHold('hold-1')).resolves.toBeUndefined();
  });

  it('throws when hold is already released', async () => {
    const db = createMockDb();
    db.limit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.RELEASED,
        amount: -1,
      },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(confirmHold('hold-1')).rejects.toThrow('invalid hold status');
  });
});

describe('releaseHold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on empty holdId', async () => {
    await expect(releaseHold('')).rejects.toThrow('holdId required');
  });

  it('silently succeeds when hold not found (admin case)', async () => {
    const db = createMockDb();
    db.transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db)
    );
    db.limit.mockResolvedValueOnce([]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('nonexistent')).resolves.toBeUndefined();
  });

  it('is idempotent for already released holds', async () => {
    const db = createMockDb();
    db.transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db)
    );
    db.limit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.RELEASED,
        amount: -1,
      },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('hold-1')).resolves.toBeUndefined();
  });

  it('throws when hold is already confirmed', async () => {
    const db = createMockDb();
    db.transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
      fn(db)
    );
    db.limit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.CONFIRMED,
        amount: -1,
      },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('hold-1')).rejects.toThrow('invalid hold status');
  });

  it('restores allocated credit ledger entries before marking hold released', async () => {
    const db = createMockDb();
    const tx = createMockTx();
    db.transaction.mockImplementation(
      async (fn: (value: typeof tx) => unknown) => fn(tx)
    );
    tx.__selectLimit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.PENDING,
        amount: -5,
        metadata: JSON.stringify({
          allocations: [
            { transactionId: 'grant-1', amount: 3 },
            { transactionId: 'grant-2', amount: 2 },
          ],
        }),
      },
    ]);
    mocks.getDb.mockResolvedValue(db);

    await releaseHold('hold-1');

    expect(tx.update).toHaveBeenCalledWith(userCredit);
    expect(tx.update).toHaveBeenCalledWith(creditTransaction);
    expect(tx.update).toHaveBeenCalledTimes(4);
  });

  it('expires held credits instead of refunding when allocations cannot be restored', async () => {
    const db = createMockDb();
    const tx = createMockTx();
    db.transaction.mockImplementation(
      async (fn: (value: typeof tx) => unknown) => fn(tx)
    );
    tx.__selectLimit.mockResolvedValueOnce([
      {
        id: 'hold-1',
        userId: 'user-1',
        holdStatus: HOLD_STATUS.PENDING,
        amount: -5,
        metadata: JSON.stringify({
          allocations: [{ transactionId: 'grant-1', amount: 5 }],
        }),
      },
    ]);
    tx.__updateReturning.mockResolvedValueOnce([]);
    mocks.getDb.mockResolvedValue(db);

    await releaseHold('hold-1');

    expect(tx.update).not.toHaveBeenCalledWith(userCredit);
    expect(tx.__insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: CREDIT_TRANSACTION_TYPE.EXPIRE,
        amount: -5,
        remainingAmount: null,
        description: 'Expire held credits: 5',
      })
    );
    expect(tx.update).toHaveBeenCalledTimes(2);
  });
});
