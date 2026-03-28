import {
  deleteGeneration,
  toggleFavorite,
  togglePublic,
} from '@/actions/generation-history';
import { createResultResponse } from '@/app/api/_utils/result-response';

type ActionBody = {
  action: 'toggle-favorite' | 'toggle-public' | 'delete';
  generationId: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;

    if (!body.generationId) {
      return createResultResponse({
        success: false,
        error: 'Generation not found',
      });
    }

    switch (body.action) {
      case 'toggle-favorite':
        return createResultResponse(await toggleFavorite(body.generationId));
      case 'toggle-public':
        return createResultResponse(await togglePublic(body.generationId));
      case 'delete':
        return createResultResponse(await deleteGeneration(body.generationId));
      default:
        return createResultResponse({
          success: false,
          error: 'Invalid action',
        });
    }
  } catch {
    return createResultResponse({
      success: false,
      error: 'Invalid request body',
    });
  }
}
