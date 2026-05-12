import { NextResponse } from 'next/server';

function getStatusCode(error?: string): number {
  if (!error) {
    return 400;
  }

  if (error === '未授权访问') {
    return 401;
  }

  if (/not found/i.test(error) || /不存在|未找到/.test(error)) {
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
