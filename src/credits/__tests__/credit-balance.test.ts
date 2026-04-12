import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserCredits, updateUserCredits } from '../credits';
import { CreditBalanceReadError, CreditBalanceUpdateError } from '../types';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

describe('credit balance operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current credits when balance record exists', async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ currentCredits: 42 }]),
    };

    mocks.getDb.mockResolvedValue(db);

    await expect(getUserCredits('user-1')).resolves.toBe(42);
  });

  it('returns 0 when user has no balance record yet', async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    mocks.getDb.mockResolvedValue(db);

    await expect(getUserCredits('user-1')).resolves.toBe(0);
  });

  it('throws a domain error when balance lookup fails', async () => {
    mocks.getDb.mockRejectedValue(new Error('db unavailable'));
    const result = getUserCredits('user-1');

    await expect(result).rejects.toBeInstanceOf(CreditBalanceReadError);
    await expect(result).rejects.toThrow('Failed to load credit balance');
  });

  it('throws a domain error when balance update fails', async () => {
    const db = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error('write failed')),
    };

    mocks.getDb.mockResolvedValue(db);
    const result = updateUserCredits('user-1', 99);

    await expect(result).rejects.toBeInstanceOf(CreditBalanceUpdateError);
    await expect(result).rejects.toThrow('Failed to update credit balance');
  });
});
