import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import { HOLD_STATUS } from '@/credits/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findExpiredGeneratingMessages,
  getMessageStatus,
  recoverExpiredGeneratingMessages,
  updateAssistantMessageDirect,
} from '../project-message';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findHoldRecordByIdempotencyKey: vi.fn(),
  findLatestHoldRecordByIdempotencyKeyPrefix: vi.fn(),
  confirmHold: vi.fn(),
  releaseHold: vi.fn(),
  getDuomiImageTaskStatus: vi.fn(),
  recordAudit: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/credits/credits', () => ({
  confirmHold: mocks.confirmHold,
  findHoldRecordByIdempotencyKey: mocks.findHoldRecordByIdempotencyKey,
  findLatestHoldRecordByIdempotencyKeyPrefix:
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix,
  releaseHold: mocks.releaseHold,
}));

vi.mock('@/ai/image/lib/duomi-client', () => ({
  getDuomiImageTaskStatus: mocks.getDuomiImageTaskStatus,
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

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue(null);
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
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
    const returningMock = vi.fn().mockResolvedValue([
      {
        id: 'msg-1',
        projectId: 'project-1',
        role: 'assistant',
        content: '生成超时，请重试',
        inputImage: null,
        inputImages: null,
        outputImage: null,
        maskImage: null,
        generationParams: null,
        creditsUsed: 0,
        generationTime: null,
        status: 'failed',
        errorMessage: '生成超时，请重试',
        generationLeaseExpiresAt: null,
        orderIndex: 1,
        createdAt: new Date('2026-05-09T12:00:00Z'),
      },
    ]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });
    mocks.getDb.mockResolvedValue({ update: updateMock });

    const updated = await updateAssistantMessageDirect('msg-1', 'user-1', {
      status: 'failed',
      content: '生成超时，请重试',
      errorMessage: '生成超时，请重试',
      leaseExpiredBefore: new Date('2026-05-09T12:00:00Z'),
    });

    expect(updated?.id).toBe('msg-1');
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
    ).resolves.toBeNull();
  });
});

describe('recoverExpiredGeneratingMessages', () => {
  function createExpiredMessageRow(overrides: {
    id: string;
    projectId: string;
    userId: string;
    generationParams?: string | null;
  }) {
    return {
      id: overrides.id,
      projectId: overrides.projectId,
      userId: overrides.userId,
      status: 'generating',
      outputImage: null,
      errorMessage: null,
      creditsUsed: null,
      generationTime: null,
      generationLeaseExpiresAt: new Date('2026-05-09T11:59:00Z'),
      updatedAt: new Date('2026-05-09T11:58:00Z'),
      generationParams: overrides.generationParams ?? null,
    };
  }

  function mockExpiredMessageQuery(
    rows: Array<ReturnType<typeof createExpiredMessageRow>>
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
      createExpiredMessageRow({
        id: 'msg-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ]);
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue(null);
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

  it('releases the latest retry hold when attempt-scoped idempotency is used', async () => {
    mockExpiredMessageQuery([
      createExpiredMessageRow({
        id: 'msg-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ]);
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue(null);
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue({
      id: 'hold-attempt-2',
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
    expect(
      mocks.findLatestHoldRecordByIdempotencyKeyPrefix
    ).toHaveBeenCalledWith('gen-hold:msg-1:', 'user-1');
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-attempt-2');
  });

  it('prefers a pending retry hold over a released legacy message hold', async () => {
    mockExpiredMessageQuery([
      createExpiredMessageRow({
        id: 'msg-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
    ]);
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue({
      id: 'released-legacy-hold',
      holdStatus: HOLD_STATUS.RELEASED,
    });
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue({
      id: 'hold-attempt-2',
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
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-attempt-2');
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          holdId: 'hold-attempt-2',
          holdStatus: HOLD_STATUS.PENDING,
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
              limit: vi.fn().mockResolvedValue([
                createExpiredMessageRow({
                  id: 'msg-1',
                  projectId: 'project-1',
                  userId: 'user-1',
                }),
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
      createExpiredMessageRow({
        id: 'msg-1',
        projectId: 'project-1',
        userId: 'user-1',
      }),
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

  it('settles an expired Duomi task before treating the lease as timed out', async () => {
    const completedAt = new Date('2026-05-11T08:00:00Z');
    const completedRow = {
      id: 'msg-1',
      status: 'completed',
      outputImage: 'https://cdn.example.com/generated.png',
      errorMessage: null,
      creditsUsed: 1,
      generationTime: 10_000,
      generationLeaseExpiresAt: null,
      updatedAt: completedAt,
    };
    const messageReturningMock = vi.fn().mockResolvedValue([completedRow]);
    const updateMock = vi
      .fn()
      .mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: messageReturningMock,
          }),
        }),
      })
      .mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
    const transactionMock = vi.fn(async (callback) => {
      return await callback({
        update: updateMock,
      });
    });
    const expiredRow = createExpiredMessageRow({
      id: 'msg-1',
      projectId: 'project-1',
      userId: 'user-1',
      generationParams: JSON.stringify({
        prompt: 'draw a chair',
        model: 'gpt-image-2',
        duomiTaskId: 'task-1',
        duomiTaskStatus: 'running',
        duomiTaskStartedAt: '2026-05-11T07:59:50Z',
      }),
    });
    mocks.getDb
      .mockResolvedValueOnce({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([expiredRow]),
            }),
          }),
        }),
      })
      .mockResolvedValue({
        transaction: transactionMock,
      });
    mocks.getDuomiImageTaskStatus.mockResolvedValue({
      status: 'succeeded',
      image: 'https://cdn.example.com/generated.png',
    });
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue(null);
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.confirmHold.mockResolvedValue(undefined);
    mocks.recordAudit.mockResolvedValue(undefined);

    const result = await recoverExpiredGeneratingMessages({
      userId: 'user-1',
      projectId: 'project-1',
      now: new Date('2026-05-11T08:05:00Z'),
      trigger: 'lazy-project',
    });

    expect(result).toEqual({ scanned: 1, recovered: 1, errors: 0 });
    expect(mocks.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.releaseHold).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          resolution: 'duomi-completed',
        }),
      })
    );
  });
});

describe('getMessageStatus Duomi polling', () => {
  const generatingMessageRow = {
    id: 'msg-1',
    status: 'generating',
    outputImage: null,
    errorMessage: null,
    creditsUsed: null,
    generationTime: null,
    generationParams: JSON.stringify({
      prompt: 'draw a chair',
      model: 'gpt-image-2',
      duomiTaskId: 'task-1',
      duomiTaskStatus: 'pending',
      duomiTaskStartedAt: new Date(Date.now() - 10_000).toISOString(),
    }),
    generationLeaseExpiresAt: new Date(Date.now() + 60_000),
    updatedAt: new Date(),
  };

  function mockStatusSelect(row = generatingMessageRow) {
    return vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([row]),
        }),
      }),
    });
  }

  function mockExpiredQuerySelect() {
    return vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  }

  function mockUpdateReturning(row: Record<string, unknown>) {
    return vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([row]),
        }),
      }),
    });
  }

  function mockCompletionTransactionDb(row: Record<string, unknown>) {
    const messageReturningMock = vi.fn().mockResolvedValue([row]);
    const projectWhereMock = vi.fn().mockResolvedValue(undefined);
    const projectSetMock = vi.fn().mockReturnValue({ where: projectWhereMock });
    const updateMock = vi
      .fn()
      .mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: messageReturningMock,
          }),
        }),
      })
      .mockReturnValueOnce({
        set: projectSetMock,
      });
    const transactionMock = vi.fn(async (callback) => {
      return await callback({
        update: updateMock,
      });
    });

    return {
      db: {
        select: mockStatusSelect(),
        transaction: transactionMock,
      },
      updateMock,
      messageReturningMock,
      projectSetMock,
      projectWhereMock,
      transactionMock,
    };
  }

  it('confirms the hold and completes the message when the Duomi task succeeds', async () => {
    const completedAt = new Date('2026-05-11T08:00:00Z');
    const completionDb = mockCompletionTransactionDb({
      id: 'msg-1',
      status: 'completed',
      outputImage: 'https://cdn.example.com/generated.png',
      errorMessage: null,
      creditsUsed: 1,
      generationTime: 10_000,
      generationLeaseExpiresAt: null,
      updatedAt: completedAt,
    });

    mocks.getDb
      .mockResolvedValueOnce({
        select: mockExpiredQuerySelect(),
      })
      .mockResolvedValue(completionDb.db);
    mocks.getDuomiImageTaskStatus.mockResolvedValue({
      status: 'succeeded',
      image: 'https://cdn.example.com/generated.png',
    });
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue(null);
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.confirmHold.mockResolvedValue(undefined);

    const result = await getMessageStatus('project-1', 'msg-1');

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
    expect(result.data?.outputImage).toBe(
      'https://cdn.example.com/generated.png'
    );
    expect(mocks.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.releaseHold).not.toHaveBeenCalled();
    expect(completionDb.transactionMock).toHaveBeenCalledTimes(1);
    expect(completionDb.updateMock).toHaveBeenCalledTimes(2);
    expect(completionDb.projectSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'https://cdn.example.com/generated.png',
      })
    );
  });

  it('releases the hold and fails the message when the Duomi task fails', async () => {
    const failedAt = new Date('2026-05-11T08:01:00Z');
    const updateMock = mockUpdateReturning({
      id: 'msg-1',
      status: 'failed',
      outputImage: null,
      errorMessage: '生成失败，请重试',
      creditsUsed: null,
      generationTime: null,
      generationLeaseExpiresAt: null,
      updatedAt: failedAt,
    });

    mocks.getDb
      .mockResolvedValueOnce({
        select: mockExpiredQuerySelect(),
      })
      .mockResolvedValue({
        select: mockStatusSelect(),
        update: updateMock,
      });
    mocks.getDuomiImageTaskStatus.mockResolvedValue({
      status: 'failed',
      error: '生成失败，请重试',
    });
    mocks.findHoldRecordByIdempotencyKey.mockResolvedValue(null);
    mocks.findLatestHoldRecordByIdempotencyKeyPrefix.mockResolvedValue({
      id: 'hold-1',
      holdStatus: HOLD_STATUS.PENDING,
    });
    mocks.releaseHold.mockResolvedValue(undefined);

    const result = await getMessageStatus('project-1', 'msg-1');

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('failed');
    expect(result.data?.errorMessage).toBe('生成失败，请重试');
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.confirmHold).not.toHaveBeenCalled();
  });
});
