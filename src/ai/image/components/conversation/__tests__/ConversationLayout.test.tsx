import { Routes } from '@/routes';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationLayout } from '../ConversationLayout';

const {
  searchParamsState,
  fetchProjectMessagesMock,
  routerReplaceMock,
  useConversationInitMock,
  projectStoreState,
  setMessagesMock,
  setLoadingMessagesMock,
  setCurrentProjectMock,
  setGenerationStageMock,
  setGeneratingMock,
} = vi.hoisted(() => ({
  searchParamsState: {
    value: '',
  },
  fetchProjectMessagesMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  useConversationInitMock: vi.fn(),
  projectStoreState: {
    currentProjectId: null as string | null,
  },
  setMessagesMock: vi.fn(),
  setLoadingMessagesMock: vi.fn(),
  setCurrentProjectMock: vi.fn(),
  setGenerationStageMock: vi.fn(),
  setGeneratingMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplaceMock,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

vi.mock('@/ai/image/hooks/use-conversation-init', () => ({
  useConversationInit: useConversationInitMock,
}));

vi.mock('@/ai/image/hooks/use-generation-recovery', () => ({
  useGenerationRecovery: vi.fn(),
}));

vi.mock('@/ai/image/hooks/use-template-apply', () => ({
  useTemplateApply: () => ({
    applyTemplateWithProject: vi.fn(),
  }),
}));

vi.mock('@/ai/image/lib/workspace-client', () => ({
  fetchProjectMessages: fetchProjectMessagesMock,
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    currentProjectId: projectStoreState.currentProjectId,
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    setMessages: setMessagesMock,
    setLoadingMessages: setLoadingMessagesMock,
    setCurrentProject: setCurrentProjectMock,
    setGenerationStage: setGenerationStageMock,
    setGenerating: setGeneratingMock,
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../ConversationHeader', () => ({
  ConversationHeader: () => <div>conversation-header</div>,
}));

vi.mock('../ConversationArea', () => ({
  ConversationArea: () => <div>conversation-area</div>,
}));

vi.mock('../ConversationInput', () => ({
  ConversationInput: () => <div>conversation-input</div>,
}));

vi.mock('../ProjectSidebar', () => ({
  ProjectSidebar: () => <div>project-sidebar</div>,
}));

vi.mock('@/ai/image/components/lazy', () => ({
  LazyTemplateDetailModal: ({
    open,
    template,
  }: {
    open: boolean;
    template: { id: string } | null;
  }) => <div>{open && template ? `modal:${template.id}` : 'modal:closed'}</div>,
}));

describe('ConversationLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = '';
    projectStoreState.currentProjectId = null;
  });

  it('bootstraps the new project entry with new-project mode', () => {
    searchParamsState.value = 'new=1';

    render(<ConversationLayout />);

    expect(useConversationInitMock).toHaveBeenCalledWith({
      mode: 'new-project',
    });
    expect(screen.getByText('conversation-area')).toBeInTheDocument();
  });

  it('opens the template entry in blank mode and clears the URL', async () => {
    searchParamsState.value = 'template=style-transfer-modern';

    render(<ConversationLayout />);

    expect(useConversationInitMock).toHaveBeenCalledWith({
      mode: 'blank',
    });
    expect(screen.getByText('modal:style-transfer-modern')).toBeInTheDocument();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(Routes.AIImage, {
        scroll: false,
      });
    });
  });

  it('clears stale generating state after loading a project without pending messages', async () => {
    fetchProjectMessagesMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'assistant-1',
          role: 'assistant',
          status: 'completed',
        },
      ],
    });

    projectStoreState.currentProjectId = 'project-0';
    const { rerender } = render(<ConversationLayout />);

    projectStoreState.currentProjectId = 'project-1';
    rerender(<ConversationLayout />);

    await waitFor(() => {
      expect(fetchProjectMessagesMock).toHaveBeenCalledWith('project-1');
    });

    expect(setGeneratingMock).toHaveBeenCalledWith(false);
    expect(setGenerationStageMock).toHaveBeenCalledWith(null);
  });

  it('skips loading messages for optimistic temp projects', async () => {
    projectStoreState.currentProjectId = 'project-0';
    const { rerender } = render(<ConversationLayout />);

    projectStoreState.currentProjectId = 'temp-project-1';
    rerender(<ConversationLayout />);

    await waitFor(() => {
      expect(setMessagesMock).toHaveBeenCalledWith([]);
    });

    expect(fetchProjectMessagesMock).not.toHaveBeenCalled();
    expect(setCurrentProjectMock).toHaveBeenCalledWith(null);
    expect(setLoadingMessagesMock).toHaveBeenCalledWith(false);
  });
});
