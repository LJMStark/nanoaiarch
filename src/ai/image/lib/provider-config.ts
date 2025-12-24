// Forma AI 配置 - 支持 Gemini 和 Vertex AI Imagen 模型
export type ProviderKey = 'gemini' | 'vertex';
export type ModelMode = 'fast' | 'quality' | 'premium';

// Gemini 模型 ID
export const GEMINI_MODEL_IDS = {
  // Forma AI - Gemini 2.0 Flash (快速，支持原生图像生成)
  forma: 'gemini-2.0-flash-exp',
  // Forma Pro - Gemini 2.0 Flash (高质量，高级渲染)
  'forma-pro': 'gemini-2.0-flash-exp',
  // Nano Banana Pro - Vertex AI Imagen 4 Fast (专业级图像生成)
  'nano-banana-pro': 'imagen-4.0-fast-generate-001',
} as const;

export type GeminiModelId = keyof typeof GEMINI_MODEL_IDS;

// 标识哪些模型使用 Vertex AI Imagen
export const VERTEX_IMAGEN_MODELS: GeminiModelId[] = ['nano-banana-pro'];

// 检查模型是否使用 Vertex AI Imagen
export function isVertexImagenModel(modelId: string): boolean {
  return VERTEX_IMAGEN_MODELS.includes(modelId as GeminiModelId);
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
    displayName: 'Forma AI',
    iconPath: '/provider-icons/gemini.svg',
    color: 'from-violet-500 to-purple-600',
    models: ['forma', 'forma-pro'],
  },
  vertex: {
    displayName: 'Nano Banana',
    iconPath: '/provider-icons/vertex.svg',
    color: 'from-amber-500 to-orange-600',
    models: ['nano-banana-pro'],
  },
};

// 模型显示名称
export const MODEL_DISPLAY_NAMES: Record<GeminiModelId, string> = {
  forma: 'Forma',
  'forma-pro': 'Forma Pro',
  'nano-banana-pro': 'Nano Banana Pro',
};

// 模型描述
export const MODEL_DESCRIPTIONS: Record<GeminiModelId, string> = {
  forma: 'Fast and efficient architectural visualization',
  'forma-pro': 'Higher quality with advanced rendering',
  'nano-banana-pro': 'Premium quality with Imagen 4 (Vertex AI)',
};

// 模型模式配置
export const MODEL_CONFIGS: Record<ModelMode, GeminiModelId> = {
  fast: 'forma',
  quality: 'forma-pro',
  premium: 'nano-banana-pro',
};

// 默认配置
export const DEFAULT_MODEL: GeminiModelId = 'forma';
export const DEFAULT_PROVIDER: ProviderKey = 'gemini';

// Provider 顺序
export const PROVIDER_ORDER: ProviderKey[] = ['gemini', 'vertex'];

// 初始化 Provider 记录的辅助函数
export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue])
  ) as Record<ProviderKey, T>;
