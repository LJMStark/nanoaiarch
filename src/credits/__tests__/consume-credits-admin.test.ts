import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeCredits } from '../credits';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isAdminUser: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/admin', () => ({
  isAdminUser: mocks.isAdminUser,
}));

vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { CREDIT_ADMIN_BYPASS: 'credit.admin_bypass' },
  recordAudit: mocks.recordAudit,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    credits: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
  },
}));

describe('consumeCredits admin audit path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an audit USAGE row with adminBypass metadata, never mutates balance', async () => {
    // Behavioral contract under test:
    //   1. Admin call must NOT use a transaction (no balance/ledger work)
    //   2. Admin call MUST insert a USAGE row tagged with adminBypass=true
    //      so the operation is auditable later (Week 5 audit_log table will
    //      query this metadata flag).
    mocks.isAdminUser.mockResolvedValue(true);
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
      transaction: vi.fn(),
    };
    mocks.getDb.mockResolvedValue(db);

    await consumeCredits({
      userId: 'admin-1',
      amount: 3,
      description: 'admin generation',
    });

    // No transaction → no reserve/allocate work.
    expect(db.transaction).not.toHaveBeenCalled();

    // Single audit insert with the marker metadata.
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.userId).toBe('admin-1');
    expect(inserted.amount).toBe(-3);
    expect(inserted.metadata).toBe('{"adminBypass":true}');
    expect(inserted.type).toBe('USAGE');
  });

  it('takes the transaction path for non-admin users (no audit shortcut)', async () => {
    // We only verify that non-admins do NOT hit the audit-only branch.
    // The full reserve/allocate flow is tested elsewhere via the existing
    // credit-hold tests.
    mocks.isAdminUser.mockResolvedValue(false);
    const auditInsert = vi.fn();
    const db = {
      insert: auditInsert,
      transaction: vi.fn().mockImplementation(async () => {
        // Throw to short-circuit the regular flow without needing a full tx
        // mock. The point of this test is to assert we even REACHED the
        // transaction path rather than the audit shortcut.
        throw new Error('regular path entered');
      }),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(
      consumeCredits({
        userId: 'user-1',
        amount: 3,
        description: 'normal generation',
      })
    ).rejects.toThrow('regular path entered');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    // Critical: audit shortcut must not fire for non-admins.
    expect(auditInsert).not.toHaveBeenCalled();
  });
});
