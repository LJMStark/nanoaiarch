import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImageWithGemini } from '../gemini-client';

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
    await generateImageWithGemini({
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
  });
});
