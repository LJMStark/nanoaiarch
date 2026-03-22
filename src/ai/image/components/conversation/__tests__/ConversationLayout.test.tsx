import { Routes } from '@/routes';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationLayout } from '../ConversationLayout';

const {
  searchParamsState,
  routerReplaceMock,
  useConversationInitMock,
  setMessagesMock,
  setLoadingMessagesMock,
  setCurrentProjectMock,
  setGeneratingMock,
} = vi.hoisted(() => ({
  searchParamsState: {
    value: '',
  },
  routerReplaceMock: vi.fn(),
  useConversationInitMock: vi.fn(),
  setMessagesMock: vi.fn(),
  setLoadingMessagesMock: vi.fn(),
  setCurrentProjectMock: vi.fn(),
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

vi.mock('@/actions/project-message', () => ({
  getProjectMessages: vi.fn(),
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    currentProjectId: null,
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    setMessages: setMessagesMock,
    setLoadingMessages: setLoadingMessagesMock,
    setCurrentProject: setCurrentProjectMock,
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
});
