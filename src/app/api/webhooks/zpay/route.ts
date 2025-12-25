import { handleWebhookEvent } from '@/payment';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * zpay async callback handler
 * Supports POST (form-urlencoded) and GET (query string) requests
 *
 * zpay will call this endpoint after payment is completed
 * Response "success" to acknowledge receipt
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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
      console.error('zpay webhook: no parameters received');
      return new NextResponse('fail', { status: 400 });
    }

    console.log('zpay webhook POST received:', Object.keys(params));

    const payload = JSON.stringify(params);
    const signature = params.sign || '';

    await handleWebhookEvent(payload, signature);

    // zpay requires "success" string response to acknowledge
    return new NextResponse('success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('zpay webhook POST error:', error);
    return new NextResponse('fail', { status: 400 });
  }
}

/**
 * Handle GET requests (some payment gateways use GET for callbacks)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (Object.keys(params).length === 0) {
      console.error('zpay webhook: no parameters received');
      return new NextResponse('fail', { status: 400 });
    }

    console.log('zpay webhook GET received:', Object.keys(params));

    const payload = JSON.stringify(params);
    const signature = params.sign || '';

    await handleWebhookEvent(payload, signature);

    return new NextResponse('success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('zpay webhook GET error:', error);
    return new NextResponse('fail', { status: 400 });
  }
}
