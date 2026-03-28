import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  editImageWithConversationGemini,
  generateImageWithGemini,
} from '../gemini-client';

const LEGACY_GEMINI_THOUGHT_SIGNATURE = Buffer.from(
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

  it('encodes the documented dummy signature for legacy model history', async () => {
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
          thoughtSignature: LEGACY_GEMINI_THOUGHT_SIGNATURE,
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'legacy-base64',
          },
          thoughtSignature: LEGACY_GEMINI_THOUGHT_SIGNATURE,
        },
      ],
    });
  });
});
