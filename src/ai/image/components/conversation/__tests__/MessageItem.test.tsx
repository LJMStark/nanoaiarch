import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageItem } from '../MessageItem';

const {
  generateImageMock,
  mockSetDraftImage,
  storeSnapshot,
  updateAssistantMessageRequestMock,
  useConversationStoreMock,
} = vi.hoisted(() => {
  const storeSnapshot = {
    messages: [] as ProjectMessageItem[],
    updateMessage: vi.fn(),
    setGenerating: vi.fn(),
    isGenerating: false,
    getConversationHistory: vi.fn() as Mock,
    setAbortController: vi.fn(),
    setGenerationRequestToken: vi.fn(),
    setGenerationStage: vi.fn(),
    generationRequestToken: null as string | null,
    generatingMessageId: null as string | null,
  };
  const useConversationStoreMock = Object.assign(
    vi.fn(() => storeSnapshot),
    {
      getState: vi.fn(() => ({
        generationRequestToken: storeSnapshot.generationRequestToken,
        generatingMessageId: storeSnapshot.generatingMessageId,
      })),
    }
  );

  return {
    generateImageMock: vi.fn(),
    mockSetDraftImage: vi.fn(),
    storeSnapshot,
    updateAssistantMessageRequestMock: vi.fn(),
    useConversationStoreMock,
  };
});

vi.mock('@/stores/project-store', () => ({
  useProjectStore: () => ({
    setDraftImage: mockSetDraftImage,
  }),
}));

vi.mock('@/stores/conversation-store', () => ({
  useConversationStore: useConversationStoreMock,
}));

vi.mock('@/ai/image/lib/workspace-client', () => ({
  updateAssistantMessageRequest: updateAssistantMessageRequestMock,
}));

vi.mock('@/ai/image/lib/api-utils', () => ({
  generateImage: generateImageMock,
}));

vi.mock('@/ai/image/lib/image-display-utils', async () => {
  const actual = await vi.importActual<
    typeof import('@/ai/image/lib/image-display-utils')
  >('@/ai/image/lib/image-display-utils');
  return {
    ...actual,
    preloadImage: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = 'mock image', fill: _fill, src = '', className }: any) => (
    <img alt={alt} src={src} data-testid="mock-image" className={className} />
  ),
}));

function resetStoreSnapshot(): void {
  storeSnapshot.messages = [];
  storeSnapshot.updateMessage = vi.fn();
  storeSnapshot.setGenerating = vi.fn(
    (isGenerating: boolean, generatingMessageId?: string | null) => {
      storeSnapshot.isGenerating = isGenerating;
      storeSnapshot.generatingMessageId = isGenerating
        ? (generatingMessageId ?? null)
        : null;
    }
  );
  storeSnapshot.isGenerating = false;
  storeSnapshot.getConversationHistory = vi.fn(() => []);
  storeSnapshot.setAbortController = vi.fn();
  storeSnapshot.setGenerationRequestToken = vi.fn((token: string | null) => {
    storeSnapshot.generationRequestToken = token;
  });
  storeSnapshot.setGenerationStage = vi.fn();
  storeSnapshot.generationRequestToken = null;
  storeSnapshot.generatingMessageId = null;
  useConversationStoreMock.mockImplementation(() => storeSnapshot);
  useConversationStoreMock.getState.mockImplementation(() => ({
    generationRequestToken: storeSnapshot.generationRequestToken,
    generatingMessageId: storeSnapshot.generatingMessageId,
  }));
}

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
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreSnapshot();
  });

  it('triggers edit by setting draft image', () => {
    render(<MessageItem message={createAssistantMessage()} isLast={true} />);

    // Desktop hover overlay + mobile action row both expose an Edit button
    // with the same aria-label; either one wires to handleEdit, so pick
    // the first match.
    const [editButton] = screen.getAllByLabelText('canvas.edit');
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

  it('retries gpt-image-2 as a fresh text-only attempt', async () => {
    const userMessage: ProjectMessageItem = {
      id: 'user-1',
      projectId: 'proj-1',
      role: 'user',
      content: '生成一个庭院',
      inputImage: 'base64-input',
      inputImages: ['base64-input'],
      outputImage: null,
      maskImage: null,
      generationParams: null,
      creditsUsed: null,
      generationTime: null,
      status: 'completed',
      errorMessage: null,
      orderIndex: 0,
      createdAt: new Date(),
    };
    const failedAssistant = {
      ...createAssistantMessage(),
      id: 'assistant-1',
      outputImage: null,
      generationParams: JSON.stringify({
        prompt: '生成一个庭院',
        aspectRatio: '1:1',
        model: 'gpt-image-2',
        imageQuality: '2K',
      }),
      creditsUsed: null,
      generationTime: null,
      status: 'failed',
      errorMessage: '积分预扣失败，请重试',
      orderIndex: 1,
    } satisfies ProjectMessageItem;

    storeSnapshot.messages = [userMessage, failedAssistant];
    storeSnapshot.getConversationHistory = vi.fn(() => [
      {
        role: 'user',
        content: '上一轮',
      },
      {
        role: 'model',
        content: '',
        image: 'https://cdn.example.com/previous.png',
      },
    ]);
    updateAssistantMessageRequestMock.mockResolvedValue({
      success: true,
      data: failedAssistant,
    });
    generateImageMock.mockResolvedValue({
      success: false,
      error: 'again failed',
    });

    render(<MessageItem message={failedAssistant} isLast={true} />);

    fireEvent.click(screen.getByRole('button', { name: /canvas.retry/ }));

    await waitFor(() => {
      expect(generateImageMock).toHaveBeenCalled();
    });

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '生成一个庭院',
        model: 'gpt-image-2',
        referenceImages: undefined,
        conversationHistory: undefined,
        projectId: 'proj-1',
        assistantMessageId: 'assistant-1',
        generationAttemptId: expect.any(String),
      })
    );
  });

  it('keeps recovery polling active when a gpt-image-2 retry returns a queued task', async () => {
    const userMessage: ProjectMessageItem = {
      id: 'user-1',
      projectId: 'proj-1',
      role: 'user',
      content: '生成一个庭院',
      inputImage: null,
      inputImages: [],
      outputImage: null,
      maskImage: null,
      generationParams: null,
      creditsUsed: null,
      generationTime: null,
      status: 'completed',
      errorMessage: null,
      orderIndex: 0,
      createdAt: new Date(),
    };
    const failedAssistant = {
      ...createAssistantMessage(),
      id: 'assistant-1',
      projectId: 'proj-1',
      outputImage: null,
      generationParams: JSON.stringify({
        prompt: '生成一个庭院',
        aspectRatio: '1:1',
        model: 'gpt-image-2',
        imageQuality: '2K',
      }),
      creditsUsed: null,
      generationTime: null,
      status: 'failed',
      errorMessage: '生成失败',
      orderIndex: 1,
    } satisfies ProjectMessageItem;

    storeSnapshot.messages = [userMessage, failedAssistant];
    updateAssistantMessageRequestMock.mockResolvedValue({
      success: true,
      data: failedAssistant,
    });
    generateImageMock.mockResolvedValue({
      success: true,
      message: {
        ...failedAssistant,
        content: '',
        errorMessage: null,
        generationParams: JSON.stringify({
          prompt: '生成一个庭院',
          duomiTaskId: 'task-1',
        }),
        status: 'generating',
        createdAt: new Date().toISOString(),
      },
    });

    render(<MessageItem message={failedAssistant} isLast={true} />);

    fireEvent.click(screen.getByRole('button', { name: /canvas.retry/ }));

    await waitFor(() => {
      expect(storeSnapshot.updateMessage).toHaveBeenCalledWith(
        'assistant-1',
        expect.objectContaining({
          status: 'generating',
        })
      );
    });

    expect(storeSnapshot.setGenerating).toHaveBeenCalledWith(
      true,
      'assistant-1'
    );
    expect(storeSnapshot.setGenerating).not.toHaveBeenCalledWith(false);
    expect(storeSnapshot.isGenerating).toBe(true);
    expect(storeSnapshot.generatingMessageId).toBe('assistant-1');
    expect(storeSnapshot.generationRequestToken).toBeNull();
  });
});
