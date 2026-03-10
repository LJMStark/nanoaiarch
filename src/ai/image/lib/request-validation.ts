import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
} from '@/ai/image/components/ImageQualitySelect';
import { validateBase64Image } from './api-utils';

const VALID_IMAGE_SIZES: readonly ImageQuality[] = ['1K', '2K', '4K'];
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
      error: 'Invalid image size. Must be 1K, 2K, or 4K',
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
      error: `Maximum ${MAX_REFERENCE_IMAGES} reference images allowed`,
    };
  }

  for (const [index, image] of images.entries()) {
    if (typeof image !== 'string') {
      return {
        valid: false,
        error: `Invalid reference image at index ${index}`,
      };
    }

    const validation = validateBase64Image(image);
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error || `Invalid reference image at index ${index}`,
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
      error: 'conversationHistory must be an array',
    };
  }

  if (messages.length > MAX_CONVERSATION_MESSAGES) {
    return {
      valid: false,
      error: `Maximum ${MAX_CONVERSATION_MESSAGES} conversation messages allowed`,
    };
  }

  for (const [index, message] of messages.entries()) {
    if (message.role !== 'user' && message.role !== 'model') {
      return {
        valid: false,
        error: `Invalid role at conversation message ${index}`,
      };
    }

    if (typeof message.content !== 'string') {
      return {
        valid: false,
        error: `Invalid content at conversation message ${index}`,
      };
    }

    if (message.content.length > MAX_HISTORY_CONTENT_LENGTH) {
      return {
        valid: false,
        error: `Conversation message ${index} content is too long`,
      };
    }

    if (message.image !== undefined) {
      if (typeof message.image !== 'string') {
        return {
          valid: false,
          error: `Invalid image payload at conversation message ${index}`,
        };
      }

      const validation = validateBase64Image(message.image);
      if (!validation.valid) {
        return {
          valid: false,
          error:
            validation.error ||
            `Invalid image payload at conversation message ${index}`,
        };
      }
    }
  }

  return { valid: true };
}
