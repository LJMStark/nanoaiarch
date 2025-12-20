// Nano Banana 专用配置 - 仅使用 Gemini 模型
export type ProviderKey = 'gemini';
export type ModelMode = 'fast' | 'quality';

// Gemini 模型 ID
export const GEMINI_MODEL_IDS = {
  // Nano Banana - Gemini 2.5 Flash Image (快速)
  'nano-banana': 'gemini-2.5-flash-preview-05-20',
  // Gemini 2.0 Flash (高质量)
  'nano-banana-pro': 'gemini-2.0-flash-exp',
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
    displayName: 'Nano Banana',
    iconPath: '/provider-icons/gemini.svg',
    color: 'from-yellow-400 to-orange-500',
    models: ['nano-banana', 'nano-banana-pro'],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  'nano-banana': 'Nano Banana',
  'nano-banana-pro': 'Nano Banana Pro',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  'nano-banana': 'Fast and efficient image generation',
  'nano-banana-pro': 'Higher quality with advanced reasoning',
};

// 模型模式配置
export const MODEL_CONFIGS: Record<ModelMode, GeminiModelId> = {
  fast: 'nano-banana',
  quality: 'nano-banana-pro',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'nano-banana';
export const DEFAULT_PROVIDER: ProviderKey = 'gemini';

// Provider 顺序（只有一个）
export const PROVIDER_ORDER: ProviderKey[] = ['gemini'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
