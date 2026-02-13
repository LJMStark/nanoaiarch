import type { ProjectMessageItem } from '@/actions/project-message';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationStore } from '../conversation-store';

function createMessage(id: string): ProjectMessageItem {
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
  };
}

describe('conversation-store', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  it('aborts active generation when switching project', () => {
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
  });

  it('aborts active generation when clearing messages', () => {
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
  });
});
