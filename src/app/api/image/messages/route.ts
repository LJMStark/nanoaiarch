import {
  createPendingGeneration,
  getProjectMessages,
  updateAssistantMessage,
} from '@/actions/project-message';
import type { GenerationParams } from '@/ai/image/lib/workspace-types';
import { createResultResponse } from '@/app/api/_utils/result-response';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return createResultResponse({
      success: false,
      error: 'Project not found',
      data: [],
    });
  }

  return createResultResponse(await getProjectMessages(projectId));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'create-pending-generation';
      projectId: string;
      data: {
        content: string;
        inputImages?: string[];
        generationParams: GenerationParams;
      };
    };

    if (body.action !== 'create-pending-generation') {
      return createResultResponse({
        success: false,
        error: 'Invalid action',
      });
    }

    return createResultResponse(
      await createPendingGeneration(body.projectId, body.data)
    );
  } catch {
    return createResultResponse({
      success: false,
      error: 'Invalid request body',
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'update-assistant-message';
      messageId: string;
      data: {
        content?: string;
        outputImage?: string | null;
        generationParams?: GenerationParams;
        creditsUsed?: number | null;
        generationTime?: number | null;
        status?: 'generating' | 'completed' | 'failed';
        errorMessage?: string | null;
      };
    };

    if (body.action !== 'update-assistant-message') {
      return createResultResponse({
        success: false,
        error: 'Invalid action',
      });
    }

    return createResultResponse(
      await updateAssistantMessage(body.messageId, body.data)
    );
  } catch {
    return createResultResponse({
      success: false,
      error: 'Invalid request body',
    });
  }
}
