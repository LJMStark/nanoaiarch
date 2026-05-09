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

  it('marks missing generating messages as failed only after sustained not-found', async () => {
    // Behavioral contract: a single "not found" response could be replica
    // lag or a multi-tab race; we retry up to MAX_NOT_FOUND_RETRIES (3)
    // times before concluding the message is truly gone. This test fakes
    // the polling timer so we can exhaust the retry budget quickly.
    vi.useFakeTimers();
    fetchMessageStatusMock.mockResolvedValue({
      success: true,
      data: null,
    });
    updateAssistantMessageRequestMock.mockResolvedValue({
      success: true,
    });

    renderHook(() => useGenerationRecovery('project-1'));

    // Initial poll fires synchronously after mount.
    await vi.waitFor(() => {
      expect(fetchMessageStatusMock).toHaveBeenCalledTimes(1);
    });
    expect(updateMessageMock).not.toHaveBeenCalled();

    // Each subsequent not-found schedules another poll on the interval.
    // After MAX_NOT_FOUND_RETRIES (3) total not-found responses we mark failed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await vi.waitFor(() => {
      expect(updateMessageMock).toHaveBeenCalledWith('assistant-1', {
        status: 'failed',
        content: '生成任务状态已丢失，请重试',
        errorMessage: '生成任务状态已丢失，请重试',
      });
    });

    expect(fetchMessageStatusMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(updateAssistantMessageRequestMock).toHaveBeenCalledWith(
      'assistant-1',
      {
        status: 'failed',
        content: '生成任务状态已丢失，请重试',
        errorMessage: '生成任务状态已丢失，请重试',
      }
    );
    expect(setGeneratingMock).toHaveBeenCalledWith(false);

    vi.useRealTimers();
  });

  it('recovers when a transient not-found is followed by a real result', async () => {
    // Critical regression scenario: previously a single not-found would
    // overwrite a completed message with status=failed. We must NOT do that
    // when the next poll surfaces the real completed state.
    vi.useFakeTimers();
    fetchMessageStatusMock
      .mockResolvedValueOnce({ success: true, data: null }) // transient miss
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'completed', content: 'done' },
      });

    renderHook(() => useGenerationRecovery('project-1'));

    await vi.waitFor(() => {
      expect(fetchMessageStatusMock).toHaveBeenCalledTimes(1);
    });
    // First poll was the transient miss — must NOT mark failed.
    expect(updateMessageMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await vi.waitFor(() => {
      expect(updateMessageMock).toHaveBeenCalledWith('assistant-1', {
        status: 'completed',
        content: 'done',
      });
    });

    // Failure path was never taken.
    expect(updateAssistantMessageRequestMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips polling while the optimistic temp message is waiting for a real id', async () => {
    storeState.generatingMessageId = 'temp-assistant-1';

    renderHook(() => useGenerationRecovery('project-1'));

    await Promise.resolve();

    expect(fetchMessageStatusMock).not.toHaveBeenCalled();
    expect(updateAssistantMessageRequestMock).not.toHaveBeenCalled();
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
