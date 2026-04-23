// Arch AI 配置 - 使用官方 Google Gemini API
export type ProviderKey = 'gemini';

// 官方 Gemini 模型 ID
// Nano Banana Pro = gemini-3-pro-image-preview (Gemini 3 Pro Image)
// Nano Banana 2   = gemini-3.1-flash-image-preview (Gemini 3.1 Flash Image)
export const GEMINI_MODEL_IDS = {
  forma: 'gemini-3-pro-image-preview',
  flash: 'gemini-3.1-flash-image-preview',
} as const;

export type GeminiModelId = keyof typeof GEMINI_MODEL_IDS;

// 模型列表 (用于验证)
export const GEMINI_MODELS: GeminiModelId[] = ['forma', 'flash'];

// 检查是否为有效模型
export function isGeminiModel(modelId: string): boolean {
  return GEMINI_MODELS.includes(modelId as GeminiModelId);
}

export function normalizeGeminiModelId(
  modelId: string | null | undefined
): GeminiModelId {
  return isGeminiModel(modelId ?? '')
    ? (modelId as GeminiModelId)
    : DEFAULT_MODEL;
}

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
    displayName: 'Arch AI',
    iconPath: '/provider-icons/gemini.svg',
    color: 'from-violet-500 to-purple-600',
    models: ['forma', 'flash'],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  forma: 'Arch AI Pro',
  flash: 'Arch AI Flash',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  forma: '高质量图像生成，支持 1K/2K/4K (Nano Banana Pro)',
  flash: '高速图像生成，性价比优选 (Nano Banana 2)',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'forma';
export const DEFAULT_PROVIDER: ProviderKey = 'gemini';

// Provider 顺序
export const PROVIDER_ORDER: ProviderKey[] = ['gemini'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
