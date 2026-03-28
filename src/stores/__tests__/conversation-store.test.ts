import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationStore } from '../conversation-store';

function createMessage(
  id: string,
  overrides: Partial<ProjectMessageItem> = {}
): ProjectMessageItem {
  return {
    id,
    projectId: 'project-1',
    role: 'assistant',
    content: '',
    inputImage: null,
    outputImage: null,
    maskImage: null,
    generationParams: null,
    creditsUsed: null,
    generationTime: null,
    status: 'generating',
    errorMessage: null,
    orderIndex: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('conversation-store', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  it('aborts active generation when switching project without storage warnings', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');
    const store = useConversationStore.getState();

    store.setAbortController(controller);
    store.setGenerating(true, 'msg-1');
    store.setGenerationStage('generating');

    store.setCurrentProject('project-1');

    const nextState = useConversationStore.getState();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(nextState.abortController).toBeNull();
    expect(nextState.isGenerating).toBe(false);
    expect(nextState.generatingMessageId).toBeNull();
    expect(nextState.generationStage).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('aborts active generation when clearing messages without storage warnings', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');
    const store = useConversationStore.getState();

    store.setMessages([createMessage('msg-1')]);
    store.setAbortController(controller);
    store.setGenerating(true, 'msg-1');
    store.setGenerationStage('finishing');

    store.clearMessages();

    const nextState = useConversationStore.getState();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(nextState.messages).toHaveLength(0);
    expect(nextState.abortController).toBeNull();
    expect(nextState.isGenerating).toBe(false);
    expect(nextState.generatingMessageId).toBeNull();
    expect(nextState.generationStage).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('includes stored model response parts in conversation history', () => {
    const store = useConversationStore.getState();

    store.setMessages([
      createMessage('user-1', {
        role: 'user',
        content: '把这个沙发放进去',
        inputImage: 'user-image-base64',
        status: 'completed',
        orderIndex: 0,
      }),
      createMessage('assistant-1', {
        role: 'assistant',
        content: '好的，我来处理',
        outputImage: 'https://example.com/generated.png',
        status: 'completed',
        orderIndex: 1,
        generationParams: JSON.stringify({
          prompt: '把这个沙发放进去',
          aspectRatio: '1:1',
          model: 'forma',
          imageQuality: '1K',
          modelResponseParts: [
            {
              type: 'text',
              text: '好的，我来处理',
              thoughtSignature: 'sig-text',
            },
            {
              type: 'image',
              mimeType: 'image/png',
              thoughtSignature: 'sig-image',
            },
          ],
        }),
      }),
    ]);

    expect(store.getConversationHistory()).toEqual([
      {
        role: 'user',
        content: '把这个沙发放进去',
        image: 'user-image-base64',
      },
      {
        role: 'model',
        content: '好的，我来处理',
        image: 'https://example.com/generated.png',
        parts: [
          {
            type: 'text',
            text: '好的，我来处理',
            thoughtSignature: 'sig-text',
          },
          {
            type: 'image',
            mimeType: 'image/png',
            thoughtSignature: 'sig-image',
          },
        ],
      },
    ]);
  });
});
