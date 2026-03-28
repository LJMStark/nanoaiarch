import { isValidImageUrl } from '@/ai/image/lib/image-utils';
import { logger } from '@/lib/logger';
import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

function createErrorResponse(
  error: string,
  status: number,
  headers: HeadersInit
): NextResponse {
  return NextResponse.json(
    { error },
    {
      status,
      headers,
    }
  );
}

export async function GET(request: Request): Promise<Response> {
  const rateLimitResult = applyRateLimit({
    key: `image-proxy:${getRateLimitIdentifier(request.headers)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    return createErrorResponse('Too many requests', 429, rateLimitHeaders);
  }

  const requestUrl = new URL(request.url);
  const url = requestUrl.searchParams.get('url');

  if (!url) {
    return createErrorResponse('Missing image url', 400, rateLimitHeaders);
  }

  if (!isValidImageUrl(url)) {
    logger.api.warn('Rejected image proxy request', { url });
    return createErrorResponse('Invalid image url', 400, rateLimitHeaders);
  }

  try {
    const upstreamResponse = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!upstreamResponse.ok) {
      logger.api.warn('Image proxy upstream request failed', {
        status: upstreamResponse.status,
        url,
      });
      return createErrorResponse(
        'Failed to fetch image',
        502,
        rateLimitHeaders
      );
    }

    const contentType = upstreamResponse.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      logger.api.warn('Image proxy upstream returned non-image content', {
        contentType,
        url,
      });
      return createErrorResponse(
        'Upstream did not return an image',
        502,
        rateLimitHeaders
      );
    }

    const headers = new Headers(rateLimitHeaders);
    headers.set('Content-Type', contentType);
    headers.set(
      'Cache-Control',
      upstreamResponse.headers.get('cache-control') ?? 'public, max-age=3600'
    );

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    logger.api.error('Image proxy request failed', error, { url });
    return createErrorResponse('Failed to fetch image', 502, rateLimitHeaders);
  }
}
