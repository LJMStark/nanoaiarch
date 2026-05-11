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

vi.mock('@/ai/image/lib/duomi-client', () => ({
  createDuomiImageTask: vi.fn(),
  generateImageWithDuomi: vi.fn(),
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

vi.mock('@/credits/credits', () => ({
  releaseHold: vi.fn(),
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
import {
  createDuomiImageTask,
  generateImageWithDuomi,
} from '@/ai/image/lib/duomi-client';
import { editImageWithConversationGemini } from '@/ai/image/lib/gemini-client';
import {
  createErrorResponse,
  executeImageGeneration,
  verifyRequestContext,
} from '@/ai/image/lib/image-api-helpers';
import {
  resolveRequestedImageSize,
  validateConversationMessages,
  validateReferenceImages,
} from '@/ai/image/lib/request-validation';
import { releaseHold } from '@/credits/credits';
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

  it('returns 400 before parsing oversized payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/generate-images', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(49 * 1024 * 1024),
        },
        body: '{}',
      }) as any
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请求体过大',
    });
    expect(validatePrompt).not.toHaveBeenCalled();
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
    vi.mocked(applyRateLimit).mockResolvedValue({
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
        inputImages: [],
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
    vi.mocked(applyRateLimit).mockResolvedValue({
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
        inputImages: [],
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
          referenceImages: ['new-reference', 'second-reference'],
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
            images: undefined,
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
            image: undefined,
            images: ['new-reference', 'second-reference'],
          },
        ],
      })
    );
  });

  it('creates a Duomi task for gpt-image-2 and returns the generating message immediately', async () => {
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
      modelId: 'gpt-image-2',
      creditCost: 1,
    });
    vi.mocked(applyRateLimit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({});
    vi.mocked(createDuomiImageTask).mockResolvedValue({
      success: true,
      taskId: 'duomi-task-1',
    });
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: true,
      data: {
        id: 'assistant-1',
        projectId: 'project-1',
        role: 'assistant',
        content: '',
        inputImage: null,
        inputImages: [],
        outputImage: null,
        maskImage: null,
        generationParams: JSON.stringify({
          prompt: '生成一个现代座椅',
          duomiTaskId: 'duomi-task-1',
          duomiTaskStatus: 'pending',
        }),
        creditsUsed: null,
        generationTime: null,
        status: 'generating',
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
          prompt: '生成一个现代座椅',
          modelId: 'gpt-image-2',
          aspectRatio: '1:1',
          imageSize: '1K',
          projectId: 'project-1',
          assistantMessageId: 'assistant-1',
          generationAttemptId: 'attempt-1',
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(mapModelIdToGeminiModel).not.toHaveBeenCalled();
    expect(editImageWithConversationGemini).not.toHaveBeenCalled();
    expect(createDuomiImageTask).toHaveBeenCalledWith({
      prompt: '生成一个现代座椅',
      aspectRatio: '1:1',
      signal: expect.any(AbortSignal),
    });
    expect(generateImageWithDuomi).not.toHaveBeenCalled();
    expect(executeImageGeneration).not.toHaveBeenCalled();
    expect(updateAssistantMessage).toHaveBeenCalledWith('assistant-1', {
      content: '',
      generationParams: expect.objectContaining({
        prompt: '生成一个现代座椅',
        duomiTaskId: 'duomi-task-1',
        duomiTaskStatus: 'pending',
        duomiTaskStartedAt: expect.any(String),
      }),
      status: 'generating',
    });
  });

  it('releases the held credits if a Duomi task cannot be persisted', async () => {
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
      modelId: 'gpt-image-2',
      creditCost: 1,
      holdId: 'hold-1',
    });
    vi.mocked(applyRateLimit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({});
    vi.mocked(mapAspectRatioToGemini).mockReturnValue('1:1');
    vi.mocked(createDuomiImageTask).mockResolvedValue({
      success: true,
      taskId: 'duomi-task-1',
    });
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: false,
      error: 'db unavailable',
    });
    vi.mocked(releaseHold).mockResolvedValue(undefined);

    const response = await POST(
      new Request('http://localhost/api/generate-images', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '生成一个现代座椅',
          modelId: 'gpt-image-2',
          aspectRatio: '1:1',
          imageSize: '1K',
          projectId: 'project-1',
          assistantMessageId: 'assistant-1',
          generationAttemptId: 'attempt-1',
        }),
      }) as any
    );

    expect(response.status).toBe(500);
    expect(releaseHold).toHaveBeenCalledWith('hold-1');
    await expect(response.json()).resolves.toEqual({
      error: '保存生成任务失败',
    });
  });

  it('marks the assistant message as failed when generation throws unexpectedly', async () => {
    vi.mocked(validatePrompt).mockReturnValue({ valid: true });
    vi.mocked(resolveRequestedImageSize).mockReturnValue({
      valid: true,
      value: '1K',
    });
    vi.mocked(validateReferenceImages).mockReturnValue({ valid: true });
    vi.mocked(verifyRequestContext).mockResolvedValue({
      requestId: 'req-1',
      userId: 'user-1',
      modelId: 'forma',
      creditCost: 1,
    });
    vi.mocked(applyRateLimit).mockResolvedValue({
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
    vi.mocked(executeImageGeneration).mockRejectedValue(new Error('boom'));
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: true,
      data: null,
    });
    vi.mocked(createErrorResponse).mockReturnValue(
      new Response(JSON.stringify({ error: '生成图片失败，请稍后重试' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }) as any
    );

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

    expect(response.status).toBe(500);
    expect(updateAssistantMessage).toHaveBeenCalledWith('assistant-1', {
      content: '生成失败，请稍后重试',
      status: 'failed',
      errorMessage: 'boom',
    });
    expect(createErrorResponse).toHaveBeenCalled();
  });

  it('marks the assistant message as failed when the request is aborted before persistence', async () => {
    const controller = new AbortController();

    vi.mocked(validatePrompt).mockReturnValue({ valid: true });
    vi.mocked(resolveRequestedImageSize).mockReturnValue({
      valid: true,
      value: '1K',
    });
    vi.mocked(validateReferenceImages).mockReturnValue({ valid: true });
    vi.mocked(verifyRequestContext).mockResolvedValue({
      requestId: 'req-1',
      userId: 'user-1',
      modelId: 'forma',
      creditCost: 1,
    });
    vi.mocked(applyRateLimit).mockResolvedValue({
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
    vi.mocked(executeImageGeneration).mockImplementation(async () => {
      controller.abort();
      return {
        image: 'https://example.com/generated.png',
        text: '已生成',
        creditsUsed: 1,
      };
    });
    vi.mocked(updateAssistantMessage).mockResolvedValue({
      success: true,
      data: null,
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
        signal: controller.signal,
      }) as any
    );

    expect(response.status).toBe(499);
    expect(updateAssistantMessage).toHaveBeenCalledWith('assistant-1', {
      content: '生成已取消',
      status: 'failed',
      errorMessage: 'Generation cancelled',
    });
  });
});
