import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateBasicCronAuth: vi.fn(),
  findExpiredGeneratingMessages: vi.fn(),
  findHoldByIdempotencyKey: vi.fn(),
  releaseHold: vi.fn(),
  updateAssistantMessageDirect: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  AUDIT_ACTIONS: { CREDIT_LEASE_SWEEP: 'credit.lease_sweep' },
  recordAudit: mocks.recordAudit,
}));

vi.mock('@/lib/cron-auth', () => ({
  validateBasicCronAuth: mocks.validateBasicCronAuth,
  createCronUnauthorizedResponse: () =>
    new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/actions/project-message', () => ({
  findExpiredGeneratingMessages: mocks.findExpiredGeneratingMessages,
  updateAssistantMessageDirect: mocks.updateAssistantMessageDirect,
}));

vi.mock('@/credits/credits', () => ({
  findHoldByIdempotencyKey: mocks.findHoldByIdempotencyKey,
  releaseHold: mocks.releaseHold,
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
    mocks.validateBasicCronAuth.mockReturnValue(true);
  });

  it('returns 401 when basic auth is missing/invalid', async () => {
    mocks.validateBasicCronAuth.mockReturnValueOnce(false);
    const { GET } = await import('../route');

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.findExpiredGeneratingMessages).not.toHaveBeenCalled();
  });

  it('returns zero-counters response when nothing has expired', async () => {
    mocks.findExpiredGeneratingMessages.mockResolvedValue([]);
    const { GET } = await import('../route');

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scanned).toBe(0);
    expect(body.swept).toBe(0);
    expect(body.errors).toBe(0);
    expect(typeof body.durationMs).toBe('number');
  });

  it('releases hold + marks message failed for each expired row', async () => {
    mocks.findExpiredGeneratingMessages.mockResolvedValue([
      { id: 'msg-1', projectId: 'p1', userId: 'u1' },
      { id: 'msg-2', projectId: 'p2', userId: 'u2' },
    ]);
    mocks.findHoldByIdempotencyKey
      .mockResolvedValueOnce('hold-1')
      .mockResolvedValueOnce('hold-2');
    mocks.releaseHold.mockResolvedValue(undefined);
    mocks.updateAssistantMessageDirect.mockResolvedValue(undefined);

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.scanned).toBe(2);
    expect(body.swept).toBe(2);
    expect(body.errors).toBe(0);

    expect(mocks.findHoldByIdempotencyKey).toHaveBeenCalledWith(
      'gen-hold:msg-1',
      'u1'
    );
    expect(mocks.findHoldByIdempotencyKey).toHaveBeenCalledWith(
      'gen-hold:msg-2',
      'u2'
    );
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-2');
    expect(mocks.updateAssistantMessageDirect).toHaveBeenCalledTimes(2);
  });

  it('continues marking message failed even when releaseHold throws', async () => {
    // The hold may be in a terminal state by the time the sweep arrives
    // (race with client). releaseHold can throw "invalid hold status".
    // The sweeper must still mark the message failed — otherwise we leak
    // the orphaned row indefinitely.
    mocks.findExpiredGeneratingMessages.mockResolvedValue([
      { id: 'msg-1', projectId: 'p1', userId: 'u1' },
    ]);
    mocks.findHoldByIdempotencyKey.mockResolvedValue('hold-1');
    mocks.releaseHold.mockRejectedValue(
      new Error('invalid hold status (released)')
    );
    mocks.updateAssistantMessageDirect.mockResolvedValue(undefined);

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.swept).toBe(1);
    expect(body.errors).toBe(0);
    expect(mocks.updateAssistantMessageDirect).toHaveBeenCalledTimes(1);
  });

  it('handles missing hold gracefully (no idempotencyKey match)', async () => {
    // Older messages created before the gen-hold:<id> idempotency key
    // convention, or messages whose hold was already released by a prior
    // sweep run. Skip the release step, still mark the message failed.
    mocks.findExpiredGeneratingMessages.mockResolvedValue([
      { id: 'msg-1', projectId: 'p1', userId: 'u1' },
    ]);
    mocks.findHoldByIdempotencyKey.mockResolvedValue(null);
    mocks.updateAssistantMessageDirect.mockResolvedValue(undefined);

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.swept).toBe(1);
    expect(mocks.releaseHold).not.toHaveBeenCalled();
    expect(mocks.updateAssistantMessageDirect).toHaveBeenCalledWith(
      'msg-1',
      'u1',
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('isolates errors per row (one bad row does not abort the sweep)', async () => {
    mocks.findExpiredGeneratingMessages.mockResolvedValue([
      { id: 'msg-good', projectId: 'p1', userId: 'u1' },
      { id: 'msg-bad', projectId: 'p2', userId: 'u2' },
      { id: 'msg-also-good', projectId: 'p3', userId: 'u3' },
    ]);
    mocks.findHoldByIdempotencyKey.mockResolvedValue(null);
    // updateAssistantMessageDirect succeeds for 1st + 3rd, throws for 2nd.
    mocks.updateAssistantMessageDirect
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('db down for this row'))
      .mockResolvedValueOnce(undefined);

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.scanned).toBe(3);
    expect(body.swept).toBe(2);
    expect(body.errors).toBe(1);
  });
});
