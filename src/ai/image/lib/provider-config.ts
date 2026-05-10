// Arch AI 配置 - 支持 Gemini 与 Duomi 图片模型
export type ProviderKey = 'gemini';

// 官方 Gemini 模型 ID
// Nano Banana Pro = gemini-3-pro-image-preview (Gemini 3 Pro Image)
// Nano Banana 2   = gemini-3.1-flash-image-preview (Gemini 3.1 Flash Image)
export const GEMINI_MODEL_IDS = {
  forma: 'gemini-3-pro-image-preview',
  flash: 'gemini-3.1-flash-image-preview',
} as const;

export type GeminiBackendModelId = keyof typeof GEMINI_MODEL_IDS;

export const DUOMI_MODEL_IDS = {
  gptImage2: 'gpt-image-2',
} as const;

export type GeminiModelId =
  | GeminiBackendModelId
  | (typeof DUOMI_MODEL_IDS)[keyof typeof DUOMI_MODEL_IDS];

// 模型列表 (用于验证)
export const GEMINI_MODELS: GeminiModelId[] = [
  'forma',
  'flash',
  DUOMI_MODEL_IDS.gptImage2,
];

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
    models: ['forma', 'flash', DUOMI_MODEL_IDS.gptImage2],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  forma: 'Arch AI Pro',
  flash: 'Arch AI Flash',
  'gpt-image-2': 'GPT Image 2',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  forma: '高质量图像生成，支持 1K/2K/4K (Nano Banana Pro)',
  flash: '高速图像生成，性价比优选 (Nano Banana 2)',
  'gpt-image-2': 'Duomi 异步图像生成模型',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'flash';
export const DEFAULT_PROVIDER: ProviderKey = 'gemini';

// Provider 顺序
export const PROVIDER_ORDER: ProviderKey[] = ['gemini'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
