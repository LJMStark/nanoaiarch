import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeReferral } from '../referral';

const mocks = vi.hoisted(() => ({
  addCredits: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('@/config/website', () => ({
  websiteConfig: {
    referral: {
      enable: true,
      commission: {
        enable: true,
        amount: 50,
        expireDays: 0,
      },
    },
  },
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

vi.mock('../credits', () => ({
  addCredits: mocks.addCredits,
}));

function createDbMock(referralRecord: Record<string, unknown> | undefined) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(referralRecord ? [referralRecord] : []),
  };

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({
    where: updateWhere,
  });

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue({
      set: updateSet,
    }),
    __updateSet: updateSet,
    __updateWhere: updateWhere,
  };
}

describe('completeReferral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addCredits.mockResolvedValue(true);
  });

  it('awards commission for an already qualified referral', async () => {
    const db = createDbMock({
      id: 'referral-1',
      referrerId: 'referrer-1',
      referredId: 'referred-1',
      status: 'qualified',
    });
    mocks.getDb.mockResolvedValue(db);

    await expect(completeReferral('referred-1')).resolves.toEqual({
      success: true,
    });

    expect(mocks.addCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'referrer-1',
        amount: 50,
        idempotencyKey: 'referral-commission:referral-1',
      })
    );
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('marks referral rewarded when commission was already applied', async () => {
    const db = createDbMock({
      id: 'referral-1',
      referrerId: 'referrer-1',
      referredId: 'referred-1',
      status: 'qualified',
    });
    mocks.getDb.mockResolvedValue(db);
    mocks.addCredits.mockResolvedValue(false);

    await expect(completeReferral('referred-1')).resolves.toEqual({
      success: true,
    });

    expect(db.update).toHaveBeenCalledTimes(1);
  });
});
