import { GEMINI_MODEL_IDS, type GeminiModelId } from './provider-config';

/**
 * 请求超时时间（55 秒）
 * 略低于运行时最大执行时间，以便优雅地终止请求
 */
export const TIMEOUT_MILLIS = 55 * 1000;

/**
 * 带超时的 Promise 包装器
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMillis: number = TIMEOUT_MILLIS
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMillis)
    ),
  ]);
};

/**
 * 生成安全的请求 ID
 */
export const generateRequestId = (): string => {
  return crypto.randomUUID().slice(0, 8);
};

/**
 * Gemini 模型 Key 类型
 */
export type GeminiModelKey = 'forma' | 'gemini-flash';

/**
 * 将 Forma AI 模型 ID 映射到 Gemini 客户端的模型 key
 */
export const mapModelIdToGeminiKey = (modelId: string): GeminiModelKey => {
  if (modelId === 'forma' || modelId === GEMINI_MODEL_IDS.forma) {
    return 'forma';
  }
  if (modelId === 'forma-pro' || modelId === GEMINI_MODEL_IDS['forma-pro']) {
    return 'gemini-flash';
  }
  // 默认使用 forma
  return 'forma';
};

/**
 * Prompt 验证
 */
const MAX_PROMPT_LENGTH = 4000;
const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
];

export interface PromptValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePrompt(prompt: string): PromptValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt is required' };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { valid: false, error: 'Invalid prompt content detected' };
    }
  }

  return { valid: true };
}
