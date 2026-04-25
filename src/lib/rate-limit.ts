import { getDb } from '@/db';
import { requestRateLimit } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateLimitStorage = 'shared' | 'memory';

type RateLimitRow = {
  count: number;
  resetAt: Date | string;
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

function normalizeResetAt(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function applyMemoryRateLimit({
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

  entry.count += 1;

  return {
    success: entry.count <= limit,
    limit,
    remaining: entry.count >= limit ? 0 : Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export async function applyRateLimit({
  key,
  limit,
  windowMs,
  storage = 'shared',
}: {
  key: string;
  limit: number;
  windowMs: number;
  storage?: RateLimitStorage;
}): Promise<RateLimitResult> {
  if (storage === 'memory') {
    return applyMemoryRateLimit({ key, limit, windowMs });
  }

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  // Inline Dates as ISO-string literals with explicit ::timestamp casts.
  // Drizzle's sql template has no column-type context for these params, so
  // postgres-js fails to serialize the raw Date when prepare:false is set.
  const nowSql = sql`${now.toISOString()}::timestamp`;
  const resetAtSql = sql`${resetAt.toISOString()}::timestamp`;

  try {
    const db = await getDb();
    const rows = await db
      .insert(requestRateLimit)
      .values({
        key,
        count: 1,
        resetAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: requestRateLimit.key,
        set: {
          count: sql`CASE WHEN ${requestRateLimit.resetAt} <= ${nowSql} THEN 1 ELSE ${requestRateLimit.count} + 1 END`,
          resetAt: sql`CASE WHEN ${requestRateLimit.resetAt} <= ${nowSql} THEN ${resetAtSql} ELSE ${requestRateLimit.resetAt} END`,
          updatedAt: now,
        },
      })
      .returning({
        count: requestRateLimit.count,
        resetAt: requestRateLimit.resetAt,
      });

    const entry = rows[0] as RateLimitRow | undefined;
    if (!entry) {
      throw new Error('missing rate limit row');
    }

    const count = Number(entry.count);
    return {
      success: count <= limit,
      limit,
      remaining: count >= limit ? 0 : Math.max(0, limit - count),
      resetAt: normalizeResetAt(entry.resetAt),
    };
  } catch (error) {
    logger.api.warn('Rate limit DB unavailable, falling back to memory store', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });

    return applyMemoryRateLimit({ key, limit, windowMs });
  }
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
