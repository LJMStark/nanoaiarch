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
  resetForProjectMock,
  setGenerationStageMock,
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
    resetForProjectMock: vi.fn(),
    setGenerationStageMock: vi.fn(),
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
    resetForProject: resetForProjectMock,
    setGenerationStage: setGenerationStageMock,
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
    // resetForProject() is invoked without arguments — it always wipes the
    // transient conversation state regardless of which project (or null) we
    // are switching to.
    expect(resetForProjectMock).toHaveBeenCalledWith();
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
    expect(resetForProjectMock).toHaveBeenCalledWith();
    expect(setMessagesMock).toHaveBeenCalledWith([]);
  });

  it('re-initializes when mode changes between renders (Week 4.4 regression)', async () => {
    // Previously initRef locked after the first run; flipping
    // ?new=1 -> ?template=foo within the same tab would silently keep the
    // 'new-project' bootstrap state and never re-fetch with mode='blank'.
    fetchConversationInitDataMock.mockResolvedValue({
      success: true,
      data: {
        projects: [],
        messages: [],
        currentProjectId: null,
      },
    });

    const { rerender } = renderHook(
      ({ mode }: { mode: 'new-project' | 'blank' }) =>
        useConversationInit({ mode } as any),
      { initialProps: { mode: 'new-project' } }
    );

    await waitFor(() => {
      expect(fetchConversationInitDataMock).toHaveBeenCalledTimes(1);
      expect(fetchConversationInitDataMock).toHaveBeenLastCalledWith(null, {
        mode: 'new-project',
      });
    });

    rerender({ mode: 'blank' });

    await waitFor(() => {
      expect(fetchConversationInitDataMock).toHaveBeenCalledTimes(2);
      expect(fetchConversationInitDataMock).toHaveBeenLastCalledWith(null, {
        mode: 'blank',
      });
    });
  });

  it('skips re-initialization when re-rendered with the same mode', async () => {
    // Spurious re-renders (e.g. parent re-renders with new prop refs but
    // the same mode) must NOT re-trigger the bootstrap. Otherwise we'd
    // race-fetch projects on every store update.
    fetchConversationInitDataMock.mockResolvedValue({
      success: true,
      data: { projects: [], messages: [], currentProjectId: null },
    });

    const { rerender } = renderHook(
      ({ mode }: { mode: 'blank' }) => useConversationInit({ mode } as any),
      { initialProps: { mode: 'blank' } }
    );

    await waitFor(() => {
      expect(fetchConversationInitDataMock).toHaveBeenCalledTimes(1);
    });

    rerender({ mode: 'blank' });
    rerender({ mode: 'blank' });

    // Still exactly one fetch — same-mode re-renders are no-ops.
    expect(fetchConversationInitDataMock).toHaveBeenCalledTimes(1);
  });

  it('clears stale generating state when bootstrap returns no generating messages', async () => {
    fetchConversationInitDataMock.mockResolvedValue({
      success: true,
      data: {
        projects: [{ id: 'project-1' }],
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            status: 'completed',
          },
        ],
        currentProjectId: 'project-1',
      },
    });

    renderHook(() => useConversationInit({ mode: 'new-project' } as any));

    await waitFor(() => {
      expect(setMessagesMock).toHaveBeenCalledWith([
        {
          id: 'assistant-1',
          role: 'assistant',
          status: 'completed',
        },
      ]);
    });

    expect(setGeneratingMock).toHaveBeenCalledWith(false);
    expect(setGenerationStageMock).toHaveBeenCalledWith(null);
  });
});
