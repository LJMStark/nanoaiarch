import { describe, expect, it } from 'vitest';
import {
  CHAT_MODEL_COSTS,
  WEB_SEARCH_CREDIT_COST,
  WEB_SEARCH_MODEL_ID,
  resolveChatRequestPolicy,
} from '../chat-policy';

describe('resolveChatRequestPolicy', () => {
  it('allows configured chat models and returns their credit cost', () => {
    const firstModel = Object.keys(CHAT_MODEL_COSTS)[0];

    const result = resolveChatRequestPolicy({
      model: firstModel,
      webSearch: false,
    });

    expect(result).toEqual({
      modelId: firstModel,
      creditCost: CHAT_MODEL_COSTS[firstModel],
    });
  });

  it('rejects unknown chat models', () => {
    expect(
      resolveChatRequestPolicy({
        model: 'openai/gpt-5',
        webSearch: false,
      })
    ).toBeNull();
  });

  it('forces the server-side web search model and cost', () => {
    expect(
      resolveChatRequestPolicy({
        model: 'openai/gpt-5',
        webSearch: true,
      })
    ).toEqual({
      modelId: WEB_SEARCH_MODEL_ID,
      creditCost: WEB_SEARCH_CREDIT_COST,
    });
  });
});
