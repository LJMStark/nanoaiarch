import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyStrictRateLimit: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
  handleWebhookEvent: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  applyStrictRateLimit: mocks.applyStrictRateLimit,
  getRateLimitIdentifier: mocks.getRateLimitIdentifier,
}));

vi.mock('@/payment', () => ({
  handleWebhookEvent: mocks.handleWebhookEvent,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    api: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

/**
 * Build a NextRequest stand-in. The real Next.js NextRequest constructor
 * pulls in too much runtime to mock cleanly; instead we hand-roll the small
 * surface our route actually touches: headers, formData(), json(), nextUrl.
 */
function createRequest(opts: {
  method: 'POST' | 'GET';
  url: string;
  contentType?: string;
  formData?: Record<string, string>;
  json?: unknown;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}): any {
  const headersMap = new Map<string, string>();
  if (opts.contentType) headersMap.set('content-type', opts.contentType);
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    headersMap.set(k.toLowerCase(), v);
  }

  const headers = {
    get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
  };

  const formDataInstance = {
    forEach: (cb: (value: string, key: string) => void) => {
      for (const [k, v] of Object.entries(opts.formData ?? {})) cb(v, k);
    },
  };

  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
    searchParams.set(k, v);
  }

  return {
    method: opts.method,
    headers,
    formData: vi.fn().mockResolvedValue(formDataInstance),
    json: vi.fn().mockResolvedValue(opts.json),
    nextUrl: {
      searchParams: {
        forEach: (cb: (value: string, key: string) => void) =>
          searchParams.forEach(cb),
      },
    },
  };
}

describe('zpay webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRateLimitIdentifier.mockReturnValue('1.2.3.4');
    mocks.applyStrictRateLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      resetAt: Date.now() + 60_000,
    });
    mocks.handleWebhookEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('POST', () => {
    it('parses form-urlencoded body and returns "success" on happy path', async () => {
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'application/x-www-form-urlencoded',
        formData: {
          out_trade_no: 'invoice-1',
          trade_no: 'trade-1',
          trade_status: 'TRADE_SUCCESS',
          money: '199.00',
          sign: 'valid-sign',
        },
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('success');
      expect(mocks.handleWebhookEvent).toHaveBeenCalledTimes(1);
      const [payload, signature] = mocks.handleWebhookEvent.mock.calls[0];
      expect(JSON.parse(payload).out_trade_no).toBe('invoice-1');
      expect(signature).toBe('valid-sign');
    });

    it('parses JSON body when content-type is application/json', async () => {
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'application/json',
        json: {
          out_trade_no: 'invoice-2',
          sign: 'sig',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      expect(mocks.handleWebhookEvent).toHaveBeenCalledTimes(1);
    });

    it('falls back to query string when content-type is unrecognised', async () => {
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay?out_trade_no=invoice-3&sign=x',
        contentType: 'text/plain',
        searchParams: {
          out_trade_no: 'invoice-3',
          sign: 'x',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      expect(mocks.handleWebhookEvent).toHaveBeenCalledWith(
        expect.stringContaining('"invoice-3"'),
        'x'
      );
    });

    it('returns 400 "fail" when no parameters were received', async () => {
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'text/plain',
        searchParams: {},
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('fail');
      expect(mocks.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('returns 400 "fail" when handleWebhookEvent throws (bad signature, etc.)', async () => {
      mocks.handleWebhookEvent.mockRejectedValueOnce(
        new Error('signature mismatch')
      );
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'application/x-www-form-urlencoded',
        formData: { out_trade_no: 'invoice-4', sign: 'bad' },
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('fail');
    });

    it('returns 503 throttled before parsing body when rate-limited', async () => {
      // Rate limiter must fire BEFORE we touch the request body, otherwise
      // a flood of malformed POSTs would still consume parse cycles.
      mocks.applyStrictRateLimit.mockResolvedValueOnce({
        success: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      });
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'application/x-www-form-urlencoded',
        formData: { out_trade_no: 'invoice-5', sign: 'sig' },
      });

      const response = await POST(req);

      expect(response.status).toBe(503);
      expect(await response.text()).toBe('throttled');
      // Critical: body parsing and webhook dispatch never happen.
      expect(req.formData).not.toHaveBeenCalled();
      expect(mocks.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('passes the same payload through twice on replay (idempotency is downstream)', async () => {
      // The route itself does not dedupe — that's payment provider's job
      // (zpay.ts handleWebhookEvent reads paymentRecord.paid). This test
      // simply asserts the route handler is replay-tolerant: calling it
      // twice with identical params yields two 200 responses and two
      // handleWebhookEvent invocations downstream.
      const { POST } = await import('../route');
      const make = () =>
        createRequest({
          method: 'POST',
          url: 'http://test/api/webhooks/zpay',
          contentType: 'application/x-www-form-urlencoded',
          formData: {
            out_trade_no: 'invoice-replay',
            sign: 'valid',
          },
        });

      const r1 = await POST(make());
      const r2 = await POST(make());

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(mocks.handleWebhookEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET', () => {
    it('parses search params and returns "success" on happy path', async () => {
      const { GET } = await import('../route');
      const req = createRequest({
        method: 'GET',
        url: 'http://test/api/webhooks/zpay?out_trade_no=invoice-7&sign=ok',
        searchParams: {
          out_trade_no: 'invoice-7',
          sign: 'ok',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('success');
      expect(mocks.handleWebhookEvent).toHaveBeenCalledTimes(1);
      const [payload, signature] = mocks.handleWebhookEvent.mock.calls[0];
      expect(JSON.parse(payload).out_trade_no).toBe('invoice-7');
      expect(signature).toBe('ok');
    });

    it('returns 400 when no query params were received', async () => {
      const { GET } = await import('../route');
      const req = createRequest({
        method: 'GET',
        url: 'http://test/api/webhooks/zpay',
        searchParams: {},
      });

      const response = await GET(req);
      expect(response.status).toBe(400);
      expect(mocks.handleWebhookEvent).not.toHaveBeenCalled();
    });

    it('also fails closed at 503 when rate-limited', async () => {
      mocks.applyStrictRateLimit.mockResolvedValueOnce({
        success: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      });
      const { GET } = await import('../route');
      const req = createRequest({
        method: 'GET',
        url: 'http://test/api/webhooks/zpay?out_trade_no=invoice-8&sign=x',
        searchParams: { out_trade_no: 'invoice-8', sign: 'x' },
      });

      const response = await GET(req);
      expect(response.status).toBe(503);
      expect(mocks.handleWebhookEvent).not.toHaveBeenCalled();
    });
  });

  describe('rate limit key', () => {
    it('uses the per-IP key zpay-webhook:<ip>', async () => {
      mocks.getRateLimitIdentifier.mockReturnValueOnce('203.0.113.7');
      const { POST } = await import('../route');
      const req = createRequest({
        method: 'POST',
        url: 'http://test/api/webhooks/zpay',
        contentType: 'application/x-www-form-urlencoded',
        formData: { out_trade_no: 'invoice-9', sign: 'sig' },
      });

      await POST(req);

      expect(mocks.applyStrictRateLimit).toHaveBeenCalledWith({
        key: 'zpay-webhook:203.0.113.7',
        limit: 100,
        windowMs: 60_000,
      });
    });
  });
});
