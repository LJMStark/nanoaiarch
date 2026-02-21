import { beforeEach, describe, expect, it, vi } from 'vitest';
import { holdCredits, confirmHold, releaseHold } from '../credits';
import { HOLD_STATUS } from '../types';

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
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

// Helper to create a mock transaction/db
function createMockDb() {
  const mockResult: { rows: Record<string, unknown>[] } = { rows: [] };
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
  };
  return chainable;
}

describe('holdCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdminUser.mockResolvedValue(false);
  });

  it('throws on invalid params', async () => {
    await expect(holdCredits({
      userId: '',
      amount: 1,
      idempotencyKey: 'key',
      description: 'test',
    })).rejects.toThrow('invalid params');
  });

  it('throws on invalid amount', async () => {
    await expect(holdCredits({
      userId: 'user-1',
      amount: 0,
      idempotencyKey: 'key',
      description: 'test',
    })).rejects.toThrow('invalid amount');
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
    db.limit.mockResolvedValueOnce([{ id: 'existing-hold', holdStatus: HOLD_STATUS.PENDING }]);
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
    db.limit.mockResolvedValueOnce([{ id: 'old-hold', holdStatus: HOLD_STATUS.CONFIRMED }]);
    mocks.getDb.mockResolvedValue(db);

    await expect(holdCredits({
      userId: 'user-1',
      amount: 1,
      idempotencyKey: 'used-key',
      description: 'test',
    })).rejects.toThrow('idempotency key already used');
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
    db.limit.mockResolvedValueOnce([{
      id: 'hold-1',
      userId: 'user-1',
      holdStatus: HOLD_STATUS.CONFIRMED,
      amount: -1,
    }]);
    mocks.getDb.mockResolvedValue(db);

    await expect(confirmHold('hold-1')).resolves.toBeUndefined();
  });

  it('throws when hold is already released', async () => {
    const db = createMockDb();
    db.limit.mockResolvedValueOnce([{
      id: 'hold-1',
      userId: 'user-1',
      holdStatus: HOLD_STATUS.RELEASED,
      amount: -1,
    }]);
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
    db.transaction.mockImplementation(async (fn: Function) => fn(db));
    db.limit.mockResolvedValueOnce([]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('nonexistent')).resolves.toBeUndefined();
  });

  it('is idempotent for already released holds', async () => {
    const db = createMockDb();
    db.transaction.mockImplementation(async (fn: Function) => fn(db));
    db.limit.mockResolvedValueOnce([{
      id: 'hold-1',
      userId: 'user-1',
      holdStatus: HOLD_STATUS.RELEASED,
      amount: -1,
    }]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('hold-1')).resolves.toBeUndefined();
  });

  it('throws when hold is already confirmed', async () => {
    const db = createMockDb();
    db.transaction.mockImplementation(async (fn: Function) => fn(db));
    db.limit.mockResolvedValueOnce([{
      id: 'hold-1',
      userId: 'user-1',
      holdStatus: HOLD_STATUS.CONFIRMED,
      amount: -1,
    }]);
    mocks.getDb.mockResolvedValue(db);

    await expect(releaseHold('hold-1')).rejects.toThrow('invalid hold status');
  });
});
