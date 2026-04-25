import {
  archiveProject,
  deleteImageProject,
  toggleProjectPin,
  updateImageProject,
} from '@/actions/image-project';
import { MAX_IMAGE_PAYLOAD_CHARS } from '@/ai/image/lib/api-utils';
import { createResultResponse } from '@/app/api/_utils/result-response';
import { z } from 'zod';

const MAX_PROJECT_ACTION_BODY_BYTES = 16 * 1024 * 1024;

const UpdateProjectActionSchema = z.object({
  action: z.literal('update'),
  projectId: z.string().min(1),
  data: z
    .object({
      title: z.string().min(1).max(120).optional(),
      coverImage: z.string().min(1).max(MAX_IMAGE_PAYLOAD_CHARS).optional(),
      stylePreset: z.string().min(1).max(80).optional(),
      aspectRatio: z.string().min(1).max(20).optional(),
      model: z.string().min(1).max(80).optional(),
    })
    .strict(),
});

const ProjectMutationActionSchema = z.object({
  action: z.enum(['toggle-pin', 'archive', 'delete']),
  projectId: z.string().min(1),
});

const ActionBodySchema = z.union([
  UpdateProjectActionSchema,
  ProjectMutationActionSchema,
]);

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PROJECT_ACTION_BODY_BYTES) {
    throw new Error('Request body too large');
  }

  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_PROJECT_ACTION_BODY_BYTES) {
    throw new Error('Request body too large');
  }

  return JSON.parse(bodyText);
}

export async function POST(request: Request) {
  try {
    const parsed = ActionBodySchema.safeParse(await readLimitedJson(request));

    if (!parsed.success) {
      return createResultResponse({
        success: false,
        error: 'Invalid request body',
      });
    }

    const body = parsed.data;

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
  } catch (error) {
    return createResultResponse({
      success: false,
      error:
        error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid request body',
    });
  }
}
