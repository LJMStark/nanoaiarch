// Forma AI 配置 - 支持 Duomi API 模型
export type ProviderKey = 'duomi';
export type ModelMode = 'fast' | 'quality';

// Duomi 模型 ID
export const DUOMI_MODEL_IDS = {
  // Duomi Gemini 2.5 Pro (快速，高效图像生成)
  forma: 'gemini-2.5-pro-image-preview',
  // Duomi Gemini 3 Pro (高质量，支持更高分辨率)
  'forma-pro': 'gemini-3-pro-image-preview',
} as const;

export type GeminiModelId = keyof typeof DUOMI_MODEL_IDS;

// 向后兼容：保留 GEMINI_MODEL_IDS 别名
export const GEMINI_MODEL_IDS = DUOMI_MODEL_IDS;

// Duomi 模型列表（全部使用 Duomi API）
export const DUOMI_MODELS: GeminiModelId[] = ['forma', 'forma-pro'];

// 检查模型是否使用 Duomi API（现在所有模型都使用 Duomi）
export function isDuomiModel(modelId: string): boolean {
  return DUOMI_MODELS.includes(modelId as GeminiModelId);
}

// 向后兼容：保留 isVertexImagenModel 函数（现在始终返回 false）
export function isVertexImagenModel(_modelId: string): boolean {
  return false;
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
    displayName: 'Nano AI',
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
  'forma-pro': 'Higher quality with advanced rendering and 4K support',
};

// 模型模式配置
export const MODEL_CONFIGS: Record<ModelMode, GeminiModelId> = {
  fast: 'forma',
  quality: 'forma-pro',
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
