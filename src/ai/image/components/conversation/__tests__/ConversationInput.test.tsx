import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationInput } from '../ConversationInput';

const submitMock = vi.fn();

vi.mock('../use-conversation-submit', () => ({
  useConversationSubmit: () => submitMock,
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    currentProjectId: 'test-project',
    draftPrompt: 'draw a chair',
    draftImage: null,
    imageQuality: '2K',
    aspectRatio: '1:1',
    selectedModel: 'forma',
    setDraftPrompt: vi.fn(),
    setDraftImage: vi.fn(),
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
    getConversationHistory: () => [],
    setAbortController: vi.fn(),
    setGenerationRequestToken: vi.fn(),
    setGenerationStage: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ConversationInput', () => {
  it('renders the input textarea', () => {
    render(<ConversationInput />);
    expect(screen.getByPlaceholderText('controls.prompt')).toBeInTheDocument();
  });

  it('does not submit while IME composition is active', () => {
    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      nativeEvent: { isComposing: true },
    });
    fireEvent.compositionEnd(textarea);

    expect(submitMock).not.toHaveBeenCalled();
  });

  it('submits on Enter when not composing', () => {
    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');

    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      shiftKey: false,
      nativeEvent: { isComposing: false },
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
  });
});
