import type { AspectRatioId } from './arch-types';

const CSS_ASPECT_RATIOS: Record<AspectRatioId, string> = {
  auto: '1 / 1',
  '1:1': '1 / 1',
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '3:4': '3 / 4',
  '9:16': '9 / 16',
};

function isAspectRatioId(value: unknown): value is AspectRatioId {
  return typeof value === 'string' && value in CSS_ASPECT_RATIOS;
}

export function getGenerationAspectRatioId(
  generationParams: string | null
): AspectRatioId {
  if (!generationParams) {
    return 'auto';
  }

  try {
    const parsed = JSON.parse(generationParams) as { aspectRatio?: unknown };
    return isAspectRatioId(parsed.aspectRatio) ? parsed.aspectRatio : 'auto';
  } catch {
    return 'auto';
  }
}

export function getGenerationCssAspectRatio(
  generationParams: string | null
): string {
  return CSS_ASPECT_RATIOS[getGenerationAspectRatioId(generationParams)];
}
