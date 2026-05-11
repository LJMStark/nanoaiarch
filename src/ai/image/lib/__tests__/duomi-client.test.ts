import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDuomiImageTask,
  generateImageWithDuomi,
  getDuomiImageTaskStatus,
} from '../duomi-client';

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

describe('generateImageWithDuomi', () => {
  const originalApiKey = process.env.DUOMI_API_KEY;

  beforeEach(() => {
    process.env.DUOMI_API_KEY = 'test-duomi-key';
  });

  afterEach(() => {
    process.env.DUOMI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('creates an async gpt-image-2 task and polls until the image URL is ready', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'task-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'running', progress: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: 'succeeded',
          data: {
            images: [{ url: 'https://cdn.example.com/generated.png' }],
          },
        }),
      }) as typeof fetch;

    const result = await generateImageWithDuomi({
      prompt: 'Generate a modern chair',
      aspectRatio: '1:1',
      pollIntervalMs: 1,
    });

    expect(result).toEqual({
      success: true,
      image: 'https://cdn.example.com/generated.png',
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://duomiapi.com/v1/images/generations?async=true',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'test-duomi-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt: 'Generate a modern chair',
          size: '1:1',
        }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://duomiapi.com/v1/tasks/task-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'test-duomi-key',
        }),
      })
    );
  });
});

describe('createDuomiImageTask', () => {
  const originalApiKey = process.env.DUOMI_API_KEY;

  beforeEach(() => {
    process.env.DUOMI_API_KEY = 'test-duomi-key';
  });

  afterEach(() => {
    process.env.DUOMI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('creates a task without polling for completion', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'task-1' }),
    }) as typeof fetch;

    const result = await createDuomiImageTask({
      prompt: 'Generate a modern chair',
      aspectRatio: '1:1',
    });

    expect(result).toEqual({
      success: true,
      taskId: 'task-1',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://duomiapi.com/v1/images/generations?async=true',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt: 'Generate a modern chair',
          size: '1:1',
        }),
      })
    );
  });
});

describe('getDuomiImageTaskStatus', () => {
  const originalApiKey = process.env.DUOMI_API_KEY;

  beforeEach(() => {
    process.env.DUOMI_API_KEY = 'test-duomi-key';
  });

  afterEach(() => {
    process.env.DUOMI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('returns succeeded with image URL when the task is ready', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: 'succeeded',
        data: {
          images: [{ url: 'https://cdn.example.com/generated.png' }],
        },
      }),
    }) as typeof fetch;

    const result = await getDuomiImageTaskStatus('task-1');

    expect(result).toEqual({
      status: 'succeeded',
      image: 'https://cdn.example.com/generated.png',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://duomiapi.com/v1/tasks/task-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'test-duomi-key',
        }),
      })
    );
  });
});
