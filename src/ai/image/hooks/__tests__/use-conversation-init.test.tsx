import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationInit } from '../use-conversation-init';

const {
  fetchConversationInitDataMock,
  fetchProjectMessagesMock,
  selectProjectMock,
  setProjectsMock,
  setLoadingProjectsMock,
  setMessagesMock,
  setLoadingMessagesMock,
  setCurrentProjectMock,
  setGeneratingMock,
  projectStoreState,
  useProjectStoreMock,
} = vi.hoisted(() => {
  const projectStoreState = {
    currentProjectId: 'persisted-project',
  };

  const useProjectStoreMock = Object.assign(
    vi.fn(() => ({
      setProjects: vi.fn(),
      setLoadingProjects: vi.fn(),
      selectProject: vi.fn(),
    })),
    {
      getState: vi.fn(() => projectStoreState),
    }
  );

  return {
    fetchConversationInitDataMock: vi.fn(),
    fetchProjectMessagesMock: vi.fn(),
    selectProjectMock: vi.fn(),
    setProjectsMock: vi.fn(),
    setLoadingProjectsMock: vi.fn(),
    setMessagesMock: vi.fn(),
    setLoadingMessagesMock: vi.fn(),
    setCurrentProjectMock: vi.fn(),
    setGeneratingMock: vi.fn(),
    projectStoreState,
    useProjectStoreMock,
  };
});

useProjectStoreMock.mockImplementation(() => ({
  setProjects: setProjectsMock,
  setLoadingProjects: setLoadingProjectsMock,
  selectProject: selectProjectMock,
}));

vi.mock('@/ai/image/lib/workspace-client', () => ({
  fetchConversationInitData: fetchConversationInitDataMock,
  fetchProjectMessages: fetchProjectMessagesMock,
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: useProjectStoreMock,
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    setMessages: setMessagesMock,
    setLoadingMessages: setLoadingMessagesMock,
    setCurrentProject: setCurrentProjectMock,
    setGenerating: setGeneratingMock,
  }),
}));

describe('useConversationInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStoreState.currentProjectId = 'persisted-project';
  });

  it('requests a blank bootstrap without restoring the persisted project', async () => {
    fetchConversationInitDataMock.mockResolvedValue({
      success: true,
      data: {
        projects: [{ id: 'project-1' }],
        messages: [],
        currentProjectId: null,
      },
    });

    renderHook(() => useConversationInit({ mode: 'blank' } as any));

    await waitFor(() => {
      expect(fetchConversationInitDataMock).toHaveBeenCalledWith(null, {
        mode: 'blank',
      });
    });

    expect(selectProjectMock).toHaveBeenCalledWith(null);
    expect(setCurrentProjectMock).toHaveBeenCalledWith(null);
    expect(setMessagesMock).toHaveBeenCalledWith([]);
  });

  it('hydrates the newly created project from the bootstrap response', async () => {
    fetchConversationInitDataMock.mockResolvedValue({
      success: true,
      data: {
        projects: [{ id: 'project-new' }],
        messages: [],
        currentProjectId: 'project-new',
      },
    });

    renderHook(() => useConversationInit({ mode: 'new-project' } as any));

    await waitFor(() => {
      expect(fetchConversationInitDataMock).toHaveBeenCalledWith(null, {
        mode: 'new-project',
      });
    });

    expect(selectProjectMock).toHaveBeenCalledWith('project-new');
    expect(setCurrentProjectMock).toHaveBeenCalledWith('project-new');
    expect(setMessagesMock).toHaveBeenCalledWith([]);
  });
});
