// Arch AI 配置 - 支持 Duomi API 模型
export type ProviderKey = 'duomi';

// Duomi 模型 ID - 使用最新的 nano-banana-pro
export const DUOMI_MODEL_IDS = {
  // Nano Banana Pro (Gemini 3 Pro) - 支持 1K/2K/4K，0.14/次
  forma: 'gemini-3-pro-image-preview',
} as const;

export type GeminiModelId = keyof typeof DUOMI_MODEL_IDS;

// Duomi 模型列表
export const DUOMI_MODELS: GeminiModelId[] = ['forma'];

// 检查模型是否使用 Duomi API
export function isDuomiModel(modelId: string): boolean {
  return DUOMI_MODELS.includes(modelId as GeminiModelId);
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
  duomi: {
    displayName: 'Arch AI',
    iconPath: '/provider-icons/gemini.svg',
    color: 'from-violet-500 to-purple-600',
    models: ['forma'],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  forma: 'Arch AI Pro',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  forma: 'High quality architectural visualization with 1K/2K/4K support',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'forma';
export const DEFAULT_PROVIDER: ProviderKey = 'duomi';

// Provider 顺序
export const PROVIDER_ORDER: ProviderKey[] = ['duomi'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
