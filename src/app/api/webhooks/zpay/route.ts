import { logger } from '@/lib/logger';
import {
  applyStrictRateLimit,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { handleWebhookEvent } from '@/payment';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * zpay async callback handler
 * Supports POST (form-urlencoded) and GET (query string) requests
 *
 * zpay will call this endpoint after payment is completed
 * Response "success" to acknowledge receipt
 *
 * Rate limiting (Week 2.8):
 *   We apply a strict (no in-memory fallback) per-IP rate limit so that
 *   - bots flooding the endpoint with garbage signatures cannot exhaust the
 *     DB / signature-verification budget, and
 *   - if the DB is itself the choke point we fail closed (503) rather than
 *     accepting unbounded traffic via the per-instance memory fallback.
 *
 *   Limit: 100 requests / 60s / IP. zpay's legitimate retry cadence is well
 *   below this; if a real callback gets throttled the gateway will retry.
 */
const WEBHOOK_RATE_LIMIT = 100;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

async function enforceRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  const ip = getRateLimitIdentifier(req.headers, 'zpay-webhook-anonymous');
  const result = await applyStrictRateLimit({
    key: `zpay-webhook:${ip}`,
    limit: WEBHOOK_RATE_LIMIT,
    windowMs: WEBHOOK_RATE_WINDOW_MS,
  });

  if (!result.success) {
    logger.api.warn('zpay webhook rejected by rate limit', {
      ip,
      remaining: result.remaining,
    });
    // 503 (not 429) so the gateway interprets this as "service unavailable,
    // please retry" rather than "you are blocked, stop sending". zpay will
    // retry the same callback later.
    return new NextResponse('throttled', { status: 503 });
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const throttled = await enforceRateLimit(req);
  if (throttled) return throttled;

  try {
    const contentType = req.headers.get('content-type') || '';
    const params: Record<string, string> = {};

    // Parse parameters based on content type
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      Object.assign(params, json);
    } else {
      // Try to parse from URL search params as fallback
      req.nextUrl.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    if (Object.keys(params).length === 0) {
      logger.api.error('zpay webhook: no parameters received');
      return new NextResponse('fail', { status: 400 });
    }

    logger.api.info('zpay webhook POST received', {
      keys: Object.keys(params),
    });

    const payload = JSON.stringify(params);
    const signature = params.sign || '';

    await handleWebhookEvent(payload, signature);

    // zpay requires "success" string response to acknowledge
    return new NextResponse('success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    logger.api.error('zpay webhook POST error:', error);
    return new NextResponse('fail', { status: 400 });
  }
}

/**
 * Handle GET requests (some payment gateways use GET for callbacks)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const throttled = await enforceRateLimit(req);
  if (throttled) return throttled;

  try {
    const params: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (Object.keys(params).length === 0) {
      logger.api.error('zpay webhook: no parameters received');
      return new NextResponse('fail', { status: 400 });
    }

    logger.api.info('zpay webhook GET received', { keys: Object.keys(params) });

    const payload = JSON.stringify(params);
    const signature = params.sign || '';

    await handleWebhookEvent(payload, signature);

    return new NextResponse('success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    logger.api.error('zpay webhook GET error:', error);
    return new NextResponse('fail', { status: 400 });
  }
}
