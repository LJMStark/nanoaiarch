import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversationInitData } from '../conversation-data';

const { getSessionMock, headersMock, getDbMock, createImageProjectRecordMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    headersMock: vi.fn(),
    getDbMock: vi.fn(),
    createImageProjectRecordMock: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('@/db', () => ({
  getDb: getDbMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    actions: {
      error: vi.fn(),
    },
  },
}));

vi.mock('../image-project', () => ({
  createImageProjectRecord: createImageProjectRecordMock,
}));

function createDbMock(projects: Array<{ id: string; title: string }>) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(projects),
  };

  const messagesQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([
      {
        id: 'msg-1',
        projectId: projects[0]?.id ?? 'project-1',
        role: 'assistant',
        content: 'existing',
        inputImage: null,
        inputImages: null,
        outputImage: null,
        maskImage: null,
        generationParams: null,
        creditsUsed: null,
        generationTime: null,
        status: 'completed',
        errorMessage: null,
        orderIndex: 0,
        createdAt: new Date(),
      },
    ]),
  };

  return {
    select: vi
      .fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(messagesQuery),
    messagesQuery,
  };
}

describe('getConversationInitData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
    });
  });

  it('keeps the conversation blank in blank mode', async () => {
    const { messagesQuery, ...db } = createDbMock([
      { id: 'project-1', title: 'Existing project' },
    ]);

    getDbMock.mockResolvedValue(db);

    const result = await getConversationInitData('project-1', {
      mode: 'blank',
    } as any);

    expect(result).toEqual({
      success: true,
      data: {
        projects: [
          {
            id: 'project-1',
            title: 'Existing project',
            model: 'forma',
          },
        ],
        messages: [],
        currentProjectId: null,
      },
    });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(messagesQuery.from).not.toHaveBeenCalled();
  });

  it('creates and selects a fresh project in new-project mode', async () => {
    const { messagesQuery, ...db } = createDbMock([
      { id: 'project-1', title: 'Existing project' },
    ]);

    getDbMock.mockResolvedValue(db);
    createImageProjectRecordMock.mockResolvedValue({
      id: 'project-new',
      title: '未命名项目',
      coverImage: null,
      templateId: null,
      stylePreset: null,
      aspectRatio: 'auto',
      model: 'forma',
      messageCount: 0,
      generationCount: 0,
      totalCreditsUsed: 0,
      status: 'active',
      isPinned: false,
      lastActiveAt: new Date('2026-03-22T00:00:00.000Z'),
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
    });

    const result = await getConversationInitData(undefined, {
      mode: 'new-project',
    } as any);

    expect(createImageProjectRecordMock).toHaveBeenCalledWith({
      db,
      userId: 'user-1',
    });
    expect(result).toMatchObject({
      success: true,
      data: {
        currentProjectId: 'project-new',
        messages: [],
      },
    });
    expect(result.data.projects[0]?.id).toBe('project-new');
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(messagesQuery.from).not.toHaveBeenCalled();
  });
});
