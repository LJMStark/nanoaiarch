import { getGenerationHistory } from '@/actions/generation-history';
import { createResultResponse } from '@/app/api/_utils/result-response';

function parseNonNegativeInteger(
  value: string | null
): number | undefined | null {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseNonNegativeInteger(url.searchParams.get('limit'));
  const offset = parseNonNegativeInteger(url.searchParams.get('offset'));
  const favoritesOnly = url.searchParams.get('favoritesOnly') === '1';

  if (limit === null || offset === null) {
    return createResultResponse({
      success: false,
      error: 'Invalid pagination params',
      data: [],
    });
  }

  return createResultResponse(
    await getGenerationHistory({
      limit,
      offset,
      favoritesOnly,
    })
  );
}
