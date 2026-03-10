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

interface ChatRequestBody {
  messages?: UIMessage[];
  model?: string;
  webSearch?: boolean;
}

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  name: 'openrouter',
});

function createChatErrorResponse(
  error: string,
  status: number,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    { error },
    {
      status,
      headers,
    }
  );
}

async function parseChatRequest(req: Request): Promise<ChatRequestBody | null> {
  try {
    return (await req.json()) as ChatRequestBody;
  } catch {
    return null;
  }
}

function createHoldSettler(holdId: string, requestId: string) {
  let holdSettled = false;

  return async function settleHold(mode: 'confirm' | 'release'): Promise<void> {
    if (holdSettled) {
      return;
    }

    holdSettled = true;

    try {
      if (mode === 'confirm') {
        await confirmHold(holdId);
        return;
      }

      await releaseHold(holdId);
    } catch (error) {
      logger.api.error(
        `Failed to ${mode} chat credit hold [requestId=${requestId}, holdId=${holdId}]`,
        error
      );
    }
  };
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return createChatErrorResponse('Please sign in to use chat', 401);
  }

  const requestBody = await parseChatRequest(req);
  if (!requestBody) {
    return createChatErrorResponse('Invalid request body', 400);
  }

  const { messages, model, webSearch = false } = requestBody;
  if (!Array.isArray(messages) || messages.length === 0 || !model) {
    return createChatErrorResponse('messages and model are required', 400);
  }

  const policy = resolveChatRequestPolicy({
    model,
    webSearch,
  });
  if (!policy) {
    return createChatErrorResponse(
      'Invalid chat model. Please select a supported model.',
      400
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
    return createChatErrorResponse(
      'Too many chat requests. Please try again shortly.',
      429,
      rateLimitHeaders
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
      return createChatErrorResponse(
        'Insufficient credits. Please purchase more credits to continue.',
        402,
        rateLimitHeaders
      );
    }

    logger.api.error(
      `Failed to reserve chat credits [requestId=${requestId}, userId=${session.user.id}]`,
      error
    );
    return createChatErrorResponse(
      'Failed to reserve credits. Please try again.',
      500,
      rateLimitHeaders
    );
  }

  const settleHold = createHoldSettler(holdId, requestId);

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
    return createChatErrorResponse(
      'Failed to generate chat response.',
      500,
      rateLimitHeaders
    );
  }
}
