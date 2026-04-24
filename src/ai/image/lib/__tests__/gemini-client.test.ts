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

  it('omits thought signatures for legacy model history without stored parts', async () => {
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
      parts: [
        {
          text: '这是上一张结果',
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'legacy-base64',
          },
        },
      ],
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
      parts: [
        { text: '好的' },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'stored-base64',
          },
        },
      ],
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
