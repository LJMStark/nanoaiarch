import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConversationSubmit } from '../use-conversation-submit';

const {
  addUserMessageMock,
  addAssistantMessageMock,
  updateAssistantMessageMock,
  generateImageMock,
  storeState,
  useConversationStoreMock,
} = vi.hoisted(() => {
  const storeState = {
    abortController: null as AbortController | null,
    generatingMessageId: null as string | null,
  };

  const useConversationStoreMock = Object.assign(vi.fn(), {
    getState: vi.fn(() => storeState),
  });

  return {
    addUserMessageMock: vi.fn(),
    addAssistantMessageMock: vi.fn(),
    updateAssistantMessageMock: vi.fn(),
    generateImageMock: vi.fn(),
    storeState,
    useConversationStoreMock,
  };
});

vi.mock('@/actions/project-message', () => ({
  addUserMessage: addUserMessageMock,
  addAssistantMessage: addAssistantMessageMock,
  updateAssistantMessage: updateAssistantMessageMock,
}));

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateImage: generateImageMock,
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

describe('useConversationSubmit', () => {
  it('falls back to local failed state when cancellation persistence fails', async () => {
    const addMessageMock = vi.fn();
    const updateMessageMock = vi.fn();
    const onErrorMock = vi.fn();

    storeState.abortController = null;
    storeState.generatingMessageId = null;

    addUserMessageMock.mockResolvedValue({
      success: true,
      data: {
        id: 'user-1',
        content: 'draw a chair',
      },
    });
    addAssistantMessageMock.mockResolvedValue({
      success: true,
      data: {
        id: 'assistant-1',
        content: '',
        status: 'generating',
      },
    });
    generateImageMock.mockResolvedValue({
      success: false,
      error: '生成已取消',
    });
    updateAssistantMessageMock.mockResolvedValue({
      success: false,
      error: 'db unavailable',
    });

    const setAbortController = vi.fn((controller: AbortController | null) => {
      storeState.abortController = controller;
    });
    const setGenerationStage = vi.fn();
    const setGenerating = vi.fn(
      (isGenerating: boolean, generatingMessageId?: string) => {
        storeState.generatingMessageId = isGenerating
          ? (generatingMessageId ?? null)
          : null;
      }
    );

    const { result } = renderHook(() =>
      useConversationSubmit({
        t: (key) => key,
        currentProjectId: 'project-1',
        draftPrompt: 'draw a chair',
        referenceImages: [],
        aspectRatio: '1:1',
        selectedModel: 'forma',
        imageQuality: '2K',
        isGenerating: false,
        clearDraft: vi.fn(),
        setReferenceImages: vi.fn(),
        setShowImageUpload: vi.fn(),
        addMessage: addMessageMock,
        updateMessage: updateMessageMock,
        setGenerating,
        getLastOutputImage: () => null,
        getConversationHistory: () => [],
        setAbortController,
        setGenerationStage,
        onError: onErrorMock,
      })
    );

    await result.current();

    await waitFor(() => {
      expect(updateMessageMock).toHaveBeenCalledWith('assistant-1', {
        content: 'loading.cancelled',
        status: 'failed',
        errorMessage: 'Generation cancelled',
      });
    });

    expect(onErrorMock).toHaveBeenCalledWith({
      title: '更新生成状态失败',
      description: 'db unavailable',
    });
    expect(setGenerating).toHaveBeenLastCalledWith(false);
    expect(storeState.generatingMessageId).toBeNull();
  });
});
