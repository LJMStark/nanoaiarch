import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationInput } from '../ConversationInput';

// Mock Zustand stores
vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    currentProjectId: 'test-project',
    draftPrompt: '',
    imageQuality: 'hd',
    aspectRatio: '1:1',
    selectedModel: 'openai-dall-e-3',
    setDraftPrompt: vi.fn(),
    setImageQuality: vi.fn(),
    setAspectRatio: vi.fn(),
    clearDraft: vi.fn(),
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    isGenerating: false,
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    setGenerating: vi.fn(),
    getLastOutputImage: () => null,
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ConversationInput', () => {
  it('renders the input textarea', () => {
    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');
    expect(textarea).toBeInTheDocument();
  });

  it('displays quality and aspect ratio settings', () => {
    render(<ConversationInput />);
    const settingsText = screen.getByText(/hd · 1:1/);
    expect(settingsText).toBeInTheDocument();
  });

  it('shows image upload button', () => {
    const { container } = render(<ConversationInput />);
    const imageButton = container.querySelector('button[class*="h-9 w-9"]');
    expect(imageButton).toBeInTheDocument();
  });
});
