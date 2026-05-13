import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  editImageWithConversationGemini,
  generateImageWithGemini,
} from '../gemini-client';

const LEGACY_GEMINI_DUMMY_SIGNATURE = Buffer.from(
  'context_engineering_is_the_way to_go'
).toString('base64');

vi.mock('@/lib/logger', () => ({
  logger: {
    ai: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('generateImageWithGemini', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64-image',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
    }) as typeof fetch;
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('does not send unsupported personGeneration to Gemini image config', async () => {
    const result = await generateImageWithGemini({
      prompt: 'Generate a test image',
      aspectRatio: '1:1',
      imageSize: '1K',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      generationConfig?: {
        imageConfig?: {
          aspectRatio?: string;
          imageSize?: string;
          personGeneration?: string;
        };
      };
    };

    expect(requestBody.generationConfig?.imageConfig).toEqual({
      aspectRatio: '1:1',
      imageSize: '1K',
    });
    expect(
      requestBody.generationConfig?.imageConfig?.personGeneration
    ).toBeUndefined();
    expect(result.modelResponseParts).toEqual([
      {
        type: 'image',
        mimeType: 'image/png',
      },
    ]);
  });

  it('returns a clearer error when the deployment region is unsupported', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            code: 400,
            message: 'User location is not supported for the API use.',
            status: 'FAILED_PRECONDITION',
          },
        }),
    }) as typeof fetch;

    const result = await generateImageWithGemini({
      prompt: 'Generate a test image',
      aspectRatio: '1:1',
      imageSize: '1K',
    });

    expect(result).toEqual({
      success: false,
      error:
        '当前服务器所在地区不支持 Gemini API，请切换到受支持地区部署或更换模型',
    });
  });

  it('replays stored thought signatures for conversational edits', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '生成一个带庭院的建筑',
        },
        {
          role: 'model',
          content: '好的',
          image: 'existing-base64',
          parts: [
            {
              type: 'text',
              text: '好的',
              thoughtSignature: 'sig-text',
            },
            {
              type: 'image',
              mimeType: 'image/png',
              thoughtSignature: 'sig-image',
            },
          ],
        },
        {
          role: 'user',
          content: '把庭院改成下沉花园',
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[1]).toEqual({
      role: 'model',
      parts: [
        {
          text: '好的',
          thoughtSignature: 'sig-text',
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'existing-base64',
          },
          thoughtSignature: 'sig-image',
        },
      ],
    });
  });

  it('drops legacy model images that have no stored thought signature', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '生成一个沙发场景',
        },
        {
          role: 'model',
          content: '这是上一张结果',
          image: 'legacy-base64',
        },
        {
          role: 'user',
          content: '把条纹沙发加进去',
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[1]).toEqual({
      role: 'model',
      parts: [{ text: '这是上一张结果' }],
    });
  });

  it('strips the documented dummy signature from previously stored model parts', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '生成封面',
        },
        {
          role: 'model',
          content: '好的',
          image: 'stored-base64',
          parts: [
            {
              type: 'text',
              text: '好的',
              thoughtSignature: LEGACY_GEMINI_DUMMY_SIGNATURE,
            },
            {
              type: 'image',
              mimeType: 'image/png',
              thoughtSignature: LEGACY_GEMINI_DUMMY_SIGNATURE,
            },
          ],
        },
        {
          role: 'user',
          content: '换个色调',
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[1]).toEqual({
      role: 'model',
      parts: [{ text: '好的' }],
    });
  });

  it('drops user images that duplicate the preceding model turn image', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '生成一个封面',
        },
        {
          role: 'model',
          content: '好的',
          image: 'shared-output-base64',
          parts: [
            { type: 'text', text: '好的', thoughtSignature: 'sig-text' },
            {
              type: 'image',
              mimeType: 'image/png',
              thoughtSignature: 'sig-image',
            },
          ],
        },
        {
          role: 'user',
          content: '动漫化',
          images: ['shared-output-base64'],
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[2]).toEqual({
      role: 'user',
      parts: [{ text: '动漫化' }],
    });
  });

  it('keeps user images that do not match the preceding model turn', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '生成一个封面',
        },
        {
          role: 'model',
          content: '好的',
          image: 'first-output-base64',
        },
        {
          role: 'user',
          content: '叠加新元素',
          images: ['brand-new-reference-base64'],
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[2]).toEqual({
      role: 'user',
      parts: [
        { text: '叠加新元素' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'brand-new-reference-base64',
          },
        },
      ],
    });
  });

  describe('retry on transient errors', () => {
    function makeOkResponse() {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: { data: 'base64-image', mimeType: 'image/png' },
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      };
    }

    function makeHttpErrorResponse(status: number, body = '{}') {
      return {
        ok: false,
        status,
        text: async () => body,
      };
    }

    it('retries on HTTP 503 and succeeds on second attempt', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          makeHttpErrorResponse(503, 'Service Unavailable')
        )
        .mockResolvedValueOnce(makeOkResponse());
      global.fetch = fetchMock as typeof fetch;

      // Patch the backoff to zero so the test runs instantly. Math.random
      // jitter at 0.5 keeps backoff = base * 2^attempt = 1000ms; mock it to
      // collapse the wait.
      const setTimeoutSpy = vi
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as unknown as NodeJS.Timeout;
        });

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
      });

      setTimeoutSpy.mockRestore();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('gives up after MAX_RETRY_ATTEMPTS retries on persistent 503', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeHttpErrorResponse(503, 'Service Unavailable'));
      global.fetch = fetchMock as typeof fetch;

      const setTimeoutSpy = vi
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as unknown as NodeJS.Timeout;
        });

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
      });

      setTimeoutSpy.mockRestore();
      // 1 initial + 3 retries = 4 calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(result).toEqual({
        success: false,
        error: 'Gemini API 错误 (503)，请稍后重试',
      });
    });

    it('does not retry on HTTP 429 (quota)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeHttpErrorResponse(429, 'Quota Exceeded'));
      global.fetch = fetchMock as typeof fetch;

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });

    it('does not retry on HTTP 400 (validation)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeHttpErrorResponse(400, 'Bad Request'));
      global.fetch = fetchMock as typeof fetch;

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });

    it('retries on undici "fetch failed" network error', async () => {
      const networkError = new TypeError('fetch failed');
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(makeOkResponse());
      global.fetch = fetchMock as typeof fetch;

      const setTimeoutSpy = vi
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as unknown as NodeJS.Timeout;
        });

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
      });

      setTimeoutSpy.mockRestore();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('aborts immediately when caller signal is already aborted', async () => {
      const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
        if (init?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        return makeOkResponse();
      });
      global.fetch = fetchMock as typeof fetch;

      const controller = new AbortController();
      controller.abort();

      const result = await generateImageWithGemini({
        prompt: 'test',
        aspectRatio: '1:1',
        imageSize: '1K',
        signal: controller.signal,
      });

      expect(result).toEqual({ success: false, error: '生成已取消' });
    });
  });

  it('serializes multiple user reference images in a single conversation turn', async () => {
    await editImageWithConversationGemini({
      model: 'gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: '把这两张图混合成一个方案',
          images: ['image-a-base64', 'image-b-base64'],
        },
      ],
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(options?.body)) as {
      contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
    };

    expect(requestBody.contents[0]).toEqual({
      role: 'user',
      parts: [
        {
          text: '把这两张图混合成一个方案',
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'image-a-base64',
          },
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'image-b-base64',
          },
        },
      ],
    });
  });
});
