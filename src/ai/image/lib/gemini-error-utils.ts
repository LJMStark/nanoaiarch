const GEMINI_LOCATION_UNSUPPORTED_SNIPPET =
  'User location is not supported for the API use.';

export function isGeminiLocationUnsupported(errorText: string): boolean {
  return errorText.includes(GEMINI_LOCATION_UNSUPPORTED_SNIPPET);
}

export function getGeminiApiErrorMessage(
  status: number,
  errorText: string
): string {
  if (isGeminiLocationUnsupported(errorText)) {
    return '当前服务器所在地区不支持 Gemini API，请切换到受支持地区部署或更换模型';
  }

  return `Gemini API 错误 (${status})，请稍后重试`;
}
