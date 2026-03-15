import type { GeminiModelId } from './provider-config';

/**
 * 每个模型生成一张图片所消耗的 Credits
 */
export const CREDIT_COSTS: Record<GeminiModelId, number> = {
  // Arch AI Pro (Gemini 3 Pro / Nano Banana Pro) - 1 credit/张
  forma: 1,
  // Arch AI Flash (Gemini 3.1 Flash / Nano Banana 2) - 1 credit/张
  flash: 1,
};

/**
 * 获取指定模型的 credit 消耗
 */
export function getCreditCost(modelId: GeminiModelId): number {
  return CREDIT_COSTS[modelId] ?? 1;
}
