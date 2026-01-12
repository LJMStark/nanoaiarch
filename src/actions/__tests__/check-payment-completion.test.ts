import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPaymentCompletionAction } from '../check-payment-completion';

// Mock dependencies
vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: {
      debug: vi.fn(),
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

// Import mocked modules
import { getDb } from '@/db';

describe('checkPaymentCompletionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return isPaid true when payment is completed', async () => {
    // Mock database to return paid payment
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 'payment-123',
          sessionId: 'session-123',
          paid: true,
          userId: 'user-123',
        },
      ]),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const result = await checkPaymentCompletionAction({
      parsedInput: { sessionId: 'session-123' },
    } as any);

    expect(result).toEqual({
      success: true,
      isPaid: true,
    });
  });

  it('should return isPaid false when payment is not completed', async () => {
    // Mock database to return unpaid payment
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 'payment-123',
          sessionId: 'session-123',
          paid: false,
          userId: 'user-123',
        },
      ]),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const result = await checkPaymentCompletionAction({
      parsedInput: { sessionId: 'session-123' },
    } as any);

    expect(result).toEqual({
      success: true,
      isPaid: false,
    });
  });

  it('should return isPaid false when session does not exist', async () => {
    // Mock database to return empty array
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const result = await checkPaymentCompletionAction({
      parsedInput: { sessionId: 'non-existent-session' },
    } as any);

    expect(result).toEqual({
      success: true,
      isPaid: false,
    });
  });

  it('should handle database errors gracefully', async () => {
    // Mock database to throw error
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const result = await checkPaymentCompletionAction({
      parsedInput: { sessionId: 'session-123' },
    } as any);

    expect(result).toEqual({
      success: false,
      error: 'Failed to check payment completion',
    });
  });
});
