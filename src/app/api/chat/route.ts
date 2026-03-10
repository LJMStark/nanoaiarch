import crypto from 'crypto';
import { confirmHold, holdCredits, releaseHold } from '@/credits/credits';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit';
import { createOpenAI } from '@ai-sdk/openai';
import { type UIMessage, convertToModelMessages, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { resolveChatRequestPolicy } from './chat-policy';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
const CHAT_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 1000,
} as const;

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  name: 'openrouter',
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Please sign in to use chat' },
      { status: 401 }
    );
  }

  let requestBody: {
    messages?: UIMessage[];
    model?: string;
    webSearch?: boolean;
  };

  try {
    requestBody = (await req.json()) as {
      messages?: UIMessage[];
      model?: string;
      webSearch?: boolean;
    };
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { messages, model, webSearch = false } = requestBody;
  if (!Array.isArray(messages) || messages.length === 0 || !model) {
    return NextResponse.json(
      { error: 'messages and model are required' },
      { status: 400 }
    );
  }

  const policy = resolveChatRequestPolicy({
    model,
    webSearch,
  });
  if (!policy) {
    return NextResponse.json(
      { error: 'Invalid chat model. Please select a supported model.' },
      { status: 400 }
    );
  }

  const clientAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const rateLimit = checkRateLimit({
    key: `api:chat:${session.user.id}:${clientAddress}`,
    limit: CHAT_RATE_LIMIT.limit,
    windowMs: CHAT_RATE_LIMIT.windowMs,
  });
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many chat requests. Please try again shortly.' },
      {
        status: 429,
        headers: rateLimitHeaders,
      }
    );
  }

  const requestId = crypto.randomUUID();

  let holdId: string;
  try {
    const hold = await holdCredits({
      userId: session.user.id,
      amount: policy.creditCost,
      idempotencyKey: `chat:${requestId}`,
      description: `Chat request hold: ${policy.modelId}`,
    });
    holdId = hold.holdId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Insufficient credits')) {
      return NextResponse.json(
        {
          error:
            'Insufficient credits. Please purchase more credits to continue.',
        },
        {
          status: 402,
          headers: rateLimitHeaders,
        }
      );
    }

    logger.api.error(
      `Failed to reserve chat credits [requestId=${requestId}, userId=${session.user.id}]`,
      error
    );
    return NextResponse.json(
      { error: 'Failed to reserve credits. Please try again.' },
      {
        status: 500,
        headers: rateLimitHeaders,
      }
    );
  }

  let holdSettled = false;
  const settleHold = async (mode: 'confirm' | 'release'): Promise<void> => {
    if (holdSettled) {
      return;
    }

    holdSettled = true;

    try {
      if (mode === 'confirm') {
        await confirmHold(holdId);
      } else {
        await releaseHold(holdId);
      }
    } catch (error) {
      logger.api.error(
        `Failed to ${mode} chat credit hold [requestId=${requestId}, holdId=${holdId}]`,
        error
      );
    }
  };

  try {
    const result = streamText({
      model: openRouter(policy.modelId),
      abortSignal: req.signal,
      messages: convertToModelMessages(messages),
      system:
        'You are a helpful assistant that can answer questions and help with tasks.',
      onFinish: async () => {
        await settleHold('confirm');
      },
      onAbort: async () => {
        await settleHold('release');
      },
      onError: async () => {
        await settleHold('release');
      },
    });

    return result.toUIMessageStreamResponse({
      headers: rateLimitHeaders,
      sendSources: true,
      sendReasoning: true,
      onError: (error) => {
        logger.api.error(
          `Chat streaming error [requestId=${requestId}, model=${policy.modelId}]`,
          error
        );
        return 'Failed to generate chat response.';
      },
    });
  } catch (error) {
    await settleHold('release');
    logger.api.error(
      `Unhandled chat route error [requestId=${requestId}, model=${policy.modelId}]`,
      error
    );
    return NextResponse.json(
      { error: 'Failed to generate chat response.' },
      {
        status: 500,
        headers: rateLimitHeaders,
      }
    );
  }
}
