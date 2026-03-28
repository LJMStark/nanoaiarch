import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/actions/project-message', () => ({
  updateAssistantMessage: vi.fn(),
}));

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateRequestId: vi.fn(() => 'req-1'),
  mapAspectRatioToGemini: vi.fn(),
  mapModelIdToGeminiModel: vi.fn(),
  validatePrompt: vi.fn(),
}));

vi.mock('@/ai/image/lib/gemini-client', () => ({
  editImageWithConversationGemini: vi.fn(),
  editImageWithGemini: vi.fn(),
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
  validateReferenceImages: vi.fn(),
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

import { updateAssistantMessage } from '@/actions/project-message';
import {
  mapAspectRatioToGemini,
  mapModelIdToGeminiModel,
  validatePrompt,
} from '@/ai/image/lib/api-utils';
import { editImageWithConversationGemini } from '@/ai/image/lib/gemini-client';
import {
  executeImageGeneration,
  verifyRequestContext,
} from '@/ai/image/lib/image-api-helpers';
import {
  resolveRequestedImageSize,
  validateConversationMessages,
  validateReferenceImages,
} from '@/ai/image/lib/request-validation';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { POST } from '../route';

describe('/api/generate-images POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for malformed json payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/generate-images', {
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

  it('persists model response parts on successful assistant messages', async () => {
    vi.mocked(validatePrompt).mockReturnValue({ valid: true });
    vi.mocked(resolveRequestedImageSize).mockReturnValue({
      valid: true,
      value: '1K',
    });
    vi.mocked(validateReferenceImages).mockReturnValue({ valid: true });
    vi.mocked(validateConversationMessages).mockReturnValue({ valid: true });
    vi.mocked(verifyRequestContext).mockResolvedValue({
      requestId: 'req-1',
      userId: 'user-1',
      modelId: 'forma',
      creditCost: 1,
    });
    vi.mocked(applyRateLimit).mockReturnValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({});
    vi.mocked(mapModelIdToGeminiModel).mockReturnValue(
      'gemini-3-pro-image-preview'
    );
    vi.mocked(mapAspectRatioToGemini).mockReturnValue('1:1');
    vi.mocked(executeImageGeneration).mockResolvedValue({
      image: 'https://example.com/generated.png',
      text: '已生成',
      creditsUsed: 1,
      modelResponseParts: [
        {
          type: 'text',
          text: '已生成',
          thoughtSignature: 'sig-text',
        },
        {
          type: 'image',
          mimeType: 'image/png',
          thoughtSignature: 'sig-image',
        },
      ],
    });
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: true,
      data: {
        id: 'assistant-1',
        projectId: 'project-1',
        role: 'assistant',
        content: '已生成',
        inputImage: null,
        outputImage: 'https://example.com/generated.png',
        maskImage: null,
        generationParams: JSON.stringify({
          prompt: '把沙发加进去',
          modelResponseParts: [
            {
              type: 'text',
              text: '已生成',
              thoughtSignature: 'sig-text',
            },
          ],
        }),
        creditsUsed: 1,
        generationTime: 1200,
        status: 'completed',
        errorMessage: null,
        orderIndex: 1,
        createdAt: new Date(),
      },
    });

    const response = await POST(
      new Request('http://localhost/api/generate-images', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '把沙发加进去',
          modelId: 'forma',
          aspectRatio: '1:1',
          imageSize: '1K',
          projectId: 'project-1',
          assistantMessageId: 'assistant-1',
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(updateAssistantMessage).toHaveBeenCalledWith(
      'assistant-1',
      expect.objectContaining({
        generationParams: {
          prompt: '把沙发加进去',
          aspectRatio: '1:1',
          model: 'forma',
          imageQuality: '1K',
          modelResponseParts: [
            {
              type: 'text',
              text: '已生成',
              thoughtSignature: 'sig-text',
            },
            {
              type: 'image',
              mimeType: 'image/png',
              thoughtSignature: 'sig-image',
            },
          ],
        },
      })
    );
  });

  it('appends the current user prompt when entering conversation mode', async () => {
    vi.mocked(validatePrompt).mockReturnValue({ valid: true });
    vi.mocked(resolveRequestedImageSize).mockReturnValue({
      valid: true,
      value: '1K',
    });
    vi.mocked(validateReferenceImages).mockReturnValue({ valid: true });
    vi.mocked(validateConversationMessages).mockReturnValue({ valid: true });
    vi.mocked(verifyRequestContext).mockResolvedValue({
      requestId: 'req-1',
      userId: 'user-1',
      modelId: 'forma',
      creditCost: 1,
    });
    vi.mocked(applyRateLimit).mockReturnValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({});
    vi.mocked(mapModelIdToGeminiModel).mockReturnValue(
      'gemini-3-pro-image-preview'
    );
    vi.mocked(mapAspectRatioToGemini).mockReturnValue('1:1');
    vi.mocked(editImageWithConversationGemini).mockResolvedValue({
      success: true,
      image: 'img-base64',
      text: '已生成',
    });
    vi.mocked(executeImageGeneration).mockResolvedValue({
      image: 'https://example.com/generated.png',
      text: '已生成',
      creditsUsed: 1,
    });
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: true,
      data: {
        id: 'assistant-1',
        projectId: 'project-1',
        role: 'assistant',
        content: '已生成',
        inputImage: null,
        outputImage: 'https://example.com/generated.png',
        maskImage: null,
        generationParams: JSON.stringify({
          prompt: '把沙发加进去',
        }),
        creditsUsed: 1,
        generationTime: 1200,
        status: 'completed',
        errorMessage: null,
        orderIndex: 1,
        createdAt: new Date(),
      },
    });

    await POST(
      new Request('http://localhost/api/generate-images', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '把沙发加进去',
          modelId: 'forma',
          aspectRatio: '1:1',
          imageSize: '1K',
          projectId: 'project-1',
          assistantMessageId: 'assistant-1',
          conversationHistory: [
            {
              role: 'user',
              content: '生成一个客厅',
            },
            {
              role: 'model',
              content: '这是上一张结果',
              image: 'previous-image',
              parts: [
                {
                  type: 'text',
                  text: '这是上一张结果',
                  thoughtSignature: 'sig-text',
                },
                {
                  type: 'image',
                  thoughtSignature: 'sig-image',
                },
              ],
            },
          ],
          referenceImages: ['new-reference'],
        }),
      }) as any
    );

    expect(editImageWithConversationGemini).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: '生成一个客厅',
            image: undefined,
          },
          {
            role: 'model',
            content: '这是上一张结果',
            image: 'previous-image',
            parts: [
              {
                type: 'text',
                text: '这是上一张结果',
                thoughtSignature: 'sig-text',
              },
              {
                type: 'image',
                thoughtSignature: 'sig-image',
              },
            ],
          },
          {
            role: 'user',
            content: '把沙发加进去',
            image: 'new-reference',
          },
        ],
      })
    );
  });
});
