import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGenerationStats } from '../generation-history';

const { getSessionMock, headersMock, getDbMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  headersMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('@/db', () => ({
  getDb: getDbMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: {
      error: vi.fn(),
    },
  },
}));

describe('getGenerationStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
    });
  });

  it('returns aggregated stats for the current user', async () => {
    const totalsQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([{ totalGenerations: 12, totalCreditsUsed: 34 }]),
    };
    const favoritesQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 5 }]),
    };
    const thisMonthQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 3 }]),
    };

    getDbMock.mockResolvedValue({
      select: vi
        .fn()
        .mockReturnValueOnce(totalsQuery)
        .mockReturnValueOnce(favoritesQuery)
        .mockReturnValueOnce(thisMonthQuery),
    });

    const result = await getGenerationStats();

    expect(result).toEqual({
      success: true,
      data: {
        totalGenerations: 12,
        totalCreditsUsed: 34,
        favoriteCount: 5,
        thisMonthGenerations: 3,
      },
    });
  });
});
