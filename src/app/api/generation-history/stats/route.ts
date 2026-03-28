import { getGenerationStats } from '@/actions/generation-history';
import { createResultResponse } from '@/app/api/_utils/result-response';

export async function GET() {
  return createResultResponse(await getGenerationStats());
}
