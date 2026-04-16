import type { AspectRatioId, StylePresetId } from './arch-types';
import type { GeminiModelId, ProviderKey } from './provider-config';
import type { ConversationHistoryMessage } from './workspace-types';

export interface PersistedAssistantMessagePayload {
  id: string;
  projectId: string;
  role: 'assistant';
  content: string;
  inputImage: string | null;
  inputImages: string[];
  outputImage: string | null;
  maskImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: string;
}

// 图像生成请求
export interface GenerateImageRequest {
  prompt: string;
  provider?: ProviderKey;
  modelId: GeminiModelId;
  // 用于编辑模式的参考图像 (base64)
  referenceImage?: string;
  // 多图参考 (base64 数组，最多 10 张)
  referenceImages?: string[];
  // Architectural enhancement options
  // 建筑增强选项
  stylePreset?: StylePresetId;
  aspectRatio?: AspectRatioId;
  useSystemPrompt?: boolean;
  templateId?: string;
  imageSize?: '1K' | '2K' | '4K';
  conversationHistory?: ConversationHistoryMessage[];
  projectId?: string;
  assistantMessageId?: string;
}

// 图像生成响应
export interface GenerateImageResponse {
  image?: string; // base64 编码的图像
  text?: string; // 模型返回的文本描述（如果有）
  error?: string;
  message?: PersistedAssistantMessagePayload;
  creditsUsed?: number;
}

// 对话式编辑请求
export interface EditImageRequest {
  // 对话历史
  messages: ConversationHistoryMessage[];
  modelId: GeminiModelId;
  imageSize?: '1K' | '2K' | '4K';
}

// 对话式编辑响应
export interface EditImageResponse {
  image?: string;
  text?: string;
  error?: string;
}
