import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyReferral, completeReferral } from '../referral';

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
      signupBonus: {
        enable: true,
        amount: 20,
        expireDays: 30,
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

describe('applyReferral idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addCredits.mockResolvedValue(true);
  });

  function createApplyReferralDb(opts: {
    /** Existing referrer record (lookup by code). */
    referrer: { id: string };
    /** Existing referral row, if any (simulating prior partial-write). */
    existingReferral?: {
      id: string;
      referrerId: string;
      referredId: string;
      status: string;
    } | null;
  }) {
    let selectCall = 0;
    const limit = vi.fn().mockImplementation(async () => {
      selectCall += 1;
      // Call 1: validateReferralCode looks up the referrer by code.
      if (selectCall === 1) return [opts.referrer];
      // Call 2: applyReferral checks for an existing referral row.
      return opts.existingReferral ? [opts.existingReferral] : [];
    });
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit,
    });
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    return { select, insert, update };
  }

  it('uses an invoice-scoped idempotency key for the signup bonus', async () => {
    // First-time apply: no existing referral row, so we insert one and grant
    // the bonus with idempotencyKey = `referral-signup:${referralRow.id}`.
    const db = createApplyReferralDb({
      referrer: { id: 'referrer-1' },
      existingReferral: null,
    });
    mocks.getDb.mockResolvedValue(db);

    await expect(applyReferral('user-new', 'CODE123')).resolves.toEqual({
      success: true,
    });

    expect(mocks.addCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-new',
        amount: 20,
        idempotencyKey: expect.stringMatching(/^referral-signup:/),
      })
    );
  });

  it('still grants the signup bonus on retry when referral row exists from a prior partial write', async () => {
    // FINDING-C4 follow-up: previously a partial failure (referral inserted
    // but bonus throw) would leave the user permanently bonus-less because
    // the second call early-returned with "User was already referred".
    // After the fix, the second call falls through to the bonus grant —
    // which is now idempotent via `referral-signup:${referralRow.id}`.
    const db = createApplyReferralDb({
      referrer: { id: 'referrer-1' },
      existingReferral: {
        id: 'referral-existing',
        referrerId: 'referrer-1',
        referredId: 'user-new',
        status: 'pending',
      },
    });
    mocks.getDb.mockResolvedValue(db);

    await expect(applyReferral('user-new', 'CODE123')).resolves.toEqual({
      success: true,
    });

    // No new referral row inserted (we found the prior one).
    expect(db.insert).not.toHaveBeenCalled();
    // Bonus grant still attempted with the existing row's id as key.
    expect(mocks.addCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'referral-signup:referral-existing',
      })
    );
  });

  it('rejects when an existing referral row points to a different referrer', async () => {
    // Defensive: if referredId already maps to a different referrer, do NOT
    // silently grant a bonus — surface the conflict.
    const db = createApplyReferralDb({
      referrer: { id: 'referrer-2' },
      existingReferral: {
        id: 'referral-old',
        referrerId: 'referrer-1',
        referredId: 'user-new',
        status: 'pending',
      },
    });
    mocks.getDb.mockResolvedValue(db);

    await expect(applyReferral('user-new', 'OTHERCODE')).resolves.toEqual({
      success: false,
      error: 'User was already referred',
    });
    expect(mocks.addCredits).not.toHaveBeenCalled();
  });
});
