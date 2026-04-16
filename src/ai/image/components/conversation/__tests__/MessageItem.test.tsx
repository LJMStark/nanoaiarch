import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageItem } from '../MessageItem';

const { mockSetDraftImage, useConversationStoreMock } = vi.hoisted(() => ({
  mockSetDraftImage: vi.fn(),
  useConversationStoreMock: Object.assign(
    () => ({
      messages: [],
      updateMessage: vi.fn(),
      setGenerating: vi.fn(),
      isGenerating: false,
      getConversationHistory: () => [],
      setAbortController: vi.fn(),
      setGenerationRequestToken: vi.fn(),
      setGenerationStage: vi.fn(),
    }),
    {
      getState: () => ({
        generationRequestToken: null,
        generatingMessageId: null,
      }),
    }
  ),
}));

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    setDraftImage: mockSetDraftImage,
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

vi.mock('@/ai/image/lib/workspace-client', () => ({
  updateAssistantMessageRequest: vi.fn(),
}));

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateImage: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = 'mock image', fill: _fill, src = '', className }: any) => (
    <img alt={alt} src={src} data-testid="mock-image" className={className} />
  ),
}));

function createAssistantMessage(): ProjectMessageItem {
  return {
    id: 'msg-1',
    projectId: 'proj-1',
    role: 'assistant',
    content: '',
    inputImage: null,
    inputImages: [],
    outputImage: 'https://example.com/image.png',
    maskImage: null,
    generationParams: null,
    creditsUsed: 1,
    generationTime: 1000,
    status: 'completed',
    errorMessage: null,
    orderIndex: 0,
    createdAt: new Date(),
  };
}

describe('MessageItem', () => {
  it('triggers edit by setting draft image', () => {
    render(<MessageItem message={createAssistantMessage()} isLast={true} />);

    const editButton = screen.getByLabelText('canvas.edit');
    fireEvent.click(editButton);

    expect(mockSetDraftImage).toHaveBeenCalledWith(
      'https://example.com/image.png'
    );
  });

  it('shows toolbar actions inside the preview dialog', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<MessageItem message={createAssistantMessage()} isLast={true} />);

    fireEvent.click(screen.getByLabelText('canvas.openPreview'));

    expect(screen.getAllByText('canvas.download').length).toBeGreaterThan(0);
    expect(screen.getAllByText('canvas.share').length).toBeGreaterThan(0);
    expect(screen.getAllByText('canvas.edit').length).toBeGreaterThan(0);
    expect(screen.getByText('canvas.previewDescription')).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
