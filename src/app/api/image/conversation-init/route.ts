import { getConversationInitData } from '@/actions/conversation-data';
import type { ConversationInitMode } from '@/ai/image/lib/workspace-types';
import { createResultResponse } from '@/app/api/_utils/result-response';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      requestedProjectId?: string | null;
      mode?: ConversationInitMode;
    };

    const result = await getConversationInitData(body.requestedProjectId, {
      mode: body.mode,
    });

    return createResultResponse(result);
  } catch {
    return createResultResponse({
      success: false,
      error: 'Invalid request body',
      data: {
        projects: [],
        messages: [],
        currentProjectId: null,
      },
    });
  }
}
