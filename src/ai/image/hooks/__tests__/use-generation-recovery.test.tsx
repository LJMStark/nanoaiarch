import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerationRecovery } from '../use-generation-recovery';

const {
  fetchMessageStatusMock,
  updateAssistantMessageRequestMock,
  storeState,
  useConversationStoreMock,
  setGeneratingMock,
  updateMessageMock,
} = vi.hoisted(() => {
  const storeState = {
    generatingMessageId: 'assistant-1' as string | null,
  };
  const setGeneratingMock = vi.fn(
    (isGenerating: boolean, messageId?: string | null) => {
      storeState.generatingMessageId = isGenerating
        ? (messageId ?? null)
        : null;
    }
  );
  const updateMessageMock = vi.fn();
  const useConversationStoreMock = Object.assign(
    vi.fn(() => ({
      generatingMessageId: storeState.generatingMessageId,
      setGenerating: setGeneratingMock,
      updateMessage: updateMessageMock,
    })),
    {
      getState: vi.fn(() => storeState),
    }
  );

  return {
    fetchMessageStatusMock: vi.fn(),
    updateAssistantMessageRequestMock: vi.fn(),
    storeState,
    useConversationStoreMock,
    setGeneratingMock,
    updateMessageMock,
  };
});

vi.mock('@/ai/image/lib/workspace-client', () => ({
  fetchMessageStatus: fetchMessageStatusMock,
  updateAssistantMessageRequest: updateAssistantMessageRequestMock,
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

describe('useGenerationRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    storeState.generatingMessageId = 'assistant-1';
  });

  it('marks missing generating messages as failed so the user can retry', async () => {
    fetchMessageStatusMock.mockResolvedValue({
      success: true,
      data: null,
    });
    updateAssistantMessageRequestMock.mockResolvedValue({
      success: true,
    });

    renderHook(() => useGenerationRecovery('project-1'));

    await waitFor(() => {
      expect(fetchMessageStatusMock).toHaveBeenCalledWith(
        'project-1',
        'assistant-1'
      );
    });

    await waitFor(() => {
      expect(updateMessageMock).toHaveBeenCalledWith('assistant-1', {
        status: 'failed',
        content: '生成任务状态已丢失，请重试',
        errorMessage: '生成任务状态已丢失，请重试',
      });
    });

    expect(updateAssistantMessageRequestMock).toHaveBeenCalledWith(
      'assistant-1',
      {
        status: 'failed',
        content: '生成任务状态已丢失，请重试',
        errorMessage: '生成任务状态已丢失，请重试',
      }
    );
    expect(setGeneratingMock).toHaveBeenCalledWith(false);
  });

  it('ignores stale poll results after a newer generation starts', async () => {
    let resolveStatus:
      | ((value: { success: boolean; data: { status: string } | null }) => void)
      | null = null;
    fetchMessageStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );

    renderHook(() => useGenerationRecovery('project-1'));

    await Promise.resolve();
    expect(fetchMessageStatusMock).toHaveBeenCalledWith(
      'project-1',
      'assistant-1'
    );

    act(() => {
      storeState.generatingMessageId = 'assistant-2';
    });

    await act(async () => {
      resolveStatus?.({
        success: true,
        data: {
          status: 'completed',
        },
      });
    });

    expect(updateMessageMock).not.toHaveBeenCalled();
    expect(setGeneratingMock).not.toHaveBeenCalledWith(false);
  });
});
