import { logger } from '@/lib/logger';
import type { GeminiAspectRatio } from './gemini-client';

const DUOMI_API_BASE = 'https://duomiapi.com/v1';
const DUOMI_GENERATIONS_URL = `${DUOMI_API_BASE}/images/generations?async=true`;
const DUOMI_MODEL = 'gpt-image-2';
const REQUEST_TIMEOUT_MS = 140_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

type DuomiTaskState = 'pending' | 'running' | 'succeeded' | 'failed';

interface DuomiCreateTaskResponse {
  id?: string;
  error?: string;
  message?: string;
}

interface DuomiTaskResponse {
  state?: DuomiTaskState | string;
  error?: string;
  message?: string;
  data?: {
    images?: Array<{
      url?: string;
    }>;
  };
}

export interface GenerateDuomiImageParams {
  prompt: string;
  aspectRatio?: GeminiAspectRatio;
  signal?: AbortSignal;
  pollIntervalMs?: number;
}

export interface GenerateDuomiImageResult {
  success: boolean;
  image?: string;
  error?: string;
}

export interface CreateDuomiImageTaskResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface DuomiImageTaskStatusResult {
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'query_error';
  image?: string;
  error?: string;
}

function getDuomiApiKey(): string {
  const apiKey = process.env.DUOMI_API_KEY;
  if (!apiKey) {
    throw new Error('DUOMI_API_KEY is not set');
  }
  return apiKey;
}

function mapAspectRatioToDuomiSize(
  aspectRatio?: GeminiAspectRatio
): string | undefined {
  if (!aspectRatio || aspectRatio === 'auto') {
    return undefined;
  }

  return aspectRatio;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function getTaskError(task: DuomiTaskResponse): string {
  return task.error || task.message || '图片生成失败，请稍后重试';
}

function extractImageUrl(task: DuomiTaskResponse): string | undefined {
  return task.data?.images?.find((image) => image.url)?.url;
}

function normalizeTaskState(
  state: DuomiTaskResponse['state']
): DuomiImageTaskStatusResult['status'] {
  if (state === 'succeeded') {
    return 'succeeded';
  }

  if (state === 'failed' || state === 'error') {
    return 'failed';
  }

  if (state === 'running') {
    return 'running';
  }

  return 'pending';
}

export async function createDuomiImageTask(params: {
  prompt: string;
  aspectRatio?: GeminiAspectRatio;
  signal?: AbortSignal;
}): Promise<CreateDuomiImageTaskResult> {
  const apiKey = getDuomiApiKey();
  const body: Record<string, string> = {
    model: DUOMI_MODEL,
    prompt: params.prompt,
  };
  const size = mapAspectRatioToDuomiSize(params.aspectRatio);
  if (size) {
    body.size = size;
  }

  logger.ai.info(`[Duomi] Creating async image task [model=${DUOMI_MODEL}]`);

  try {
    const createResponse = await fetch(DUOMI_GENERATIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logger.ai.error(`[Duomi] Create task error: ${createResponse.status}`, {
        errorText,
      });
      return {
        success: false,
        error: '创建图片生成任务失败，请稍后重试',
      };
    }

    const task = await readJson<DuomiCreateTaskResponse>(createResponse);
    if (!task.id) {
      return {
        success: false,
        error: task.error || task.message || '创建图片生成任务失败',
      };
    }

    return {
      success: true,
      taskId: task.id,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.ai.info('[Duomi] Create task aborted by caller');
      return { success: false, error: '生成已取消' };
    }

    logger.ai.error('[Duomi] Create task error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

export async function getDuomiImageTaskStatus(
  taskId: string,
  signal?: AbortSignal
): Promise<DuomiImageTaskStatusResult> {
  const apiKey = getDuomiApiKey();

  const response = await fetch(
    `${DUOMI_API_BASE}/tasks/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: apiKey,
      },
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.ai.error(`[Duomi] Task query error: ${response.status}`, {
      taskId,
      errorText,
    });
    // Use query_error (not 'failed') for HTTP transport failures so callers
    // can retry instead of permanently terminating the task.
    return {
      status: 'query_error',
      error: '查询图片生成任务失败，请稍后重试',
    };
  }

  const task = await readJson<DuomiTaskResponse>(response);
  const status = normalizeTaskState(task.state);

  if (status === 'succeeded') {
    const imageUrl = extractImageUrl(task);
    if (!imageUrl) {
      return {
        status: 'failed',
        error: '图片生成成功但未返回图片地址',
      };
    }

    return {
      status: 'succeeded',
      image: imageUrl,
    };
  }

  if (status === 'failed') {
    return {
      status: 'failed',
      error: getTaskError(task),
    };
  }

  return { status };
}

async function pollDuomiTask(
  taskId: string,
  apiKey: string,
  signal: AbortSignal,
  pollIntervalMs: number
): Promise<GenerateDuomiImageResult> {
  while (!signal.aborted) {
    await sleep(pollIntervalMs, signal);

    const response = await fetch(
      `${DUOMI_API_BASE}/tasks/${encodeURIComponent(taskId)}`,
      {
        headers: {
          Authorization: apiKey,
        },
        signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.ai.error(`[Duomi] Task query error: ${response.status}`, {
        taskId,
        errorText,
      });
      return {
        success: false,
        error: '查询图片生成任务失败，请稍后重试',
      };
    }

    const task = await readJson<DuomiTaskResponse>(response);
    const status = normalizeTaskState(task.state);
    if (status === 'succeeded') {
      const imageUrl = extractImageUrl(task);
      if (!imageUrl) {
        return {
          success: false,
          error: '图片生成成功但未返回图片地址',
        };
      }

      return {
        success: true,
        image: imageUrl,
      };
    }

    if (status === 'failed') {
      return {
        success: false,
        error: getTaskError(task),
      };
    }
  }

  return {
    success: false,
    error: '生成已取消',
  };
}

export async function generateImageWithDuomi(
  params: GenerateDuomiImageParams
): Promise<GenerateDuomiImageResult> {
  const apiKey = getDuomiApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const handleAbort = () => controller.abort();

  if (params.signal) {
    if (params.signal.aborted) {
      clearTimeout(timeoutId);
      return { success: false, error: '生成已取消' };
    }
    params.signal.addEventListener('abort', handleAbort, { once: true });
  }

  try {
    const task = await createDuomiImageTask({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      signal: controller.signal,
    });
    if (!task.success || !task.taskId) {
      return {
        success: false,
        error: task.error || '创建图片生成任务失败',
      };
    }

    return await pollDuomiTask(
      task.taskId,
      apiKey,
      controller.signal,
      params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (params.signal?.aborted) {
        logger.ai.info('[Duomi] Request aborted by caller');
        return { success: false, error: '生成已取消' };
      }

      logger.ai.error('[Duomi] Request timeout');
      return { success: false, error: '请求超时，请重试' };
    }

    logger.ai.error('[Duomi] Request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  } finally {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener('abort', handleAbort);
  }
}
