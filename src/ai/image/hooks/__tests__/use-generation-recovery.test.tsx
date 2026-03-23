import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGenerationRecovery } from '../use-generation-recovery';

const {
  getMessageStatusMock,
  updateAssistantMessageMock,
  useConversationStoreMock,
} = vi.hoisted(() => ({
  getMessageStatusMock: vi.fn(),
  updateAssistantMessageMock: vi.fn(),
  useConversationStoreMock: vi.fn(),
}));

vi.mock('@/actions/project-message', () => ({
  getMessageStatus: getMessageStatusMock,
  updateAssistantMessage: updateAssistantMessageMock,
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

describe('useGenerationRecovery', () => {
  it('marks missing generating messages as failed so the user can retry', async () => {
    const setGeneratingMock = vi.fn();
    const updateMessageMock = vi.fn();

    useConversationStoreMock.mockReturnValue({
      generatingMessageId: 'assistant-1',
      setGenerating: setGeneratingMock,
      updateMessage: updateMessageMock,
    });

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
});
