import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  extractImageData,
  fetchWithTimeout,
  validateEditImageParams,
  validateGenerateImageParams,
} from './image-utils';

// Duomi API 配置
const DUOMI_API_BASE =
  process.env.DUOMI_API_BASE_URL || 'https://duomiapi.com/api/gemini';

// 轮询配置 - 使用指数退避策略
const INITIAL_POLL_DELAY_MS = 1000;
const MAX_POLL_DELAY_MS = 8000;
const BACKOFF_MULTIPLIER = 1.5;
const MAX_POLL_ATTEMPTS = 30;
const REQUEST_TIMEOUT_MS = 30000;

// Duomi 模型类型 - 使用最新的 nano-banana-pro
export type DuomiModelId = 'gemini-3-pro-image-preview';

// 画幅比例类型
export type DuomiAspectRatio =
  | 'auto'
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';

// 分辨率类型 - 支持 1K/2K/4K，价格相同，分辨率越高耗时越长
export type DuomiImageSize = '1K' | '2K' | '4K';

// 任务状态类型
export type DuomiTaskState = 'pending' | 'running' | 'succeeded' | 'error';

// ============================================
// Zod Validation Schemas for API Responses
// ============================================

const DuomiSubmitResponseSchema = z.object({
  code: z.number(),
  msg: z.string(),
  data: z.object({
    task_id: z.string(),
  }),
  exec_time: z.number(),
  ip: z.string(),
});

const DuomiImageSchema = z.union([
  z.string(),
  z.object({
    url: z.string().optional(),
    value: z.string().optional(),
    data: z.string().optional(),
  }),
]);

const DuomiTaskResponseSchema = z.object({
  code: z.number(),
  msg: z.string(),
  data: z.object({
    task_id: z.string(),
    state: z.enum(['pending', 'running', 'succeeded', 'error']),
    data: z.object({
      images: z.array(DuomiImageSchema),
      description: z.string(),
    }),
    create_time: z.string(),
    update_time: z.string(),
    msg: z.string(),
    status: z.string(),
    action: z.string(),
  }),
  exec_time: z.number(),
  ip: z.string(),
});

/**
 * 获取 Duomi API Key
 */
function getDuomiApiKey(): string {
  const apiKey = process.env.DUOMI_API_KEY;
  if (!apiKey) {
    throw new Error('DUOMI_API_KEY is not set');
  }
  return apiKey;
}

// ============================================
// 文生图 API
// ============================================

export interface GenerateImageParams {
  prompt: string;
  model?: DuomiModelId;
  aspectRatio?: DuomiAspectRatio;
  imageSize?: DuomiImageSize;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string; // base64 编码的图像
  text?: string; // 模型返回的描述
  error?: string;
}

type DuomiSubmitResponse = z.infer<typeof DuomiSubmitResponseSchema>;
type DuomiTaskResponse = z.infer<typeof DuomiTaskResponseSchema>;

/**
 * 提交文生图任务
 */
async function submitTextToImageTask(
  params: GenerateImageParams
): Promise<string> {
  // ✅ 添加 Zod 参数验证
  const validatedParams = validateGenerateImageParams(params);

  const {
    prompt,
    model = 'gemini-3-pro-image-preview',
    aspectRatio = 'auto',
    imageSize,
  } = validatedParams;
  const apiKey = getDuomiApiKey();

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    aspect_ratio: aspectRatio,
  };

  // 添加分辨率参数
  if (imageSize) {
    requestBody.image_size = imageSize;
  }

  logger.ai.info(`[Duomi] Submitting text-to-image task [model=${model}]`);

  // ✅ 使用超时包装器
  const response = await fetchWithTimeout(
    `${DUOMI_API_BASE}/nano-banana`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(requestBody),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Duomi API error: ${response.status} - ${errorText}`);
  }

  const rawData = await response.json();

  // Validate response with Zod
  const parseResult = DuomiSubmitResponseSchema.safeParse(rawData);
  if (!parseResult.success) {
    logger.ai.error(
      '[Duomi] Invalid submit response structure:',
      parseResult.error
    );
    throw new Error(
      'Invalid response from Duomi API: malformed submit response'
    );
  }

  const data = parseResult.data;

  if (data.code !== 200) {
    throw new Error(`Duomi API error: ${data.msg}`);
  }

  logger.ai.info(`[Duomi] Task submitted [task_id=${data.data.task_id}]`);
  return data.data.task_id;
}

/**
 * 查询任务状态
 */
async function queryTaskStatus(taskId: string): Promise<DuomiTaskResponse> {
  const apiKey = getDuomiApiKey();

  // ✅ 使用超时包装器
  const response = await fetchWithTimeout(
    `${DUOMI_API_BASE}/nano-banana/${taskId}`,
    {
      method: 'GET',
      headers: {
        Authorization: apiKey,
      },
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Duomi API error: ${response.status} - ${errorText}`);
  }

  const rawData = await response.json();

  // Validate response with Zod
  const parseResult = DuomiTaskResponseSchema.safeParse(rawData);
  if (!parseResult.success) {
    logger.ai.error(
      '[Duomi] Invalid task response structure:',
      parseResult.error
    );
    throw new Error('Invalid response from Duomi API: malformed task response');
  }

  return parseResult.data;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_POLL_DELAY_MS * BACKOFF_MULTIPLIER ** attempt,
    MAX_POLL_DELAY_MS
  );
  // Add jitter (±20%) to prevent synchronized requests
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  return Math.floor(exponentialDelay + jitter);
}

async function pollTaskUntilComplete(
  taskId: string
): Promise<DuomiTaskResponse> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const result = await queryTaskStatus(taskId);
    const state = result.data.state;

    logger.ai.debug(
      `[Duomi] Task status [task_id=${taskId}, state=${state}, attempt=${attempts + 1}/${MAX_POLL_ATTEMPTS}]`
    );

    if (state === 'succeeded') {
      logger.ai.info(
        `[Duomi] Task completed [task_id=${taskId}, attempts=${attempts + 1}]`
      );
      return result;
    }

    if (state === 'error') {
      throw new Error(result.data.msg || 'Task failed');
    }

    const delay = calculateBackoffDelay(attempts);
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;
  }

  throw new Error(`Task timeout after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * 使用 Duomi API 生成图像（文生图）
 */
export async function generateImageWithDuomi(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  try {
    // 1. 提交任务
    const taskId = await submitTextToImageTask(params);

    // 2. 轮询等待完成
    const result = await pollTaskUntilComplete(taskId);

    // 3. 返回结果
    const images = result.data.data.images;
    if (!images || images.length === 0) {
      return {
        success: false,
        error: 'No image generated',
        text: result.data.data.description,
      };
    }

    // ✅ 使用统一的图片提取函数
    const image = extractImageData(images[0]);

    return {
      success: true,
      image,
      text: result.data.data.description,
    };
  } catch (error) {
    logger.ai.error('[Duomi] Text-to-image generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================
// 图片编辑 API
// ============================================

export interface EditImageParams {
  prompt: string;
  imageUrls: string[]; // 参考图 URL 数组，最多 5 张
  model?: DuomiModelId;
  aspectRatio?: DuomiAspectRatio;
  imageSize?: DuomiImageSize;
}

/**
 * 提交图片编辑任务
 */
async function submitEditImageTask(params: EditImageParams): Promise<string> {
  // ✅ 添加 Zod 参数验证（包括 URL 白名单检查）
  const validatedParams = validateEditImageParams(params);

  const {
    prompt,
    imageUrls,
    model = 'gemini-3-pro-image-preview',
    aspectRatio = 'auto',
    imageSize,
  } = validatedParams;
  const apiKey = getDuomiApiKey();

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    image_urls: imageUrls,
    aspect_ratio: aspectRatio,
  };

  // 添加分辨率参数
  if (imageSize) {
    requestBody.image_size = imageSize;
  }

  logger.ai.info(
    `[Duomi] Submitting image edit task [model=${model}, imageCount=${imageUrls.length}]`
  );

  // ✅ 使用超时包装器
  const response = await fetchWithTimeout(
    `${DUOMI_API_BASE}/nano-banana-edit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(requestBody),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Duomi API error: ${response.status} - ${errorText}`);
  }

  const rawData = await response.json();

  // Validate response with Zod
  const parseResult = DuomiSubmitResponseSchema.safeParse(rawData);
  if (!parseResult.success) {
    logger.ai.error(
      '[Duomi] Invalid edit submit response structure:',
      parseResult.error
    );
    throw new Error(
      'Invalid response from Duomi API: malformed edit submit response'
    );
  }

  const data = parseResult.data;

  if (data.code !== 200) {
    throw new Error(`Duomi API error: ${data.msg}`);
  }

  logger.ai.info(`[Duomi] Edit task submitted [task_id=${data.data.task_id}]`);
  return data.data.task_id;
}

/**
 * 使用 Duomi API 编辑图像（图生图）
 */
export async function editImageWithDuomi(
  params: EditImageParams
): Promise<GenerateImageResult> {
  try {
    // 1. 提交任务
    const taskId = await submitEditImageTask(params);

    // 2. 轮询等待完成
    const result = await pollTaskUntilComplete(taskId);

    // 3. 返回结果
    const images = result.data.data.images;
    if (!images || images.length === 0) {
      return {
        success: false,
        error: 'No image generated',
        text: result.data.data.description,
      };
    }

    // ✅ 使用统一的图片提取函数
    const image = extractImageData(images[0]);

    return {
      success: true,
      image,
      text: result.data.data.description,
    };
  } catch (error) {
    logger.ai.error('[Duomi] Image edit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================
// 对话式编辑支持
// ============================================

export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // base64 或 URL
}

export interface EditImageWithConversationParams {
  messages: ConversationMessage[];
  model?: DuomiModelId;
  aspectRatio?: DuomiAspectRatio;
  imageSize?: DuomiImageSize;
}

/**
 * 对话式图像编辑
 * 从对话历史中提取最新的用户 prompt 和所有图片作为参考
 */
export async function editImageWithConversationDuomi(
  params: EditImageWithConversationParams
): Promise<GenerateImageResult> {
  const { messages, model, aspectRatio, imageSize } = params;

  // 提取最新的用户消息作为 prompt
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) {
    return {
      success: false,
      error: 'No user message found',
    };
  }

  const latestUserMessage = userMessages[userMessages.length - 1];
  const prompt = latestUserMessage.content;

  // 收集所有图片 URL（从对话历史中）
  // 优先使用用户消息中的图片，然后是模型生成的图片
  const imageUrls: string[] = [];
  for (const msg of messages) {
    if (msg.image) {
      // 如果是 base64，需要先上传转换为 URL（这里假设已经是 URL）
      // 实际使用时可能需要实现 base64 到 URL 的转换
      if (msg.image.startsWith('http')) {
        imageUrls.push(msg.image);
      }
    }
  }

  // 如果没有图片 URL，尝试使用文生图
  if (imageUrls.length === 0) {
    return generateImageWithDuomi({
      prompt,
      model,
      aspectRatio,
      imageSize,
    });
  }

  // 限制最多 5 张图片
  const limitedImageUrls = imageUrls.slice(-5);

  return editImageWithDuomi({
    prompt,
    imageUrls: limitedImageUrls,
    model,
    aspectRatio,
    imageSize,
  });
}
