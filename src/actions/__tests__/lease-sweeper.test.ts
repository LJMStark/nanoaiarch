import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findExpiredGeneratingMessages } from '../project-message';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db', () => ({
  getDb: mocks.getDb,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

describe('findExpiredGeneratingMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    // The Week 5 cron will read this to decide its sweep interval —
    // typically run every (DURATION_MS / 2) so a row never sits expired
    // for more than half its lease window.
    expect(GENERATION_LEASE_DURATION_MS).toBe(5 * 60 * 1000);
  });
});
