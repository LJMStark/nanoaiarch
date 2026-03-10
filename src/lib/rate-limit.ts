type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

declare global {
  var __nanoRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore =
  globalThis.__nanoRateLimitStore ?? new Map<string, RateLimitEntry>();

if (!globalThis.__nanoRateLimitStore) {
  globalThis.__nanoRateLimitStore = rateLimitStore;
}

export function getRateLimitIdentifier(
  headers: Headers,
  fallback = 'anonymous'
): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();

  return forwardedFor || realIp || fallback;
}

export function applyRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    });

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

export const checkRateLimit = applyRateLimit;
export const createRateLimitHeaders = getRateLimitHeaders;
