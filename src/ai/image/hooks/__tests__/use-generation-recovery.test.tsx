import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerationRecovery } from '../use-generation-recovery';

const {
  getMessageStatusMock,
  updateAssistantMessageMock,
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
    getMessageStatusMock: vi.fn(),
    updateAssistantMessageMock: vi.fn(),
    storeState,
    useConversationStoreMock,
    setGeneratingMock,
    updateMessageMock,
  };
});

vi.mock('@/actions/project-message', () => ({
  getMessageStatus: getMessageStatusMock,
  updateAssistantMessage: updateAssistantMessageMock,
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
    getMessageStatusMock.mockResolvedValue({
      success: true,
      data: null,
    });
    updateAssistantMessageMock.mockResolvedValue({
      success: true,
    });

    renderHook(() => useGenerationRecovery('project-1'));

    await waitFor(() => {
      expect(getMessageStatusMock).toHaveBeenCalledWith(
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

    expect(updateAssistantMessageMock).toHaveBeenCalledWith('assistant-1', {
      status: 'failed',
      content: '生成任务状态已丢失，请重试',
      errorMessage: '生成任务状态已丢失，请重试',
    });
    expect(setGeneratingMock).toHaveBeenCalledWith(false);
  });

  it('ignores stale poll results after a newer generation starts', async () => {
    let resolveStatus:
      | ((value: { success: boolean; data: { status: string } | null }) => void)
      | null = null;
    getMessageStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );

    renderHook(() => useGenerationRecovery('project-1'));

    await Promise.resolve();
    expect(getMessageStatusMock).toHaveBeenCalledWith(
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
