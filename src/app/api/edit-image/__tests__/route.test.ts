import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateRequestId: vi.fn(() => 'req-1'),
  mapModelIdToGeminiModel: vi.fn(),
  validatePrompt: vi.fn(),
}));

vi.mock('@/ai/image/lib/gemini-client', () => ({
  editImageWithConversationGemini: vi.fn(),
  generateImageWithGemini: vi.fn(),
}));

vi.mock('@/ai/image/lib/image-api-helpers', () => ({
  createErrorResponse: vi.fn(),
  createImageResponse: vi.fn(),
  executeImageGeneration: vi.fn(),
  verifyRequestContext: vi.fn(),
}));

vi.mock('@/ai/image/lib/request-validation', () => ({
  resolveRequestedImageSize: vi.fn(),
  validateConversationMessages: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    api: {
      error: vi.fn(),
      info: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
}));

import { POST } from '../route';

describe('/api/edit-image POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for malformed json payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/edit-image', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{bad',
      }) as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请求体格式错误',
    });
  });

  it('rejects gpt-image-2 because the edit endpoint only supports Gemini editing', async () => {
    const response = await POST(
      new Request('http://localhost/api/edit-image', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          modelId: 'gpt-image-2',
          messages: [
            {
              role: 'user',
              content: '把图片改成日落色调',
            },
          ],
        }),
      }) as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'GPT Image 2 暂不支持图片编辑',
    });
  });
});
