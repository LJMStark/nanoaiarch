import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateCronAuth: vi.fn(),
  recoverExpiredGeneratingMessages: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({
  validateCronAuth: mocks.validateCronAuth,
  createCronUnauthorizedResponse: () =>
    new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/actions/project-message', () => ({
  recoverExpiredGeneratingMessages: mocks.recoverExpiredGeneratingMessages,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    api: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

function makeRequest(): Request {
  return new Request('http://test/api/cron/lease-sweep');
}

describe('GET /api/cron/lease-sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateCronAuth.mockReturnValue(true);
  });

  it('returns 401 when cron auth is missing/invalid', async () => {
    mocks.validateCronAuth.mockReturnValueOnce(false);
    const { GET } = await import('../route');

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.recoverExpiredGeneratingMessages).not.toHaveBeenCalled();
  });

  it('returns zero-counters response when nothing has expired', async () => {
    mocks.recoverExpiredGeneratingMessages.mockResolvedValue({
      scanned: 0,
      recovered: 0,
      errors: 0,
    });
    const { GET } = await import('../route');

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scanned).toBe(0);
    expect(body.swept).toBe(0);
    expect(body.errors).toBe(0);
    expect(typeof body.durationMs).toBe('number');
  });

  it('runs optional global recovery and maps recovered count to swept', async () => {
    mocks.recoverExpiredGeneratingMessages.mockResolvedValue({
      scanned: 2,
      recovered: 2,
      errors: 0,
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.scanned).toBe(2);
    expect(body.swept).toBe(2);
    expect(body.errors).toBe(0);
    expect(mocks.recoverExpiredGeneratingMessages).toHaveBeenCalledWith({
      limit: 200,
      trigger: 'cron',
    });
  });

  it('surfaces per-row errors from recovery summary', async () => {
    mocks.recoverExpiredGeneratingMessages.mockResolvedValue({
      scanned: 3,
      recovered: 2,
      errors: 1,
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.scanned).toBe(3);
    expect(body.swept).toBe(2);
    expect(body.errors).toBe(1);
  });
});
