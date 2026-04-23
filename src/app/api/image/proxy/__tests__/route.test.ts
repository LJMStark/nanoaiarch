import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/image/lib/image-utils', () => ({
  isValidImageUrl: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    api: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
}));

import { isValidImageUrl } from '@/ai/image/lib/image-utils';
import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { GET } from '../route';

describe('/api/image/proxy GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    vi.mocked(applyRateLimit).mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({
      'X-RateLimit-Limit': '120',
      'X-RateLimit-Remaining': '119',
      'X-RateLimit-Reset': '123',
    });
    vi.mocked(getRateLimitIdentifier).mockReturnValue('127.0.0.1');
  });

  it('returns 400 when url is missing', async () => {
    const response = await GET(new Request('http://localhost/api/image/proxy'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing image url',
    });
  });

  it('returns 400 for rejected image urls', async () => {
    vi.mocked(isValidImageUrl).mockReturnValue(false);

    const response = await GET(
      new Request(
        'http://localhost/api/image/proxy?url=https%3A%2F%2Fevil.example%2Fa.png'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid image url',
    });
  });

  it('proxies allowlisted image responses', async () => {
    vi.mocked(isValidImageUrl).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '11',
        },
      })
    );

    const response = await GET(
      new Request(
        'http://localhost/api/image/proxy?url=https%3A%2F%2Fexample.com%2Fa.png'
      )
    );

    expect(fetch).toHaveBeenCalledWith('https://example.com/a.png', {
      cache: 'no-store',
      redirect: 'follow',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('image-bytes');
  });
});
