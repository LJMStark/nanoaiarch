import {
  archiveProject,
  deleteImageProject,
  toggleProjectPin,
  updateImageProject,
} from '@/actions/image-project';
import type { UpdateImageProjectInput } from '@/ai/image/lib/workspace-types';
import { createResultResponse } from '@/app/api/_utils/result-response';

type ActionBody =
  | {
      action: 'update';
      projectId: string;
      data: UpdateImageProjectInput;
    }
  | {
      action: 'toggle-pin' | 'archive' | 'delete';
      projectId: string;
    };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionBody;

    if (!body.projectId) {
      return createResultResponse({
        success: false,
        error: 'Project not found',
      });
    }

    switch (body.action) {
      case 'update':
        return createResultResponse(
          await updateImageProject(body.projectId, body.data)
        );
      case 'toggle-pin':
        return createResultResponse(await toggleProjectPin(body.projectId));
      case 'archive':
        return createResultResponse(await archiveProject(body.projectId));
      case 'delete':
        return createResultResponse(await deleteImageProject(body.projectId));
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
