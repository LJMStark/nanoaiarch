import { MAX_FILE_SIZE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { uploadFile } from '@/storage';
import { StorageError } from '@/storage/types';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      logger.api.warn('uploadFile, file size exceeds the server limit', {
        size: file.size,
        maxSize: MAX_FILE_SIZE,
      });
      return NextResponse.json(
        { error: 'File size exceeds the server limit' },
        { status: 400 }
      );
    }

    // Validate file type (optional, based on your requirements)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      logger.api.warn('uploadFile, file type not supported', {
        type: file.type,
      });
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to storage
    const result = await uploadFile(
      buffer,
      file.name,
      file.type,
      folder || undefined
    );

    logger.api.debug('uploadFile, result', { result });
    return NextResponse.json(result);
  } catch (error) {
    logger.api.error('Error uploading file:', error);

    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Something went wrong while uploading the file' },
      { status: 500 }
    );
  }
}

// Note: Body size limit is configured via experimental.serverActions.bodySizeLimit in next.config.ts
// Route timeout can be configured using maxDuration route segment config if needed
export const maxDuration = 30; // 30 seconds timeout
