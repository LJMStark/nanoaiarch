import type { GeminiModelId } from './provider-config';

/**
 * 每个模型生成一张图片所消耗的 Credits
 */
export const CREDIT_COSTS: Record<GeminiModelId, number> = {
  // Forma (快速模式) - 1 credit/张
  forma: 1,
  // Forma Pro (高质量模式) - 3 credits/张
  'forma-pro': 3,
  // Nano Banana Pro (Vertex AI Imagen 4) - 5 credits/张
  'nano-banana-pro': 5,
};

/**
 * 获取指定模型的 credit 消耗
 */
export function getCreditCost(modelId: GeminiModelId): number {
  return CREDIT_COSTS[modelId] ?? 1;
}
