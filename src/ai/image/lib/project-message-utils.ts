import { parseStoredInputImages } from '@/ai/image/lib/input-images';
import type {
  MessageRole,
  ProjectMessageItem,
} from '@/ai/image/lib/workspace-types';

type ProjectMessageRecord = {
  id: string;
  projectId: string;
  role: string;
  content: string;
  inputImage: string | null;
  inputImages: string | null;
  outputImage: string | null;
  maskImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: Date;
};

export function hydrateProjectMessage(
  message: ProjectMessageRecord
): ProjectMessageItem {
  const inputImages = parseStoredInputImages(
    message.inputImages,
    message.inputImage
  );

  return {
    ...message,
    role: message.role as MessageRole,
    inputImage: inputImages[0] ?? null,
    inputImages,
  };
}
