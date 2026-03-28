import { requestJson } from '@/lib/request-json';
import type {
  GenerationHistoryItem,
  GenerationStats,
} from './generation-history-types';

type SuccessResult<T> = {
  success: true;
  data: T;
  error?: undefined;
};

type ErrorResult = {
  success: false;
  error: string;
};

type MutationResult = {
  success: boolean;
  error?: string;
};

type FavoriteResult =
  | {
      success: true;
      isFavorite: boolean;
      error?: undefined;
    }
  | ErrorResult;

type PublicResult =
  | {
      success: true;
      isPublic: boolean;
      error?: undefined;
    }
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

export async function fetchGenerationHistory(options?: {
  limit?: number;
  offset?: number;
  favoritesOnly?: boolean;
}): Promise<
  | SuccessResult<GenerationHistoryItem[]>
  | (ErrorResult & { data: GenerationHistoryItem[] })
> {
  const url = new URL('/api/generation-history', window.location.origin);
  if (options?.limit !== undefined) {
    url.searchParams.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    url.searchParams.set('offset', String(options.offset));
  }
  if (options?.favoritesOnly) {
    url.searchParams.set('favoritesOnly', '1');
  }

  return safeRequest(url.toString(), {
    success: false,
    error: '获取历史记录失败',
    data: [],
  });
}

export async function fetchGenerationStats(): Promise<
  SuccessResult<GenerationStats> | ErrorResult
> {
  return safeRequest('/api/generation-history/stats', {
    success: false,
    error: '获取统计数据失败',
  });
}

export async function toggleFavoriteRequest(
  generationId: string
): Promise<FavoriteResult> {
  return safeRequest(
    '/api/generation-history/actions',
    {
      success: false,
      error: '更新失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle-favorite',
        generationId,
      }),
    }
  );
}

export async function togglePublicRequest(
  generationId: string
): Promise<PublicResult> {
  return safeRequest(
    '/api/generation-history/actions',
    {
      success: false,
      error: '更新失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle-public',
        generationId,
      }),
    }
  );
}

export async function deleteGenerationRequest(
  generationId: string
): Promise<MutationResult> {
  return safeRequest(
    '/api/generation-history/actions',
    {
      success: false,
      error: '删除失败',
    },
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        generationId,
      }),
    }
  );
}
