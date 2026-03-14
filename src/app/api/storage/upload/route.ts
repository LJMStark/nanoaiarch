import { MAX_FILE_SIZE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { getSession } from '@/lib/server';
import { uploadFile } from '@/storage';
import {
  ALLOWED_STORAGE_MIME_TYPES,
  resolveSafeUploadFilename,
  sanitizeStorageFolder,
} from '@/storage/sanitize';
import { StorageError } from '@/storage/types';
import { type NextRequest, NextResponse } from 'next/server';

function createUploadErrorResponse(
  error: string,
  status: number,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    { error },
    {
      status,
      headers,
    }
  );
}

function validateUploadedFile(file: File | null): string | null {
  if (!file) {
    return 'No file provided';
  }

  if (file.size > MAX_FILE_SIZE) {
    logger.api.warn('uploadFile, file size exceeds the server limit', {
      size: file.size,
      maxSize: MAX_FILE_SIZE,
    });
    return 'File size exceeds the server limit';
  }

  if (
    !ALLOWED_STORAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_STORAGE_MIME_TYPES)[number]
    )
  ) {
    logger.api.warn('uploadFile, file type not supported', {
      type: file.type,
    });
    return 'File type not supported';
  }

  return null;
}

function resolveScopedFolder(
  userId: string,
  folder: string | null
): string | null {
  const safeFolder = sanitizeStorageFolder(folder);

  if (folder && !safeFolder) {
    return null;
  }

  if (safeFolder) {
    return `users/${userId}/${safeFolder}`;
  }

  return `users/${userId}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return createUploadErrorResponse('Unauthorized', 401);
    }

    const rateLimitResult = applyRateLimit({
      key: `storage-upload:${session.user.id}:${getRateLimitIdentifier(request.headers, session.user.id)}`,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.success) {
      return createUploadErrorResponse(
        'Too many upload requests. Please try again later.',
        429,
        getRateLimitHeaders(rateLimitResult)
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;
    const validationError = validateUploadedFile(file);

    if (validationError) {
      return createUploadErrorResponse(validationError, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const scopedFolder = resolveScopedFolder(session.user.id, folder);

    if (!scopedFolder) {
      return createUploadErrorResponse('Invalid upload folder', 400);
    }

    const safeFilename = resolveSafeUploadFilename(file.name, file.type);
    const result = await uploadFile(
      buffer,
      safeFilename,
      file.type,
      scopedFolder
    );

    logger.api.debug('uploadFile, result', { result });
    return NextResponse.json(result, {
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    logger.api.error('Error uploading file:', error);

    if (error instanceof StorageError) {
      return createUploadErrorResponse(error.message, 500);
    }

    return createUploadErrorResponse(
      'Something went wrong while uploading the file',
      500
    );
  }
}

// Note: Body size limit is configured via experimental.serverActions.bodySizeLimit in next.config.ts
// Route timeout can be configured using maxDuration route segment config if needed
export const maxDuration = 30; // 30 seconds timeout
