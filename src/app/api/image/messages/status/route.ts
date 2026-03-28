import { getMessageStatus } from '@/actions/project-message';
import { createResultResponse } from '@/app/api/_utils/result-response';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const messageId = url.searchParams.get('messageId');

  if (!projectId || !messageId) {
    return createResultResponse({
      success: false,
      error: 'Message not found',
    });
  }

  return createResultResponse(await getMessageStatus(projectId, messageId));
}
