import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/actions/project-message', () => ({
  createPendingGeneration: vi.fn(),
  getProjectMessages: vi.fn(),
  updateAssistantMessageFromClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
}));

import {
  createPendingGeneration,
  updateAssistantMessageFromClient,
} from '@/actions/project-message';
import { MAX_BASE64_IMAGE_CHARS } from '@/ai/image/lib/api-utils';
import { auth } from '@/lib/auth';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { PATCH, POST } from '../route';

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
const JPEG_MAGIC_BASE64 = '/9j/';

function buildMaxSizedJpegDataUrl(): string {
  return `${JPEG_DATA_URL_PREFIX}${JPEG_MAGIC_BASE64}${'A'.repeat(MAX_BASE64_IMAGE_CHARS - JPEG_MAGIC_BASE64.length)}`;
}

describe('/api/image/messages route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as never);
    vi.mocked(applyRateLimit).mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(getRateLimitHeaders).mockReturnValue({});
  });

  it('rejects client attempts to mark assistant messages completed', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/image/messages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update-assistant-message',
          messageId: 'assistant-1',
          data: {
            status: 'completed',
            outputImage: 'https://assets.example/generated.png',
            creditsUsed: 0,
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(updateAssistantMessageFromClient).not.toHaveBeenCalled();
  });

  it('allows client failure updates without accepting generated output fields', async () => {
    vi.mocked(updateAssistantMessageFromClient).mockResolvedValue({
      success: true,
      data: {
        id: 'assistant-1',
        projectId: 'project-1',
        role: 'assistant',
        content: '生成已取消',
        inputImage: null,
        inputImages: [],
        outputImage: null,
        maskImage: null,
        generationParams: null,
        creditsUsed: null,
        generationTime: null,
        status: 'failed',
        errorMessage: 'Generation cancelled',
        orderIndex: 1,
        createdAt: new Date(),
      },
    });

    const response = await PATCH(
      new Request('http://localhost/api/image/messages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'update-assistant-message',
          messageId: 'assistant-1',
          data: {
            status: 'failed',
            content: '生成已取消',
            errorMessage: 'Generation cancelled',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateAssistantMessageFromClient).toHaveBeenCalledWith(
      'assistant-1',
      {
        status: 'failed',
        content: '生成已取消',
        errorMessage: 'Generation cancelled',
      }
    );
  });

  it('rejects duplicated image payloads inside generationParams', async () => {
    const response = await POST(
      new Request('http://localhost/api/image/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create-pending-generation',
          projectId: 'project-1',
          data: {
            content: 'draw',
            inputImages: [VALID_PNG_BASE64],
            generationParams: {
              prompt: 'draw',
              model: 'forma',
              inputImages: [VALID_PNG_BASE64],
            },
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(createPendingGeneration).not.toHaveBeenCalled();
  });

  it('passes data URL image payloads at the base64 size limit', async () => {
    const imageDataUrl = buildMaxSizedJpegDataUrl();
    vi.mocked(createPendingGeneration).mockResolvedValue({
      success: true,
      data: null,
    } as never);

    const response = await POST(
      new Request('http://localhost/api/image/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create-pending-generation',
          projectId: 'project-1',
          data: {
            content: 'draw',
            inputImages: [imageDataUrl],
            generationParams: {
              prompt: 'draw',
              model: 'forma',
            },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(createPendingGeneration).toHaveBeenCalledWith('project-1', {
      content: 'draw',
      inputImages: [imageDataUrl],
      generationParams: {
        prompt: 'draw',
        model: 'forma',
      },
    });
  });
});
