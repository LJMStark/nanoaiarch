import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    general: { error: mocks.loggerError, info: vi.fn(), debug: vi.fn() },
  },
}));

describe('recordAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('inserts a row with all provided fields and a generated id', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue({
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
    });

    const { recordAudit, AUDIT_ACTIONS } = await import('../audit');
    await recordAudit({
      userId: 'u1',
      actorId: 'admin-1',
      action: AUDIT_ACTIONS.ADMIN_BAN_USER,
      entityType: 'user',
      entityId: 'u1',
      metadata: { reason: 'spam' },
    });

    expect(valuesMock).toHaveBeenCalledTimes(1);
    const row = valuesMock.mock.calls[0][0];
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(row.userId).toBe('u1');
    expect(row.actorId).toBe('admin-1');
    expect(row.action).toBe('admin.ban_user');
    expect(row.entityType).toBe('user');
    expect(row.entityId).toBe('u1');
    expect(row.metadata).toEqual({ reason: 'spam' });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('coerces missing optional fields to null (not undefined)', async () => {
    // Drizzle's .values() requires each column to be present; null means
    // "explicitly empty", undefined means "omit". Audit always wants nulls
    // so the row's shape is consistent.
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue({
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
    });

    const { recordAudit } = await import('../audit');
    await recordAudit({
      userId: 'u1',
      action: 'credit.lease_sweep',
    });

    const row = valuesMock.mock.calls[0][0];
    expect(row.actorId).toBeNull();
    expect(row.entityType).toBeNull();
    expect(row.entityId).toBeNull();
    expect(row.metadata).toBeNull();
  });

  it('swallows DB errors and logs (audit must never abort the caller)', async () => {
    // The contract: audit failure should never throw out of recordAudit.
    // Otherwise an audit outage would cascade into refusing the primary
    // operation (credit grant, payment processing, etc.).
    mocks.getDb.mockResolvedValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('audit_log down')),
      }),
    });

    const { recordAudit } = await import('../audit');
    await expect(
      recordAudit({ userId: 'u1', action: 'credit.add' })
    ).resolves.toBeUndefined();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'recordAudit failed',
      expect.any(Error),
      expect.objectContaining({ action: 'credit.add', userId: 'u1' })
    );
  });
});
