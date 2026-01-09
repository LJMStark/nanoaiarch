import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * 图片 URL/Base64 格式检测和转换
 */
export function getImageSrc(imageData: string): string {
  return imageData.startsWith('http://') || imageData.startsWith('https://')
    ? imageData
    : `data:image/png;base64,${imageData}`;
}

/**
 * 验证是否为有效的 base64 字符串
 * 改进的验证逻辑：检查长度、填充和字符集
 */
export function isValidBase64(str: string): boolean {
  if (!str || str.length < 100) return false;

  // Base64 字符串长度必须是 4 的倍数
  if (str.length % 4 !== 0) return false;

  // 验证字符集：只允许 A-Z, a-z, 0-9, +, / 和最多2个 = 填充
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Pattern.test(str);
}

/**
 * 验证是否为安全的图片 URL
 * 使用白名单机制，只允许特定域名
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // 只允许 HTTPS 协议
    if (parsed.protocol !== 'https:') {
      logger.ai.warn('[Image Utils] Rejected non-HTTPS URL', { url });
      return false;
    }

    // URL 白名单：允许的图片域名
    const allowedDomains = [
      'dmiapi.com',
      'duomiapi.com',
      'cloudfront.net', // AWS CloudFront CDN (Duomi 备用)
      'replicate.delivery',
      'oaidalleapiprodscus.blob.core.windows.net', // OpenAI DALL-E
      'cdn.openai.com',
    ];

    // 检查域名是否在白名单中（支持子域名）
    const isAllowed = allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      logger.ai.warn('[Image Utils] Rejected URL from untrusted domain', {
        hostname: parsed.hostname,
      });
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 从 API 响应中安全提取图片数据
 * 支持字符串和对象格式，并进行验证
 */
export function extractImageData(rawImage: unknown): string {
  // 处理字符串格式
  if (typeof rawImage === 'string') {
    return validateAndReturnImage(rawImage);
  }

  // 处理对象格式
  if (typeof rawImage === 'object' && rawImage !== null) {
    const obj = rawImage as Record<string, unknown>;
    const imageData =
      (obj.url as string) ||
      (obj.value as string) ||
      (obj.data as string) ||
      '';

    if (!imageData) {
      throw new Error('No image data found in object');
    }

    return validateAndReturnImage(imageData);
  }

  throw new Error(
    `Invalid image format: expected string or object, got ${typeof rawImage}`
  );
}

/**
 * 验证并返回图片数据
 * 内部辅助函数
 */
function validateAndReturnImage(imageData: string): string {
  if (!imageData || !imageData.trim()) {
    throw new Error('Empty image data');
  }

  // 检查是否为 URL
  const isUrl =
    imageData.startsWith('http://') || imageData.startsWith('https://');

  if (isUrl) {
    // 验证 URL 安全性
    if (!isValidImageUrl(imageData)) {
      throw new Error('Image URL failed security validation');
    }
    return imageData;
  }

  // 检查是否为有效的 Base64
  if (!isValidBase64(imageData)) {
    throw new Error('Invalid base64 image data');
  }

  return imageData;
}

/**
 * Fetch 超时包装器
 * 为 fetch 请求添加超时控制
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ============================================
// Zod 验证 Schema
// ============================================

/**
 * 图片生成参数验证 Schema
 */
export const generateImageParamsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(4000, 'Prompt is too long (max 4000 characters)'),
  model: z.string().optional(),
  aspectRatio: z
    .enum([
      'auto',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ])
    .optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
});

/**
 * 图片编辑参数验证 Schema
 */
export const editImageParamsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(4000, 'Prompt is too long (max 4000 characters)'),
  imageUrls: z
    .array(z.string().url('Invalid image URL'))
    .min(1, 'At least one reference image is required')
    .max(5, 'Maximum 5 reference images allowed')
    .refine(
      (urls) => urls.every(isValidImageUrl),
      'One or more image URLs failed security validation'
    ),
  model: z.string().optional(),
  aspectRatio: z
    .enum([
      'auto',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ])
    .optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
});

/**
 * 类型安全的参数验证辅助函数
 */
export function validateGenerateImageParams<T>(
  params: T
): z.infer<typeof generateImageParamsSchema> {
  return generateImageParamsSchema.parse(params);
}

export function validateEditImageParams<T>(
  params: T
): z.infer<typeof editImageParamsSchema> {
  return editImageParamsSchema.parse(params);
}
