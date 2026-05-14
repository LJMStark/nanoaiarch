import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationHeader } from '../ConversationHeader';

const { updateImageProjectRequestMock, updateProjectMock, projectStoreState } =
  vi.hoisted(() => ({
    updateImageProjectRequestMock: vi.fn(),
    updateProjectMock: vi.fn(),
    projectStoreState: {
      projects: [
        {
          id: 'project-1',
          title: 'Original Title',
          generationCount: 0,
          totalCreditsUsed: 0,
        },
      ],
      currentProjectId: 'project-1' as string | null,
    },
  }));

vi.mock('@/ai/image/lib/workspace-client', () => ({
  updateImageProjectRequest: updateImageProjectRequestMock,
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    projects: projectStoreState.projects,
    currentProjectId: projectStoreState.currentProjectId,
    updateProject: updateProjectMock,
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn(), state: 'expanded' }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'u1', name: 'Test' } },
      isPending: false,
    }),
  },
}));

vi.mock('@/components/auth/login-wrapper', () => ({
  LoginWrapper: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/components/layout/logo', () => ({
  Logo: () => <div>logo</div>,
}));

vi.mock('@/components/layout/mode-switcher', () => ({
  ModeSwitcher: () => <div>mode-switcher</div>,
}));

vi.mock('@/components/layout/user-button', () => ({
  UserButton: () => <div>user-button</div>,
}));

vi.mock('@/i18n/navigation', () => ({
  LocaleLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ConversationHeader title inline edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStoreState.projects = [
      {
        id: 'project-1',
        title: 'Original Title',
        generationCount: 0,
        totalCreditsUsed: 0,
      },
    ];
    projectStoreState.currentProjectId = 'project-1';
  });

  function enterEditMode() {
    // The title display is rendered as a <button> showing the current title text.
    const trigger = screen.getByRole('button', { name: /Original Title/ });
    fireEvent.click(trigger);
  }

  it('clicking Cancel does NOT trigger a save request and restores the original title', async () => {
    render(<ConversationHeader />);
    enterEditMode();

    const input = screen.getByDisplayValue(
      'Original Title'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Edited but cancelled' } });
    expect(input.value).toBe('Edited but cancelled');

    const cancelButton = screen.getByTestId('project-title-cancel');

    // Simulate the real DOM sequence: mousedown on Cancel button (which our
    // handler responds to via preventDefault + immediate cancel), then blur
    // would normally fire — we fire it explicitly to assert it's a no-op.
    fireEvent.mouseDown(cancelButton);
    fireEvent.blur(input);

    // No save request should have been sent.
    expect(updateImageProjectRequestMock).not.toHaveBeenCalled();
    expect(updateProjectMock).not.toHaveBeenCalled();

    // The original title should be visible again (edit mode closed).
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Edited but cancelled')).toBeNull();
      expect(
        screen.getByRole('button', { name: /Original Title/ })
      ).toBeInTheDocument();
    });
  });

  it('pressing Escape rolls back and does not send a request', async () => {
    render(<ConversationHeader />);
    enterEditMode();

    const input = screen.getByDisplayValue(
      'Original Title'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Will be discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // Blur after Esc should still be a no-op.
    fireEvent.blur(input);

    expect(updateImageProjectRequestMock).not.toHaveBeenCalled();
    expect(updateProjectMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Original Title/ })
      ).toBeInTheDocument();
    });
  });

  it('pressing Enter submits exactly once (no duplicate from blur)', async () => {
    updateImageProjectRequestMock.mockResolvedValue({ success: true });

    render(<ConversationHeader />);
    enterEditMode();

    const input = screen.getByDisplayValue(
      'Original Title'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Subsequent blur (focus moves elsewhere after Enter closes edit mode)
    // must not duplicate the request.
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateImageProjectRequestMock).toHaveBeenCalledTimes(1);
    });
    expect(updateImageProjectRequestMock).toHaveBeenCalledWith('project-1', {
      title: 'Renamed',
    });
  });
});
