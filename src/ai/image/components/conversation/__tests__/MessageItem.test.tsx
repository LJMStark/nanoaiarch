import type { ProjectMessageItem } from '@/actions/project-message';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageItem } from '../MessageItem';

const mockSetDraftImage = vi.fn();

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    setDraftImage: mockSetDraftImage,
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    messages: [],
    addMessage: vi.fn(),
    removeMessage: vi.fn(),
    setGenerating: vi.fn(),
    isGenerating: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe('MessageItem', () => {
  it('triggers edit by setting draft image', () => {
    const message: ProjectMessageItem = {
      id: 'msg-1',
      projectId: 'proj-1',
      role: 'assistant',
      content: '',
      inputImage: null,
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

    render(<MessageItem message={message} isLast={true} />);

    const editButton = screen.getByLabelText('canvas.edit');
    fireEvent.click(editButton);

    expect(mockSetDraftImage).toHaveBeenCalledWith(
      'https://example.com/image.png'
    );
  });
});
