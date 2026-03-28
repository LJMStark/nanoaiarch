import { createImageProject } from '@/actions/image-project';
import type { CreateImageProjectInput } from '@/ai/image/lib/workspace-types';
import { createResultResponse } from '@/app/api/_utils/result-response';

async function readCreateProjectInput(
  request: Request
): Promise<CreateImageProjectInput | null | undefined> {
  const bodyText = await request.text();

  if (!bodyText) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as CreateImageProjectInput;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readCreateProjectInput(request);

  if (body === null) {
    return createResultResponse({
      success: false,
      error: 'Invalid request body',
    });
  }

  const result = await createImageProject(body);
  return createResultResponse(result);
}
