import { logger } from '@/lib/logger';
import { uploadFile } from '@/storage';

/**
 * Upload a generated image to object storage
 * Returns the URL of the uploaded image
 */
export async function uploadGeneratedImage(
  base64: string,
  projectId: string,
  messageId: string
): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const filename = `${messageId}-${Date.now()}.png`;
  const result = await uploadFile(
    buffer,
    filename,
    'image/png',
    `generated/${projectId}`
  );
  logger.ai.info(`[ImageStorage] Uploaded generated image: ${result.url}`);
  return result.url;
}
