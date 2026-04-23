import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
}));

import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { GET } from '../route';

describe('/api/ping GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '59',
      'X-RateLimit-Reset': '123',
    });
    vi.mocked(getRateLimitIdentifier).mockReturnValue('127.0.0.1');
  });

  it('keeps the health check on the in-memory rate limiter', async () => {
    const response = await GET(new Request('http://localhost/api/ping'));

    expect(response.status).toBe(200);
    expect(applyRateLimit).toHaveBeenCalledWith({
      key: 'ping:127.0.0.1',
      limit: 60,
      windowMs: 60 * 1000,
      storage: 'memory',
    });
  });
});
