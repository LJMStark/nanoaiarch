import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCreditStatsAction } from '../get-credit-stats';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
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

describe('getCreditStatsAction', () => {
  const ctx = { user: { id: 'user-1' } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups expiring credits by the selected expiration day expression', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          expirationDate: new Date('2026-05-20T00:00:00.000Z'),
          totalAmount: 3,
        },
        {
          expirationDate: new Date('2026-06-01T00:00:00.000Z'),
          totalAmount: 5,
        },
      ]),
    };

    mocks.getDb.mockResolvedValue(query);

    const result = await getCreditStatsAction({ ctx } as any);

    expect(result).toEqual({
      success: true,
      data: {
        expiringCredits: {
          amount: 8,
          breakdown: [
            { date: '2026-05-20', amount: 3 },
            { date: '2026-06-01', amount: 5 },
          ],
        },
      },
    });

    const selectedExpirationDay = query.select.mock.calls[0][0].expirationDate;
    expect(query.groupBy).toHaveBeenCalledWith(selectedExpirationDay);
    expect(query.orderBy).toHaveBeenCalledWith(selectedExpirationDay);
  });

  it('returns an error response when stats lookup fails', async () => {
    mocks.getDb.mockRejectedValue(new Error('database failed'));

    const result = await getCreditStatsAction({ ctx } as any);

    expect(result).toEqual({
      success: false,
      error: 'database failed',
    });
  });
});
