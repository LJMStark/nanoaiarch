import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
  VALID_IMAGE_SIZES,
} from '@/ai/image/lib/image-constants';
import { validateBase64Image } from './api-utils';
import type {
  ConversationHistoryMessage,
  GeminiConversationPart,
} from './workspace-types';

const MAX_REFERENCE_IMAGES = 5;
const MAX_CONVERSATION_MESSAGES = 10;
const MAX_HISTORY_CONTENT_LENGTH = 4000;

function formatImageValidationError(
  index: number,
  kind: 'reference' | 'conversation',
  error: string | undefined
): string {
  if (kind === 'reference') {
    if (error === '图片来源未被允许') {
      return `第 ${index + 1} 张参考图图片来源未被允许`;
    }

    return error || `第 ${index + 1} 张参考图无效`;
  }

  if (error === '图片来源未被允许') {
    return `第 ${index + 1} 条对话消息图片来源未被允许`;
  }

  return error || `第 ${index + 1} 条对话消息图片无效`;
}

type ValidationResult = { valid: true } | { valid: false; error: string };

function validateConversationPart(
  part: GeminiConversationPart,
  messageIndex: number,
  partIndex: number
): ValidationResult {
  if (part.type === 'text') {
    if (typeof part.text !== 'string' || part.text.length === 0) {
      return {
        valid: false,
        error: `第 ${messageIndex + 1} 条对话消息第 ${partIndex + 1} 个片段文本无效`,
      };
    }

    if (part.text.length > MAX_HISTORY_CONTENT_LENGTH) {
      return {
        valid: false,
        error: `第 ${messageIndex + 1} 条对话消息第 ${partIndex + 1} 个片段文本过长`,
      };
    }
  }

  if (part.type === 'image' && part.mimeType !== undefined) {
    if (typeof part.mimeType !== 'string' || part.mimeType.length === 0) {
      return {
        valid: false,
        error: `第 ${messageIndex + 1} 条对话消息第 ${partIndex + 1} 个图片片段类型无效`,
      };
    }
  }

  if (
    part.thoughtSignature !== undefined &&
    (typeof part.thoughtSignature !== 'string' ||
      part.thoughtSignature.length === 0)
  ) {
    return {
      valid: false,
      error: `第 ${messageIndex + 1} 条对话消息第 ${partIndex + 1} 个片段签名无效`,
    };
  }

  return { valid: true };
}

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
        error: formatImageValidationError(index, 'reference', validation.error),
      };
    }
  }

  return { valid: true };
}

export function validateConversationMessages(
  messages: ConversationHistoryMessage[] | undefined
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
          error: formatImageValidationError(
            index,
            'conversation',
            validation.error
          ),
        };
      }
    }

    if (message.parts !== undefined) {
      if (!Array.isArray(message.parts)) {
        return {
          valid: false,
          error: `第 ${index + 1} 条对话消息片段格式错误`,
        };
      }

      for (const [partIndex, part] of message.parts.entries()) {
        if (
          !part ||
          typeof part !== 'object' ||
          (part.type !== 'text' && part.type !== 'image')
        ) {
          return {
            valid: false,
            error: `第 ${index + 1} 条对话消息第 ${partIndex + 1} 个片段无效`,
          };
        }

        const partValidation = validateConversationPart(part, index, partIndex);
        if (!partValidation.valid) {
          return partValidation;
        }
      }
    }
  }

  return { valid: true };
}
