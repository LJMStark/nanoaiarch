import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationInput } from '../ConversationInput';

const { submitMock, compressAcceptedImageFilesMock } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  compressAcceptedImageFilesMock: vi.fn(),
}));

vi.mock('../use-conversation-submit', () => ({
  useConversationSubmit: () => submitMock,
}));

vi.mock('@/ai/image/lib/image-compress', () => ({
  compressAcceptedImageFiles: compressAcceptedImageFilesMock,
  isAcceptedImageType: (type: string) => type.startsWith('image/'),
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

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

describe('ConversationInput', () => {
  beforeEach(() => {
    submitMock.mockClear();
    compressAcceptedImageFilesMock.mockReset();
  });

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

  it('adds pasted clipboard images to the reference preview', async () => {
    compressAcceptedImageFilesMock.mockResolvedValue([VALID_PNG_BASE64]);

    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');
    const imageFile = new File(['binary'], 'reference.png', {
      type: 'image/png',
    });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => imageFile,
          },
        ],
        files: [imageFile],
      },
    });

    await waitFor(() => {
      expect(compressAcceptedImageFilesMock).toHaveBeenCalledWith([imageFile]);
    });

    expect(screen.getByText('controls.referenceCount')).toBeInTheDocument();
    expect(screen.getByAltText('Reference 1')).toBeInTheDocument();
  });

  it('does not submit on Enter while image paste compression is in progress', async () => {
    let resolveCompression: ((value: string[]) => void) | undefined;
    compressAcceptedImageFilesMock.mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveCompression = resolve;
      })
    );

    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');
    const imageFile = new File(['binary'], 'reference.png', {
      type: 'image/png',
    });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => imageFile,
          },
        ],
        files: [imageFile],
      },
    });

    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      shiftKey: false,
      nativeEvent: { isComposing: false },
    });

    expect(submitMock).not.toHaveBeenCalled();

    resolveCompression?.([VALID_PNG_BASE64]);
    await waitFor(() => {
      expect(screen.getByAltText('Reference 1')).toBeInTheDocument();
    });
  });

  it('ignores additional image paste while a paste compression is running', async () => {
    let resolveCompression: ((value: string[]) => void) | undefined;
    compressAcceptedImageFilesMock.mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveCompression = resolve;
      })
    );

    render(<ConversationInput />);
    const textarea = screen.getByPlaceholderText('controls.prompt');
    const firstImageFile = new File(['binary'], 'first.png', {
      type: 'image/png',
    });
    const secondImageFile = new File(['binary'], 'second.png', {
      type: 'image/png',
    });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => firstImageFile,
          },
        ],
        files: [firstImageFile],
      },
    });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => secondImageFile,
          },
        ],
        files: [secondImageFile],
      },
    });

    expect(compressAcceptedImageFilesMock).toHaveBeenCalledTimes(1);
    expect(compressAcceptedImageFilesMock).toHaveBeenCalledWith([
      firstImageFile,
    ]);

    resolveCompression?.([VALID_PNG_BASE64]);
    await waitFor(() => {
      expect(screen.getByAltText('Reference 1')).toBeInTheDocument();
    });
  });
});
