// Forma AI 专用配置 - 仅使用 Gemini 模型
export type ProviderKey = 'gemini';
export type ModelMode = 'fast' | 'quality';

// Gemini 模型 ID
export const GEMINI_MODEL_IDS = {
  // Forma AI - Gemini 2.0 Flash (快速，支持原生图像生成)
  forma: 'gemini-2.0-flash-exp',
  // Forma Pro - Gemini 2.0 Flash (高质量，高级渲染)
  'forma-pro': 'gemini-2.0-flash-exp',
} as const;

export type GeminiModelId = keyof typeof GEMINI_MODEL_IDS;

// Provider 配置
export const PROVIDERS: Record<
  ProviderKey,
  {
    displayName: string;
    iconPath: string;
    color: string;
    models: GeminiModelId[];
  }
> = {
  gemini: {
    displayName: 'Forma AI',
    iconPath: '/provider-icons/gemini.svg',
    color: 'from-violet-500 to-purple-600',
    models: ['forma', 'forma-pro'],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  forma: 'Forma',
  'forma-pro': 'Forma Pro',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  forma: 'Fast and efficient architectural visualization',
  'forma-pro': 'Higher quality with advanced rendering',
};

// 模型模式配置
export const MODEL_CONFIGS: Record<ModelMode, GeminiModelId> = {
  fast: 'forma',
  quality: 'forma-pro',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'forma';
export const DEFAULT_PROVIDER: ProviderKey = 'gemini';

// Provider 顺序（只有一个）
export const PROVIDER_ORDER: ProviderKey[] = ['gemini'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
