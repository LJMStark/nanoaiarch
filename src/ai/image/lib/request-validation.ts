import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
  VALID_IMAGE_SIZES,
} from '@/ai/image/lib/image-constants';
import { validateBase64Image } from './api-utils';
const MAX_REFERENCE_IMAGES = 5;
const MAX_CONVERSATION_MESSAGES = 10;
const MAX_HISTORY_CONTENT_LENGTH = 4000;

type ConversationMessage = {
  role: 'user' | 'model';
  content: string;
  image?: string;
};

type ValidationResult = { valid: true } | { valid: false; error: string };

export function resolveRequestedImageSize(
  requestedImageSize: string | undefined,
  fallbackImageSize: ImageQuality = DEFAULT_IMAGE_QUALITY
): { valid: true; value: ImageQuality } | { valid: false; error: string } {
  if (!requestedImageSize) {
    return {
      valid: true,
      value: fallbackImageSize,
    };
  }

  if (!VALID_IMAGE_SIZES.includes(requestedImageSize as ImageQuality)) {
    return {
      valid: false,
      error: '无效的图片尺寸，必须为 1K、2K 或 4K',
    };
  }

  return {
    valid: true,
    value: requestedImageSize as ImageQuality,
  };
}

export function validateReferenceImages(
  referenceImage: string | undefined,
  referenceImages: string[] | undefined
): ValidationResult {
  const images = [
    ...(referenceImage ? [referenceImage] : []),
    ...(referenceImages ?? []),
  ];

  if (images.length > MAX_REFERENCE_IMAGES) {
    return {
      valid: false,
      error: `最多上传 ${MAX_REFERENCE_IMAGES} 张参考图`,
    };
  }

  for (const [index, image] of images.entries()) {
    if (typeof image !== 'string') {
      return {
        valid: false,
        error: `第 ${index + 1} 张参考图无效`,
      };
    }

    const validation = validateBase64Image(image);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error || `第 ${index + 1} 张参考图无效`,
      };
    }
  }

  return { valid: true };
}

export function validateConversationMessages(
  messages: ConversationMessage[] | undefined
): ValidationResult {
  if (!messages) {
    return { valid: true };
  }

  if (!Array.isArray(messages)) {
    return {
      valid: false,
      error: '对话历史格式错误',
    };
  }

  if (messages.length > MAX_CONVERSATION_MESSAGES) {
    return {
      valid: false,
      error: `对话消息最多 ${MAX_CONVERSATION_MESSAGES} 条`,
    };
  }

  for (const [index, message] of messages.entries()) {
    if (message.role !== 'user' && message.role !== 'model') {
      return {
        valid: false,
        error: `第 ${index + 1} 条对话消息角色无效`,
      };
    }

    if (typeof message.content !== 'string') {
      return {
        valid: false,
        error: `第 ${index + 1} 条对话消息内容无效`,
      };
    }

    if (message.content.length > MAX_HISTORY_CONTENT_LENGTH) {
      return {
        valid: false,
        error: `第 ${index + 1} 条对话消息内容过长`,
      };
    }

    if (message.image !== undefined) {
      if (typeof message.image !== 'string') {
        return {
          valid: false,
          error: `第 ${index + 1} 条对话消息图片无效`,
        };
      }

      const validation = validateBase64Image(message.image);
      if (!validation.valid) {
        return {
          valid: false,
          error:
            validation.error ||
            `第 ${index + 1} 条对话消息图片无效`,
        };
      }
    }
  }

  return { valid: true };
}
