import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  holdCredits: vi.fn(),
  confirmHold: vi.fn(),
  releaseHold: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  streamText: vi.fn(),
  convertToModelMessages: vi.fn(),
  createOpenAI: vi.fn(() => (modelId: string) => ({
    provider: 'openrouter',
    modelId,
  })),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/credits/credits', () => ({
  holdCredits: mocks.holdCredits,
  confirmHold: mocks.confirmHold,
  releaseHold: mocks.releaseHold,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  createRateLimitHeaders: mocks.createRateLimitHeaders,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    api: {
      error: mocks.loggerError,
    },
  },
}));

vi.mock('ai', () => ({
  streamText: mocks.streamText,
  convertToModelMessages: mocks.convertToModelMessages,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

import { CHAT_MODEL_COSTS } from '../chat-policy';
import { POST } from '../route';

describe('/api/chat POST', () => {
  const validModel = Object.keys(CHAT_MODEL_COSTS)[0];

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    });
    mocks.checkRateLimit.mockReturnValue({
      success: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
    });
    mocks.createRateLimitHeaders.mockReturnValue({
      'x-ratelimit-limit': '20',
      'x-ratelimit-remaining': '19',
      'x-ratelimit-reset': '1234567890',
    });
    mocks.holdCredits.mockResolvedValue({
      holdId: 'hold-1',
      userId: 'user-1',
      amount: 1,
    });
    mocks.confirmHold.mockResolvedValue(undefined);
    mocks.releaseHold.mockResolvedValue(undefined);
    mocks.convertToModelMessages.mockImplementation((messages) => messages);
    mocks.streamText.mockImplementation((options) => ({
      toUIMessageStreamResponse: async (responseOptions?: {
        headers?: Record<string, string>;
      }) => {
        await options.onFinish?.({
          finishReason: 'stop',
          warnings: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          request: {},
          response: { id: 'resp-1', modelId: validModel, messages: [] },
          providerMetadata: undefined,
          sources: [],
          files: [],
          reasoning: [],
          reasoningText: undefined,
          text: 'ok',
          content: [],
          toolCalls: [],
          toolResults: [],
          staticToolCalls: [],
          staticToolResults: [],
          dynamicToolCalls: [],
          dynamicToolResults: [],
          steps: [],
        });

        return new Response('ok', {
          status: 200,
          headers: responseOptions?.headers,
        });
      },
    }));
  });

  it('rejects unsupported models before charging credits', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
          model: 'openai/gpt-5',
          webSearch: false,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValue({
      success: false,
      limit: 20,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });
    mocks.createRateLimitHeaders.mockReturnValue({
      'x-ratelimit-limit': '20',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1234567890',
      'retry-after': '60',
    });

    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
          model: validModel,
          webSearch: false,
        }),
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(mocks.holdCredits).not.toHaveBeenCalled();
  });

  it('holds and confirms credits on a successful streamed response', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
          model: validModel,
          webSearch: false,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.holdCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: CHAT_MODEL_COSTS[validModel],
        description: `Chat request hold: ${validModel}`,
      })
    );
    expect(mocks.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.releaseHold).not.toHaveBeenCalled();
  });

  it('releases the hold when the streaming layer reports an error', async () => {
    mocks.streamText.mockImplementation((options) => ({
      toUIMessageStreamResponse: async (responseOptions?: {
        headers?: Record<string, string>;
      }) => {
        await options.onError?.({
          error: new Error('stream failed'),
        });

        return new Response('failed', {
          status: 500,
          headers: responseOptions?.headers,
        });
      },
    }));

    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
          model: validModel,
          webSearch: false,
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(mocks.releaseHold).toHaveBeenCalledWith('hold-1');
    expect(mocks.confirmHold).not.toHaveBeenCalled();
  });
});
