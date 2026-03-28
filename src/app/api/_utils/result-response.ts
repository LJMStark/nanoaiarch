import { NextResponse } from 'next/server';

function getStatusCode(error?: string): number {
  if (!error) {
    return 400;
  }

  if (error === 'Unauthorized') {
    return 401;
  }

  if (/not found/i.test(error)) {
    return 404;
  }

  return 400;
}

export function createResultResponse<
  T extends { success: boolean; error?: string },
>(result: T) {
  return NextResponse.json(result, {
    status: result.success ? 200 : getStatusCode(result.error),
  });
}
