import type { AspectRatioId, StylePresetId } from './arch-types';
import type { GeminiModelId, ProviderKey } from './provider-config';

// 图像生成请求
export interface GenerateImageRequest {
  prompt: string;
  provider: ProviderKey;
  modelId: GeminiModelId;
  // 用于编辑模式的参考图像 (base64)
  referenceImage?: string;
  // 多图参考 (base64 数组，最多 5 张)
  referenceImages?: string[];
  // Architectural enhancement options
  // 建筑增强选项
  stylePreset?: StylePresetId;
  aspectRatio?: AspectRatioId;
  useSystemPrompt?: boolean;
  templateId?: string;
}

// 图像生成响应
export interface GenerateImageResponse {
  image?: string; // base64 编码的图像
  text?: string; // 模型返回的文本描述（如果有）
  error?: string;
}

// 对话式编辑请求
export interface EditImageRequest {
  // 对话历史
  messages: Array<{
    role: 'user' | 'model';
    content: string;
    image?: string; // base64 编码的图像
  }>;
  modelId: GeminiModelId;
}

// 对话式编辑响应
export interface EditImageResponse {
  image?: string;
  text?: string;
  error?: string;
}
