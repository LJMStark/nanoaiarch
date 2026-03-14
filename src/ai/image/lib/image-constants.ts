// Shared image quality constants - safe to import from both server and client
export type ImageQuality = '1K' | '2K' | '4K';

export const DEFAULT_IMAGE_QUALITY: ImageQuality = '1K';

export const VALID_IMAGE_SIZES: readonly ImageQuality[] = ['1K', '2K', '4K'];
