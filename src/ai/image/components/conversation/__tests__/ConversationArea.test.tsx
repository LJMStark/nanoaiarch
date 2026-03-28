import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ConversationArea } from '../ConversationArea';

beforeAll(() => {
  Element.prototype.scrollTo ??= vi.fn();
});

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    currentProjectId: 'project-1',
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: () => ({
    messages: [
      {
        id: 'user-1',
        role: 'user',
      },
    ],
    isLoadingMessages: false,
    isGenerating: false,
  }),
}));

vi.mock('../MessageList', () => ({
  MessageList: () => <div>message-list</div>,
}));

vi.mock('../TemplateShowcase', () => ({
  TemplateShowcase: () => <div>template-showcase</div>,
}));

describe('ConversationArea', () => {
  it('keeps the scroll area inside a flex column wrapper', () => {
    const { container } = render(<ConversationArea />);

    const scrollArea = container.querySelector('[data-slot="scroll-area"]');

    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.parentElement).toHaveClass('flex');
    expect(scrollArea?.parentElement).toHaveClass('flex-col');
  });
});
