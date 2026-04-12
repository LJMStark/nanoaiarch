import { CreditBalanceReadError } from '@/credits/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCreditBalanceAction } from '../get-credit-balance';

const mocks = vi.hoisted(() => ({
  getUserCredits: vi.fn(),
}));

vi.mock('@/credits/credits', () => ({
  getUserCredits: mocks.getUserCredits,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: {
      error: vi.fn(),
    },
  },
}));

vi.mock('@/lib/safe-action', () => ({
  userActionClient: {
    action: vi.fn((fn) => fn),
  },
}));

describe('getCreditBalanceAction', () => {
  const ctx = { user: { id: 'user-1' } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns credits when lookup succeeds', async () => {
    mocks.getUserCredits.mockResolvedValue(18);

    const result = await getCreditBalanceAction({ ctx } as any);

    expect(result).toEqual({
      success: true,
      credits: 18,
    });
  });

  it('returns a safe domain error message when balance lookup fails', async () => {
    mocks.getUserCredits.mockRejectedValue(
      new CreditBalanceReadError('Failed to load credit balance')
    );

    const result = await getCreditBalanceAction({ ctx } as any);

    expect(result).toEqual({
      success: false,
      error: 'Failed to load credit balance',
    });
  });

  it('does not leak unexpected internal errors', async () => {
    mocks.getUserCredits.mockRejectedValue(new Error('database host down'));

    const result = await getCreditBalanceAction({ ctx } as any);

    expect(result).toEqual({
      success: false,
      error: 'Failed to fetch credit balance',
    });
  });
});
