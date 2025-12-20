import type { GeminiModelId, ProviderKey } from './provider-config';

// 生成的图像结果
export interface GeneratedImage {
  provider: ProviderKey;
  image: string | null;
  modelId?: GeminiModelId;
  text?: string; // 模型返回的文本描述
}

export interface ImageResult {
  provider: ProviderKey;
  image: string | null;
  modelId?: GeminiModelId;
  text?: string;
}

export interface ImageError {
  provider: ProviderKey;
  message: string;
}

export interface ProviderTiming {
  startTime?: number;
  completionTime?: number;
  elapsed?: number;
}

// 对话式编辑相关类型
export interface ConversationMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string; // base64 编码的图像
  timestamp: number;
}

export interface EditSession {
  id: string;
  messages: ConversationMessage[];
  currentImage?: string; // 当前编辑的图像
  modelId: GeminiModelId;
  createdAt: number;
  updatedAt: number;
}

// 编辑历史记录
export interface EditHistoryItem {
  id: string;
  prompt: string;
  beforeImage?: string;
  afterImage: string;
  timestamp: number;
}

// 图像生成/编辑模式
export type ImageMode = 'generate' | 'edit';
