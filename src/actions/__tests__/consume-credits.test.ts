import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeCreditsAction } from '../consume-credits';

const mocks = vi.hoisted(() => ({
  consumeCredits: vi.fn(),
}));

vi.mock('@/credits/credits', () => ({
  consumeCredits: mocks.consumeCredits,
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
    schema: vi.fn().mockReturnValue({
      action: vi.fn((fn) => fn),
    }),
  },
}));

describe('consumeCreditsAction', () => {
  const ctx = { user: { id: 'user-1' } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the default description when one is not provided', async () => {
    mocks.consumeCredits.mockResolvedValue(undefined);

    const result = await consumeCreditsAction({
      parsedInput: { amount: 3 },
      ctx,
    } as any);

    expect(result).toEqual({ success: true });
    expect(mocks.consumeCredits).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 3,
      description: 'Consume credits: 3',
    });
  });

  it('returns the domain error when consumption fails', async () => {
    mocks.consumeCredits.mockRejectedValue(new Error('Insufficient credits'));

    const result = await consumeCreditsAction({
      parsedInput: { amount: 3, description: 'manual charge' },
      ctx,
    } as any);

    expect(result).toEqual({
      success: false,
      error: 'Insufficient credits',
    });
  });
});
