export const CHAT_MODEL_COSTS: Record<string, number> = {
  'openai/gpt-4.1-mini': 1,
  'openai/gpt-4.1': 3,
  'anthropic/claude-3-5-sonnet-latest': 3,
};

export const WEB_SEARCH_MODEL_ID = 'perplexity/sonar';
export const WEB_SEARCH_CREDIT_COST = 5;

interface ResolveChatRequestPolicyParams {
  model: string;
  webSearch: boolean;
}

export function resolveChatRequestPolicy({
  model,
  webSearch,
}: ResolveChatRequestPolicyParams): {
  modelId: string;
  creditCost: number;
} | null {
  if (webSearch) {
    return {
      modelId: WEB_SEARCH_MODEL_ID,
      creditCost: WEB_SEARCH_CREDIT_COST,
    };
  }

  if (!(model in CHAT_MODEL_COSTS)) {
    return null;
  }

  return {
    modelId: model,
    creditCost: CHAT_MODEL_COSTS[model as keyof typeof CHAT_MODEL_COSTS],
  };
}
