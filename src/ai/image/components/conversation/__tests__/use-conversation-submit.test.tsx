import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConversationSubmit } from '../use-conversation-submit';

const {
  createPendingGenerationRequestMock,
  updateAssistantMessageRequestMock,
  generateImageMock,
  storeState,
  useConversationStoreMock,
} = vi.hoisted(() => {
  const storeState = {
    abortController: null as AbortController | null,
    generatingMessageId: null as string | null,
    generationRequestToken: null as string | null,
  };

  const useConversationStoreMock = Object.assign(vi.fn(), {
    getState: vi.fn(() => storeState),
  });

  return {
    createPendingGenerationRequestMock: vi.fn(),
    updateAssistantMessageRequestMock: vi.fn(),
    generateImageMock: vi.fn(),
    storeState,
    useConversationStoreMock,
  };
});

vi.mock('@/ai/image/lib/workspace-client', () => ({
  createPendingGenerationRequest: createPendingGenerationRequestMock,
  updateAssistantMessageRequest: updateAssistantMessageRequestMock,
}));

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateImage: generateImageMock,
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

describe('useConversationSubmit', () => {
  it('keeps the draft intact when bootstrapping the pending generation fails', async () => {
    const addMessageMock = vi.fn();
    const updateMessageMock = vi.fn();
    const clearDraftMock = vi.fn();
    const setReferenceImagesMock = vi.fn();
    const setShowImageUploadMock = vi.fn();

    createPendingGenerationRequestMock.mockResolvedValue({
      success: false,
      error: 'db error',
    });

    const { result } = renderHook(() =>
      useConversationSubmit({
        t: (key) => key,
        currentProjectId: 'project-1',
        draftPrompt: 'draw a chair',
        referenceImages: ['base64-image'],
        aspectRatio: '1:1',
        selectedModel: 'forma',
        imageQuality: '2K',
        isGenerating: false,
        clearDraft: clearDraftMock,
        setReferenceImages: setReferenceImagesMock,
        setShowImageUpload: setShowImageUploadMock,
        addMessage: addMessageMock,
        updateMessage: updateMessageMock,
        setGenerating: vi.fn(),
        getLastOutputImage: () => null,
        getConversationHistory: () => [],
        setAbortController: vi.fn(),
        setGenerationRequestToken: vi.fn(),
        setGenerationStage: vi.fn(),
      })
    );

    await result.current();

    expect(clearDraftMock).not.toHaveBeenCalled();
    expect(setReferenceImagesMock).not.toHaveBeenCalled();
    expect(setShowImageUploadMock).not.toHaveBeenCalled();
    expect(addMessageMock).not.toHaveBeenCalled();
  });

  it('falls back to local failed state when cancellation persistence fails', async () => {
    const addMessageMock = vi.fn();
    const updateMessageMock = vi.fn();
    const onErrorMock = vi.fn();

    storeState.abortController = null;
    storeState.generatingMessageId = null;
    storeState.generationRequestToken = null;

    createPendingGenerationRequestMock.mockResolvedValue({
      success: true,
      data: {
        userMessage: {
          id: 'user-1',
          projectId: 'project-1',
          role: 'user',
          content: 'draw a chair',
          inputImage: null,
          outputImage: null,
          maskImage: null,
          generationParams: null,
          creditsUsed: null,
          generationTime: null,
          status: 'completed',
          errorMessage: null,
          orderIndex: 0,
          createdAt: new Date(),
        },
        assistantMessage: {
          id: 'assistant-1',
          projectId: 'project-1',
          role: 'assistant',
          content: '',
          inputImage: null,
          outputImage: null,
          maskImage: null,
          generationParams: JSON.stringify({ prompt: 'draw a chair' }),
          creditsUsed: null,
          generationTime: null,
          status: 'generating',
          errorMessage: null,
          orderIndex: 1,
          createdAt: new Date(),
        },
      },
    });
    generateImageMock.mockResolvedValue({
      success: false,
      error: '生成已取消',
    });
    updateAssistantMessageRequestMock.mockResolvedValue({
      success: false,
      error: 'db unavailable',
    });

    const setAbortController = vi.fn((controller: AbortController | null) => {
      storeState.abortController = controller;
    });
    const setGenerationRequestToken = vi.fn((token: string | null) => {
      storeState.generationRequestToken = token;
    });
    const setGenerationStage = vi.fn();
    const setGenerating = vi.fn(
      (isGenerating: boolean, generatingMessageId?: string | null) => {
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
        setGenerationRequestToken,
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
    expect(storeState.generationRequestToken).toBeNull();
  });
});
