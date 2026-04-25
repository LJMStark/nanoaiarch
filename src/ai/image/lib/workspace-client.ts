import { requestJson } from '@/lib/request-json';
import type {
  ConversationInitData,
  ConversationInitMode,
  CreateImageProjectInput,
  GenerationParams,
  ImageProjectItem,
  MessageStatusItem,
  ProjectMessageItem,
  UpdateImageProjectInput,
} from './workspace-types';

type SuccessResult<T> = {
  success: true;
  data: T;
  error?: undefined;
};

type ErrorResult = {
  success: false;
  error: string;
};

type ListResult<T> = SuccessResult<T[]> | (ErrorResult & { data: T[] });
type ItemResult<T> = SuccessResult<T> | ErrorResult;

type PendingGenerationResult =
  | SuccessResult<{
      userMessage: ProjectMessageItem;
      assistantMessage: ProjectMessageItem;
    }>
  | ErrorResult;

type MutationResult = {
  success: boolean;
  error?: string;
};

type TogglePinResult =
  | {
      success: true;
      isPinned: boolean;
      error?: undefined;
    }
  | ErrorResult;

type MessageStatusResult =
  | SuccessResult<MessageStatusItem | null>
  | ErrorResult;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}

async function safeRequest<T extends { success: boolean; error?: string }>(
  input: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    return await requestJson<T>(input, init);
  } catch (error) {
    return {
      ...fallback,
      error: getErrorMessage(error),
    };
  }
}

export async function fetchConversationInitData(
  requestedProjectId?: string | null,
  options?: { mode?: ConversationInitMode }
): Promise<
  | SuccessResult<ConversationInitData>
  | (ErrorResult & { data: ConversationInitData })
> {
  return safeRequest(
    '/api/image/conversation-init',
    {
      success: false,
      error: '加载数据失败',
      data: {
        projects: [],
        messages: [],
        currentProjectId: null,
      },
    },
    {
      method: 'POST',
      body: JSON.stringify({
        requestedProjectId,
        mode: options?.mode,
      }),
    }
  );
}

export async function fetchProjectMessages(
  projectId: string
): Promise<ListResult<ProjectMessageItem>> {
  const url = new URL('/api/image/messages', window.location.origin);
  url.searchParams.set('projectId', projectId);

  return safeRequest(url.toString(), {
    success: false,
    error: '获取消息失败',
    data: [],
  });
}

export async function fetchMessageStatus(
  projectId: string,
  messageId: string
): Promise<MessageStatusResult> {
  const url = new URL('/api/image/messages/status', window.location.origin);
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('messageId', messageId);

  return safeRequest(url.toString(), {
    success: false,
    error: '获取消息状态失败',
  });
}

export async function createImageProjectRequest(
  data?: CreateImageProjectInput
): Promise<ItemResult<ImageProjectItem>> {
  return safeRequest(
    '/api/image/projects',
    {
      success: false,
      error: '创建项目失败',
    },
    {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }
  );
}

export async function updateImageProjectRequest(
  projectId: string,
  data: UpdateImageProjectInput
): Promise<MutationResult> {
  return safeRequest(
    '/api/image/projects/actions',
    {
      success: false,
      error: '更新项目失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        projectId,
        data,
      }),
    }
  );
}

export async function toggleProjectPinRequest(
  projectId: string
): Promise<TogglePinResult> {
  return safeRequest(
    '/api/image/projects/actions',
    {
      success: false,
      error: '更新失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle-pin',
        projectId,
      }),
    }
  );
}

export async function archiveProjectRequest(
  projectId: string
): Promise<MutationResult> {
  return safeRequest(
    '/api/image/projects/actions',
    {
      success: false,
      error: '归档失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'archive',
        projectId,
      }),
    }
  );
}

export async function deleteImageProjectRequest(
  projectId: string
): Promise<MutationResult> {
  return safeRequest(
    '/api/image/projects/actions',
    {
      success: false,
      error: '删除失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        projectId,
      }),
    }
  );
}

export async function createPendingGenerationRequest(
  projectId: string,
  data: {
    content: string;
    inputImages?: string[];
    generationParams: GenerationParams;
  }
): Promise<PendingGenerationResult> {
  return safeRequest(
    '/api/image/messages',
    {
      success: false,
      error: '创建生成任务失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'create-pending-generation',
        projectId,
        data,
      }),
    }
  );
}

export async function updateAssistantMessageRequest(
  messageId: string,
  data: {
    content?: string;
    outputImage?: null;
    creditsUsed?: null;
    generationTime?: null;
    status?: 'generating' | 'failed';
    errorMessage?: string | null;
  }
): Promise<ItemResult<ProjectMessageItem | null>> {
  return safeRequest(
    '/api/image/messages',
    {
      success: false,
      error: '更新消息失败',
    },
    {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'update-assistant-message',
        messageId,
        data,
      }),
    }
  );
}
