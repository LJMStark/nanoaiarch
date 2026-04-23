import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

/**
 * It is used to check if the server is running.
 * You can use tools like Uptime Kuma to monitor this endpoint.
 */
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit({
    key: `ping:${getRateLimitIdentifier(request.headers)}`,
    limit: 60,
    windowMs: 60 * 1000,
    storage: 'memory',
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  return NextResponse.json(
    { message: 'pong' },
    { headers: getRateLimitHeaders(rateLimitResult) }
  );
}
