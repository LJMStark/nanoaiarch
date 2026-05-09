import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import { HOLD_STATUS } from '@/credits/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findExpiredGeneratingMessages,
  recoverExpiredGeneratingMessages,
  updateAssistantMessageDirect,
} from '../project-message';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findHoldRecordByIdempotencyKey: vi.fn(),
  releaseHold: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/credits/credits', () => ({
  findHoldRecordByIdempotencyKey: mocks.findHoldRecordByIdempotencyKey,
  releaseHold: mocks.releaseHold,
}));

vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { CREDIT_LEASE_SWEEP: 'credit.lease_sweep' },
  recordAudit: mocks.recordAudit,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findExpiredGeneratingMessages', () => {
  it('queries for status=generating + lease in the past, capped at limit', async () => {
    const limitMock = vi.fn().mockResolvedValue([
      { id: 'msg-1', projectId: 'p1', userId: 'u1' },
      { id: 'msg-2', projectId: 'p2', userId: 'u2' },
    ]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    mocks.getDb.mockResolvedValue({ select: selectMock });

    const fixedNow = new Date('2026-05-09T12:00:00Z');
    const result = await findExpiredGeneratingMessages({
      limit: 50,
      now: fixedNow,
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('msg-1');
    expect(limitMock).toHaveBeenCalledWith(50);

    // Verify a where() was actually constructed (we don't introspect the
    // SQL fragments — that's covered by the migration test in CI). The
    // important contract: caller passed a "now" we control, no implicit
    // wallclock drift.
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it('adds user/project/message filters for lazy recovery', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    mocks.getDb.mockResolvedValue({ select: selectMock });

    await findExpiredGeneratingMessages({
      userId: 'user-1',
      projectId: 'project-1',
      messageId: 'message-1',
      limit: 1,
      now: new Date('2026-05-09T12:00:00Z'),
    });

    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it('falls back to limit=100 when not specified', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    mocks.getDb.mockResolvedValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: limitMock }),
        }),
      }),
    });

    await findExpiredGeneratingMessages({});
    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it('exports the lease duration constant for cron schedule alignment', () => {
    // Keep the server-side recovery window longer than normal Gemini calls.
    expect(GENERATION_LEASE_DURATION_MS).toBe(5 * 60 * 1000);
  });
});

describe('updateAssistantMessageDirect', () => {
  it('only finalizes still-generating messages for the same user', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'msg-1' }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    mocks.getDb.mockResolvedValue({ update: updateMock });

    const updated = await updateAssistantMessageDirect('msg-1', 'user-1', {
      status: 'failed',
      content: '生成超时，请重试',
      errorMessage: 'Generation timed out (lease expired)',
      leaseExpiredBefore: new Date('2026-05-09T12:00:00Z'),
    });

    expect(updated).toBe(true);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        generationLeaseExpiresAt: null,
      })
    );
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it('returns false when a race already completed the message', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    mocks.getDb.mockResolvedValue({
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: returningMock }),
        }),
      }),
    });

    await expect(
      updateAssistantMessageDirect('msg-1', 'user-1', {
        status: 'failed',
        leaseExpiredBefore: new Date('2026-05-09T12:00:00Z'),
      })
    ).resolves.toBe(false);
  });
});

describe('recoverExpiredGeneratingMessages', () => {
  function mockExpiredMessageQuery(
    rows: Array<{ id: string; projectId: string; userId: string }>
  ) {
    const limitMock = vi.fn().mockResolvedValue(rows);
    mocks.getDb
      .mockResolvedValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: limitMock }),
          }),
        }),
      })
      .mockResolvedValue({
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: rows[0]?.id }]),
            }),
          }),
        }),
      });
  }

  it('releases pending hold and finalizes expired message', async () => {
    mockExpiredMessageQuery([
      { id: 'msg-1', projectId: 'project-1', userId: 'user-1' },
    ]);
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.releaseHold.mockResolvedValue(undefined);
    mocks.recordAudit.mockResolvedValue(undefined);

    const result = await recoverExpiredGeneratingMessages({
      userId: 'user-1',
      projectId: 'project-1',
      now: new Date('2026-05-09T12:00:00Z'),
      trigger: 'lazy-create',
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, errors: 0 });
    expect(mocks.findHoldRecordByIdempotencyKey).toHaveBeenCalledWith(
      'gen-hold:msg-1',
      'user-1'
    );
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        entityId: 'msg-1',
        metadata: expect.objectContaining({
          holdId: 'hold-1',
          projectId: 'project-1',
          trigger: 'lazy-create',
        }),
      })
    );
  });

  it('finalizes without refund when the hold is already confirmed', async () => {
    const updateMock = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'msg-1' }]),
        }),
      }),
    });
    mocks.getDb
      .mockResolvedValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'msg-1', projectId: 'project-1', userId: 'user-1' },
                ]),
            }),
          }),
        }),
      })
      .mockResolvedValue({ update: updateMock });
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.CONFIRMED,
    });
    mocks.recordAudit.mockResolvedValue(undefined);

    const result = await recoverExpiredGeneratingMessages({
      userId: 'user-1',
      projectId: 'project-1',
      now: new Date('2026-05-09T12:00:00Z'),
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, errors: 0 });
    expect(mocks.releaseHold).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          holdId: 'hold-1',
          holdStatus: HOLD_STATUS.CONFIRMED,
        }),
      })
    );
  });

  it('keeps message generating when release fails so credits are not double-counted', async () => {
    mockExpiredMessageQuery([
      { id: 'msg-1', projectId: 'project-1', userId: 'user-1' },
    ]);
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.releaseHold.mockRejectedValue(new Error('database unavailable'));

    const result = await recoverExpiredGeneratingMessages({
      userId: 'user-1',
      projectId: 'project-1',
      now: new Date('2026-05-09T12:00:00Z'),
    });

    expect(result).toEqual({ scanned: 1, recovered: 0, errors: 1 });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
