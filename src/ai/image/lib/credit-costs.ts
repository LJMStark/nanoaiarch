import type { GeminiModelId } from './provider-config';

/**
 * 每个模型生成一张图片所消耗的 Credits
 * nano-banana-pro API 成本 0.14/次，所有分辨率价格相同
 */
export const CREDIT_COSTS: Record<GeminiModelId, number> = {
  // Arch AI Pro (Gemini 3 Pro / nano-banana-pro) - 1 credit/张
  forma: 1,
};

/**
 * 获取指定模型的 credit 消耗
 */
export function getCreditCost(modelId: GeminiModelId): number {
  return CREDIT_COSTS[modelId] ?? 1;
}
